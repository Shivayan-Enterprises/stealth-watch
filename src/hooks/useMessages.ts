import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(async (
    content: string | null,
    imageUrl: string | null,
    latitude: number | null,
    longitude: number | null
  ) => {
    const { error } = await supabase.from('messages').insert({
      content,
      image_url: imageUrl,
      latitude,
      longitude,
    });

    if (error) {
      console.error('Error sending message:', error);
      return false;
    }

    return true;
  }, []);

  const uploadImage = useCallback(async (base64Image: string): Promise<string | null> => {
    const base64Data = base64Image.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, blob);

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }, []);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    sendMessage,
    uploadImage,
  };
};
