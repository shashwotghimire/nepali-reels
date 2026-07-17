import nodemailer from "nodemailer";
import "dotenv/config";

export const nodemailerConfig = nodemailer.createTransport({
  host: "smtp.resend.com",
  secure: true,
  port: 465,
  auth: {
    user: "resend",
    pass: process.env.EMAIL_PASS,
  },
});
