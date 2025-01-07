'use client';

import { User } from '@/types/user';
import { Channel, Workspace } from '@prisma/client';
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { api } from '@/trpc/react';

interface WorkspaceContextType {
  workspace: Workspace | null;
  joinedChannels: Channel[];
  unjoinedChannels: Channel[];
  workspaceMembers: Record<string, User>;
  isLoading: boolean;
  refetchWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
  workspace: Workspace | null;
  joinedChannels: Channel[];
  unjoinedChannels: Channel[];
  workspaceMembers: User[];
}

export function WorkspaceProvider({
  children,
  workspace: initialWorkspace,
  joinedChannels: initialJoinedChannels,
  unjoinedChannels: initialUnjoinedChannels,
  workspaceMembers: initialWorkspaceMembers,
}: WorkspaceProviderProps) {
  const workspaceId = initialWorkspace?.id;

  const { data: workspaceData, refetch: refetchWorkspace } = api.workspace.getById.useQuery(
    { workspaceId: workspaceId! },
    {
      initialData: initialWorkspace ? {
        ...initialWorkspace,
        members: initialWorkspaceMembers.map(member => ({
          id: `${workspaceId}-${member.id}`,
          userId: member.id,
          workspaceId: workspaceId!,
          role: 'member',
          joinedAt: new Date(),
        })),
      } : undefined,
      enabled: !!workspaceId,
    }
  );

  const { data: channelsData } = api.channel.getAllWithMembership.useQuery(
    { workspaceId: workspaceId! },
    {
      initialData: {
        joined: initialJoinedChannels,
        unjoined: initialUnjoinedChannels,
      },
      enabled: !!workspaceId,
    }
  );

  const { data: membersData } = api.workspace.getMembers.useQuery(
    { workspaceId: workspaceId! },
    {
      initialData: initialWorkspaceMembers.map(member => ({
        id: `${workspaceId}-${member.id}`,
        userId: member.id,
        workspaceId: workspaceId!,
        role: 'member',
        joinedAt: new Date(),
      })),
      enabled: !!workspaceId,
    }
  );

  const members = useMemo(() => {
    const map: Record<string, User> = {};
    initialWorkspaceMembers.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [initialWorkspaceMembers]);

  const isLoading = !workspaceData || !channelsData || !membersData;

  const value = useMemo(
    () => ({
      workspace: workspaceData ?? null,
      joinedChannels: channelsData?.joined ?? initialJoinedChannels,
      unjoinedChannels: channelsData?.unjoined ?? initialUnjoinedChannels,
      workspaceMembers: members,
      isLoading,
      refetchWorkspace: async () => {
        await refetchWorkspace();
      },
    }),
    [workspaceData, channelsData, members, isLoading, refetchWorkspace, initialJoinedChannels, initialUnjoinedChannels]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
} 