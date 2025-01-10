'use client';

import MessageList from '@/components/message-view/message-list';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChannelProvider } from '@/contexts/channel-context';
import { useWorkspace } from '@/contexts/workspace-context';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import type { User } from '@/types/user';
import type { Channel, Message } from '@prisma/client';
import { Loader2, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

type SortOption = 'relevance' | 'newest' | 'oldest';

interface MessageWithUser extends Message {
  user?: User;
  rank: number;
  channel?: Channel;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const msgId = searchParams.get('msg');
  const workspace = useWorkspace();
  const [sort, setSort] = useState<SortOption>('relevance');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(msgId);

  // Update URL when selecting a message
  const handleSelectMessage = (messageId: string | null) => {
    setSelectedMessage(messageId);
    const newParams = new URLSearchParams(searchParams);
    if (messageId) {
      newParams.set('msg', messageId);
    } else {
      newParams.delete('msg');
    }
    router.replace(`?${newParams.toString()}`);
  };

  const { data: searchResults, isLoading } = api.search.messages.useQuery(
    {
      workspaceId: workspace?.workspace?.id ?? '',
      query,
      limit: 50,
    },
    {
      enabled: !!workspace?.workspace?.id && !!query,
    },
  );

  const { data: contextMessages } = api.message.getContext.useQuery(
    {
      messageId: selectedMessage ?? '',
      limit: 50,
    },
    {
      enabled: !!selectedMessage,
    },
  );
  const reversedContextMessages = useMemo(() => {
    return contextMessages?.slice().reverse();
  }, [contextMessages]);

  // Sort messages client-side
  const sortedMessages = useMemo(() => {
    if (!searchResults?.items) return [];

    const messages = [...searchResults.items];
    const channelMap = new Map(workspace.joinedChannels.map((c) => [c.id, c]));

    const messagesWithChannel = messages.map((message) => ({
      ...message,
      channel: channelMap.get(message.channelId),
    }));

    if (sort === 'newest') {
      return messagesWithChannel.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === 'oldest') {
      return messagesWithChannel.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return messagesWithChannel;
  }, [searchResults?.items, sort, workspace.joinedChannels]);

  // Get full selected message object
  const selected = useMemo(() => {
    if (!selectedMessage) return null;
    const message = sortedMessages.find(
      (message) => message.id === selectedMessage,
    );
    const channel = workspace.joinedChannels.find(
      (channel) => channel.id === message?.channelId,
    );
    if (!message || !channel) return null;
    return {
      message,
      channel,
    };
  }, [selectedMessage, sortedMessages]);

  return (
    <div className='flex h-full'>
      <div className='flex flex-1 flex-col overflow-hidden'>
        <div className='flex-shrink-0 border-b p-4'>
          <div className='flex items-center justify-between'>
            <h1 className='flex items-center gap-2 text-xl font-semibold'>
              <Search className='h-5 w-5' />
              Search results for "{query}"
            </h1>
            <Select
              value={sort}
              onValueChange={(value: SortOption) => setSort(value)}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Sort by...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='relevance'>Most relevant</SelectItem>
                <SelectItem value='newest'>Newest first</SelectItem>
                <SelectItem value='oldest'>Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchResults?.items && (
            <p className='text-sm text-muted-foreground'>
              Found {searchResults.items.length} results
            </p>
          )}
        </div>

        <div className='flex-1 overflow-y-auto p-4'>
          <div className='space-y-4'>
            {isLoading && (
              <div className='flex h-40 items-center justify-center'>
                <Loader2 className='h-6 w-6 animate-spin text-primary' />
              </div>
            )}
            {sortedMessages.map((message: MessageWithUser) => (
              <button
                key={message.id}
                onClick={() => handleSelectMessage(message.id)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent',
                  selectedMessage === message.id && 'bg-accent',
                )}
              >
                <div className='mb-1 flex items-center gap-2'>
                  <span className='font-medium'>
                    {message.user?.firstName} {message.user?.lastName}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    {new Date(message.createdAt).toLocaleDateString()}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    in{' '}
                    {message.channel?.type === 'dm'
                      ? 'Direct Message'
                      : `#${message.channel?.name}`}
                  </span>
                </div>
                <div
                  className='text-sm text-muted-foreground'
                  dangerouslySetInnerHTML={{
                    __html: message.content.replace(
                      new RegExp(query, 'gi'),
                      (match: string) =>
                        `<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>`,
                    ),
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {selected && reversedContextMessages && (
        <ChannelProvider
          channel={selected.channel}
          initialMessages={reversedContextMessages}
        >
          <div className='flex h-full w-[400px] flex-col border-l xl:w-[500px]'>
            <div className='flex h-12 items-center justify-between border-b px-4'>
              <h3 className='font-semibold'>
                {selected.channel.type === 'dm'
                  ? 'Direct Message'
                  : `#${selected.channel.name}`}
              </h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleSelectMessage(null)}
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
            <ScrollArea className='flex-1 overflow-hidden'>
              {!reversedContextMessages ? (
                <div className='flex h-40 items-center justify-center'>
                  <Loader2 className='h-6 w-6 animate-spin text-primary' />
                </div>
              ) : (
                <MessageList messages={reversedContextMessages} />
              )}
            </ScrollArea>
          </div>
        </ChannelProvider>
      )}
    </div>
  );
}
