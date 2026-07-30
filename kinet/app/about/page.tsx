import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pillars = [
  {
    title: "Share your moments",
    description: "Post photos, videos, ideas, and milestones with the people who matter to you.",
  },
  {
    title: "Find your people",
    description: "Connect with friends, creators, and communities around shared interests.",
  },
  {
    title: "Create freely",
    description: "Use creative tools to share your ideas and express yourself.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-primary">About Kinet</p>
        <h1 className="mb-4 text-4xl font-bold">A social network built around connection, not noise.</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Kinet is designed to help people share what they care about, discover new voices, and build meaningful communities.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title}>
            <CardHeader>
              <CardTitle className="text-xl">{pillar.title}</CardTitle>
              <CardDescription>{pillar.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-10 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Ready to build your profile?</h2>
            <p className="text-muted-foreground">
              Join the network and start sharing your story.
            </p>
          </div>
          <Button asChild>
            <Link href="/signup">Create your account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
