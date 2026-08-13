import { NextResponse } from "next/server";
import { processDueJobs, runMaintenance } from "@/lib/job-queue";
import { logEvent, requestId } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  const id = requestId(request);
  if (!authorized(request)) {
    logEvent("warn", "jobs.unauthorized", { requestId: id });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "x-request-id": id } });
  }
  const startedAt = Date.now();
  try {
    const [jobs, maintenance] = await Promise.all([processDueJobs(), runMaintenance()]);
    logEvent("info", "jobs.completed", { requestId: id, durationMs: Date.now() - startedAt, jobs, maintenance });
    return NextResponse.json({ ok: true, jobs, maintenance }, { headers: { "x-request-id": id } });
  } catch (error) {
    logEvent("error", "jobs.failed", { requestId: id, durationMs: Date.now() - startedAt, error });
    return NextResponse.json({ error: "Background processing failed", requestId: id }, { status: 500, headers: { "x-request-id": id } });
  }
}

export const GET = POST;
