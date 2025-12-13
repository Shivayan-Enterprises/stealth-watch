import { useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseVideoRecorderProps {
  sessionId: string;
  stream: MediaStream | null;
}

export const useVideoRecorder = ({ sessionId, stream }: UseVideoRecorderProps) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const uploadVideo = useCallback(async (videoBlob: Blob) => {
    if (!sessionId || videoBlob.size === 0) {
      console.log('No video to upload or no session');
      return;
    }

    const fileName = `${sessionId}-${Date.now()}.webm`;
    console.log('Uploading video:', fileName, 'Size:', videoBlob.size);

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(`videos/${fileName}`, videoBlob, {
        contentType: 'video/webm',
      });

    if (error) {
      console.error('Error uploading video:', error);
    } else {
      console.log('Video uploaded successfully:', fileName);
    }
  }, [sessionId]);

  const stopAndSave = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('Stopping recorder and saving video...');
      
      return new Promise<void>((resolve) => {
        if (!mediaRecorderRef.current) {
          resolve();
          return;
        }

        mediaRecorderRef.current.onstop = async () => {
          if (chunksRef.current.length > 0) {
            const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
            await uploadVideo(videoBlob);
            chunksRef.current = [];
          }
          resolve();
        };

        mediaRecorderRef.current.stop();
      });
    }
  }, [uploadVideo]);

  useEffect(() => {
    if (!stream || !sessionId) return;

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('Video chunk recorded, total chunks:', chunksRef.current.length);
        }
      };

      mediaRecorder.start(5000); // Record in 5 second chunks
      mediaRecorderRef.current = mediaRecorder;
      console.log('Video recording started');
    } catch (err) {
      console.error('MediaRecorder error:', err);
    }

    // Save video when page is closed/hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAndSave();
      }
    };

    const handleBeforeUnload = () => {
      stopAndSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopAndSave();
    };
  }, [stream, sessionId, stopAndSave]);

  return { stopAndSave };
};
