"use client";

import { auth } from "@/lib/firebase";

export async function moderateTextBeforePublish(text: string, purpose: string) {
  if (!text.trim()) return;
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  const token = await user.getIdToken(true);
  let response: Response;
  try {
    response = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, purpose }),
    });
  } catch {
    throw new Error("Message moderation could not be reached. Please refresh and try again.");
  }
  let result: { error?: string } = {};
  try {
    result = await response.json() as { error?: string };
  } catch {
    throw new Error("Message moderation returned an invalid response. Please try again.");
  }
  if (!response.ok) {
    throw new Error(result.error || (response.status === 422
      ? "This message violates Kinet Community Guidelines and cannot be sent."
      : "Message moderation is unavailable. Please try again."));
  }
}