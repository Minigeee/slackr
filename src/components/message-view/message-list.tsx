import { type Message } from '@prisma/client';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { User } from '@/types/user';
import { memo, useMemo } from 'react';

dayjs.extend(calendar);

interface MessageWithUser extends Message {
  user: User | undefined;
}

interface MessageProps {
  message: MessageWithUser;
}

const Message = ({ message }: MessageProps) => {
  const name = useMemo(() => {
    if (message.user?.firstName && message.user?.lastName) {
      return `${message.user.firstName} ${message.user.lastName}`;
    }
    return message.user?.email ?? 'Unknown User';
  }, [message.user?.firstName, message.user?.lastName, message.user?.email]);

  const initials = useMemo(() => {
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <div className='group flex gap-3 hover:bg-muted/50 px-3 py-2 rounded-lg'>
      <Avatar>
        <AvatarImage src={message.user?.profilePicture ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className='flex flex-col flex-1'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold'>{name}</span>
          <span className='text-xs text-muted-foreground'>
            {dayjs(message.createdAt).calendar()}
          </span>
        </div>
        <div
          className={cn(
            'prose prose-sm overflow-hidden break-words w-full',
            'prose-p:my-0 prose-p:leading-snug',
            'prose-ol:my-1 prose-ul:my-1',
            'prose-li:my-0',
          )}
          dangerouslySetInnerHTML={{ __html: message.content }}
        />
      </div>
    </div>
  );
};
const MemoMessage = memo(Message);

interface MessageListProps {
  messages: MessageWithUser[];
}

const MessageList = ({ messages }: MessageListProps) => {
  return (
    <div className='flex flex-col-reverse gap-4 overflow-y-auto p-4'>
      {messages.map((message) => (
        <MemoMessage key={message.id} message={message} />
      ))}
    </div>
  );
};

export default MessageList;
