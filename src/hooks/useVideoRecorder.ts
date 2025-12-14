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

    // Check if stream has active video tracks
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0 || !videoTracks[0].enabled) {
      console.log('No active video tracks available for recording');
      return;
    }

    try {
      // Try different codecs for better compatibility
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        console.error('No supported video mimeType found');
        return;
      }

      console.log('Using mimeType:', selectedMimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('Video chunk recorded, size:', event.data.size, 'total chunks:', chunksRef.current.length);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.start(3000); // Record in 3 second chunks for faster saving
      mediaRecorderRef.current = mediaRecorder;
      console.log('Video recording started for session:', sessionId);
    } catch (err) {
      console.error('MediaRecorder initialization error:', err);
    }

    // Save video when page is closed/hidden
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        console.log('Page hidden, saving video...');
        await stopAndSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Trigger synchronous save attempt
      if (chunksRef.current.length > 0 && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        // Use sendBeacon for reliable upload on page unload
        const formData = new FormData();
        formData.append('video', videoBlob, `${sessionId}-${Date.now()}.webm`);
        navigator.sendBeacon('/api/upload-video', formData);
      }
      stopAndSave();
    };

    const handlePageHide = async () => {
      console.log('Page hide event, saving video...');
      await stopAndSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      stopAndSave();
    };
  }, [stream, sessionId, stopAndSave]);

  return { stopAndSave };
};
