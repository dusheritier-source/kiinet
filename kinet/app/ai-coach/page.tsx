"use client";

import { useEffect, useState } from "react";
import { Brain, ClipboardList, Dumbbell, Pencil, Send, Sparkles, Trash2 } from "lucide-react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildProfileOptimizationPrompt,
  deleteCoachEntry,
  getCoachHistory,
  renameCoachEntry,
  saveCoachEntry,
  type CoachEntry,
} from "@/lib/ai-tools";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type ChatMessage = {
  role: "ai" | "user";
  text: string;
};

async function requestCoach(input: {
  message: string;
  mode: "chat" | "plan" | "profile";
  context?: string;
}) {
  const response = await authenticatedFetch("/api/ai-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await response.json()) as { response?: string; error?: string };
}

function AICoachPageContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "I'm your Kinet AI Coach. Ask about training, recovery, mindset, or use the quick tools to generate plans and profile tips.",
    },
  ]);
  const [history, setHistory] = useState<CoachEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("");
  const [profileTips, setProfileTips] = useState("");
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});

  const refreshHistory = async () => {
    setHistory(await getCoachHistory());
  };

  useEffect(() => {
    void refreshHistory();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }

    const userMessage = input.trim();
    setMessages((current) => [...current, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const data = await requestCoach({ message: userMessage, mode: "chat" });
      const reply = data.response || data.error || "I couldn't generate a response just now.";

      setMessages((current) => [...current, { role: "ai", text: reply }]);
      await saveCoachEntry({ type: "chat", title: "Coach Chat", prompt: userMessage, response: reply });
      await refreshHistory();
    } catch {
      setMessages((current) => [
        ...current,
        { role: "ai", text: "I couldn't reach the coaching service. Try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlan = async () => {
    setLoading(true);
    try {
      const prompt = "Build me a training plan that helps me improve this week.";
      const data = await requestCoach({ message: prompt, mode: "plan" });
      const reply = data.response || data.error || "No training plan was generated.";
      setPlan(reply);
      await saveCoachEntry({ type: "plan", title: "Weekly Training Plan", prompt, response: reply });
      await refreshHistory();
    } finally {
      setLoading(false);
    }
  };

  const handleProfileTips = async () => {
    setLoading(true);
    try {
      const context = await buildProfileOptimizationPrompt();
      const prompt = "How should I improve my profile to look stronger to coaches, scouts, and teams?";
      const data = await requestCoach({ message: prompt, mode: "profile", context });
      const reply = data.response || data.error || "No profile tips were generated.";
      setProfileTips(reply);
      await saveCoachEntry({ type: "profile", title: "Profile Optimization", prompt, response: reply });
      await refreshHistory();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr,0.9fr]">
          <Card className="flex h-[80vh] flex-col">
            <CardHeader className="flex-row items-center gap-4 pb-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src="/api/placeholder/48/48" />
                <AvatarFallback>
                  <Brain className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  AI Coach <Dumbbell className="h-5 w-5 text-primary" />
                </CardTitle>
                <p className="text-sm text-muted-foreground">Chat, plan generation, and profile optimization are saved as reusable coaching entries.</p>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 ${message.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</pre>
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-br-sm bg-muted p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
                        <span className="text-sm text-muted-foreground">Coaching...</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t bg-background p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handlePlan()} disabled={loading}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Generate Plan
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleProfileTips()} disabled={loading}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Profile Tips
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) {
                        void handleSend();
                      }
                    }}
                    placeholder="Ask about training, mindset, nutrition..."
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button size="icon" onClick={() => void handleSend()} disabled={loading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Latest Training Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {plan || "Generate a weekly plan and it will appear here."}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {profileTips || "Generate profile tips to improve recruiting clarity and credibility."}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved AI History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved coaching history yet.</p>
                ) : (
                  history.map((entry) => (
                    <div key={entry.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{entry.type}</p>
                          <input
                            value={draftTitles[entry.id] ?? entry.title ?? ""}
                            onChange={(event) =>
                              setDraftTitles((current) => ({ ...current, [entry.id]: event.target.value }))
                            }
                            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium"
                            placeholder="Title this entry"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              void renameCoachEntry(entry.id, draftTitles[entry.id] ?? entry.title ?? "").then(refreshHistory)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void deleteCoachEntry(entry.id).then(refreshHistory)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-medium">{entry.prompt}</p>
                      <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{entry.response}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function AICoachPage() {
  return <AICoachPageContent />;
}
