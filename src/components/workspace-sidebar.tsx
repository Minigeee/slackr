'use client';

import Link from 'next/link';
import { Plus, LogOut, MessageSquare } from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import { UserAvatar } from './user-avatar';
import { useWorkspace } from '@/contexts/workspace-context';
import type { Channel, Workspace } from '@prisma/client';
import { api } from '@/trpc/react';
import { pusherClient, EVENTS } from '@/utils/pusher';
import { User } from '@/types/user';
import { useMemo } from 'react';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuContent,
  ContextMenuTrigger,
} from './ui/context-menu';
import { UserStatus } from '@/types/user';
import { cn } from '@/lib/utils';

function MemberContextMenu({
  member,
  currentUserId,
  onMessageClick,
  children,
}: {
  member: User;
  currentUserId: string;
  onMessageClick: (member: User) => void;
  children: React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className='w-56'>
        {member.id !== currentUserId && (
          <ContextMenuItem onClick={() => onMessageClick(member)}>
            <MessageSquare className='mr-2 h-4 w-4' />
            Message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function UserFooter() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { members, workspace, setStatus } = useWorkspace();

  const handleStatusChange = async (status: UserStatus) => {
    if (!workspace) return;
    await setStatus(status);
  };

  // Get current user object
  const currentUser = members[user?.id ?? ''];

  if (!currentUser) return null;

  return (
    <div className='border-t p-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='w-full justify-start gap-2 px-2 hover:bg-indigo-100'>
            <UserAvatar user={currentUser} className='h-8 w-8' />
            <span className='text-sm font-medium'>
              {currentUser.firstName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56'>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'online' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('online')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-green-500' />
            Online
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'busy' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('busy')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-red-600' />
            Busy
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'invisible' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('invisible')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-gray-500' />
            Appear Offline
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
  );
}

export default function WorkspaceSidebar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const params = useParams();
  const channelId = params.channelId as string;
  const router = useRouter();
  const { workspace, joinedChannels, unjoinedChannels, members, _mutators } =
    useWorkspace();
  const createDM = api.channel.createDM.useMutation({
    onSuccess: (channel) => {
      // Update local state if this is a new channel
      const channelExists = joinedChannels.some((c) => c.id === channel.id);
      if (!channelExists) {
        const updatedJoinedChannels = [...joinedChannels, channel];
        _mutators.setJoinedChannels(updatedJoinedChannels);
      }
    },
  });

  // Sorted members
  const sortedMembers = useMemo(() => {
    const sorted = Object.values(members).sort(
      (a, b) =>
        a.firstName?.localeCompare(b.firstName ?? '') ||
        a.email.localeCompare(b.email ?? ''),
    );
    return sorted;
  }, [members]);

  if (!workspace || !user) {
    return (
      <div className='flex h-full w-64 flex-col border-r bg-background'>
        <div className='flex h-12 flex-shrink-0 items-center border-b px-4'>
          <div className='h-4 w-32 animate-pulse rounded bg-muted'></div>
        </div>
        <div className='p-4 space-y-4'>
          <div className='space-y-2'>
            <div className='h-4 w-20 animate-pulse rounded bg-muted'></div>
            <div className='space-y-2'>
              {[1, 2, 3].map((i) => (
                <div key={i} className='h-8 w-full animate-pulse rounded bg-muted'></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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

  const handleCreateDM = async (targetMember: User) => {
    if (!user || !workspace) return;

    // Use the new createDM endpoint
    const channel = await createDM.mutateAsync({
      workspaceId: workspace.id,
      targetUserId: targetMember.id,
    });

    // Navigate to the channel
    router.push(`/w/${workspace.id}/${channel.id}`);
  };

  return (
    <div className='flex h-full w-64 flex-col border-r bg-indigo-50'>
      {/* Workspace Header */}
      <div className='flex h-12 flex-shrink-0 items-center border-b px-4'>
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
                <Button variant='ghost' size='icon' className='h-5 w-5 hover:bg-indigo-100'>
                  <Plus className='h-4 w-4' />
                </Button>
              }
              workspaceId={workspace.id}
              onSubmit={handleCreateChannel}
              existingChannels={unjoinedChannels}
            />
          </div>

          <nav className='space-y-1'>
            {joinedChannels
              .filter((channel) => channel.type !== 'dm')
              .map((channel) => (
                <Link
                  key={channel.id}
                  href={`/w/${workspace.id}/${channel.id}`}
                  className={`flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-indigo-100 ${
                    channel.id === channelId ? 'bg-indigo-100' : ''
                  }`}
                >
                  # {channel.name}
                </Link>
              ))}
          </nav>
        </div>

        {/* DMs Section */}
        <div className='space-y-1 p-4'>
          <h3 className='text-sm font-semibold text-muted-foreground'>
            Direct Messages
          </h3>
          <nav className='space-y-1'>
            {joinedChannels
              .filter((channel) => channel.type === 'dm')
              .map((channel) => {
                const [, user1, user2] = channel.name.split('-');
                const otherUserId = user1 === user.id ? user2 : user1;
                const otherUser = otherUserId ? members[otherUserId] : null;

                if (!otherUser) return null;

                return (
                  <MemberContextMenu
                    key={channel.id}
                    member={otherUser}
                    currentUserId={user.id}
                    onMessageClick={handleCreateDM}
                  >
                    <Link
                      href={`/w/${workspace.id}/${channel.id}`}
                      className={`flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-indigo-100 ${
                        channel.id === channelId ? 'bg-indigo-100' : ''
                      }`}
                    >
                      <UserAvatar user={otherUser} className='mr-2 h-5 w-5' indicatorClassName='right-1' />
                      {otherUser.firstName
                        ? `${otherUser.firstName} ${otherUser.lastName}`
                        : otherUser.email}
                    </Link>
                  </MemberContextMenu>
                );
              })}
          </nav>
        </div>

        {/* Members Section */}
        <div className='space-y-1 p-4'>
          <h3 className='text-sm font-semibold text-muted-foreground'>
            Members
          </h3>
          <nav className='space-y-1'>
            {sortedMembers.map((member) => (
              <MemberContextMenu
                key={member.id}
                member={member}
                currentUserId={user.id}
                onMessageClick={handleCreateDM}
              >
                <div className='flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm hover:bg-indigo-100'>
                  <UserAvatar user={member} className='mr-2 h-5 w-5' indicatorClassName='right-1' />
                  {member.firstName
                    ? `${member.firstName} ${member.lastName}`
                    : member.email}
                </div>
              </MemberContextMenu>
            ))}
          </nav>
        </div>
      </ScrollArea>

      {/* Replace the old footer with the new component */}
      <UserFooter />
    </div>
  );
}
