import { useState } from 'react';
import { MapPin, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import CameraView from '@/components/CameraView';
import MessageList from '@/components/MessageList';
import ChatInput from '@/components/ChatInput';
import { useMessages } from '@/hooks/useMessages';
import { useLocation } from '@/hooks/useLocation';

const Index = () => {
  const { toast } = useToast();
  const { messages, isLoading, sendMessage, uploadImage } = useMessages();
  const { location, error: locationError } = useLocation();
  const [isSending, setIsSending] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(true);

  const handleCapture = (imageData: string) => {
    setCapturedImage(imageData);
    setShowCamera(false);
    toast({
      title: 'Photo captured!',
      description: 'Add a message and send.',
    });
  };

  const handleSend = async (content: string) => {
    setIsSending(true);

    let imageUrl: string | null = null;

    if (capturedImage) {
      imageUrl = await uploadImage(capturedImage);
      if (!imageUrl) {
        toast({
          title: 'Upload failed',
          description: 'Could not upload image',
          variant: 'destructive',
        });
        setIsSending(false);
        return;
      }
    }

    const success = await sendMessage(
      content,
      imageUrl,
      location?.latitude || null,
      location?.longitude || null
    );

    if (success) {
      setCapturedImage(null);
      setShowCamera(false);
      toast({ title: 'Message sent!' });
    } else {
      toast({
        title: 'Failed to send',
        description: 'Please try again',
        variant: 'destructive',
      });
    }

    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Live Chat</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            {location ? (
              <span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
            ) : locationError ? (
              <span>Location unavailable</span>
            ) : (
              <span>Getting location...</span>
            )}
          </div>
        </div>
        {!showCamera && !capturedImage && (
          <Button variant="outline" size="sm" onClick={() => setShowCamera(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Open Camera
          </Button>
        )}
      </header>

      {showCamera && !capturedImage && (
        <div className="p-4">
          <CameraView onCapture={handleCapture} />
        </div>
      )}

      {capturedImage && (
        <div className="p-4">
          <div className="relative">
            <img src={capturedImage} alt="Captured" className="w-full h-48 object-cover rounded-lg" />
            <button
              onClick={() => setCapturedImage(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput onSend={handleSend} isSending={isSending} />
    </div>
  );
};

export default Index;
