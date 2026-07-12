import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { ApiError } from "../utils/ApiError.util";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log("cookie:", req.headers.cookie);
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    throw new ApiError(401, "Invalid or expired login", "Unauthorized");
  }
  res.locals.session = session.session;
  res.locals.user = session.user;
  next();
};
