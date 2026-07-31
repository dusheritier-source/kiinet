import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LandingPageClient from "./_components/LandingPageClient";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/feed");
  }

  return <LandingPageClient />;
}