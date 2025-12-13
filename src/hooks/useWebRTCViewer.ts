import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCViewerOptions {
  sessionId: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const useWebRTCViewer = ({ sessionId, videoRef }: WebRTCViewerOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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
      if (event.candidate && sessionId) {
        console.log('Admin: Sending ICE candidate');
        await supabase.from('webrtc_signals').insert({
          session_id: sessionId,
          sender_type: 'admin',
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as unknown as Record<string, unknown>,
        } as never);
      }
    };

    pc.ontrack = (event) => {
      console.log('Admin: Received track:', event.track.kind);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Admin: Connection state:', pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');
      if (pc.connectionState === 'connected' || pc.connectionState === 'failed') {
        setIsConnecting(false);
      }
    };

    return pc;
  }, [sessionId, videoRef]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!sessionId) return;

    console.log('Admin: Handling offer from user');
    setIsConnecting(true);

    // Close existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    console.log('Admin: Sending answer');
    await supabase.from('webrtc_signals').insert({
      session_id: sessionId,
      sender_type: 'admin',
      signal_type: 'answer',
      signal_data: answer as unknown as Record<string, unknown>,
    } as never);
  }, [sessionId, createPeerConnection]);

  useEffect(() => {
    if (!sessionId) {
      // Cleanup when session is deselected
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    console.log('Admin: Setting up WebRTC viewer for session:', sessionId);

    // Check for existing offers
    const checkExistingOffers = async () => {
      const { data } = await supabase
        .from('webrtc_signals')
        .select('*')
        .eq('session_id', sessionId)
        .eq('sender_type', 'user')
        .eq('signal_type', 'offer')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        console.log('Admin: Found existing offer');
        const signalData = data[0].signal_data as unknown as RTCSessionDescriptionInit;
        await handleOffer(signalData);
      }
    };

    checkExistingOffers();

    // Listen for signals from user
    const channel = supabase
      .channel(`webrtc-admin-${sessionId}`)
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

          if (signal.sender_type !== 'user') return;

          console.log('Admin: Received signal from user:', signal.signal_type);

          if (signal.signal_type === 'offer') {
            await handleOffer(signal.signal_data as RTCSessionDescriptionInit);
          } else if (signal.signal_type === 'ice-candidate' && peerConnectionRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(signal.signal_data as RTCIceCandidateInit)
              );
            } catch (e) {
              console.error('Admin: Error adding ICE candidate:', e);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('Admin: Cleaning up WebRTC viewer');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [sessionId, handleOffer]);

  return { isConnected, isConnecting };
};
