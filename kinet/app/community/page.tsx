"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addPostgameReflection,
  castVote,
  createAudioSpace,
  createFantasyLeague,
  createPredictionContest,
  createVote,
  getAnonymousFeedback,
  getAudioSpaces,
  getFantasyLeagues,
  getPostgameReflections,
  getPredictionContests,
  getVotes,
  pickPrediction,
  submitAnonymousFeedback,
  type AnonymousFeedbackRecord,
  type AudioSpaceRecord,
  type FantasyLeagueRecord,
  type PostgameReflectionRecord,
  type PredictionContestRecord,
  type VoteRecord,
} from "@/lib/phase7";
import { subscribeToTeams, type TeamRecord } from "@/lib/teams";

function CommunityPageContent() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [teamId, setTeamId] = useState("");
  const [audioSpaces, setAudioSpaces] = useState<AudioSpaceRecord[]>([]);
  const [feedback, setFeedback] = useState<AnonymousFeedbackRecord[]>([]);
  const [reflections, setReflections] = useState<PostgameReflectionRecord[]>([]);
  const [mvpVotes, setMvpVotes] = useState<VoteRecord[]>([]);
  const [awardVotes, setAwardVotes] = useState<VoteRecord[]>([]);
  const [predictions, setPredictions] = useState<PredictionContestRecord[]>([]);
  const [fantasyLeagues, setFantasyLeagues] = useState<FantasyLeagueRecord[]>([]);
  const [audioForm, setAudioForm] = useState({ title: "", topic: "" });
  const [feedbackText, setFeedbackText] = useState("");
  const [reflectionForm, setReflectionForm] = useState({ eventId: "", reflection: "" });
  const [voteForm, setVoteForm] = useState({ title: "", candidates: "Player A,Player B" });
  const [contestForm, setContestForm] = useState({ prompt: "", options: "Win,Loss" });
  const [fantasyForm, setFantasyForm] = useState({ name: "", scoringRule: "2 points per correct MVP pick" });

  useEffect(() => subscribeToTeams((nextTeams) => {
    setTeams(nextTeams);
    setTeamId((current) => current || nextTeams[0]?.id || "");
  }), []);

  const refresh = useCallback(async (nextTeamId: string) => {
    if (!nextTeamId) return;
    const [spaces, nextFeedback, nextReflections, nextMvpVotes, nextAwardVotes, nextPredictions, nextFantasy] = await Promise.all([
      getAudioSpaces(nextTeamId),
      getAnonymousFeedback(nextTeamId),
      getPostgameReflections(nextTeamId),
      getVotes(nextTeamId, "mvp"),
      getVotes(nextTeamId, "award"),
      getPredictionContests(nextTeamId),
      getFantasyLeagues(nextTeamId),
    ]);
    setAudioSpaces(spaces);
    setFeedback(nextFeedback);
    setReflections(nextReflections);
    setMvpVotes(nextMvpVotes);
    setAwardVotes(nextAwardVotes);
    setPredictions(nextPredictions);
    setFantasyLeagues(nextFantasy);
  }, []);

  useEffect(() => {
    void refresh(teamId);
  }, [refresh, teamId]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Team Community</h1>
          <p className="text-muted-foreground">Audio spaces, locker-room style discussion, anonymous feedback, postgame reflections, fan contests, fantasy leagues, MVP, and seasonal awards.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose Team</CardTitle>
          </CardHeader>
          <CardContent>
            <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Audio Spaces</CardTitle><CardDescription>Team audio rooms and live conversations.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Input value={audioForm.title} onChange={(event) => setAudioForm((current) => ({ ...current, title: event.target.value }))} placeholder="Space title" />
              <Input value={audioForm.topic} onChange={(event) => setAudioForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic" />
              <Button onClick={() => void createAudioSpace({ teamId, title: audioForm.title, topic: audioForm.topic }).then(() => { setAudioForm({ title: "", topic: "" }); refresh(teamId); })}>Create Audio Space</Button>
              {audioSpaces.map((space) => (
                <div key={space.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{space.title}</p>
                  <p className="text-muted-foreground">{space.topic} • {space.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Anonymous Feedback Box</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Anonymous team feedback" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button onClick={() => void submitAnonymousFeedback(teamId, feedbackText).then(() => { setFeedbackText(""); refresh(teamId); })}>Submit Anonymous Feedback</Button>
              {feedback.map((entry) => (
                <div key={entry.id} className="rounded-xl border p-3 text-sm">{entry.message}</div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Postgame Reflections</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={reflectionForm.eventId} onChange={(event) => setReflectionForm((current) => ({ ...current, eventId: event.target.value }))} placeholder="Event id" />
              <textarea value={reflectionForm.reflection} onChange={(event) => setReflectionForm((current) => ({ ...current, reflection: event.target.value }))} placeholder="How did the team feel after the game?" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button onClick={() => void addPostgameReflection(teamId, reflectionForm.eventId, reflectionForm.reflection).then(() => { setReflectionForm({ eventId: "", reflection: "" }); refresh(teamId); })}>Save Reflection</Button>
              {reflections.map((entry) => (
                <div key={entry.id} className="rounded-xl border p-3 text-sm">{entry.reflection}</div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Match MVP Voting</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={voteForm.title} onChange={(event) => setVoteForm((current) => ({ ...current, title: event.target.value }))} placeholder="Vote title" />
              <Input value={voteForm.candidates} onChange={(event) => setVoteForm((current) => ({ ...current, candidates: event.target.value }))} placeholder="Candidates comma-separated" />
              <Button onClick={() => void createVote({ scope: "mvp", teamId, title: voteForm.title || "Match MVP", candidateNames: voteForm.candidates.split(",").map((value) => value.trim()).filter(Boolean) }).then(() => refresh(teamId))}>Create MVP Vote</Button>
              {mvpVotes.map((vote) => (
                <div key={vote.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{vote.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vote.candidateNames.map((candidate) => (
                      <Button key={candidate} size="sm" variant="outline" onClick={() => void castVote(vote.id, candidate).then(() => refresh(teamId))}>{candidate}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Prediction Contests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={contestForm.prompt} onChange={(event) => setContestForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Contest prompt" />
              <Input value={contestForm.options} onChange={(event) => setContestForm((current) => ({ ...current, options: event.target.value }))} placeholder="Options comma-separated" />
              <Button onClick={() => void createPredictionContest({ teamId, prompt: contestForm.prompt, options: contestForm.options.split(",").map((value) => value.trim()).filter(Boolean) }).then(() => refresh(teamId))}>Create Contest</Button>
              {predictions.map((contest) => (
                <div key={contest.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{contest.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contest.options.map((option) => (
                      <Button key={option} size="sm" variant="outline" onClick={() => void pickPrediction(contest.id, option).then(() => refresh(teamId))}>{option}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fantasy Leagues & Seasonal Awards</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={fantasyForm.name} onChange={(event) => setFantasyForm((current) => ({ ...current, name: event.target.value }))} placeholder="Fantasy league name" />
              <Input value={fantasyForm.scoringRule} onChange={(event) => setFantasyForm((current) => ({ ...current, scoringRule: event.target.value }))} placeholder="Scoring rule" />
              <Button onClick={() => void createFantasyLeague({ teamId, name: fantasyForm.name, scoringRule: fantasyForm.scoringRule }).then(() => refresh(teamId))}>Create Fantasy League</Button>
              <Button variant="outline" onClick={() => void createVote({ scope: "award", teamId, title: "Season Awards", candidateNames: voteForm.candidates.split(",").map((value) => value.trim()).filter(Boolean) }).then(() => refresh(teamId))}>Create Seasonal Awards Vote</Button>
              {fantasyLeagues.map((league) => (
                <div key={league.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{league.name}</p>
                  <p className="text-muted-foreground">{league.scoringRule}</p>
                </div>
              ))}
              {awardVotes.map((vote) => (
                <div key={vote.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{vote.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vote.candidateNames.map((candidate) => (
                      <Button key={candidate} size="sm" variant="outline" onClick={() => void castVote(vote.id, candidate).then(() => refresh(teamId))}>{candidate}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function CommunityPage() {
  return (
    <AuthProvider>
      <CommunityPageContent />
    </AuthProvider>
  );
}
