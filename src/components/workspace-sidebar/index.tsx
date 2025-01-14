'use client';

import { useWorkspace } from '@/contexts/workspace-context';
import { api } from '@/trpc/react';
import { User } from '@/types/user';
import { useClerk, useUser } from '@clerk/nextjs';
import { MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { CreateChannelDialog } from '../create-channel-dialog';
import { Button } from '../ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { ScrollArea } from '../ui/scroll-area';
import { UserAvatar } from '../user-avatar';
import { ChannelButton } from './channel-button';
import { UserFooter } from './user-footer';
import { WorkspaceHeader } from './workspace-header';

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

export default function WorkspaceSidebar() {
  const { user } = useUser();
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
      <div className='flex h-full w-full flex-col bg-indigo-50'>
        <div className='flex h-12 flex-shrink-0 items-center border-b px-4'>
          <div className='h-4 w-32 animate-pulse rounded bg-muted'></div>
        </div>
        <div className='p-4 space-y-4'>
          <div className='space-y-2'>
            <div className='h-4 w-20 animate-pulse rounded bg-muted'></div>
            <div className='space-y-2'>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className='h-8 w-full animate-pulse rounded bg-muted'
                ></div>
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
    <div className='flex w-full h-full flex-col bg-indigo-50'>
      {/* Workspace Header */}
      <WorkspaceHeader workspace={workspace} />

      {/* Channels Section */}
      <ScrollArea className='flex-grow'>
        <div className='space-y-1 p-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-muted-foreground'>
              Channels
            </h3>
            <CreateChannelDialog
              trigger={
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-5 w-5 hover:bg-indigo-100'
                >
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
                <ChannelButton
                  key={channel.id}
                  channel={channel}
                  workspace={workspace}
                  selected={channel.id === channelId}
                />
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
                      <UserAvatar
                        user={otherUser}
                        className='mr-2 h-5 w-5'
                        indicatorClassName='right-1'
                      />
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
                  <UserAvatar
                    user={member}
                    className='mr-2 h-5 w-5'
                    indicatorClassName='right-1'
                  />
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
