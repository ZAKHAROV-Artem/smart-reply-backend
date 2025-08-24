import { NextFunction, Request, Response } from 'express'

export type AuthenticatedController<TReq = {}, TRes = unknown> = (
  req: AuthenticatedRequest<TReq>,
  res: ControllerResponse<TRes>,
  next: NextFunction,
) => Promise<void> | void

export type AuthenticatedRequest<T = {}> = ControllerRequest<T> & {
  user: NonNullable<Request['user']>
}

export type Controller<TReq = {}, TRes = unknown> = (
  req: ControllerRequest<TReq>,
  res: ControllerResponse<TRes>,
  next: NextFunction,
) => Promise<void> | void

export type ControllerRequest<T = {}> = Request<
  T extends { params: infer P } ? P : unknown,
  unknown,
  T extends { body: infer B } ? B : unknown,
  T extends { query: infer Q } ? Q : unknown
>

export type ControllerResponse<T = unknown> = Response<T>
