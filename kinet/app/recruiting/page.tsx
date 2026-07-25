"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildRecruitBoardPdf, getGraduationYear } from "@/lib/phase5";
import {
  deleteRecruitTarget,
  getRecruitBoardShares,
  getRecruitTargets,
  getRecruiterSearches,
  saveRecruiterSearch,
  scoutReportTemplates,
  shareRecruitBoard,
  upsertRecruitTarget,
  type RecruitBoardShare,
  type RecruitTarget,
  type RecruiterSavedSearch,
} from "@/lib/recruiting";
import { searchProfiles, type SearchProfile } from "@/lib/user-profile";

const STAGES = ["watchlist", "contacted", "evaluating", "offer", "committed"] as const;

function RecruitingPageContent() {
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [targets, setTargets] = useState<RecruitTarget[]>([]);
  const [savedSearches, setSavedSearches] = useState<RecruiterSavedSearch[]>([]);
  const [sharedBoards, setSharedBoards] = useState<RecruitBoardShare[]>([]);
  const [queryText, setQueryText] = useState("");
  const [selectedUid, setSelectedUid] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<(typeof STAGES)[number]>(STAGES[0]);
  const [tags, setTags] = useState("");
  const [reportTemplate, setReportTemplate] = useState("");
  const [savedSearchName, setSavedSearchName] = useState("");
  const [shareRecipientUid, setShareRecipientUid] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [classYearFilter, setClassYearFilter] = useState("");

  const refreshBoard = async () => {
    const [nextTargets, nextSearches, nextSharedBoards] = await Promise.all([
      getRecruitTargets(),
      getRecruiterSearches(),
      getRecruitBoardShares(),
    ]);
    setTargets(nextTargets);
    setSavedSearches(nextSearches);
    setSharedBoards(nextSharedBoards);
  };

  useEffect(() => {
    void searchProfiles("").then(setProfiles);
    void refreshBoard();
  }, []);

  useEffect(() => {
    const target = searchParams.get("target");
    if (target) {
      setSelectedUid(target);
    }
  }, [searchParams]);

  const filteredProfiles = useMemo(
    () =>
      profiles.filter((profile) =>
        [profile.displayName, profile.role?.sport, profile.role?.position, profile.role?.team]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(queryText.trim().toLowerCase())
      ).filter((profile) =>
        !classYearFilter || String(getGraduationYear(profile) ?? "") === classYearFilter
      ),
    [classYearFilter, profiles, queryText]
  );

  const groupedTargets = useMemo(
    () =>
      STAGES.map((stageName) => ({
        stage: stageName,
        items: targets.filter((target) => target.stage === stageName),
      })),
    [targets]
  );

  const comparedProfiles = useMemo(
    () => profiles.filter((profile) => compareIds.includes(profile.uid)).slice(0, 2),
    [compareIds, profiles]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUid) {
      return;
    }

    await upsertRecruitTarget(selectedUid, note, stage, {
      tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
      reportTemplate,
    });
    await refreshBoard();
    setNote("");
    setTags("");
    setReportTemplate("");
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Recruiting Board</h1>
          <p className="text-muted-foreground">Shortlist prospects, compare them side by side, and privately share boards with your recruiting circle.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Add Prospect</CardTitle>
              <CardDescription>Search Kinet profiles and add a private scout note.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search athletes, positions, teams..." />
              <Input value={classYearFilter} onChange={(event) => setClassYearFilter(event.target.value)} placeholder="Class year filter" />
              <div className="flex gap-2">
                <Input value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} placeholder="Save current search as..." />
                <Button
                  variant="outline"
                  onClick={() =>
                    void saveRecruiterSearch({
                      name: savedSearchName || queryText || "Recruit search",
                      query: queryText,
                      filters: { team: classYearFilter },
                    }).then(() => {
                      setSavedSearchName("");
                      return refreshBoard();
                    })
                  }
                >
                  Save Search
                </Button>
                <Button
                  variant="outline"
                  disabled={targets.length === 0}
                  onClick={() => {
                    const blob = buildRecruitBoardPdf(targets, profiles);
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = "Kinet-recruit-board.pdf";
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export PDF
                </Button>
              </div>
              {savedSearches.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {savedSearches.map((savedSearch) => (
                    <button
                      key={savedSearch.id}
                      type="button"
                      onClick={() => setQueryText(savedSearch.query)}
                      className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      {savedSearch.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {filteredProfiles.map((profile) => (
                  <div key={profile.uid} className={`rounded-xl border p-3 ${selectedUid === profile.uid ? "border-primary bg-primary/5" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedUid(profile.uid)}
                      className="w-full text-left"
                    >
                      <p className="font-medium">{profile.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {[profile.role?.sport, profile.role?.position, profile.role?.team].filter(Boolean).join(" • ")}
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`mt-2 rounded-full border px-2 py-1 text-xs ${compareIds.includes(profile.uid) ? "border-primary bg-primary/5 text-primary" : ""}`}
                      onClick={() =>
                        setCompareIds((current) =>
                          current.includes(profile.uid)
                            ? current.filter((item) => item !== profile.uid)
                            : [...current.slice(-1), profile.uid]
                        )
                      }
                    >
                      {compareIds.includes(profile.uid) ? "Selected for compare" : "Compare"}
                    </button>
                  </div>
                ))}
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                <select value={stage} onChange={(event) => setStage(event.target.value as (typeof STAGES)[number])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {STAGES.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Private scout note" className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Private tags, comma separated" />
                <select value={reportTemplate} onChange={(event) => setReportTemplate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Scout report template</option>
                  {scoutReportTemplates.map((template) => (
                    <option key={template.id} value={template.text}>{template.name}</option>
                  ))}
                </select>
                <Button type="submit" disabled={!selectedUid}>Save to board</Button>
              </form>

              <div className="rounded-xl border p-4">
                <p className="font-semibold">Share This Board</p>
                <p className="mt-1 text-sm text-muted-foreground">Send your current shortlist privately to another scout or admin.</p>
                <div className="mt-3 space-y-2">
                  <select value={shareRecipientUid} onChange={(event) => setShareRecipientUid(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose recipient</option>
                    {profiles.map((profile) => (
                      <option key={profile.uid} value={profile.uid}>{profile.displayName}</option>
                    ))}
                  </select>
                  <textarea value={shareNote} onChange={(event) => setShareNote(event.target.value)} placeholder="Private note for the shared board" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <Button
                    variant="outline"
                    disabled={!shareRecipientUid || targets.length === 0}
                    onClick={() =>
                      void shareRecruitBoard(
                        shareRecipientUid,
                        targets.map((target) => target.id),
                        shareNote
                      ).then(() => {
                        setShareRecipientUid("");
                        setShareNote("");
                        return refreshBoard();
                      })
                    }
                  >
                    Share Current Board
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {comparedProfiles.length === 2 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Compare Prospects</CardTitle>
                  <CardDescription>Quick side-by-side view for two athletes.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {comparedProfiles.map((profile) => (
                    <div key={profile.uid} className="rounded-xl border p-4">
                      <p className="text-lg font-semibold">{profile.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {[profile.role?.sport, profile.role?.position, profile.role?.team].filter(Boolean).join(" • ")}
                      </p>
                      <p className="mt-2 text-sm">{profile.role?.bio || "No bio yet."}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted p-2 text-sm">
                          <div className="font-semibold">{profile.athleteProfile?.stats?.pointsPerGame ?? 0}</div>
                          <div className="text-xs text-muted-foreground">PPG</div>
                        </div>
                        <div className="rounded-lg bg-muted p-2 text-sm">
                          <div className="font-semibold">{profile.athleteProfile?.stats?.assistsPerGame ?? 0}</div>
                          <div className="text-xs text-muted-foreground">APG</div>
                        </div>
                        <div className="rounded-lg bg-muted p-2 text-sm">
                          <div className="font-semibold">{profile.athleteProfile?.stats?.reboundsPerGame ?? 0}</div>
                          <div className="text-xs text-muted-foreground">RPG</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {sharedBoards.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Boards Shared With You</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sharedBoards.map((share) => (
                    <div key={share.id} className="rounded-xl border p-3">
                      <p className="font-medium">{share.targetIds.length} shared prospects</p>
                      <p className="text-sm text-muted-foreground">{share.note || "No note added."}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-5">
              {groupedTargets.map((column) => (
                <Card key={column.stage}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base capitalize">{column.stage}</CardTitle>
                    <CardDescription>{column.items.length} prospects</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {column.items.length === 0 ? (
                      <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">No prospects here.</div>
                    ) : (
                      column.items.map((target) => {
                        const profile = profiles.find((candidate) => candidate.uid === target.targetUid);
                        return (
                          <div key={target.id} className="rounded-xl border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{profile?.displayName || target.targetUid}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[profile?.role?.sport, profile?.role?.position].filter(Boolean).join(" • ")}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void deleteRecruitTarget(target.id).then(refreshBoard)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="mt-3 text-sm">{target.note || "No private note saved yet."}</p>
                            {target.tags?.length ? (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {target.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{tag}</span>
                                ))}
                              </div>
                            ) : null}
                            {target.reportTemplate ? (
                              <p className="mt-3 text-xs text-muted-foreground">{target.reportTemplate}</p>
                            ) : null}
                            {target.sharedWith?.length ? (
                              <p className="mt-3 text-xs text-muted-foreground">Shared with {target.sharedWith.length} teammate(s)</p>
                            ) : null}
                            <select
                              value={target.stage}
                              onChange={(event) =>
                                void upsertRecruitTarget(target.targetUid, target.note, event.target.value, {
                                  tags: target.tags,
                                  reportTemplate: target.reportTemplate,
                                }).then(refreshBoard)
                              }
                              className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              {STAGES.map((value) => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function RecruitingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <RecruitingPageContent />
      </AuthProvider>
    </Suspense>
  );
}
