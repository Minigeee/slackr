'use client';

import { api } from '@/trpc/react';
import { User, UserStatus } from '@/types/user';
import { EVENTS, pusherClient } from '@/utils/pusher';
import { useUser } from '@clerk/nextjs';
import { Channel, Workspace } from '@prisma/client';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface WorkspaceContextType {
  workspace: Workspace | null;
  joinedChannels: Channel[];
  unjoinedChannels: Channel[];
  members: Record<string, User>;
  isLoading: boolean;
  refetchWorkspace: () => Promise<void>;
  setStatus: (
    status: UserStatus,
    statusMessage?: string | null,
  ) => Promise<void>;
  createChannel: (name: string) => Promise<Channel | null>;
  joinChannel: (channelId: string) => Promise<Channel>;
  deleteChannel: (channelId: string) => Promise<void>;
  _mutators: {
    setMembers: Dispatch<SetStateAction<Record<string, User>>>;
    setJoinedChannels: Dispatch<SetStateAction<Channel[]>>;
    setMemberStatus: (userId: string, status: UserStatus) => void;
    setUnjoinedChannels: Dispatch<SetStateAction<Channel[]>>;
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
  const { user } = useUser();
  const workspaceId = initialWorkspace?.id;
  const updateStatus = api.workspace.updateStatus.useMutation();

  // Add createChannel and joinChannel mutations
  const createChannel = api.channel.create.useMutation({
    onSuccess: async (newChannel) => {
      setJoinedChannels((prev) => [...prev, newChannel]);
      await refetchWorkspace();
    },
  });

  const joinChannel = api.channel.join.useMutation({
    onSuccess: async (channelMember, { channelId }) => {
      // Find the channel in unjoined channels
      const channel = unjoinedChannels.find((c) => c.id === channelId);
      if (channel) {
        setJoinedChannels((prev) => [...prev, channel]);
        setUnjoinedChannels((prev) => prev.filter((c) => c.id !== channelId));
      }
      await refetchWorkspace();
    },
  });

  const deleteChannelMutation = api.channel.delete.useMutation({
    onSuccess: async (_, { channelId }) => {
      await refetchWorkspace();
    },
  });

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
                statusMessage: null,
                lastSeen: new Date(),
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
      map[member.id] = {
        ...member,
        status: user?.id === member.id ? member.status : 'offline',
        lastSeen: new Date(),
      };
    });
    return map;
  }, [props.members]);

  const [members, setMembers] = useState<Record<string, User>>(initialMembers);
  const [joinedChannels, setJoinedChannels] = useState<Channel[]>(
    initialJoinedChannels,
  );
  const [unjoinedChannels, setUnjoinedChannels] = useState<Channel[]>(
    initialUnjoinedChannels,
  );

  // Subscribe to presence channel and status changes
  useEffect(() => {
    if (!workspaceId || !user) return;

    const channel = pusherClient.subscribe(`presence-workspace-${workspaceId}`);

    channel.bind('pusher:subscription_succeeded', (members: any) => {
      console.log('subscription succeeded', members);
      setMembers((prev) => {
        const newMembers = { ...prev };
        members.each((member: any) => {
          if (newMembers[member.id]) {
            newMembers[member.id] = {
              ...newMembers[member.id],
              status: member.info.status || 'online',
              statusMessage: member.info.statusMessage,
              lastSeen: new Date(),
            } as User;
          }
        });
        return newMembers;
      });
    });

    channel.bind('pusher:member_added', (member: any) => {
      console.log('member added', member);
      setMembers((prev) => {
        if (!prev[member.id]) return prev;
        return {
          ...prev,
          [member.id]: {
            ...prev[member.id],
            status: member.info.status || 'online',
            statusMessage: member.info.statusMessage,
            lastSeen: new Date(),
          },
        };
      });
    });

    channel.bind('pusher:member_removed', (member: any) => {
      console.log('member removed', member);
      setMembers((prev) => {
        if (!prev[member.id]) return prev;
        return {
          ...prev,
          [member.id]: {
            ...prev[member.id],
            status: 'offline',
            lastSeen: new Date(),
          },
        };
      });
    });

    // Add status change listener
    channel.bind(
      EVENTS.STATUS_CHANGED,
      (data: {
        userId: string;
        status: UserStatus;
        statusMessage: string | null;
      }) => {
        setMembers((prev) => {
          if (!prev[data.userId]) return prev;
          return {
            ...prev,
            [data.userId]: {
              ...prev[data.userId],
              status: data.status,
              statusMessage: data.statusMessage,
              lastSeen: new Date(),
            } as User,
          };
        });
      },
    );

    return () => {
      channel.unsubscribe();
    };
  }, [workspaceId, user]);

  const setMemberStatus = useCallback((userId: string, status: UserStatus) => {
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

  const setStatus = useCallback(
    async (status: UserStatus, statusMessage?: string | null) => {
      if (!workspaceId || !user) return;

      // Update local state optimistically
      setMembers((prev) => ({
        ...prev,
        [user.id]: {
          ...prev[user.id],
          status,
          statusMessage: statusMessage ?? prev[user.id]?.statusMessage,
          lastSeen: new Date(),
        } as User,
      }));

      // Make the API call
      await updateStatus.mutateAsync({
        workspaceId,
        status: status as any,
        statusMessage,
      });
    },
    [workspaceId, user, updateStatus],
  );

  const isLoading = !workspaceData || !channelsData;

  return (
    <WorkspaceContext.Provider
      value={{
        workspace: workspaceData ?? null,
        joinedChannels: joinedChannels,
        unjoinedChannels: unjoinedChannels,
        members: members,
        isLoading,
        setStatus,
        createChannel: useCallback(async (name: string) => {
          if (!workspaceId) return null;
          const channel = await createChannel.mutateAsync({
            workspaceId,
            name,
          });
          return channel;
        }, [workspaceId, createChannel]),
        joinChannel: useCallback(async (channelId: string) => {
          await joinChannel.mutateAsync({ channelId });
          const channel = unjoinedChannels.find((c) => c.id === channelId);
          if (!channel) {
            throw new Error('Channel not found');
          }
          return channel;
        }, [joinChannel, unjoinedChannels]),
        deleteChannel: useCallback(async (channelId: string) => {
          // Optimistically remove the channel from the lists
          const channel = joinedChannels.find((c) => c.id === channelId);
          if (channel) {
            setJoinedChannels((prev) => prev.filter((c) => c.id !== channelId));
          } else {
            setUnjoinedChannels((prev) => prev.filter((c) => c.id !== channelId));
          }

          try {
            await deleteChannelMutation.mutateAsync({ channelId });
          } catch (error) {
            // If the deletion fails, revert the optimistic update
            if (channel) {
              setJoinedChannels((prev) => [...prev, channel]);
            } else {
              const unjoinedChannel = unjoinedChannels.find((c) => c.id === channelId);
              if (unjoinedChannel) {
                setUnjoinedChannels((prev) => [...prev, unjoinedChannel]);
              }
            }
            throw error;
          }
        }, [deleteChannelMutation, joinedChannels, unjoinedChannels]),
        refetchWorkspace: useCallback(async () => {
          await refetchWorkspace();
        }, [refetchWorkspace]),
        _mutators: {
          setMembers,
          setJoinedChannels,
          setMemberStatus,
          setUnjoinedChannels,
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
