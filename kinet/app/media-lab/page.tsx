"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import OptimizedMedia from "@/components/OptimizedMedia";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createClipFeedbackRequest,
  createExpiringShare,
  createPlaylist,
  findPotentialDuplicatePosts,
  generateSeasonHighlightPlan,
  saveClipChapter,
  saveEvaluatorNote,
  saveRubricScore,
  saveTelestrationNote,
  submitPeerReview,
  subscribeToClipChapters,
  subscribeToClipFeedbackRequests,
  subscribeToEvaluatorNotes,
  subscribeToExpiringShares,
  subscribeToMyPlaylists,
  subscribeToPeerReviews,
  subscribeToRubricScores,
  subscribeToTelestrationNotes,
  type ClipChapter,
  type ClipFeedbackRequest,
  type EvaluatorNote,
  type ExpiringShare,
  type MediaPlaylist,
  type PeerReview,
  type RubricScore,
  type TelestrationNote,
} from "@/lib/media-lab";
import { subscribeToUserPosts, type FeedPost } from "@/lib/posts";

function MediaLabContent() {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [playlists, setPlaylists] = useState<MediaPlaylist[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [comparePostId, setComparePostId] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [chapterLabel, setChapterLabel] = useState("");
  const [chapterTimeSec, setChapterTimeSec] = useState("0");
  const [chapters, setChapters] = useState<ClipChapter[]>([]);
  const [telestrationText, setTelestrationText] = useState("");
  const [telestrationTimeSec, setTelestrationTimeSec] = useState("0");
  const [telestrationNotes, setTelestrationNotes] = useState<TelestrationNote[]>([]);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [feedbackRequests, setFeedbackRequests] = useState<ClipFeedbackRequest[]>([]);
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reviewScore, setReviewScore] = useState("8");
  const [rubricScores, setRubricScores] = useState<RubricScore[]>([]);
  const [rubricMetrics, setRubricMetrics] = useState("Athleticism:8,Decision Making:7,Finishing:9");
  const [evaluatorTitle, setEvaluatorTitle] = useState("Scout Read");
  const [evaluatorNote, setEvaluatorNote] = useState("");
  const [evaluatorNotes, setEvaluatorNotes] = useState<EvaluatorNote[]>([]);
  const [expiringShares, setExpiringShares] = useState<ExpiringShare[]>([]);
  const [shareHours, setShareHours] = useState("48");
  const [shareNote, setShareNote] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubPosts = subscribeToUserPosts(user.uid, (nextPosts) => {
      setPosts(nextPosts.filter((post) => Boolean(post.mediaUrl)));
    });
    const unsubPlaylists = subscribeToMyPlaylists(setPlaylists);
    const unsubFeedback = subscribeToClipFeedbackRequests(user.uid, setFeedbackRequests);
    const unsubShares = subscribeToExpiringShares(user.uid, setExpiringShares);

    return () => {
      unsubPosts();
      unsubPlaylists();
      unsubFeedback();
      unsubShares();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedPostId && posts[0]) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (!selectedPostId) {
      setChapters([]);
      setTelestrationNotes([]);
      setRubricScores([]);
      setEvaluatorNotes([]);
      return;
    }

    const unsubChapters = subscribeToClipChapters(selectedPostId, setChapters);
    const unsubTelestration = subscribeToTelestrationNotes(selectedPostId, setTelestrationNotes);
    const unsubRubrics = subscribeToRubricScores(selectedPostId, setRubricScores);
    const unsubNotes = subscribeToEvaluatorNotes(selectedPostId, setEvaluatorNotes);

    return () => {
      unsubChapters();
      unsubTelestration();
      unsubRubrics();
      unsubNotes();
    };
  }, [selectedPostId]);

  const selectedFeedbackRequestId =
    feedbackRequests.find((request) => request.postId === selectedPostId)?.id ?? feedbackRequests[0]?.id ?? "";

  useEffect(() => {
    if (!selectedFeedbackRequestId) {
      setReviews([]);
      return;
    }

    return subscribeToPeerReviews(selectedFeedbackRequestId, setReviews);
  }, [selectedFeedbackRequestId]);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const comparePost = posts.find((post) => post.id === comparePostId) ?? null;
  const seasonPlan = useMemo(() => generateSeasonHighlightPlan(posts), [posts]);
  const duplicateCandidates = useMemo(
    () => (selectedPostId ? findPotentialDuplicatePosts(posts, selectedPostId) : []),
    [posts, selectedPostId]
  );

  const handleCreatePlaylist = async () => {
    if (!selectedPostIds.length) {
      setStatus("Choose at least one clip for the playlist.");
      return;
    }

    await createPlaylist({
      name: playlistName || "Highlight Playlist",
      postIds: selectedPostIds,
      kind: "manual",
    });
    setPlaylistName("");
    setStatus("Playlist saved.");
  };

  const handleSaveSeasonReel = async () => {
    await createPlaylist({
      name: "Season Highlight Reel",
      postIds: seasonPlan.postIds,
      kind: "season",
      summary: seasonPlan.summary,
    });
    setStatus("Season reel saved as a playlist.");
  };

  const handleChapterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPostId) {
      return;
    }

    await saveClipChapter(selectedPostId, chapterLabel, Number(chapterTimeSec || 0));
    setChapterLabel("");
    setStatus("Chapter marker added.");
  };

  const handleTelestrationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPostId) {
      return;
    }

    await saveTelestrationNote(selectedPostId, Number(telestrationTimeSec || 0), telestrationText);
    setTelestrationText("");
    setStatus("Telestration note saved.");
  };

  const handleFeedbackRequest = async () => {
    if (!selectedPostId || !feedbackPrompt.trim()) {
      setStatus("Add a clip and a feedback prompt.");
      return;
    }

    await createClipFeedbackRequest(selectedPostId, feedbackPrompt);
    setFeedbackPrompt("");
    setStatus("Feedback request opened.");
  };

  const handlePeerReview = async () => {
    if (!selectedFeedbackRequestId || !selectedPostId || !reviewText.trim()) {
      setStatus("Pick a request and add a review.");
      return;
    }

    await submitPeerReview({
      feedbackRequestId: selectedFeedbackRequestId,
      postId: selectedPostId,
      reviewerName: user?.displayName || "Kinet Reviewer",
      feedback: reviewText,
      score: Number(reviewScore || 0),
    });
    setReviewText("");
    setStatus("Peer review submitted.");
  };

  const handleRubricSave = async () => {
    if (!selectedPostId) {
      return;
    }

    const metrics = rubricMetrics
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [label, rawScore] = item.split(":");
        return {
          label: (label || "Metric").trim(),
          score: Number(rawScore || 0),
        };
      });

    await saveRubricScore({
      postId: selectedPostId,
      rubricName: "Scout Rubric",
      metrics,
    });
    setStatus("Rubric score saved.");
  };

  const handleEvaluatorSave = async () => {
    if (!selectedPostId || !evaluatorNote.trim()) {
      return;
    }

    await saveEvaluatorNote(selectedPostId, evaluatorTitle, evaluatorNote);
    setEvaluatorNote("");
    setStatus("Private evaluator note saved.");
  };

  const handleCreateShare = async () => {
    if (!selectedPostId) {
      return;
    }

    await createExpiringShare(selectedPostId, Number(shareHours || 24), shareNote);
    setShareNote("");
    setStatus("Expiring private link created.");
  };

  if (!user) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Media Lab</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build playlists, cut season reels, mark chapters, add telestration, compare clips, collect reviews,
            score highlights, and publish expiring private links.
          </p>
          {status ? <p className="mt-3 text-sm text-primary">{status}</p> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Clip Library</CardTitle>
              <CardDescription>Select clips to use across playlists, reels, chapters, and reviews.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {posts.map((post) => {
                  const selected = selectedPostIds.includes(post.id);
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => {
                        setSelectedPostId(post.id);
                        setSelectedPostIds((current) =>
                          selected ? current.filter((id) => id !== post.id) : [...current, post.id]
                        );
                      }}
                      className={`overflow-hidden rounded-xl border text-left ${selected ? "border-primary bg-primary/5" : ""}`}
                    >
                      {post.mediaType === "video" ? (
                        <video src={post.mediaUrl} className="aspect-video w-full bg-black object-cover" muted />
                      ) : (
                        <OptimizedMedia src={post.mediaUrl} alt={post.caption || "Clip"} width={640} height={360} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-video w-full object-cover" />
                      )}
                      <div className="space-y-1 p-3">
                        <p className="line-clamp-2 text-sm font-medium">{post.caption || "Untitled clip"}</p>
                        <p className="text-xs text-muted-foreground">
                          {post.sport} • {post.contentType} • {post.likes.length} likes
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {posts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Upload a few posts or reels first so Media Lab has clips to work with.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Highlight Playlists</CardTitle>
                <CardDescription>Build manual playlists or auto-save a season reel stack.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Playlist name" />
                <Button onClick={() => void handleCreatePlaylist()} className="w-full">
                  Save Playlist
                </Button>
                <div className="rounded-xl bg-muted p-3 text-sm">
                  <p className="font-semibold">Season Reel Builder</p>
                  <p className="mt-1 text-muted-foreground">{seasonPlan.summary}</p>
                  <Button variant="outline" className="mt-3 w-full" onClick={() => void handleSaveSeasonReel()}>
                    Save Season Reel
                  </Button>
                </div>
                <div className="space-y-2">
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="rounded-xl border p-3 text-sm">
                      <p className="font-semibold">{playlist.name}</p>
                      <p className="text-muted-foreground">
                        {playlist.kind === "season" ? "Season reel" : "Manual playlist"} • {playlist.postIds.length} clips
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compare Clips</CardTitle>
                <CardDescription>Use side-by-side review before you publish a final reel cut.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={comparePostId}
                  onChange={(event) => setComparePostId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose comparison clip</option>
                  {posts
                    .filter((post) => post.id !== selectedPostId)
                    .map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.caption || post.id}
                      </option>
                    ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  {[selectedPost, comparePost].map((post, index) => (
                    <div key={post?.id || index} className="overflow-hidden rounded-xl border">
                      {post ? (
                        <>
                          {post.mediaType === "video" ? (
                            <video src={post.mediaUrl} controls className="aspect-video w-full bg-black object-cover" />
                          ) : (
                            <OptimizedMedia src={post.mediaUrl} alt={post.caption || "Clip"} width={640} height={360} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-video w-full object-cover" />
                          )}
                          <div className="p-3 text-sm">
                            <p className="font-medium">{post.caption || "Untitled clip"}</p>
                            <p className="text-muted-foreground">{post.autoCaption || "No supporting caption yet."}</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                          {index === 0 ? "Pick a primary clip" : "Pick a comparison clip"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Chapters</CardTitle>
              <CardDescription>Add video chapter timestamps for recruiters and coaches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form className="space-y-3" onSubmit={handleChapterSubmit}>
                <Input value={chapterLabel} onChange={(event) => setChapterLabel(event.target.value)} placeholder="Chapter label" />
                <Input value={chapterTimeSec} onChange={(event) => setChapterTimeSec(event.target.value)} placeholder="Time in seconds" />
                <Button type="submit" className="w-full">Add Chapter</Button>
              </form>
              {chapters.map((chapter) => (
                <div key={chapter.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{chapter.label}</p>
                  <p className="text-muted-foreground">{chapter.timeSec}s</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Telestration Notes</CardTitle>
              <CardDescription>Store frame-by-frame coaching callouts for the selected clip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form className="space-y-3" onSubmit={handleTelestrationSubmit}>
                <Input value={telestrationTimeSec} onChange={(event) => setTelestrationTimeSec(event.target.value)} placeholder="Frame time in seconds" />
                <textarea
                  value={telestrationText}
                  onChange={(event) => setTelestrationText(event.target.value)}
                  placeholder="What should the viewer notice here?"
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" className="w-full">Save Note</Button>
              </form>
              {telestrationNotes.map((note) => (
                <div key={note.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{note.frameSec}s</p>
                  <p className="text-muted-foreground">{note.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Duplicate Detection</CardTitle>
              <CardDescription>Quick AI-style duplicate spotting before you repost a similar clip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicateCandidates.length === 0 ? (
                <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  No likely duplicates found for the current clip.
                </div>
              ) : (
                duplicateCandidates.map((post) => (
                  <div key={post.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{post.caption || "Untitled clip"}</p>
                    <p className="text-muted-foreground">{post.sport} • {post.mediaType}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Requests</CardTitle>
              <CardDescription>Ask for clip feedback, crowdsource peer reviews, and collect quick scores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={feedbackPrompt}
                onChange={(event) => setFeedbackPrompt(event.target.value)}
                placeholder="What do you want reviewers to focus on?"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button className="w-full" onClick={() => void handleFeedbackRequest()}>
                Open Feedback Request
              </Button>
              {feedbackRequests.map((request) => (
                <div key={request.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{request.prompt}</p>
                  <p className="text-muted-foreground">{request.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peer Reviews</CardTitle>
              <CardDescription>Collect crowdsource reviews against the active feedback request.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={reviewScore} onChange={(event) => setReviewScore(event.target.value)} placeholder="Score out of 10" />
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="Add your peer review"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button className="w-full" onClick={() => void handlePeerReview()}>
                Submit Peer Review
              </Button>
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{review.reviewerName} • {review.score}/10</p>
                  <p className="text-muted-foreground">{review.feedback}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scout Rubrics</CardTitle>
              <CardDescription>Store rubric-based scoring and private evaluator notes on a clip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={rubricMetrics} onChange={(event) => setRubricMetrics(event.target.value)} placeholder="Metric:Score, Metric:Score" />
              <Button variant="outline" className="w-full" onClick={() => void handleRubricSave()}>
                Save Rubric
              </Button>
              <Input value={evaluatorTitle} onChange={(event) => setEvaluatorTitle(event.target.value)} placeholder="Private note title" />
              <textarea
                value={evaluatorNote}
                onChange={(event) => setEvaluatorNote(event.target.value)}
                placeholder="Private evaluator note"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button className="w-full" onClick={() => void handleEvaluatorSave()}>
                Save Evaluator Note
              </Button>
              {rubricScores.map((rubric) => (
                <div key={rubric.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{rubric.rubricName}</p>
                  <p className="text-muted-foreground">
                    {rubric.metrics.map((metric) => `${metric.label} ${metric.score}/10`).join(" • ")}
                  </p>
                </div>
              ))}
              {evaluatorNotes.map((note) => (
                <div key={note.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{note.title}</p>
                  <p className="text-muted-foreground">{note.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Private Shares</CardTitle>
            <CardDescription>Create expiring links for private scouting, premium reviews, or coach-only access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[120px,1fr,auto]">
              <Input value={shareHours} onChange={(event) => setShareHours(event.target.value)} placeholder="Hours" />
              <Input value={shareNote} onChange={(event) => setShareNote(event.target.value)} placeholder="Optional note for this share" />
              <Button onClick={() => void handleCreateShare()}>Create Link</Button>
            </div>
            <div className="grid gap-3">
              {expiringShares.map((share) => (
                <div key={share.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">
                    {typeof window === "undefined" ? "" : `${window.location.origin}/share/${share.id}`}
                  </p>
                  <p className="text-muted-foreground">
                    Expires{" "}
                    {share.expiresAt?.seconds
                      ? new Date(share.expiresAt.seconds * 1000).toLocaleString()
                      : "soon"}
                    {share.note ? ` • ${share.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function MediaLabPage() {
  return (
    <AuthProvider>
      <MediaLabContent />
    </AuthProvider>
  );
}
