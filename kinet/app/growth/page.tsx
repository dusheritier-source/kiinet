"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  claimDailyCheckIn,
  completeQuest,
  createBlogPost,
  createCoupon,
  createFundraiser,
  createMerchProduct,
  createNewsletterIssue,
  createPriorityInboxRequest,
  createQuest,
  enableFamilyPlan,
  getGrowthHubSnapshot,
  getHighlightCarouselEmbedCode,
  getProfileEmbedCode,
  redeemCoupon,
  updateCurrentGrowthProfile,
  updatePriorityInboxStatus,
  type BlogPostRecord,
  type CouponRecord,
  type FundraiserRecord,
  type GrowthProfile,
  type MerchProductRecord,
  type NewsletterIssue,
  type PriorityInboxRequest,
  type QuestRecord,
} from "@/lib/phase6";

function GrowthHubContent() {
  const { user } = useAuthContext();
  const [growth, setGrowth] = useState<GrowthProfile | null>(null);
  const [fundraisers, setFundraisers] = useState<FundraiserRecord[]>([]);
  const [merch, setMerch] = useState<MerchProductRecord[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [inviteLeaderboard, setInviteLeaderboard] = useState<Array<{ code: string; referralCount: number; note: string }>>([]);
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [priorityInbox, setPriorityInbox] = useState<PriorityInboxRequest[]>([]);
  const [newsletterIssues, setNewsletterIssues] = useState<NewsletterIssue[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPostRecord[]>([]);
  const [rewards, setRewards] = useState({ loyaltyPoints: 0, checkInStreak: 0, familyPlan: false });
  const [status, setStatus] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [familyEmails, setFamilyEmails] = useState("");
  const [fundraiserForm, setFundraiserForm] = useState({ title: "", description: "", goalAmount: "500", ownerType: "user" as "user" | "team", ownerRefId: "" });
  const [merchForm, setMerchForm] = useState({ title: "", description: "", priceLabel: "", limitedDropEndsAt: "" });
  const [couponForm, setCouponForm] = useState({ code: "", description: "", reward: "" });
  const [questForm, setQuestForm] = useState({ title: "", description: "", pointsReward: "25" });
  const [newsletterForm, setNewsletterForm] = useState({ title: "", body: "", subscriberOnly: true });
  const [blogForm, setBlogForm] = useState({ title: "", summary: "", body: "" });

  const refresh = useCallback(async () => {
    const snapshot = await getGrowthHubSnapshot();
    setGrowth(snapshot.growth);
    setFundraisers(snapshot.fundraisers);
    setMerch(snapshot.merch);
    setCoupons(snapshot.coupons);
    setInviteLeaderboard(snapshot.inviteLeaderboard);
    setQuests(snapshot.quests);
    setRewards(snapshot.rewards);
    setPriorityInbox(snapshot.priorityInbox);
    setNewsletterIssues(await import("@/lib/phase6").then((mod) => mod.getCreatorNewsletterIssues(user?.uid || "")));
    setBlogPosts(await import("@/lib/phase6").then((mod) => mod.getCreatorBlogPosts(user?.uid || "")));
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [refresh, user]);

  if (!user || !growth) return null;

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Growth Hub</h1>
          <p className="text-muted-foreground">Fundraising, merch, referrals, rewards, premium comms, blogs, SEO pages, and embeds.</p>
          {status ? <p className="mt-2 text-sm text-primary">{status}</p> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Rewards</CardTitle><CardDescription>Daily check-ins, loyalty points, and quests.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-3"><p className="font-semibold">{rewards.loyaltyPoints}</p><p className="text-muted-foreground">Loyalty points</p></div>
                <div className="rounded-xl border p-3"><p className="font-semibold">{rewards.checkInStreak}</p><p className="text-muted-foreground">Check-in streak</p></div>
              </div>
              <Button onClick={() => void claimDailyCheckIn().then(() => { setStatus("Daily bonus claimed."); return refresh(); })}>Claim Daily Bonus</Button>
              <div className="space-y-2">
                {quests.map((quest) => (
                  <div key={quest.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{quest.title}</p>
                    <p className="text-muted-foreground">{quest.description}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => void completeQuest(quest.id, quest.pointsReward).then(() => refresh())}>
                      Complete +{quest.pointsReward}
                    </Button>
                  </div>
                ))}
              </div>
              <Input value={questForm.title} onChange={(event) => setQuestForm((current) => ({ ...current, title: event.target.value }))} placeholder="Quest title" />
              <Input value={questForm.description} onChange={(event) => setQuestForm((current) => ({ ...current, description: event.target.value }))} placeholder="Quest description" />
              <Input value={questForm.pointsReward} onChange={(event) => setQuestForm((current) => ({ ...current, pointsReward: event.target.value }))} placeholder="Points reward" />
              <Button variant="outline" onClick={() => void createQuest({ title: questForm.title, description: questForm.description, pointsReward: Number(questForm.pointsReward) }).then(() => refresh())}>Create Quest</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Coupons & Referrals</CardTitle><CardDescription>Coupon redemption and invite leaderboard.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Redeem coupon code" />
              <Button onClick={() => void redeemCoupon(couponCode).then(() => { setCouponCode(""); setStatus("Coupon redeemed."); refresh(); })}>Redeem Coupon</Button>
              <Input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value }))} placeholder="New coupon code" />
              <Input value={couponForm.description} onChange={(event) => setCouponForm((current) => ({ ...current, description: event.target.value }))} placeholder="Coupon description" />
              <Input value={couponForm.reward} onChange={(event) => setCouponForm((current) => ({ ...current, reward: event.target.value }))} placeholder="Reward" />
              <Button variant="outline" onClick={() => void createCoupon(couponForm).then(() => refresh())}>Create Coupon</Button>
              <div className="space-y-2">
                {inviteLeaderboard.map((item, index) => (
                  <div key={item.code} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <span>{index + 1}. {item.code}</span>
                    <span className="text-muted-foreground">{item.referralCount} referrals</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Family Plan</CardTitle><CardDescription>Bundle household access and premium benefits.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{rewards.familyPlan ? "Family plan active" : "Family plan inactive"}</p>
              <textarea value={familyEmails} onChange={(event) => setFamilyEmails(event.target.value)} placeholder="Comma-separated family emails" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button onClick={() => void enableFamilyPlan(familyEmails.split(",")).then(() => { setStatus("Family plan updated."); refresh(); })}>Enable Family Plan</Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Fundraising & Merch</CardTitle><CardDescription>Donation goals, progress, storefront items, and limited drops.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Input value={fundraiserForm.title} onChange={(event) => setFundraiserForm((current) => ({ ...current, title: event.target.value }))} placeholder="Fundraiser title" />
              <Input value={fundraiserForm.description} onChange={(event) => setFundraiserForm((current) => ({ ...current, description: event.target.value }))} placeholder="Fundraiser description" />
              <div className="grid gap-3 md:grid-cols-3">
                <select value={fundraiserForm.ownerType} onChange={(event) => setFundraiserForm((current) => ({ ...current, ownerType: event.target.value as "user" | "team" }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="user">User page</option>
                  <option value="team">Team page</option>
                </select>
                <Input value={fundraiserForm.ownerRefId} onChange={(event) => setFundraiserForm((current) => ({ ...current, ownerRefId: event.target.value }))} placeholder="Owner ref id" />
                <Input value={fundraiserForm.goalAmount} onChange={(event) => setFundraiserForm((current) => ({ ...current, goalAmount: event.target.value }))} placeholder="Goal amount" />
              </div>
              <Button onClick={() => void createFundraiser({ ownerType: fundraiserForm.ownerType, ownerRefId: fundraiserForm.ownerRefId || user.uid, title: fundraiserForm.title, description: fundraiserForm.description, goalAmount: Number(fundraiserForm.goalAmount) }).then(() => refresh())}>Create Fundraiser</Button>
              <div className="space-y-3">
                {fundraisers.map((fundraiser) => {
                  const percent = fundraiser.goalAmount ? Math.min(100, Math.round((fundraiser.raisedAmount / fundraiser.goalAmount) * 100)) : 0;
                  return (
                    <div key={fundraiser.id} className="rounded-xl border p-3 text-sm">
                      <p className="font-semibold">{fundraiser.title}</p>
                      <p className="text-muted-foreground">{fundraiser.description}</p>
                      <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
                      <p className="mt-2 text-xs text-muted-foreground">${fundraiser.raisedAmount} raised of ${fundraiser.goalAmount}</p>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-4">
                <Input value={merchForm.title} onChange={(event) => setMerchForm((current) => ({ ...current, title: event.target.value }))} placeholder="Merch title" />
                <Input className="mt-3" value={merchForm.description} onChange={(event) => setMerchForm((current) => ({ ...current, description: event.target.value }))} placeholder="Merch description" />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input value={merchForm.priceLabel} onChange={(event) => setMerchForm((current) => ({ ...current, priceLabel: event.target.value }))} placeholder="Price label" />
                  <Input type="datetime-local" value={merchForm.limitedDropEndsAt} onChange={(event) => setMerchForm((current) => ({ ...current, limitedDropEndsAt: event.target.value }))} placeholder="Drop ends" />
                </div>
                <Button className="mt-3" variant="outline" onClick={() => void createMerchProduct(merchForm).then(() => refresh())}>Add Merch Product</Button>
                <div className="mt-3 space-y-2">
                  {merch.map((product) => (
                    <div key={product.id} className="rounded-xl border p-3 text-sm">
                      <p className="font-semibold">{product.title}</p>
                      <p className="text-muted-foreground">{product.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.priceLabel}{product.limitedDropEndsAt?.seconds ? ` • Drop ends ${new Date(product.limitedDropEndsAt.seconds * 1000).toLocaleString()}` : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Priority Inbox</CardTitle><CardDescription>Paid DM requests and premium inbox handling.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {priorityInbox.map((request) => (
                <div key={request.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{request.requesterName}</p>
                  <p className="text-muted-foreground">{request.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{request.priceLabel} • {request.status}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void updatePriorityInboxStatus(request.id, "accepted").then(() => refresh())}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => void updatePriorityInboxStatus(request.id, "closed").then(() => refresh())}>Close</Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => void createPriorityInboxRequest({ creatorId: user.uid, note: "Demo priority request", priceLabel: "$25" }).then(() => refresh())}>Create Demo Request</Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Newsletter</CardTitle><CardDescription>Subscriber-only newsletters and landing page links.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Input value={newsletterForm.title} onChange={(event) => setNewsletterForm((current) => ({ ...current, title: event.target.value }))} placeholder="Issue title" />
              <textarea value={newsletterForm.body} onChange={(event) => setNewsletterForm((current) => ({ ...current, body: event.target.value }))} placeholder="Newsletter body" className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" checked={newsletterForm.subscriberOnly} onChange={(event) => setNewsletterForm((current) => ({ ...current, subscriberOnly: event.target.checked }))} />
                Subscriber only
              </label>
              <Button onClick={() => void createNewsletterIssue(newsletterForm).then(() => refresh())}>Publish Newsletter</Button>
              <Button variant="outline" asChild><Link href={`/newsletter/${user.uid}`}>Open subscriber landing page</Link></Button>
              <div className="space-y-2">
                {newsletterIssues.map((issue) => (
                  <div key={issue.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{issue.title}</p>
                    <p className="text-muted-foreground">{issue.body.slice(0, 140)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Blog & Embeds</CardTitle><CardDescription>Articles, SEO pages, and embeddable widgets.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Input value={blogForm.title} onChange={(event) => setBlogForm((current) => ({ ...current, title: event.target.value }))} placeholder="Blog title" />
              <Input value={blogForm.summary} onChange={(event) => setBlogForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Summary" />
              <textarea value={blogForm.body} onChange={(event) => setBlogForm((current) => ({ ...current, body: event.target.value }))} placeholder="Blog body" className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button onClick={() => void createBlogPost(blogForm).then(() => refresh())}>Publish Article</Button>
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" asChild><Link href={`/athlete/${user.uid}`}>Athlete landing</Link></Button>
                <Button variant="outline" asChild><Link href={`/blog/${user.uid}`}>Blog page</Link></Button>
              </div>
              <div className="rounded-xl border p-3 text-xs">
                <p className="font-semibold">Profile widget embed</p>
                <code className="mt-2 block whitespace-pre-wrap">{getProfileEmbedCode(user.uid)}</code>
              </div>
              <div className="rounded-xl border p-3 text-xs">
                <p className="font-semibold">Highlight carousel embed</p>
                <code className="mt-2 block whitespace-pre-wrap">{getHighlightCarouselEmbedCode(user.uid)}</code>
              </div>
              <div className="space-y-2">
                {blogPosts.map((post) => (
                  <div key={post.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{post.title}</p>
                    <p className="text-muted-foreground">{post.summary}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Branding & Domain</CardTitle><CardDescription>Custom domain, storefront headline, and subscriber landing copy.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Input value={growth.customDomain} onChange={(event) => setGrowth((current) => current ? { ...current, customDomain: event.target.value } : current)} placeholder="Custom domain" />
            <Input value={growth.storefrontHeadline} onChange={(event) => setGrowth((current) => current ? { ...current, storefrontHeadline: event.target.value } : current)} placeholder="Storefront headline" />
            <Input value={growth.subscriberLandingTitle} onChange={(event) => setGrowth((current) => current ? { ...current, subscriberLandingTitle: event.target.value } : current)} placeholder="Subscriber landing title" />
            <Button className="md:col-span-3" onClick={() => void updateCurrentGrowthProfile(growth).then(() => setStatus("Growth profile saved."))}>Save Branding</Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function GrowthPage() {
  return (
    <AuthProvider>
      <GrowthHubContent />
    </AuthProvider>
  );
}
