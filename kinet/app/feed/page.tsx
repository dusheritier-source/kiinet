import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import FeedClient from "./_components/FeedClient";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-400" />
        </div>
      }
    >
      <FeedClient userId={session.user.id} />
    </Suspense>
  );
}