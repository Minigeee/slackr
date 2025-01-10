import { env } from '@/env';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const generateUploadPresignedUrl = async (
  key: string,
  contentType: string,
  expiresIn = 60, // URL expires in 60 seconds
) => {
  const command = new PutObjectCommand({
    Bucket: env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
};

export const deleteFile = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: env.AWS_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
};

export const getFileUrl = (key: string) => {
  return `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
};
