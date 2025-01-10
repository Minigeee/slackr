import type { Workspace } from '@prisma/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Copy, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceHeaderProps {
  workspace: Workspace;
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const utils = api.useContext();
  const { toast } = useToast();

  const { mutateAsync: updateWorkspace } = api.workspace.update.useMutation({
    onSuccess: () => {
      utils.workspace.getAll.invalidate();
      utils.workspace.getById.invalidate({ workspaceId: workspace.id });
    },
  });

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    await updateWorkspace({
      workspaceId: workspace.id,
      name: workspaceName,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setWorkspaceName(workspace.name);
    }
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/${workspace.id}`;
    navigator.clipboard.writeText(inviteLink);
    toast({
      description: 'Invite link copied to clipboard',
    });
  };

  if (isEditing) {
    return (
      <div className='flex h-12 flex-shrink-0 items-center border-b px-4'>
        <form onSubmit={handleRename} className="flex-1">
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              setWorkspaceName(workspace.name);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
          />
        </form>
      </div>
    );
  }

  return (
    <div className='flex h-12 flex-shrink-0 items-center border-b px-4'>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 font-semibold outline-none">
          {workspaceName}
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52" align="start">
          <DropdownMenuItem onSelect={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleCopyInviteLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy invite link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
