import { clerkClient, User } from '@clerk/nextjs/server';

/** Get user name from clerk */
export function getUserName(user: User | undefined): string {
  if (!user) return 'Unknown User';
  return user.firstName
    ? user.firstName + ' ' + user.lastName
    : (user.emailAddresses[0]?.emailAddress ?? 'Unknown User');
}

/** Get sender user objects from a list of messages */
export async function getSenders(messages: { userId: string }[]) {
  const senderIds = new Set(messages.map((msg) => msg.userId));
  const client = await clerkClient();
  const senders = await client.users.getUserList({
    userId: Array.from(senderIds),
  });
  return senders.data;
}
