'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SearchBar } from '@/components/ui/search-bar';
import { useWorkspace } from '@/contexts/workspace-context';
import { api } from '@/trpc/react';
import type { User } from '@/types/user';
import type { Channel, Message } from '@prisma/client';
import { Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

interface MessageWithUser extends Message {
  user?: User;
  rank: number;
  channel?: Channel;
}

export function SearchDropdown() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults, isLoading } = api.search.messages.useQuery(
    {
      workspaceId: workspace?.workspace?.id ?? '',
      query,
      limit: 3,
    },
    {
      enabled: !!workspace?.workspace?.id && !!query && query.length > 0,
    },
  );

  const messagesWithChannel = useMemo(() => {
    if (!searchResults?.items) return [];
    const channelMap = new Map(workspace.joinedChannels.map((c) => [c.id, c]));
    return searchResults.items.map((message) => ({
      ...message,
      channel: channelMap.get(message.channelId),
    }));
  }, [searchResults?.items, workspace.joinedChannels]);

  const handleSelect = (messageId: string) => {
    setOpen(false);
    setQuery('');
    router.push(
      `/w/${workspace?.workspace?.id}/search?q=${encodeURIComponent(query)}&msg=${messageId}`,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className='w-full max-w-lg'>
          <SearchBar
            ref={inputRef}
            value={query}
            onChange={(value) => {
              setQuery(value);
              setOpen(!!value);
            }}
            onFocus={() => {
              if (query) setOpen(true);
            }}
            placeholder='Search workspace...'
            className='w-full'
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className='w-[512px] p-0'
        align='start'
        sideOffset={8}
        onInteractOutside={(e) => {
          if (!inputRef.current?.contains(e.target as Node)) {
            setOpen(false);
          }
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <div className='divide-y'>
          {query && (
            <div className='p-1'>
              <button
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  router.push(
                    `/w/${workspace?.workspace?.id}/search?q=${encodeURIComponent(query)}`,
                  );
                }}
                className='flex w-full items-center gap-2 rounded-md px-2 py-3 text-sm hover:bg-accent hover:text-accent-foreground'
              >
                <Search className='h-4 w-4' />
                <span>
                  Search for "<span className='font-medium'>{query}</span>"
                </span>
              </button>
            </div>
          )}

          {isLoading && (
            <div className='flex h-24 items-center justify-center'>
              <Loader2 className='h-5 w-5 animate-spin text-primary' />
            </div>
          )}

          {messagesWithChannel.length > 0 && (
            <div className='p-1'>
              <div className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
                Messages
              </div>
              <div className='space-y-1'>
                {messagesWithChannel.map((message: MessageWithUser) => (
                  <button
                    key={message.id}
                    onClick={() => handleSelect(message.id)}
                    className='flex w-full flex-col items-start gap-1 rounded-md px-2 py-3 text-sm hover:bg-accent hover:text-accent-foreground'
                  >
                    <div className='flex items-center gap-2'>
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
                    <p
                      className='line-clamp-1 text-sm text-muted-foreground'
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(!searchResults?.items || searchResults.items.length === 0) &&
            query &&
            !isLoading && (
              <div className='py-6 text-center text-sm text-muted-foreground'>
                No results found.
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
