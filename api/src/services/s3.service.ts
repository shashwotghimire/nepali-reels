import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";

export const s3 = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3 = async (filePath: string, pipelineId: string) => {
  const fileKey = `videos/${pipelineId}.mp4`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
      Body: fs.createReadStream(filePath),
      ContentType: "video/mp4",
    }),
  );
  console.log(
    "CDN URL being sent:",
    `${process.env.AWS_CLOUDFRONT_DOMAIN}/videos/${pipelineId}.mp4`,
  );
  return {
    key: fileKey,
    url: `${process.env.AWS_CLOUDFRONT_DOMAIN}/videos/${pipelineId}.mp4`,
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

export const uploadThumbnailToS3 = async (
  imageBuffer: Buffer,
  pipelineId: string,
) => {
  const fileKey = `thumbnails/${pipelineId}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
      Body: imageBuffer,
      ContentType: "image/jpeg",
    }),
  );
  return {
    key: fileKey,
    url: `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/thumbnails/${pipelineId}.jpg`,
  };
};

export const deleteFromS3 = async (key: string) => {
  const data = await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    }),
  );
  return data;
};
