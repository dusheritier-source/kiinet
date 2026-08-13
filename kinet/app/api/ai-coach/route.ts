import { NextResponse } from "next/server";
import { limitForUser, requireApiUser } from "@/lib/api-security";

const systemPrompt = [
  "You are Kinet AI Coach, a supportive sports performance assistant.",
  "Give practical, sport-focused coaching advice.",
  "Be concise, structured, and actionable.",
  "Prioritize drills, routines, recovery, mindset, and player development.",
  "Do not claim to diagnose injuries or provide medical treatment.",
].join(" ");

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if (authResult.response) return authResult.response;
  const limited = limitForUser(request, authResult.user.uid, "ai-coach", 12, 60_000);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    mode?: "chat" | "plan" | "profile";
    context?: string;
  };
  const message = body.message?.trim() || "";
  const mode = body.mode || "chat";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const taskPrompt =
    mode === "plan"
      ? "Build a 7-day training plan with daily focus, drills, recovery, and mindset checkpoints."
      : mode === "profile"
        ? "Give concrete profile optimization tips for recruiting visibility, credibility, and clarity."
        : "Answer the athlete's question with practical coaching advice.";

  const provider =
    process.env.GROQ_API_KEY
      ? "groq"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : null;

  if (!provider) {
    return NextResponse.json(
      { error: "Add GROQ_API_KEY or OPENAI_API_KEY to your environment to enable the AI coach." },
      { status: 500 }
    );
  }

  try {
    if (provider === "groq") {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: `${taskPrompt}\n\nUser request:\n${message}\n\nOptional context:\n${
                body.context?.trim() || "None provided."
              }`,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        return NextResponse.json(
          { error: data.error?.message || "Groq request failed." },
          { status: response.status }
        );
      }

      return NextResponse.json({
        response:
          data.choices?.[0]?.message?.content ||
          "I couldn't generate coaching guidance just now.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${taskPrompt}\n\nUser request:\n${message}\n\nOptional context:\n${
                  body.context?.trim() || "None provided."
                }`,
              },
            ],
          },
        ],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      output_text?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "OpenAI request failed." },
        { status: response.status }
      );
    }

    return NextResponse.json({
      response: data.output_text || "I couldn't generate coaching guidance just now.",
    });
  } catch {
    return NextResponse.json(
      { error: "The AI coach could not reach the model provider right now." },
      { status: 500 }
    );
  }
}
