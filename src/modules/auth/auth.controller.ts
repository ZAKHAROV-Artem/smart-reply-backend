import { Request, Response } from 'express'

import { prisma } from '../../shared/libs/prisma'
import { authenticatedControllerHandler, controllerHandler } from '../../shared/utils/controller-handler'
import { authService } from './auth.service'

class AuthController {
  /** Logout – revoke refresh token and clear cookie */
  logout = controllerHandler(async (req, res) => {
    try {
      const refreshToken = req.cookies?.rt as string | undefined
      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken)
      }

      res.clearCookie('rt', this.cookieOptions())
      res.json({ message: 'Logged out' })
      return
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
      return
    }
  })

  me = authenticatedControllerHandler(async (req, res) => {
    const [activeSub, userRecord, usageRecord] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          // Treat any subscription that isn't cancelled or expired as active
          status: { notIn: ['CANCELED', 'INCOMPLETE_EXPIRED'] },
          userId: req.user.id,
        },
      }),
      prisma.user.findUnique({ where: { id: req.user.id } }),
      // @ts-ignore – tokenUsage will be available after prisma generate
      prisma.tokenUsage.findFirst({
        where: {
          userId: req.user.id,
          periodEnd: { gt: new Date() },
          periodStart: { lte: new Date() },
        },
      }) as any,
    ])

    const freeRequestsUsed = (userRecord as any)?.freeRequestsUsed ?? 0
    const freeRequestsRemaining = Math.max(0, 5 - freeRequestsUsed)

    const usageCost = usageRecord?.totalCostUsd ?? 0
    const costLimitUsd = 4
    const overLimit = usageCost >= costLimitUsd

    res.json({
      freeRequestsRemaining,
      hasSubscription: !!activeSub,
      usageCostUsd: usageCost,
      overLimit,
      user: req.user,
    })
    return
  })

  /** Refresh access token using refresh token cookie */
  refresh = controllerHandler(async (req, res) => {
    try {
      const refreshToken = req.cookies?.rt as string | undefined
      if (!refreshToken) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const { refreshToken: newRt, token, user } = await authService.refreshTokens(refreshToken)

      this.setRefreshCookie(res, newRt)

      res.json({ token, user })
    } catch {
      res.status(401).json({ error: 'Unauthorized' })
    }
  })

  /** Send OTP for sign-up / login */
  sendOtp = controllerHandler(async (req, res) => {
    try {
      const { email, name } = req.body as { email?: string; name?: string }
      if (!email) {
        res.status(400).json({ error: 'Email is required' })
        return
      }

      const result = await authService.sendOtp(email, name)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  /** Update the authenticated user’s email */
  updateEmail = authenticatedControllerHandler(async (req, res) => {
    try {
      const { email } = req.body as { email?: string }
      if (!email) {
        res.status(400).json({ error: 'Email is required' })
        return
      }

      const data = await authService.updateEmail(req.user!.id, email)
      res.json(data)
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  /** Verify OTP and receive JWT */
  verifyOtp = controllerHandler(async (req, res) => {
    try {
      const { code, email } = req.body as { code?: string; email?: string }
      if (!email || !code) {
        res.status(400).json({ error: 'Email and code are required' })
        return
      }

      const { refreshToken, token, user } = await authService.verifyOtp(email, code)

      this.setRefreshCookie(res, refreshToken)

      res.json({ token, user })
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  cookieOptions() {
    return {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      sameSite: 'none' as const,
      secure: true,
    }
  }

  setRefreshCookie(res: Response, token: string) {
    res.cookie('rt', token, this.cookieOptions())
  }
}

const authController = new AuthController()
export default authController
