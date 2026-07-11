import { NextFunction, Request, Response, RequestHandler } from "express";

const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req, res, next) => {
    return Promise.resolve(fn(req as T, res, next)).catch(next);
  };
};

export default asyncHandler;
