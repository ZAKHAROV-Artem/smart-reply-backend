/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from 'stripe'
import createError from 'http-errors'

import { prisma } from '../../shared/libs/prisma'
import { requireEnv } from '../../shared/utils/env'

const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
})

class BillingService {
  /* -------------------------------------------------------
    CHECKOUT & PORTAL
  ------------------------------------------------------- */
  public async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw createError(404, 'User not found', { code: 'USER_NOT_FOUND' })

    // Ensure we have a Stripe customer
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email })
      customerId = customer.id
      await prisma.user.update({
        data: { stripeCustomerId: customerId },
        where: { id: userId },
      })
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: this.toStripeCompatibleUrl(cancelUrl),
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID ?? '',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: this.toStripeCompatibleUrl(successUrl),
    })

    return session.url
  }

  /* -------------------------------------------------------
    GIFT SUBSCRIPTION
  ------------------------------------------------------- */
  public async createGiftCheckoutSession(
    giverUserId: string,
    recipientEmail: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    // Ensure giver exists
    const giver = await prisma.user.findUnique({ where: { id: giverUserId } })
    if (!giver) throw createError(404, 'User not found', { code: 'USER_NOT_FOUND' })

    // Use giver as customer for payment
    let customerId = giver.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: giver.email })
      customerId = customer.id
      await prisma.user.update({
        data: { stripeCustomerId: customerId },
        where: { id: giverUserId },
      })
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: this.toStripeCompatibleUrl(cancelUrl),
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID ?? '',
          quantity: 1,
        },
      ],
      metadata: {
        giftFor: recipientEmail,
      },
      mode: 'subscription',
      success_url: this.toStripeCompatibleUrl(successUrl),
    })

    return session.url
  }

  public async createPortalSession(userId: string, returnUrl: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.stripeCustomerId) throw createError(400, 'No Stripe customer', { code: 'NO_STRIPE_CUSTOMER' })

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    })

    return session.url
  }

  /* -------------------------------------------------------
    USAGE-BASED BILLING
  ------------------------------------------------------- */
  public async createUsagePlanCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw createError(404, 'User not found', { code: 'USER_NOT_FOUND' })

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email })
      customerId = customer.id
      await prisma.user.update({ data: { stripeCustomerId: customerId }, where: { id: userId } })
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: this.toStripeCompatibleUrl(cancelUrl),
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_USAGE_PRICE_ID ?? '',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: this.toStripeCompatibleUrl(successUrl),
    })

    return session.url
  }

  public async getCurrentUsage(userId: string) {
    const now = new Date()
    // @ts-ignore tokenUsage pending prisma generate
    const usage = (await prisma.tokenUsage.findFirst({
      where: {
        userId,
        periodEnd: { gt: now },
        periodStart: { lte: now },
      },
    })) as any

    return {
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      totalCostUsd: usage?.totalCostUsd ?? 0,
    }
  }

  /* -------------------------------------------------------
    WEBHOOK HANDLER
  ------------------------------------------------------- */
  public async handleWebhook(signature: string | string[] | undefined, body: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature ?? '', webhookSecret)
    } catch (err) {
      throw createError(400, `Webhook signature verification failed: ${(err as Error).message}`, {
        code: 'INVALID_SIGNATURE',
      })
    }

    // Record the event regardless of type
    const customerId = (event.data.object as any).customer as string | undefined
    if (customerId) {
      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
      if (user) {
        await prisma.paymentEvent.create({
          data: {
            amountTotal: (event.data.object as any).amount_total ?? null,
            currency: (event.data.object as any).currency ?? null,
            occurredAt: new Date(event.created * 1000),
            stripeEventId: event.id,
            type: event.type,
            user: {
              connect: { id: user.id },
            },
          },
        })
      }
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated':
        await this.syncSubscription(event.data.object as Stripe.Subscription)
        break
      default:
        break
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== 'subscription') return
    const subscriptionId = session.subscription as string
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    await this.syncSubscription(sub)
  }

  private async syncSubscription(subscription: Stripe.Subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

    const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
    if (!user) return

    await prisma.subscription.upsert({
      create: {
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        status: subscription.status.toUpperCase() as any,
        stripePriceId: subscription.items.data[0].price.id,
        stripeSubscriptionId: subscription.id,
        userId: user.id,
      },
      update: {
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        status: subscription.status.toUpperCase() as any,
      },
      where: { stripeSubscriptionId: subscription.id },
    })
  }

  /**
   * Stripe only accepts http/https success & cancel URLs. When the extension
   * provides a chrome-extension:// URL we proxy the redirect through our own
   * backend so the final hop happens in browser context instead of Stripe.
   */
  private toStripeCompatibleUrl(originalUrl: string): string {
    if (!originalUrl.startsWith('chrome-extension://')) {
      return originalUrl // already http/https – nothing to do
    }

    const baseUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'
    // The Express API is mounted under /api – keep that in the redirect path
    const redirectPath = '/api/billing/redirect?u=' + encodeURIComponent(originalUrl)
    return `${baseUrl.replace(/\/$/, '')}${redirectPath}`
  }
}

export const billingService = new BillingService()
