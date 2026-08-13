import Image from "next/image";
import type { CSSProperties, ReactEventHandler } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  style?: CSSProperties;
};

const optimizedHosts = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "res.cloudinary.com",
]);

export function canOptimizeMedia(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const hostname = new URL(src).hostname.toLowerCase();
    return optimizedHosts.has(hostname) || hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export default function OptimizedMedia({ src, alt, className, width, height, sizes, priority, onLoad, style }: Props) {
  if (!canOptimizeMedia(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- Unknown user hosts cannot safely use the server image proxy.
    return <img src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" className={className} onLoad={onLoad} style={style} />;
  }
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className={className} onLoad={onLoad} style={style} />;
}
