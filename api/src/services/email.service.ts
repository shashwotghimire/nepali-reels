import { nodemailerConfig } from "../configs/email.config";

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await nodemailerConfig.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error(e);
    throw new Error("Failed to send email");
  }
}
