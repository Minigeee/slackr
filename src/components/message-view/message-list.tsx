import { FullMessage } from '@/types/message';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { Message } from './message';

dayjs.extend(calendar);

interface MessageListProps {
  messages: FullMessage[];
  onReply?: (message: FullMessage) => void;
}

const MessageList = ({ messages, onReply }: MessageListProps) => {
  return (
    <div className='flex flex-col-reverse gap-4 overflow-y-auto p-4'>
      {messages.map((message) => (
        <Message key={message.id} message={message} onReply={onReply} />
      ))}
    </div>
  );
};

export default MessageList;
