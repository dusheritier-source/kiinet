import * as React from "react";
/* eslint-disable @next/next/no-img-element -- This primitive forwards native image props and refs. */
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function hasUsableAvatarSrc(src: string | null | undefined) {
  if (typeof src !== "string") return false;
  const normalized = src.trim();
  if (!normalized) return false;
  if (normalized.toLowerCase() === "null" || normalized.toLowerCase() === "undefined") return false;
  return true;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt = "", onError, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      setHasError(false);
    }, [src]);

    const imageSrc = typeof src === "string" ? src : "";

    if (!hasUsableAvatarSrc(imageSrc) || hasError) {
      return null;
    }

    return (
      <img
        ref={ref}
        src={imageSrc}
        alt={alt}
        loading="lazy"
        className={cn("absolute inset-0 z-10 h-full w-full object-cover", className)}
        onError={(event) => {
          setHasError(true);
          if (onError) {
            onError(event);
          }
        }}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage";

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, delayMs = 0, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(delayMs === 0);

    React.useEffect(() => {
      if (delayMs > 0) {
        const timer = setTimeout(() => setIsVisible(true), delayMs);
        return () => clearTimeout(timer);
      }
    }, [delayMs]);

    if (!isVisible) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute inset-0 z-0 flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground",
          className
        )}
        {...props}
      />
    );
  }
);
AvatarFallback.displayName = "AvatarFallback";

interface ProfileAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  username?: string;
  alt?: string;
}

function ProfileAvatar({
  src,
  username,
  alt,
  className,
  ...props
}: ProfileAvatarProps) {
  return (
    <Avatar className={cn("overflow-hidden rounded-full bg-muted", className)} {...props}>
      <AvatarImage src={src ?? ""} alt={alt || username || "User"} />
      <AvatarFallback>{username?.trim().slice(0, 1) || "U"}</AvatarFallback>
    </Avatar>
  );
}

ProfileAvatar.displayName = "ProfileAvatar";

export { Avatar, AvatarImage, AvatarFallback, ProfileAvatar };
