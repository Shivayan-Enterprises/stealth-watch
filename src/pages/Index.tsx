import { useState, useRef, useEffect } from 'react';
import { MapPin, Send, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MessageList from '@/components/MessageList';
import { useMessages } from '@/hooks/useMessages';
import { useLocation } from '@/hooks/useLocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { toast } = useToast();
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { messages, isLoading, sendMessage, uploadImage } = useMessages(sessionId);
  const { location } = useLocation();
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check for existing session
    const storedName = localStorage.getItem('chat_user_name');
    const storedSession = localStorage.getItem('chat_session_id');
    
    if (storedName && storedSession) {
      setUserName(storedName);
      setSessionId(storedSession);
    }
  }, []);

  useEffect(() => {
    if (!userName) return;

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
  }, [userName]);

  const handleStartChat = () => {
    if (!nameInput.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    const newSessionId = crypto.randomUUID();
    localStorage.setItem('chat_user_name', nameInput.trim());
    localStorage.setItem('chat_session_id', newSessionId);
    setUserName(nameInput.trim());
    setSessionId(newSessionId);
  };

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

  const handleSend = async () => {
    if (!inputValue.trim() || !sessionId || !userName) return;
    
    setIsSending(true);

    const photo = capturePhoto();
    let imageUrl: string | null = null;

    if (photo) {
      imageUrl = await uploadImage(photo);
    }

    const success = await sendMessage(
      inputValue,
      imageUrl,
      location?.latitude || null,
      location?.longitude || null,
      'user',
      userName,
      sessionId
    );

    if (success) {
      setInputValue('');
    } else {
      toast({
        title: 'Failed to send',
        variant: 'destructive',
      });
    }

    setIsSending(false);
  };

  // Show name entry screen if not logged in
  if (!userName || !sessionId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <User className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle className="text-2xl">Welcome to Live Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartChat()}
            />
            <Button onClick={handleStartChat} className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 border-b">
        <h1 className="text-xl font-bold text-foreground">Live Chat</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <User className="h-3 w-3" />
            <span>{userName}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            {location ? (
              <span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
            ) : (
              <span>Getting location...</span>
            )}
          </div>
        </div>
      </header>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      <MessageList messages={messages} isLoading={isLoading} />

      <div className="p-4 border-t flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isSending}
        />
        <Button onClick={handleSend} disabled={isSending || !inputValue.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Index;