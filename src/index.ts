import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import 'dotenv/config'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import passport from 'passport'
import './middleware/passport'
import errorHandler from './middleware/errorHandler'
import { getEnv } from './shared/utils/env'

import { requireSubscription } from './middleware/requireSubscription'
import aiRouter from './modules/ai/ai.router'
import contextsRouter from './modules/contexts/context.router'
import authRouter from './modules/auth/auth.router'
import { billingController } from './modules/billing/billing.controller'
import billingRouter from './modules/billing/billing.router'
import { auth } from './middleware/passport'
import legalRouter from './modules/legal/legal.router'

const app = express()
const router = express.Router()
const PORT = Number(getEnv('PORT') ?? 3000)

// ─────────────────────────────────────────────────────────────
// Security & logging middleware
// ─────────────────────────────────────────────────────────────
app.use(helmet())

// Structured logging
app.use(pinoHttp())

// Basic health check
app.get('/healthz', (_, res) => {
  res.status(200).json({ status: 'ok' })
})

// Rate limiting – general default
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
app.use('/api/', apiLimiter)

// Fine-grained limiter: OTP send (to avoid email spam)
const otpLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 })
app.use('/api/auth/otp/send', otpLimiter)

// Limiter for AI endpoint (costly). Subscribers are exempt.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // Free-tier: 20 requests per minute
  keyGenerator: req => (req as any).user?.id ?? req.ip,
  skip: req => (req as any).isSubscriber === true,
})

// Stripe webhook requires the raw body, place this route before json parsing
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  Promise.resolve(billingController.webhook(req, res, next)).catch(next)
})

// parse JSON for all other routes
app.use(express.json())
app.use(cookieParser())
// CORS allow-list
const allowedOrigins = (getEnv('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // Allow non-browser requests (e.g., curl, tests)
      // Allow requests from any Chrome extension (extension IDs vary per machine)
      if (origin.startsWith('chrome-extension://')) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error('Not allowed by CORS'))
    },
  }),
)

// Register API routes
router.use('/auth', authRouter)
router.use('/billing', billingRouter)
router.use('/ai', auth, requireSubscription, aiLimiter, aiRouter)
router.use('/contexts', auth, contextsRouter)
router.use('/legal', legalRouter)

app.use('/api', router)

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

/**
 * Central error handler.
 * In v5, async errors bubble here automatically – no more wrapping in next().
 */
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`⚡ Server listening on http://localhost:${PORT}`)
})
