import Pusher from "pusher";

// Initialize Pusher server instance
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Helper function to get channel name for a specific channel
export const getChannelName = (channelId: string) => `private-channel-${channelId}`;

// Event names
export const EVENTS = {
  NEW_MESSAGE: 'new-message',
  UPDATE_MESSAGE: 'update-message',
  DELETE_MESSAGE: 'delete-message',
  JOIN_CHANNEL: 'join-channel',
  ADD_REACTION: 'add-reaction',
  REMOVE_REACTION: 'remove-reaction',
  STATUS_CHANGED: 'status-changed',
  TYPING_START: 'client-typing-start',
  TYPING_STOP: 'client-typing-stop',
} as const; 