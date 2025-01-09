import WorkspaceSidebar from '@/components/workspace-sidebar';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/nextjs';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { SearchDropdown } from '@/components/search/search-dropdown';
import { db } from '@/server/db';
import { User } from '@/types/user';
import Link from 'next/link';

async function getWorkspaceData(workspaceId: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: true,
    },
  });

  const members = workspace
    ? await clerkClient()
        .then((client) =>
          client.users.getUserList({
            userId: workspace.members.map((member) => member.userId),
          }),
        )
        .then((users) =>
          users.data.map(
            (user) =>
              ({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.emailAddresses[0]?.emailAddress ?? '',
                profilePicture: user.imageUrl,
              }) as User,
          ),
        )
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
    members,
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
  const { workspace, members, joinedChannels, unjoinedChannels } =
    await getWorkspaceData(workspaceId, user?.id ?? '');

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <WorkspaceProvider
          workspace={workspace}
          members={members}
          joinedChannels={joinedChannels}
          unjoinedChannels={unjoinedChannels}
        >
          <div className='h-screen'>
            <div className='h-[50px] border-b px-4 flex items-center gap-8 bg-[hsl(265,56%,25%)]'>
              <Link href='/' className='text-purple-50 font-bold text-2xl'>
                Slackr
              </Link>
              <div className='flex-1 flex justify-center'>
                <SearchDropdown />
              </div>
            </div>
            <div className='flex w-full h-[calc(100vh-50px)]'>
              <WorkspaceSidebar />
              <div className='flex-1'>{children}</div>
            </div>
          </div>
        </WorkspaceProvider>
      </SignedIn>
    </>
  );
}
