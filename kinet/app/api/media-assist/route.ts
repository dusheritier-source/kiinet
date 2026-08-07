import { NextResponse } from "next/server";

type MediaTask =
  | "caption_rewrite"
  | "hashtags"
  | "translate"
  | "voiceover"
  | "thumbnail";

type ProfileContext = {
  displayName?: string;
  username?: string;
  email?: string;
  contentType?: string;
  visibility?: string;
};

function buildFallback(task: MediaTask, body: { caption?: string; sport?: string; autoCaption?: string }) {
  const caption = body.caption?.trim() || body.autoCaption?.trim() || "Fresh highlight clip";
  const sport = body.sport?.trim() || "basketball";

  if (task === "hashtags") {
    return `#${sport.toLowerCase().replace(/\s+/g, "")} #highlight #Kinet #athlete #gametape`;
  }

  if (task === "translate") {
    return `Translated caption draft: ${caption}`;
  }

  if (task === "voiceover") {
    return `Start with the setup, call out the read, then finish with the result: ${caption}. Keep the tone confident and short.`;
  }

  if (task === "thumbnail") {
    return "Choose the frame right before the finish, when the athlete and defender are both visible and the ball is still in motion.";
  }

  return `${sport} highlight: ${caption}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    task?: MediaTask;
    caption?: string;
    sport?: string;
    autoCaption?: string;
    targetLanguage?: string;
    profileContext?: ProfileContext;
  };

  const task = body.task;
  if (!task) {
    return NextResponse.json({ error: "Task is required." }, { status: 400 });
  }

  const provider = process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : null;

  if (!provider) {
    return NextResponse.json({ result: buildFallback(task, body) });
  }

  const profileContextText = [
    body.profileContext?.displayName ? `Creator: ${body.profileContext.displayName}` : null,
    body.profileContext?.username ? `Username: ${body.profileContext.username}` : null,
    body.profileContext?.contentType ? `Content type: ${body.profileContext.contentType}` : null,
    body.profileContext?.visibility ? `Visibility: ${body.profileContext.visibility}` : null,
  ].filter(Boolean).join("\n");

  const prompt =
    task === "hashtags"
      ? "Return only a short line of 5-7 high-signal hashtags for this sports clip."
      : task === "translate"
        ? `Translate the sports caption into ${body.targetLanguage?.trim() || "Spanish"}. Return only the translated caption.`
        : task === "voiceover"
          ? "Write a short, high-energy voiceover script for a sports highlight reel clip. Return only the script."
          : task === "thumbnail"
            ? "Recommend the best thumbnail moment for this sports clip. Return only one concise recommendation."
            : "Rewrite this sports caption to sound sharper, cleaner, and more shareable. Return only the rewritten caption.";

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
              content: "You are Kinet Media Lab AI. Be concise, creator-focused, and sports-native.",
            },
            {
              role: "user",
              content: `${prompt}\n\n${profileContextText ? `Profile context:\n${profileContextText}\n` : ""}Sport: ${body.sport || "Unknown"}\nCaption: ${body.caption || ""}\nAuto-caption: ${body.autoCaption || ""}`,
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

      return NextResponse.json({ result: data.choices?.[0]?.message?.content?.trim() || buildFallback(task, body) });
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
            content: [
              {
                type: "input_text",
                text: "You are Kinet Media Lab AI. Be concise, creator-focused, and sports-native.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${prompt}\n\n${profileContextText ? `Profile context:\n${profileContextText}\n` : ""}Sport: ${body.sport || "Unknown"}\nCaption: ${body.caption || ""}\nAuto-caption: ${body.autoCaption || ""}`,
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

    return NextResponse.json({ result: data.output_text || buildFallback(task, body) });
  } catch {
    return NextResponse.json({ result: buildFallback(task, body) });
  }
}
