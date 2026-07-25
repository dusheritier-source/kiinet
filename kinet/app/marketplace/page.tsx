"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyToBrandCampaign,
  createMarketplaceReview,
  getMarketplaceReviews,
  getOpenBrandCampaigns,
  recordCreatorTip,
  type BrandCampaignRecord,
  type MarketplaceReviewRecord,
} from "@/lib/commerce";
import { searchProfiles, type SearchProfile } from "@/lib/user-profile";

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const [campaigns, setCampaigns] = useState<BrandCampaignRecord[]>([]);
  const [creators, setCreators] = useState<SearchProfile[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignNote, setCampaignNote] = useState("");
  const [selectedCreatorUid, setSelectedCreatorUid] = useState("");
  const [tipAmount, setTipAmount] = useState("$10");
  const [tipNote, setTipNote] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviews, setReviews] = useState<MarketplaceReviewRecord[]>([]);

  useEffect(() => {
    const creatorFromQuery = searchParams.get("creator") ?? "";
    setSelectedCreatorUid(creatorFromQuery);
    void getOpenBrandCampaigns().then(setCampaigns);
    void searchProfiles("").then(setCreators);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCreatorUid) {
      setReviews([]);
      return;
    }
    void getMarketplaceReviews(selectedCreatorUid).then(setReviews);
  }, [selectedCreatorUid]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const selectedCreator = useMemo(
    () => creators.find((creator) => creator.uid === selectedCreatorUid) ?? null,
    [creators, selectedCreatorUid]
  );

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">
            Explore brand campaigns, support creators directly, and leave marketplace reviews after paid work.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Open Campaigns</CardTitle>
              <CardDescription>Apply to creator and brand opportunities without leaving Kinet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No campaigns are open right now.
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`w-full rounded-2xl border p-4 text-left ${selectedCampaignId === campaign.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{campaign.brandName}</p>
                        <h3 className="font-semibold">{campaign.title}</h3>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs">{campaign.budgetLabel || "Budget on request"}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{campaign.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Requirements: {campaign.requirements || "None listed"}</p>
                  </button>
                ))
              )}

              <form
                className="space-y-3 rounded-2xl border p-4"
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  if (!selectedCampaign) {
                    return;
                  }
                  await applyToBrandCampaign(selectedCampaign, campaignNote);
                  setCampaignNote("");
                }}
              >
                <p className="font-medium">Campaign application</p>
                <textarea
                  value={campaignNote}
                  onChange={(event) => setCampaignNote(event.target.value)}
                  placeholder="Share why you're a fit, your audience angle, and the content you would deliver."
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={!selectedCampaignId || !campaignNote.trim()}>
                  Apply to Campaign
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Support a Creator</CardTitle>
                <CardDescription>Tip creators and send quick appreciation directly from the marketplace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={selectedCreatorUid}
                  onChange={(event) => setSelectedCreatorUid(event.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose creator</option>
                  {creators
                    .filter((creator) => creator.uid !== user?.uid)
                    .map((creator) => (
                      <option key={creator.uid} value={creator.uid}>
                        {creator.displayName}
                      </option>
                    ))}
                </select>
                {selectedCreator ? (
                  <div className="rounded-xl bg-muted p-4 text-sm">
                    <p className="font-semibold">{selectedCreator.displayName}</p>
                    <p className="text-muted-foreground">
                      {[selectedCreator.role?.type, selectedCreator.role?.sport, selectedCreator.role?.team].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/profile/${selectedCreator.uid}`}>View Profile</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
                <input
                  value={tipAmount}
                  onChange={(event) => setTipAmount(event.target.value)}
                  placeholder="$10"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <textarea
                  value={tipNote}
                  onChange={(event) => setTipNote(event.target.value)}
                  placeholder="Great session, loved the breakdown, thanks for the help."
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button
                  onClick={() =>
                    void recordCreatorTip({
                      targetUid: selectedCreatorUid,
                      amountLabel: tipAmount,
                      note: tipNote,
                    }).then(() => setTipNote(""))
                  }
                  disabled={!selectedCreatorUid || !tipAmount.trim()}
                >
                  Send Tip
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marketplace Reviews</CardTitle>
                <CardDescription>Leave a rating after campaigns, bookings, or creator work.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[120px,1fr]">
                  <select
                    value={reviewRating}
                    onChange={(event) => setReviewRating(event.target.value)}
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} stars
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Fast turnaround, clear communication, and strong content delivery."
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button
                  onClick={() =>
                    void createMarketplaceReview({
                      targetUid: selectedCreatorUid,
                      rating: Number(reviewRating),
                      comment: reviewComment,
                    }).then(async () => {
                      setReviewComment("");
                      if (selectedCreatorUid) {
                        setReviews(await getMarketplaceReviews(selectedCreatorUid));
                      }
                    })
                  }
                  disabled={!selectedCreatorUid || !reviewComment.trim()}
                >
                  Submit Review
                </Button>

                <div className="space-y-3 border-t pt-3">
                  {reviews.length === 0 ? (
                    <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                      No reviews for this creator yet.
                    </div>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{review.authorName}</p>
                          <span className="text-sm text-muted-foreground">{review.rating}/5</span>
                        </div>
                        <p className="mt-2 text-sm">{review.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <MarketplacePageContent />
      </AuthProvider>
    </Suspense>
  );
}
