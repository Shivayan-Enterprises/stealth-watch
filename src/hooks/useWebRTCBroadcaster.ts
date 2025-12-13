import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCBroadcasterOptions {
  sessionId: string;
  stream: MediaStream | null;
}

export const useWebRTCBroadcaster = ({ sessionId, stream }: WebRTCBroadcasterOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('User: Sending ICE candidate');
        await supabase.from('webrtc_signals').insert({
          session_id: sessionId,
          sender_type: 'user',
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as unknown as Record<string, unknown>,
        } as never);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('User: Connection state:', pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');
    };

    return pc;
  }, [sessionId]);

  const handleAdminRequest = useCallback(async () => {
    if (!stream) {
      console.log('User: No stream available');
      return;
    }

    console.log('User: Creating peer connection for admin request');
    
    // Close existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    // Add tracks from stream
    stream.getTracks().forEach((track) => {
      console.log('User: Adding track:', track.kind);
      pc.addTrack(track, stream);
    });

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log('User: Sending offer');
    await supabase.from('webrtc_signals').insert({
      session_id: sessionId,
      sender_type: 'user',
      signal_type: 'offer',
      signal_data: offer as unknown as Record<string, unknown>,
    } as never);
  }, [stream, sessionId, createPeerConnection]);

  useEffect(() => {
    if (!sessionId || !stream) return;

    console.log('User: Setting up WebRTC broadcaster for session:', sessionId);

    // Listen for signals from admin
    const channel = supabase
      .channel(`webrtc-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const signal = payload.new as {
            sender_type: string;
            signal_type: string;
            signal_data: RTCSessionDescriptionInit | RTCIceCandidateInit;
          };

          if (signal.sender_type !== 'admin') return;

          console.log('User: Received signal from admin:', signal.signal_type);

          if (signal.signal_type === 'answer' && peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(signal.signal_data as RTCSessionDescriptionInit)
            );
          } else if (signal.signal_type === 'ice-candidate' && peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(signal.signal_data as RTCIceCandidateInit)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Automatically send offer when stream is ready
    handleAdminRequest();

    return () => {
      console.log('User: Cleaning up WebRTC broadcaster');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [sessionId, stream, handleAdminRequest]);

  return { isConnected };
};
