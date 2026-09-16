import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

export const s3 = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
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
  version = 1,
) => {
  const fileKey = `thumbnails/${pipelineId}/v${version}.jpg`;
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

export const uploadChannelLogoToS3 = async (imageBuffer: Buffer, userId: string, styleId: string, contentType: string) => {
  const extension = contentType === "image/png" ? "png" : "jpg";
  const key = `channel-styles/${userId}/${styleId}.${extension}`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key, Body: imageBuffer, ContentType: contentType }));
  return { key, url: `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}` };
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

export const uploadWorkflowFile = async (
  filePath: string,
  key: string,
  contentType: string,
) => {
  const stat = await fs.promises.stat(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: contentType,
  }));
  return { key, byteSize: stat.size };
};

export const downloadWorkflowFile = async (key: string, destination: string) => {
  const response = await s3.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
  }));
  if (!response.Body) throw new Error(`S3 workflow artifact ${key} has no body`);
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.writeFile(destination, Buffer.from(await response.Body.transformToByteArray()));
  return destination;
};
