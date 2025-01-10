import { useWorkspace } from '@/contexts/workspace-context';
import { cn } from '@/lib/utils';
import { UserStatus } from '@/types/user';
import { useClerk, useUser } from '@clerk/nextjs';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { UserAvatar } from '../user-avatar';

export function UserFooter() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { members, workspace, setStatus } = useWorkspace();

  const handleStatusChange = async (status: UserStatus) => {
    if (!workspace) return;
    await setStatus(status);
  };

  // Get current user object
  const currentUser = members[user?.id ?? ''];

  if (!currentUser) return null;

  return (
    <div className='border-t p-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='w-full justify-start gap-2 px-2 hover:bg-indigo-100'
          >
            <UserAvatar user={currentUser} className='h-8 w-8' />
            <span className='text-sm font-medium'>
              {currentUser.firstName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56'>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'online' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('online')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-green-500' />
            Online
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'busy' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('busy')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-red-600' />
            Busy
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              'cursor-pointer',
              currentUser.status === 'invisible' && 'bg-accent',
            )}
            onClick={() => handleStatusChange('invisible')}
          >
            <span className='mr-2 h-2 w-2 rounded-full bg-gray-500' />
            Appear Offline
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='cursor-pointer text-red-500'
            onClick={async () => {
              try {
                await signOut();
                router.push('/');
              } catch (error) {
                console.error('Failed to sign out:', error);
              }
            }}
          >
            <LogOut className='mr-2 h-4 w-4' />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
