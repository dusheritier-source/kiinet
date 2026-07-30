"use client";

import Image from "next/image";

interface DefaultAvatarProps {
  username?: string;
  className?: string;
}

export default function DefaultAvatar({ username, className }: DefaultAvatarProps) {
  const initial = username?.trim().charAt(0).toUpperCase() || "U";
  
  return (
    <div
      className={`flex items-center justify-center bg-yellow-400 text-yellow-950 font-bold ${className}`}
      role="img"
      aria-label={`${username || "User"} default profile picture`}
    >
      <span className="text-lg">{initial}</span>
    </div>
  );
}
