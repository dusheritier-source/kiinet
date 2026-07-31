"use client";

import { RealtimeChatExample } from "@/lib/realtime-db-example";

export default function TestRealtimePage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Realtime Database Test</h1>
      <RealtimeChatExample conversationId="test-conversation-123" />
    </div>
  );
}