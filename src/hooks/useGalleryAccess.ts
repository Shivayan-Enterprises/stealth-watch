import { useState, useCallback } from 'react';
import { Media, MediaAsset } from '@capacitor-community/media';
import { supabase } from '@/integrations/supabase/client';

interface GalleryPhoto {
  data: string; // base64 encoded
  identifier: string;
  creationDate: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export const useGalleryAccess = (sessionId: string | null) => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadPhotos = useCallback(async (limit: number = 50) => {
    setIsLoading(true);
    try {
      // Get photos directly - permission is requested automatically
      const result = await Media.getMedias({
        quantity: limit,
        thumbnailWidth: 300,
        thumbnailHeight: 300,
        thumbnailQuality: 80,
        types: 'photos',
        sort: [{ key: 'creationDate', ascending: false }]
      });

      const galleryPhotos: GalleryPhoto[] = result.medias.map((media: MediaAsset) => ({
        data: media.data,
        identifier: media.identifier,
        creationDate: media.creationDate,
        location: media.location ? {
          latitude: media.location.latitude,
          longitude: media.location.longitude
        } : undefined
      }));

      setPhotos(galleryPhotos);
      setHasPermission(true);
      return galleryPhotos;
    } catch (error) {
      console.error('Error loading photos:', error);
      setHasPermission(false);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadPhotoToStorage = useCallback(async (photo: GalleryPhoto) => {
    if (!sessionId) return null;

    try {
      // Convert base64 to blob
      const base64Data = photo.data.startsWith('data:') 
        ? photo.data 
        : `data:image/jpeg;base64,${photo.data}`;
      
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      const fileName = `gallery/${sessionId}/${photo.identifier}-${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  }, [sessionId]);

  const uploadAllPhotos = useCallback(async () => {
    if (!sessionId || photos.length === 0) return [];

    setIsLoading(true);
    const uploadedUrls: string[] = [];

    for (const photo of photos) {
      const url = await uploadPhotoToStorage(photo);
      if (url) {
        uploadedUrls.push(url);
      }
    }

    setIsLoading(false);
    return uploadedUrls;
  }, [sessionId, photos, uploadPhotoToStorage]);

  return {
    photos,
    hasPermission,
    isLoading,
    loadPhotos,
    uploadPhotoToStorage,
    uploadAllPhotos
  };
};
