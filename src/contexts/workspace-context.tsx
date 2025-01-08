'use client';

import { User } from '@/types/user';
import { Channel, Workspace } from '@prisma/client';
import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
} from 'react';
import { api } from '@/trpc/react';

interface WorkspaceContextType {
  workspace: Workspace | null;
  joinedChannels: Channel[];
  unjoinedChannels: Channel[];
  members: Record<string, User>;
  isLoading: boolean;
  refetchWorkspace: () => Promise<void>;
  _mutators: {
    setMembers: Dispatch<SetStateAction<Record<string, User>>>;
    setJoinedChannels: Dispatch<SetStateAction<Channel[]>>;
    setMemberStatus: (userId: string, status: 'online' | 'offline' | 'away') => void;
  };
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

interface WorkspaceProviderProps {
  children: ReactNode;
  workspace: Workspace | null;
  joinedChannels: Channel[];
  unjoinedChannels: Channel[];
  members: User[];
}

export function WorkspaceProvider({
  children,
  workspace: initialWorkspace,
  joinedChannels: initialJoinedChannels,
  unjoinedChannels: initialUnjoinedChannels,
  ...props
}: WorkspaceProviderProps) {
  const workspaceId = initialWorkspace?.id;

  const { data: workspaceData, refetch: refetchWorkspace } =
    api.workspace.getById.useQuery(
      { workspaceId: workspaceId! },
      {
        initialData: initialWorkspace
          ? {
              ...initialWorkspace,
              members: props.members.map((member) => ({
                id: `${workspaceId}-${member.id}`,
                userId: member.id,
                workspaceId: workspaceId!,
                role: 'member',
                status: 'offline',
                joinedAt: new Date(),
              })),
            }
          : undefined,
        enabled: !!workspaceId,
      },
    );

  const { data: channelsData } = api.channel.getAllWithMembership.useQuery(
    { workspaceId: workspaceId! },
    {
      initialData: {
        joined: initialJoinedChannels,
        unjoined: initialUnjoinedChannels,
      },
      enabled: !!workspaceId,
    },
  );

  const initialMembers = useMemo(() => {
    const map: Record<string, User> = {};
    props.members.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [props.members]);

  const [members, setMembers] = useState<Record<string, User>>(initialMembers);
  const [joinedChannels, setJoinedChannels] = useState<Channel[]>(initialJoinedChannels);

  const setMemberStatus = useCallback((userId: string, status: 'online' | 'offline' | 'away') => {
    setMembers((prev) => {
      if (!prev[userId]) return prev;
      return {
        ...prev,
        [userId]: {
          ...prev[userId],
          status,
        },
      };
    });
  }, []);

  const isLoading = !workspaceData || !channelsData;

  return (
    <WorkspaceContext.Provider
      value={{
        workspace: workspaceData ?? null,
        joinedChannels: joinedChannels,
        unjoinedChannels: channelsData?.unjoined ?? initialUnjoinedChannels,
        members: members,
        isLoading,
        refetchWorkspace: useCallback(async () => {
          await refetchWorkspace();
        }, [refetchWorkspace]),
        _mutators: {
          setMembers,
          setJoinedChannels,
          setMemberStatus,
        },
      }}
    >
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
