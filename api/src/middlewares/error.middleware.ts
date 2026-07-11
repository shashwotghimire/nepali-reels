import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.util";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err);
  let statusCode = 500;
  let message = "Error processing request";
  let error = "Internal server error";
  let validationError: any = undefined;

  if (err instanceof Error && err.message.startsWith("Unsupported file type")) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: "INVALID_FILE_TYPE",
    });
  }

  if (err instanceof ZodError) {
    statusCode = 400;
    return res.status(statusCode).json({
      success: false,
      error: "Validation Error, invalid request payload",
      message: "Invalid data",
      validationError: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.error,
      ...(err.validationError && { validationErrors: err.validationError }),
    });
  }

  //500 for anything else
  return res.status(500).json({
    success: false,
    message: "Error processing request",
    error: "Internal server error",
  });
};
