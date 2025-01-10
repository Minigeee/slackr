import PusherClient from 'pusher-js';

// Initialize Pusher client instance
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth',
  },
);

// Helper function to get channel name for a specific channel
export const getChannelName = (channelId: string) =>
  `private-channel-${channelId}`;

// Event names (must match server-side events)
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
  PIN_MESSAGE: 'pin-message',
  UNPIN_MESSAGE: 'unpin-message',
} as const;

// Helper hook for subscribing to a channel
export const subscribeToChannel = (channelId: string) => {
  const channelName = getChannelName(channelId);

  // First, clean up any existing subscription
  const existingChannel = pusherClient.channel(channelName);
  if (existingChannel) {
    existingChannel.unbind_all();
    pusherClient.unsubscribe(channelName);
  }

  // Create new subscription
  return pusherClient.subscribe(channelName);
};

// Add a helper to unsubscribe cleanly
export const unsubscribeFromChannel = (channelId: string) => {
  const channelName = getChannelName(channelId);
  const channel = pusherClient.channel(channelName);
  if (channel) {
    channel.unbind_all();
    pusherClient.unsubscribe(channelName);
  }
};
