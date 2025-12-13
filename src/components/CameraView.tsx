import { useEffect } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';

interface CameraViewProps {
  onCapture: (imageData: string) => void;
}

const CameraView = ({ onCapture }: CameraViewProps) => {
  const { videoRef, isActive, error, startCamera, stopCamera, capturePhoto } = useCamera();

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    const photo = capturePhoto();
    if (photo) {
      onCapture(photo);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg">
        <CameraOff className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={startCamera} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-48 object-cover"
      />
      {isActive && (
        <Button
          onClick={handleCapture}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full w-14 h-14"
          size="icon"
        >
          <Camera className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default CameraView;
