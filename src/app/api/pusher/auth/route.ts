import { NextRequest } from "next/server";
import { pusher } from "@/server/pusher";
import { getAuth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const data = await request.formData();
    const socketId = data.get("socket_id") as string;
    const channel = data.get("channel_name") as string;
    if (!socketId || !channel) {
      return new Response("Invalid request", { status: 400 });
    }

    // For presence channels, extract the workspace ID from the channel name
    // Channel format: presence-workspace-{workspaceId}
    const workspaceId = channel.split("-")[2];
    if (!workspaceId) {
      return new Response("Invalid channel name", { status: 400 });
    }

    // Get the member's current status and info from the database
    const member = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      return new Response("Not a member of this workspace", { status: 403 });
    }

    // Generate auth signature with user data
    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: userId,
      user_info: {
        status: member.status,
        statusMessage: member.statusMessage,
        lastSeen: member.lastSeen,
      },
    });

    return Response.json(authResponse);
  } catch (error) {
    console.error("Pusher auth error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
} 