import { Message, Attachment } from "@prisma/client";
import { User } from "./user";

export type MessageWithUser = Message & {
  user?: User;
};

export type AttachmentWithStatus = Attachment & {
  isUploading?: boolean;
};

export type FullMessage = MessageWithUser & {
  replies?: Message[];
  attachments?: AttachmentWithStatus[];
};
