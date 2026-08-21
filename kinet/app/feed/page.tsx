"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import FeedClient from "./_components/FeedClient";
import FeedDiscovery from "./_components/FeedDiscovery";
import FeedExperience from "./_components/FeedExperience";
import FeedStories from "./_components/FeedStories";
import KinetDrops from "./_components/KinetDrops";

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedStories />
      <KinetDrops />
      <FeedDiscovery />
      <FeedExperience />
      <FeedClient />
    </ProtectedRoute>
  );
}
