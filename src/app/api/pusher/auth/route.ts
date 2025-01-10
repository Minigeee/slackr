import { db } from '@/server/db';
import { pusher } from '@/server/pusher';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get('socket_id') as string;
    const channel = formData.get('channel_name') as string;

    // Get user data from Clerk
    const user = await currentUser();
    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    // Handle different channel types
    if (channel.startsWith('presence-workspace-')) {
      // Workspace presence channel
      const parts = channel.split('-');
      if (parts.length < 3 || !parts[2]) {
        return new Response('Invalid workspace channel name', { status: 400 });
      }
      const workspaceId = parts[2];

      // Verify workspace membership
      const member = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
      });

      if (!member) {
        return new Response('Not a member of this workspace', { status: 403 });
      }

      // Generate auth for presence channel
      const authResponse = pusher.authorizeChannel(socketId, channel, {
        user_id: userId,
        user_info: {
          status: member.status,
          statusMessage: member.statusMessage,
          lastSeen: member.lastSeen,
          name:
            user.firstName ?? user.emailAddresses[0]?.emailAddress ?? 'Unknown',
          email: user.emailAddresses[0]?.emailAddress,
        },
      });

      return Response.json(authResponse);
    } else if (channel.startsWith('private-channel-')) {
      // Private channel
      const channelId = channel.split('-').slice(2).join('-');

      // Verify channel membership
      const member = await db.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId,
            channelId,
          },
        },
      });

      if (!member) {
        return new Response('Forbidden', { status: 403 });
      }

      // Generate auth for private channel
      const authResponse = pusher.authorizeChannel(socketId, channel, {
        user_id: userId,
        user_info: {
          name:
            user.firstName ?? user.emailAddresses[0]?.emailAddress ?? 'Unknown',
          email: user.emailAddresses[0]?.emailAddress,
        },
      });

      return Response.json(authResponse);
    }

    return new Response('Invalid channel type', { status: 400 });
  } catch (error) {
    console.error('Pusher auth error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
