"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import FeedClient from "./_components/FeedClient";

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedClient />
    </ProtectedRoute>
  );
}
