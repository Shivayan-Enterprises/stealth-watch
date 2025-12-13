import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MessageList from '@/components/MessageList';
import ChatInput from '@/components/ChatInput';
import { useMessages } from '@/hooks/useMessages';
import { useLocation } from '@/hooks/useLocation';

const Index = () => {
  const { toast } = useToast();
  const { messages, isLoading, sendMessage, uploadImage } = useMessages();
  const { location } = useLocation();
  const [isSending, setIsSending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera error:', err);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = (): string | null => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleSend = async (content: string) => {
    setIsSending(true);

    const photo = capturePhoto();
    let imageUrl: string | null = null;

    if (photo) {
      imageUrl = await uploadImage(photo);
    }

    const success = await sendMessage(
      content,
      imageUrl,
      location?.latitude || null,
      location?.longitude || null
    );

    if (success) {
      toast({ title: 'Sent!' });
    } else {
      toast({
        title: 'Failed',
        variant: 'destructive',
      });
    }

    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 border-b">
        <h1 className="text-xl font-bold text-foreground">Live Chat</h1>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          {location ? (
            <span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
          ) : (
            <span>Getting location...</span>
          )}
        </div>
      </header>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-32 object-cover"
      />

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput onSend={handleSend} isSending={isSending} />
    </div>
  );
};

export default Index;
