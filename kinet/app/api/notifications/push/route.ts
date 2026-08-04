import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

  if (!process.env.PUSH_DELIVERY_WEBHOOK_URL) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: "PUSH_DELIVERY_WEBHOOK_URL is not set, so the push payload was generated but not delivered.",
      payload: body,
    });
  }

  const response = await fetch(process.env.PUSH_DELIVERY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: body.token.trim(),
      title: body.title?.trim() || "Kinet",
      body: body.body?.trim() || "You have a new alert.",
      link: body.link?.trim() || "/notifications",
      icon: body.icon?.trim() || "/icon.svg",
      tag: body.tag?.trim() || "kinet-notification",
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Push delivery failed." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
