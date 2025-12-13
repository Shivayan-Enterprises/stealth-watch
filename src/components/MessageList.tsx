import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  sender_role: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">No messages yet. Send a photo to start!</p>
      </div>
    );
  }

  // Filter out admin_capture messages (hidden from user view)
  const visibleMessages = messages.filter(m => m.sender_role !== 'admin_capture');

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-xs rounded-lg p-3 shadow-sm ${
              message.sender_role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {message.content && (
              <p>{message.content}</p>
            )}
            
            {message.latitude && message.longitude && (
              <div className="flex items-center gap-1 text-xs mt-2 opacity-70">
                <MapPin className="h-3 w-3" />
                <span>{message.latitude.toFixed(4)}, {message.longitude.toFixed(4)}</span>
              </div>
            )}
            
            <p className="text-xs mt-1 opacity-50">
              {format(new Date(message.created_at), 'HH:mm')}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
