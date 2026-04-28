import { supabase } from '../lib/supabase';
import { STORAGE_BUCKET_UPLOADS } from '../config/storage';

export const getPublicUploadUrl = (path: string): string => {
    // If it's already a full HTTP URL or Data URI, return it as is
    if (path.startsWith('http') || path.startsWith('data:')) {
        return path;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET_UPLOADS).getPublicUrl(path);
    return data.publicUrl;
};
