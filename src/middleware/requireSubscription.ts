import { prisma } from '../shared/libs/prisma'
import type { AuthenticatedRequest } from '../shared/utils/controller.types'
import type { RequestHandler } from 'express'
import createError from 'http-errors'

export const requireSubscription: RequestHandler = async (req, _res, next) => {
  const typedReq = req as unknown as AuthenticatedRequest
  const userId = typedReq.user?.id

  if (!userId) {
    return next(createError(401, 'Unauthorized', { code: 'AUTH_REQUIRED' }))
  }

  const now = new Date()
  const subscription = await prisma.subscription.findFirst({
    where: {
      currentPeriodEnd: { gt: now },
      status: { in: ['ACTIVE', 'TRIALING'] },
      userId,
    },
  })

  // If the user has an active (or trialing) subscription, mark and proceed immediately
  if (subscription) {
    ;(req as any).isSubscriber = true
    return next()
  }

  // ─────────────────────────────────────────────────────────────
  // Free-tier allowance: max 5 AI reply generations
  // ─────────────────────────────────────────────────────────────
  const user = (await prisma.user.findUnique({
    where: { id: userId },
  })) as null | { freeRequestsUsed: number }

  if (!user) {
    return next(createError(401, 'Unauthorized', { code: 'AUTH_REQUIRED' }))
  }

  if (user.freeRequestsUsed < 5) {
    // Atomically increment the counter then continue
    await prisma.user.update({
      data: { freeRequestsUsed: { increment: 1 } },
      where: { id: userId },
    })

    return next()
  }

  return next(createError(402, 'Free quota exceeded', { code: 'PAYMENT_REQUIRED' }))
}
