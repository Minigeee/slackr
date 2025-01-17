'use client';

import { api } from '@/trpc/react';
import { WatchPromptBox } from './watch-prompt-box';
import { ScrollArea } from '../ui/scroll-area';
import { CreateWatchDialog } from './create-watch-dialog';

export default function WatchView() {
  const { data: watchPrompts, isLoading } = api.watch.getAll.useQuery(undefined, {
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Watch List</h2>
            <p className="text-sm text-muted-foreground">
              Get notified when topics you care about are discussed
            </p>
          </div>
          <CreateWatchDialog />
        </div>
      </div>

      {/* Watch Prompts List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="text-center text-muted-foreground">
                Loading watch prompts...
              </div>
            </div>
          ) : watchPrompts?.length ? (
            watchPrompts.map((prompt) => (
              <WatchPromptBox
                key={prompt.id}
                prompt={prompt}
                matches={prompt.matches}
              />
            ))
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <h3 className="font-medium">No watch prompts yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create a watch prompt to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 