import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { requireEnv } from '../../shared/utils/env'

import { sendOtpEmail } from '../../shared/libs/mailer'
import { prisma } from '../../shared/libs/prisma'
import createError from 'http-errors'

const JWT_SECRET = requireEnv('JWT_SECRET')
const JWT_EXPIRES_IN = '15m'

// Refresh-token settings
const REFRESH_TOKEN_EXPIRY_DAYS = 30
const MAX_REFRESH_TOKENS_PER_USER = 5

class AuthService {
  /* -------------------------------------------------------
    OTP Sign-up / Login
  ------------------------------------------------------- */

  /** Verify an incoming refresh token, rotate it and issue new access token */
  public async refreshTokens(rawToken: string) {
    // Retrieve all active tokens (could optimise with search on recent window)
    const candidates = await prisma.refreshToken.findMany({
      include: { user: true },
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    })

    for (const record of candidates) {
      const valid = await bcrypt.compare(rawToken, record.tokenHash)
      if (!valid) continue

      // Revoke old
      await prisma.refreshToken.update({
        data: { revokedAt: new Date() },
        where: { id: record.id },
      })

      // Issue replacements
      const newRefresh = await this.createRefreshToken(record.userId)
      const newAccess = this.signToken(record.userId, record.user.email)

      return {
        refreshToken: newRefresh,
        token: newAccess,
        user: { email: record.user.email, id: record.user.id, name: record.user.name },
      }
    }

    throw createError(401, 'Invalid refresh token', { code: 'INVALID_REFRESH_TOKEN' })
  }

  /** Revoke a single refresh token */
  public async revokeRefreshToken(rawToken: string) {
    const candidates = await prisma.refreshToken.findMany({
      where: { revokedAt: null },
    })

    for (const record of candidates) {
      const valid = await bcrypt.compare(rawToken, record.tokenHash)
      if (valid) {
        await prisma.refreshToken.update({
          data: { revokedAt: new Date() },
          where: { id: record.id },
        })
        return
      }
    }
  }

  /**
   * Generate and e-mail an OTP to the user. Creates the user if they don’t exist yet.
   */
  public async sendOtp(email: string, name?: string) {
    // Normalise e-mail to avoid case/whitespace mismatches
    const normalizedEmail = email.trim().toLowerCase()

    // Six-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Hash for secure storage
    const otpHash = await bcrypt.hash(code, 10)
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          emailVerified: false,
          name: name ?? null,
          otpExpiresAt: expires,
          otpHash,
        },
      })
    } else {
      await prisma.user.update({
        data: {
          emailVerified: false,
          otpExpiresAt: expires,
          otpHash,
        },
        where: { id: user.id },
      })
    }

    // Send e-mail
    await sendOtpEmail(normalizedEmail, code)

    return { message: 'OTP sent' }
  }

  /**
   * Update the user’s e-mail address and issue a fresh JWT.
   */
  public async updateEmail(userId: string, newEmail: string) {
    // Ensure the e-mail isn’t already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing && existing.id !== userId) {
      throw createError(409, 'E-mail already in use', { code: 'EMAIL_IN_USE' })
    }

    const user = await prisma.user.update({
      data: { email: newEmail },
      where: { id: userId },
    })

    const token = this.signToken(user.id, user.email)
    // No refresh-token rotation needed here (user still has one via cookie)
    return { token, user: { email: user.email, id: user.id, name: user.name } }
  }

  // createGuest method removed – guest accounts no longer supported

  /* -------------------------------------------------------
    Refresh-token helpers
  ------------------------------------------------------- */

  /** Verify the OTP and issue JWT */
  public async verifyOtp(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw createError(400, 'No OTP requested', { code: 'NO_OTP' })
    }

    if (user.otpExpiresAt < new Date()) {
      throw createError(400, 'OTP expired', { code: 'OTP_EXPIRED' })
    }

    const valid = await bcrypt.compare(code, user.otpHash)
    if (!valid) {
      throw createError(400, 'Invalid code', { code: 'INVALID_OTP_CODE' })
    }

    await prisma.user.update({
      data: {
        emailVerified: true,
        otpExpiresAt: null,
        otpHash: null,
        policiesAcceptedAt: user.policiesAcceptedAt ?? new Date(),
      },
      where: { id: user.id },
    })

    const token = this.signToken(user.id, user.email)
    const refreshToken = await this.createRefreshToken(user.id)
    return {
      refreshToken,
      token,
      user: { email: user.email, id: user.id, name: user.name },
    }
  }

  /** Generate and persist a new refresh token for the user */
  private async createRefreshToken(userId: string) {
    const token = crypto.randomBytes(64).toString('hex')
    const tokenHash = await bcrypt.hash(token, 10)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({
      data: { expiresAt, tokenHash, userId },
    })

    // Enforce token limit (LRU pruning)
    const total = await prisma.refreshToken.count({ where: { userId } })
    if (total > MAX_REFRESH_TOKENS_PER_USER) {
      const surplus = await prisma.refreshToken.findMany({
        orderBy: { createdAt: 'asc' },
        take: total - MAX_REFRESH_TOKENS_PER_USER,
        where: { userId },
      })
      await prisma.refreshToken.deleteMany({
        where: { id: { in: surplus.map((t: { id: string }) => t.id) } },
      })
    }

    return token
  }

  private signToken(userId: string, email: string) {
    return jwt.sign({ email, userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  }
}

export const authService = new AuthService()
