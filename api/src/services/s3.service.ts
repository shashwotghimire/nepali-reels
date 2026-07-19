import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

export const s3 = new S3Client({
  region: process.env.AWS_s3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3 = async (file: Express.Multer.File) => {
  const extension = path.extname(file.originalname);
  const fileKey = `uploads/${crypto.randomUUID()}${extension}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_s3_BUCKET!,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  return {
    key: fileKey,
    // bucket: process.env.AWS_S3_BUCKET!,
  };
};

export const getS3PresignedUrl = async (key: string, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ResponseContentDisposition: "inline",
  });
  return getSignedUrl(s3, command, { expiresIn });
};

export const deleteFromS3 = async (key: string) => {
  const data = await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_s3_BUCKET!,
      Key: key,
    }),
  );
  return data;
};
