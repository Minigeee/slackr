import { api } from '@/trpc/server';
import { currentUser } from '@clerk/nextjs/server';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { redirect } from 'next/navigation';

async function JoinCard({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const workspace = await api.workspace.getById({
    workspaceId,
  });

  async function handleJoin() {
    'use server';
    
    if (!userId) return;

    await api.workspace.addMember({
      workspaceId,
      userId,
    });

    redirect(`/w/${workspaceId}`);
  }

  const initials = workspace.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader className="flex items-center space-y-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <h2 className="text-3xl font-bold text-center">{workspace.name}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-600">
            You've been invited to join this workspace
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <form action={handleJoin}>
            <Button type="submit" size="lg">
              Join Workspace
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

export default async function JoinWorkspacePage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const user = await currentUser();

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        {user && <JoinCard workspaceId={params.workspaceId} userId={user.id} />}
      </SignedIn>
    </>
  );
}