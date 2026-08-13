import { NextResponse } from "next/server";
import { limitForUser, requireApiUser } from "@/lib/api-security";
import { enqueueJob } from "@/lib/job-queue";

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if (authResult.response) return authResult.response;
  const limited = limitForUser(request, authResult.user.uid, "push", 10, 60_000);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    title?: string;
    body?: string;
    link?: string;
    icon?: string;
    tag?: string;
  };

  if (!body.token?.trim()) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const payload = {
      token: body.token.trim(),
      title: body.title?.trim() || "Kinet",
      body: body.body?.trim() || "You have a new alert.",
      link: body.link?.trim() || "/notifications",
      icon: body.icon?.trim() || "/icon.svg",
      tag: body.tag?.trim() || "kinet-notification",
  };
  const jobId = await enqueueJob("push", payload, `${authResult.user.uid}:${payload.token}:${payload.tag}:${payload.body}`);
  return NextResponse.json({ ok: true, queued: true, jobId }, { status: 202 });
}
