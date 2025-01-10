import { WorkspaceForm } from '@/components/workspace-form';
import { api } from '@/trpc/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cache } from 'react';

const getWorkspaces = cache(() => {
  return api.workspace.getAll();
});

async function createWorkspace(formData: FormData) {
  'use server';

  try {
    const name = formData.get('name') as string;
    const workspace = await api.workspace.create({
      name,
    });

    revalidatePath('/w');
    redirect(`/w/${workspace.id}`);
  } catch (error) {
    return { error: 'Failed to create workspace. Please try again.' };
  }
}

export default async function Page() {
  const workspaces = await getWorkspaces();

  if (workspaces.length > 0) {
    redirect(`/w/${workspaces[0]?.id}`);
  }

  return <WorkspaceForm onSubmit={createWorkspace} />;
}
