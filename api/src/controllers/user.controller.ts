import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { getUserProfileService } from "../services/user.service";

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const data = await getUserProfileService(user.id);
  return res
    .status(200)
    .json(new ApiResponse(true, "User fetched successfully", data));
});
