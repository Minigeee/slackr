'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import MessageView from '@/components/message-view';
import { Channel, Message } from '@prisma/client';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import { EVENTS, pusherClient } from '@/utils/pusher';
import { subscribeToChannel, unsubscribeFromChannel } from '@/utils/pusher';
import { User } from '@/types/user';
import { useWorkspace } from '@/contexts/workspace-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChannelProvider, useChannel } from '@/contexts/channel-context';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  AttachmentWithStatus,
  FullMessage,
  MessageWithUser,
} from '@/types/message';
import { generateUploadPresignedUrl, getFileUrl } from '@/server/s3';
import { UserAvatar } from './user-avatar';

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

function ChannelViewContent(props: { channel: Channel }) {
  const { user } = useUser();
  const workspace = useWorkspace();
  const { messages, activeThreadId, sendMessage, setActiveThreadId } =
    useChannel();

  return (
    <div className='flex h-full w-full'>
      <div className='flex h-full flex-1 flex-col'>
        <div className='flex h-12 items-center border-b px-4'>
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
