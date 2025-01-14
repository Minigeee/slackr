import { SearchDropdown } from '@/components/search/search-dropdown';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { db } from '@/server/db';
import { User } from '@/types/user';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/nextjs';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import Main from './main';

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

const LAYOUT_COOKIE_NAME = 'slackr-layout';

async function getLayoutFromCookie(): Promise<number[] | undefined> {
  const cookieStore = await cookies();
  const layout = cookieStore.get(LAYOUT_COOKIE_NAME)?.value;
  if (layout) {
    try {
      return JSON.parse(layout);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const user = await currentUser();
  const { workspace, members, joinedChannels, unjoinedChannels } =
    await getWorkspaceData(workspaceId, user?.id ?? '');

  const defaultLayout = await getLayoutFromCookie();

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
          <div className='h-screen flex flex-col'>
            <div className='h-[50px] border-b px-4 flex items-center gap-8 bg-violet-950'>
              <Link href='/' className='text-violet-50 font-bold text-2xl'>
                Slackr
              </Link>
              <div className='flex-1 flex justify-center gap-1'>
                <SearchDropdown />
              </div>
            </div>
            <Main defaultLayout={defaultLayout ?? [15, 65, 20]}>
              {children}
            </Main>
          </div>
        </WorkspaceProvider>
      </SignedIn>
    </>
  );
}
