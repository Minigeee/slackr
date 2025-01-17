import { PrismaClient } from '@prisma/client';

export interface TrpcContext {
  db: PrismaClient;
  auth: {
    userId: string;
  };
  headers: Headers;
}
