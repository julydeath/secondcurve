import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler =
  (
    handler: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<unknown> | void
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
