import { NextResponse } from "next/server";
import { limitForUser, requireApiUser } from "@/lib/api-security";

const systemPrompt = [
  "You are Kinet Highlight Analyst.",
  "Review sports highlight context and return concise, creator-friendly analysis.",
  "Focus on what stands out, what the athlete did well, and one improvement or recruiting angle.",
  "Keep the tone sharp, supportive, and social-ready.",
].join(" ");

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if (authResult.response) return authResult.response;
  const limited = limitForUser(request, authResult.user.uid, "highlight-analysis", 12, 60_000);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    caption?: string;
    sport?: string;
    contentType?: "post" | "reel";
    autoCaption?: string;
  };

  const caption = body.caption?.trim() || "";
  const sport = body.sport?.trim() || "sport";
  const contentType = body.contentType || "post";
  const autoCaption = body.autoCaption?.trim() || "";

  if (!caption && !autoCaption) {
    return NextResponse.json(
      { error: "Add a caption or generated caption before running analysis." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    const fallback = `Strong ${sport} ${contentType}: quick decision-making, clear confidence, and a shareable moment. Add one line of context so viewers know the game situation and why the play matters.`;
    return NextResponse.json({ analysis: fallback, simulated: true });
  }

  try {
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
                text: `Sport: ${sport}\nFormat: ${contentType}\nCaption: ${caption || "None"}\nAuto-caption: ${autoCaption || "None"}\n\nReturn 2-3 sentences of highlight analysis.`,
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
      analysis:
        data.output_text ||
        `Strong ${sport} highlight. Add one line of context about the play and one line on what it shows about your game.`,
    });
  } catch {
    return NextResponse.json(
      { error: "The highlight analysis service could not be reached right now." },
      { status: 500 }
    );
  }
}
