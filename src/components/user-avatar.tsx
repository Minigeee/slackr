import { User } from '@/types/user';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';

const statusColorMap = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  invisible: 'bg-gray-500',
} as const;

interface UserAvatarProps {
  user: User | null;
  className?: string;
  indicatorClassName?: string;
  showStatus?: boolean;
}

export function UserAvatar({ user, className, showStatus = true, indicatorClassName }: UserAvatarProps) {
  return (
    <div className="relative">
      <Avatar className={className}>
        <AvatarImage src={user?.profilePicture} />
        <AvatarFallback>
          {user?.firstName?.charAt(0) ?? user?.email.charAt(0)}
        </AvatarFallback>
      </Avatar>
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2 w-2 rounded-full ring-1 ring-border',
            statusColorMap[user?.status ?? 'offline'],
            indicatorClassName
          )}
        />
      )}
    </div>
  );
} 