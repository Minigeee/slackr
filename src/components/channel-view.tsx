'use client';

import { useState } from 'react';
import MessageView from '@/components/message-view';
import MessageList from '@/components/message-view/message-list';
import { Button } from '@/components/ui/button';
import { ChannelProvider, useChannel } from '@/contexts/channel-context';
import { useWorkspace } from '@/contexts/workspace-context';
import {
  FullMessage
} from '@/types/message';
import { useUser } from '@clerk/nextjs';
import { Channel, Message } from '@prisma/client';
import { Bookmark, Loader2, PinIcon, X } from 'lucide-react';
import { UserAvatar } from './user-avatar';
import { api } from '@/trpc/react';

interface ThreadViewProps {
  threadId: string;
  messages: FullMessage[];
  onClose: () => void;
  onSendMessage: (
    content: string,
    attachments: File[],
    threadId?: string,
  ) => Promise<Message | null>;
}

function ThreadView({
  threadId,
  messages,
  onClose,
  onSendMessage,
}: ThreadViewProps) {
  return (
    <div className='flex h-full w-[400px] flex-col border-l xl:w-[500px]'>
      <div className='flex h-12 items-center justify-between border-b px-4'>
        <h3 className='font-semibold'>Thread</h3>
        <Button variant='ghost' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>
      <MessageView
        messages={messages}
        onSendMessage={onSendMessage}
        threadId={threadId}
      />
    </div>
  );
}

////////////////////////////////////////////////////////////

interface PinnedMessagesViewProps {
  channelId: string;
  onClose: () => void;
}

function PinnedMessagesView({ channelId, onClose }: PinnedMessagesViewProps) {
  const { data: pinnedMessages, isLoading } = api.message.getPinned.useQuery({ channelId });

  return (
    <div className='flex h-full w-[400px] flex-col border-l xl:w-[500px]'>
      <div className='flex h-12 items-center justify-between border-b px-4'>
        <h3 className='font-semibold'>Pinned Messages</h3>
        <Button variant='ghost' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>
      <div className='flex-1 overflow-y-auto'>
        {isLoading ? (
          <div className='flex h-full items-center justify-center'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : pinnedMessages?.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center gap-2 text-muted-foreground'>
            <PinIcon className='h-6 w-6' />
            <p className='text-sm'>No pinned messages yet</p>
          </div>
        ) : (
          <MessageList messages={pinnedMessages ?? []} />
        )}
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////

function ChannelViewContent(props: { channel: Channel }) {
  const { user } = useUser();
  const workspace = useWorkspace();
  const { messages, activeThreadId, sendMessage, setActiveThreadId } =
    useChannel();
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  return (
    <div className='flex h-full w-full'>
      <div className='flex h-full flex-1 flex-col'>
        <div className='flex h-12 items-center justify-between border-b px-4'>
          <div className='flex items-center'>
            {props.channel.type === 'dm' ? (
              <>
                {/* For DM channels, show the other user's info */}
                {(() => {
                  const [, user1, user2] = props.channel.name.split('-');
                  const otherUserId = user1 === user?.id ? user2 : user1;
                  if (!otherUserId) return null;
                  const otherUser = workspace.members[otherUserId];

                  return (
                    <div className='flex items-center'>
                      <UserAvatar user={otherUser ?? null} className='h-8 w-8' />
                      <span className='ml-2 font-semibold'>
                        {otherUser?.firstName
                          ? `${otherUser.firstName} ${otherUser.lastName}`
                          : otherUser?.email}
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <h2 className='font-semibold'>#{props.channel.name}</h2>
            )}
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setShowPinnedMessages(!showPinnedMessages)}
          >
            <PinIcon className='h-4 w-4' />
          </Button>
        </div>
        <MessageView messages={messages} onSendMessage={sendMessage} />
      </div>
      {activeThreadId && (
        <ThreadView
          threadId={activeThreadId}
          messages={messages}
          onClose={() => setActiveThreadId(null)}
          onSendMessage={sendMessage}
        />
      )}
      {showPinnedMessages && (
        <PinnedMessagesView
          channelId={props.channel.id}
          onClose={() => setShowPinnedMessages(false)}
        />
      )}
    </div>
  );
}

////////////////////////////////////////////////////////////

interface ChannelViewProps {
  channel: Channel;
  initialMessages: Omit<FullMessage, 'user'>[];
}

export default function ChannelView({
  channel,
  initialMessages,
}: ChannelViewProps) {
  return (
    <ChannelProvider channel={channel} initialMessages={initialMessages}>
      <ChannelViewContent channel={channel} />
    </ChannelProvider>
  );
}
