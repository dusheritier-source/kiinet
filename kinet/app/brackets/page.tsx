"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  autoAdvanceBracket,
  createSeededTournamentBracket,
  getTournamentBrackets,
  recordBracketWinner,
  type TournamentBracket,
} from "@/lib/tournaments";

function BracketsPageContent() {
  const searchParams = useSearchParams();
  const [brackets, setBrackets] = useState<TournamentBracket[]>([]);
  const [seededTeams, setSeededTeams] = useState("");
  const [title, setTitle] = useState("");

  const teamId = searchParams.get("team") || "";

  const refresh = async () => {
    if (!teamId) {
      return;
    }
    setBrackets(await getTournamentBrackets(teamId));
  };

  useEffect(() => {
    void refresh();
  }, [teamId]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-5xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Tournament Brackets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {teamId ? (
              <div className="rounded-xl border p-4">
                <p className="font-semibold">Tournament Seeding Tool</p>
                <p className="mt-1 text-sm text-muted-foreground">Paste team names comma-separated to build a seeded bracket.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr,2fr,auto]">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bracket title" className="h-10 rounded-md border border-input px-3 text-sm" />
                  <input value={seededTeams} onChange={(event) => setSeededTeams(event.target.value)} placeholder="Team A, Team B, Team C, Team D" className="h-10 rounded-md border border-input px-3 text-sm" />
                  <Button
                    onClick={() =>
                      void createSeededTournamentBracket({
                        teamId,
                        title: title || "Seeded Bracket",
                        teamNames: seededTeams.split(",").map((value) => value.trim()).filter(Boolean),
                      }).then(() => {
                        setSeededTeams("");
                        setTitle("");
                        return refresh();
                      })
                    }
                  >
                    Seed Bracket
                  </Button>
                </div>
              </div>
            ) : null}

            {brackets.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No brackets yet.</div>
            ) : (
              brackets.map((bracket) => (
                <div key={bracket.id} className="rounded-xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{bracket.title}</h2>
                    <Button variant="outline" size="sm" onClick={() => void autoAdvanceBracket(bracket.id).then(refresh)}>
                      Auto-Advance
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {bracket.rounds.map((round, roundIndex) => (
                      <div key={round.name} className="rounded-xl bg-muted p-3">
                        <p className="font-medium">{round.name}</p>
                        <div className="mt-3 space-y-2">
                          {round.matchups.map((matchup, index) => (
                            <div key={`${round.name}-${index}`} className="rounded-lg bg-background p-3 text-sm">
                              <p>{matchup.home}</p>
                              <p className="text-xs text-muted-foreground">vs</p>
                              <p>{matchup.away}</p>
                              <p className="mt-2 text-xs text-muted-foreground">Winner: {matchup.winner || "TBD"}</p>
                              <div className="mt-2 flex gap-2">
                                {[matchup.home, matchup.away]
                                  .filter((teamName) => teamName && teamName !== "BYE")
                                  .map((teamName) => (
                                    <Button
                                      key={teamName}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void recordBracketWinner(bracket.id, roundIndex, index, teamName).then(refresh)}
                                    >
                                      {teamName}
                                    </Button>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function BracketsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <BracketsPageContent />
      </AuthProvider>
    </Suspense>
  );
}
