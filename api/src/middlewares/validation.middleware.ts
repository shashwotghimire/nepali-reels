import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validate = (schema: z.ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (e) {
      next(e);
    }
  };
};
