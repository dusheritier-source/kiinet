import Image, { ImageProps } from 'next/image';
import React from 'react';
import { getPublicUrl } from '@/lib/supabase-storage';

type Props = Omit<ImageProps, 'src'> & {
  srcPath: string; // path in Supabase bucket or full URL
  bucket?: string; // optional bucket when using path
};

export default function OptimizedImage({ srcPath, bucket = 'kinet-media', alt, ...rest }: Props) {
  let src = srcPath;
  try {
    // If srcPath looks like a full URL, use it directly; otherwise build public URL
    const isFullUrl = /^https?:\/\//i.test(srcPath);
    if (!isFullUrl) {
      src = getPublicUrl(bucket, srcPath);
    }
  } catch (err) {
    // fallback to provided srcPath
    src = srcPath;
  }

  return <Image src={src} alt={alt ?? ''} {...rest} />;
}
