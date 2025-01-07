'use client';

import Link from 'next/link';
import { Plus, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { useParams, useRouter } from 'next/navigation';
import { CreateChannelDialog } from './create-channel-dialog';
import { ScrollArea } from './ui/scroll-area';
import { useUser, useClerk } from '@clerk/nextjs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { useWorkspace } from '@/contexts/workspace-context';
import type { Channel, Workspace } from '@prisma/client';

export default function WorkspaceSidebar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const params = useParams();
  const channelId = params.channelId as string;
  const router = useRouter();
  const { workspace, joinedChannels, unjoinedChannels } = useWorkspace();

  if (!workspace) {
    return null;
  }

  const handleCreateChannel = async (data: {
    mode: 'create' | 'join';
    channelName?: string;
    channelId?: string;
  }) => {
    // The actual channel creation/joining is handled in the dialog component
    // This is just for any additional UI updates if needed
    console.log('Channel action completed:', data);
  };

  return (
    <div className='flex h-full w-64 flex-col border-r bg-background'>
      {/* Workspace Header */}
      <div className='flex flex-shrink-0 h-12 items-center border-b px-4'>
        <h2 className='font-semibold'>{workspace.name}</h2>
      </div>

      {/* Channels Section */}
      <ScrollArea className='flex-grow'>
        <div className='space-y-1 p-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-muted-foreground'>
              Channels
            </h3>
            <CreateChannelDialog
              trigger={
                <Button variant='ghost' size='icon' className='h-5 w-5'>
                  <Plus className='h-4 w-4' />
                </Button>
              }
              workspaceId={workspace.id}
              onSubmit={handleCreateChannel}
              existingChannels={unjoinedChannels}
            />
          </div>

          <nav className='space-y-1'>
            {joinedChannels.map((channel) => (
              <Link
                key={channel.id}
                href={`/w/${workspace.id}/${channel.id}`}
                className={`flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted ${
                  channel.id === channelId ? 'bg-accent' : ''
                }`}
              >
                # {channel.name}
              </Link>
            ))}
          </nav>
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className='border-t p-2'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='w-full justify-start gap-2 px-2'>
              <Avatar className='h-8 w-8'>
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>
                  {user?.firstName?.charAt(0) ??
                    user?.emailAddresses[0]?.emailAddress?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className='text-sm font-medium'>
                {user?.firstName
                  ? `${user?.firstName} ${user?.lastName}`
                  : user?.emailAddresses[0]?.emailAddress}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-56'>
            <DropdownMenuItem
              className='cursor-pointer text-red-500'
              onClick={() => {
                signOut();
                router.push('/');
              }}
            >
              <LogOut className='mr-2 h-4 w-4' />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
