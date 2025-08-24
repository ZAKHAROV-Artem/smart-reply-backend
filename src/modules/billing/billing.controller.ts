import { Request, Response } from 'express'

import { billingService } from './billing.service'
import { authenticatedControllerHandler, controllerHandler } from '../../shared/utils/controller-handler'

class BillingController {
  checkout = authenticatedControllerHandler(async (req, res) => {
    const { cancelUrl, successUrl } = req.body as {
      cancelUrl?: string
      successUrl?: string
    }

    if (!successUrl || !cancelUrl) {
      res.status(400).json({ error: 'successUrl and cancelUrl are required' })
      return
    }

    const url = await billingService.createCheckoutSession(req.user!.id, successUrl, cancelUrl)

    res.json({ url })
    return
  })

  /** Create a gift subscription checkout session */
  gift = authenticatedControllerHandler(async (req, res) => {
    const { cancelUrl, recipientEmail, successUrl } = req.body as {
      cancelUrl?: string
      recipientEmail?: string
      successUrl?: string
    }

    if (!recipientEmail || !successUrl || !cancelUrl) {
      res.status(400).json({ error: 'recipientEmail, successUrl and cancelUrl are required' })
      return
    }

    const url = await billingService.createGiftCheckoutSession(req.user!.id, recipientEmail, successUrl, cancelUrl)

    res.json({ url })
    return
  })

  portal = authenticatedControllerHandler(async (req, res) => {
    const { returnUrl } = req.body as { returnUrl?: string }
    if (!returnUrl) {
      res.status(400).json({ error: 'returnUrl is required' })
      return
    }

    const url = await billingService.createPortalSession(req.user!.id, returnUrl)
    res.json({ url })
    return
  })

  /**
   * Redirect helper used after Stripe checkout. Accepts `u` query param (encoded
   * chrome-extension:// URL) and navigates the browser there. This endpoint is
   * intentionally left unauthenticated because Stripe will hit it directly.
   */
  redirect = controllerHandler(async (req, res) => {
    const encoded = ((req.query as any).u as string) ?? ''
    if (!encoded) {
      res.status(400).send('Missing u parameter')
      return
    }

    const destination = decodeURIComponent(encoded)

    // Serve a tiny HTML page performing the redirect via JS and meta refresh
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta http-equiv="refresh" content="0; url=${destination}">
          <title>Redirecting…</title>
          <style>html,body{height:100%;display:flex;align-items:center;justify-content:center;font-family:sans-serif}</style>
        </head>
        <body>
          <p>Redirecting to extension…</p>
          <script>location.replace(${JSON.stringify(destination)})</script>
        </body>
      </html>`)
  })

  /** Create usage-based billing checkout */
  usagePlan = authenticatedControllerHandler(async (req, res) => {
    const { cancelUrl, successUrl } = req.body as { cancelUrl?: string; successUrl?: string }

    if (!successUrl || !cancelUrl) {
      res.status(400).json({ error: 'successUrl and cancelUrl are required' })
      return
    }

    const url = await billingService.createUsagePlanCheckoutSession(req.user!.id, successUrl, cancelUrl)

    res.json({ url })
    return
  })

  /** Get current token usage */
  usage = authenticatedControllerHandler(async (req, res) => {
    const data = await billingService.getCurrentUsage(req.user!.id)
    res.json(data)
    return
  })

  webhook = controllerHandler(async (req, res) => {
    const signature = req.headers['stripe-signature']
    await billingService.handleWebhook(signature, req.body as Buffer)
    res.json({ received: true })
    return
  })

  /** Static success page rendered after Stripe checkout */
  checkoutSuccess = controllerHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Checkout complete</title>
          <style>body{display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f6fffa}h1{color:#16a34a}</style>
        </head>
        <body>
          <div style="text-align:center;max-width:400px;">
            <h1>🎉 Thank you!</h1>
            <p>Your subscription is now active. You can return to the extension.</p>
          </div>
        </body>
      </html>`)
  })

  /** Static cancel page rendered if Stripe checkout is cancelled */
  checkoutCancel = controllerHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Checkout cancelled</title>
          <style>body{display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fff7ed}h1{color:#d97706}</style>
        </head>
        <body>
          <div style="text-align:center;max-width:400px;">
            <h1>😕 Checkout cancelled</h1>
            <p>You can restart the upgrade process from the extension at any time.</p>
          </div>
        </body>
      </html>`)
  })
}

export const billingController = new BillingController()
