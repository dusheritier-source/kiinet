import { NextResponse } from "next/server";
import { limitForUser, requireApiUser } from "@/lib/api-security";
import { enqueueJob } from "@/lib/job-queue";

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if (authResult.response) return authResult.response;
  const limited = limitForUser(request, authResult.user.uid, "digest", 5, 60_000);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string;
    digest?: {
      total?: number;
      unread?: number;
      byType?: Array<{ type?: string; count?: number }>;
    };
  };

  if (!body.recipientEmail?.trim()) {
    return NextResponse.json({ error: "recipientEmail is required." }, { status: 400 });
  }
  if (!authResult.user.email || body.recipientEmail.trim().toLowerCase() !== authResult.user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can only send a digest to your account email." }, { status: 403 });
  }

  const digest = body.digest ?? { total: 0, unread: 0, byType: [] };
  const text = [
    `Kinet Digest`,
    `Unread: ${digest.unread ?? 0}`,
    `Recent: ${digest.total ?? 0}`,
    "",
    ...(digest.byType ?? []).map((entry) => `${entry.type}: ${entry.count}`),
  ].join("\n");

  const payload = {
      to: body.recipientEmail.trim(),
      subject: "Your Kinet Digest",
      text,
      digest,
  };
  const jobId = await enqueueJob("email_digest", payload, `${authResult.user.uid}:${payload.to}:${digest.total}:${digest.unread}`);
  return NextResponse.json({ ok: true, queued: true, jobId }, { status: 202 });
}
