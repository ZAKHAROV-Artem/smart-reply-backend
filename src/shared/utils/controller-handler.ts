import { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { requireEnv } from '../utils/env'
import { prisma } from '../libs/prisma'
import { AuthenticatedController, AuthenticatedRequest, Controller, ControllerRequest } from './controller.types'
import createError from 'http-errors'

export const controllerHandler = <TReq = {}, TRes = unknown>(fn: Controller<TReq, TRes>): RequestHandler => {
  return async (req, res, next) => {
    try {
      await fn(req as ControllerRequest<TReq>, res, next)
    } catch (error) {
      next(error)
    }
  }
}

export const authenticatedControllerHandler = <TReq = {}, TRes = unknown>(
  fn: AuthenticatedController<TReq, TRes>,
): RequestHandler => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        // Attempt graceful recovery: extract JWT from Authorization header
        const authHeader = req.headers?.authorization || req.get?.('Authorization') || ''
        const match = authHeader.match(/^Bearer\s+(.+)$/i)
        const token = match?.[1]

        if (token) {
          try {
            const JWT_SECRET = requireEnv('JWT_SECRET')
            const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
            const user = await prisma.user.findUnique({ where: { id: payload.userId } })
            if (user) {
              ;(req as any).user = user
            }
          } catch {
            /* ignore – will throw below */
          }
        }

        if (!req.user) {
          throw createError(401, 'Authentication required', { code: 'AUTH_REQUIRED' })
        }
      }
      await fn(req as AuthenticatedRequest<TReq>, res, next)
    } catch (error) {
      next(error)
    }
  }
}
