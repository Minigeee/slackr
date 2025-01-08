import { type Message } from '@prisma/client';
import { type User } from '@/types/user';

export interface MessageWithUser extends Message {
  user: User | undefined;
}

/** Message with replies and user info */
export interface FullMessage extends MessageWithUser {
  replies: MessageWithUser[];
}
