"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import FeedClient from "./_components/FeedClient";
import FeedDiscovery from "./_components/FeedDiscovery";
import FeedExperience from "./_components/FeedExperience";
import FeedStories from "./_components/FeedStories";

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedStories />
      <FeedDiscovery />
      <FeedExperience />
      <FeedClient />
    </ProtectedRoute>
  );
}
