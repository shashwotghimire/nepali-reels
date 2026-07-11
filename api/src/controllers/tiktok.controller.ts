import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { buildAuthUrl, exchangeCodeForToken } from "../services/tiktok.service";
import { ApiResponse } from "../utils/ApiResponse.util";
import { ApiError } from "../utils/ApiError.util";
import { STATE_COOKIE } from "../constants/constant";

export const connectTiktok = asyncHandler(
  async (req: Request, res: Response) => {
    const { url, state } = buildAuthUrl();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      signed: true,
    });
    // res.redirect(url)
    res.status(200).json(new ApiResponse(true, "Connection initiated!", url));
  },
);

export const tiktokCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    const cookieState = req.signedCookies[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);
    if (error) {
      throw new ApiError(
        400,
        `TikTok OAuth error: ${error}`,
        "TIKTOK_OAUTH_ERROR",
      );
    }
    if (!cookieState || cookieState !== state) {
      throw new ApiError(
        403,
        "Invalid or missing OAuth state",
        "INVALID_STATE",
      );
    }
    const tokenData = await exchangeCodeForToken(code as string);
    res.status(200).json(new ApiResponse(true, "Tiktok connected!", tokenData));
  },
);
