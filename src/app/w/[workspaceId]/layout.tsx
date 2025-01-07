import WorkspaceSidebar from '@/components/workspace-sidebar';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/nextjs';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { db } from '@/server/db';
import { User } from '@/types/user';

async function getWorkspaceData(workspaceId: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: true,
    },
  });

  const workspaceMembers = workspace
    ? await clerkClient()
        .then((client) =>
          client.users.getUserList({
            userId: workspace.members.map((member) => member.userId),
          }),
        )
        .then((users) => users.data.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.emailAddresses[0]?.emailAddress ?? '',
          profilePicture: user.imageUrl,
        } as User)))
    : [];

  const memberChannels = await db.channel.findMany({
    where: {
      workspaceId,
      members: {
        some: {
          userId,
        },
      },
    },
  });

  const unjoinedChannels = await db.channel.findMany({
    where: {
      workspaceId,
      isPrivate: false,
      NOT: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
  });

  return {
    workspace,
    workspaceMembers,
    joinedChannels: memberChannels,
    unjoinedChannels,
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const user = await currentUser();
  const { workspaceId } = await params;
  const { workspace, workspaceMembers, joinedChannels, unjoinedChannels } =
    await getWorkspaceData(workspaceId, user?.id ?? '');

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <WorkspaceProvider
          workspace={workspace}
          workspaceMembers={workspaceMembers}
          joinedChannels={joinedChannels}
          unjoinedChannels={unjoinedChannels}
        >
          <div className='flex h-screen w-full'>
            <WorkspaceSidebar />
            <div className='flex-1'>{children}</div>
          </div>
        </WorkspaceProvider>
      </SignedIn>
    </>
  );
}
