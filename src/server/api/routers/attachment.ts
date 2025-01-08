import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { generateUploadPresignedUrl, getFileUrl, deleteFile } from "@/server/s3";
import crypto from "crypto";
import path from "path";

export const attachmentRouter = createTRPCRouter({
  // Generate a presigned URL for file upload
  getUploadUrl: protectedProcedure
    .input(z.object({
      filename: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate a unique key for the file
      const extension = path.extname(input.filename);
      const key = `attachments/${crypto.randomBytes(16).toString("hex")}${extension}`;

      // Generate presigned URL
      const presignedUrl = await generateUploadPresignedUrl(key, input.contentType);

      return {
        presignedUrl,
        key,
      };
    }),

  // Delete attachment
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.attachment.findUnique({
        where: { id: input.id },
        include: { message: true },
      });

      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user has access to the message
      const member = await ctx.db.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: ctx.auth.userId,
            channelId: attachment.message.channelId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Delete from S3
      await deleteFile(attachment.key);

      // Delete from database
      await ctx.db.attachment.delete({
        where: { id: input.id },
      });

      return true;
    }),
}); 