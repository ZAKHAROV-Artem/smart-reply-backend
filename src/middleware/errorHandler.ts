import { Request, Response, NextFunction } from 'express'
import { AppError } from '../shared/utils/app-error'
import { HttpError } from 'http-errors'

export default function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Avoid noisy stack traces in production – uncomment for debugging
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err)
  }

  let status = 500
  let code = 'UNKNOWN'
  let message = 'Something went wrong'
  let details: any

  if (err instanceof AppError) {
    status = err.status
    code = err.code
    message = err.message
    details = err.details
  } else if (err instanceof HttpError) {
    status = (err as any).status || (err as any).statusCode || 500
    code = (err as any).code || err.name?.toUpperCase?.() || 'HTTP_ERROR'
    message = err.message
    details = (err as any).details
  } else if ((err as any)?.name === 'UnauthorizedError') {
    status = 401
    code = 'AUTH_ERROR'
    message = 'Unauthorized'
  } else if ((err as any)?.status === 400 && (err as any)?.type === 'entity.parse.failed') {
    status = 400
    code = 'BAD_JSON'
    message = 'Invalid JSON payload'
  } else if (err instanceof Error) {
    message = err.message
  }

  const payload: any = { success: false, error: { code, message } }
  if (details !== undefined) payload.error.details = details

  res.status(status).json(payload)
}
