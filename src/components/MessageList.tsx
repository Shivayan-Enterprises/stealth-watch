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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className="bg-card rounded-lg p-3 shadow-sm border"
        >
          {message.image_url && (
            <img
              src={message.image_url}
              alt="Chat"
              className="rounded-lg w-full max-w-xs mb-2"
            />
          )}
          
          {message.content && (
            <p className="text-foreground">{message.content}</p>
          )}
          
          {message.latitude && message.longitude && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <MapPin className="h-3 w-3" />
              <span>{message.latitude.toFixed(4)}, {message.longitude.toFixed(4)}</span>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(message.created_at), 'HH:mm')}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
