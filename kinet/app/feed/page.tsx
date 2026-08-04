"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import FeedClient from "./_components/FeedClient";
import FeedDiscovery from "./_components/FeedDiscovery";
import FeedExperience from "./_components/FeedExperience";

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedDiscovery />
      <FeedExperience />
      <FeedClient />
    </ProtectedRoute>
  );
}
