"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCurrentUserBusinessProfile,
  updateCurrentUserBusinessProfile,
  type CreatorBusinessProfile,
} from "@/lib/business";
import {
  createPremiumGroup,
  getCurrentEarningsSnapshot,
  getOwnedPremiumGroups,
  type PremiumGroupRecord,
  type EarningsSnapshot,
} from "@/lib/creator-hub";

function BusinessPageContent() {
  const [profile, setProfile] = useState<CreatorBusinessProfile | null>(null);
  const [earnings, setEarnings] = useState<EarningsSnapshot | null>(null);
  const [groups, setGroups] = useState<PremiumGroupRecord[]>([]);
  const [groupForm, setGroupForm] = useState({ name: "", description: "", priceLabel: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getCurrentUserBusinessProfile().then(setProfile);
    void getCurrentEarningsSnapshot().then(setEarnings);
    void getOwnedPremiumGroups().then(setGroups);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setSaving(true);
    try {
      await updateCurrentUserBusinessProfile(profile);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Business Hub</CardTitle>
            <CardDescription>Set up creator links, paid training sessions, coach consultations, subscriptions, and premium groups.</CardDescription>
          </CardHeader>
          <CardContent>
            {earnings ? (
              <div className="mb-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border p-4 text-center"><div className="text-2xl font-bold">{earnings.subscribers}</div><div className="text-sm text-muted-foreground">Subscribers</div></div>
                <div className="rounded-xl border p-4 text-center"><div className="text-2xl font-bold">{earnings.premiumGroupMembers}</div><div className="text-sm text-muted-foreground">Premium Members</div></div>
                <div className="rounded-xl border p-4 text-center"><div className="text-2xl font-bold">{earnings.bookingRequests}</div><div className="text-sm text-muted-foreground">Bookings</div></div>
                <div className="rounded-xl border p-4 text-center"><div className="text-2xl font-bold">${earnings.estimatedRevenue}</div><div className="text-sm text-muted-foreground">Estimated Revenue</div></div>
              </div>
            ) : null}

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <Button variant="outline" asChild>
                <a href="/marketplace">Open Marketplace</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/billing">Open Billing and Monetization</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/growth">Open Growth Hub</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/search">Discover people</a>
              </Button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Support link"
                  value={profile.supportUrl}
                  onChange={(event) => setProfile((current) => current ? { ...current, supportUrl: event.target.value } : current)}
                />
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Merch link"
                  value={profile.merchUrl}
                  onChange={(event) => setProfile((current) => current ? { ...current, merchUrl: event.target.value } : current)}
                />
              </div>

              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Collaboration pitch for brands, coaches, or creators"
                value={profile.collaborationPitch}
                onChange={(event) => setProfile((current) => current ? { ...current, collaborationPitch: event.target.value } : current)}
              />

              {(["training", "consultation"] as const).map((offerKey) => {
                const offer = profile[offerKey];
                return (
                  <div key={offerKey} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold capitalize">{offerKey}</h3>
                        <p className="text-sm text-muted-foreground">
                          Make this available for paid bookings from your public profile.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={offer.enabled}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  [offerKey]: { ...current[offerKey], enabled: event.target.checked },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <input
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        placeholder="Offer title"
                        value={offer.title}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  [offerKey]: { ...current[offerKey], title: event.target.value },
                                }
                              : current
                          )
                        }
                      />
                      <input
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        placeholder="Price label, e.g. $45/session"
                        value={offer.priceLabel}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  [offerKey]: { ...current[offerKey], priceLabel: event.target.value },
                                }
                              : current
                          )
                        }
                      />
                      <input
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        type="number"
                        min={15}
                        placeholder="Duration in minutes"
                        value={offer.durationMinutes}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  [offerKey]: {
                                    ...current[offerKey],
                                    durationMinutes: Number(event.target.value),
                                  },
                                }
                              : current
                          )
                        }
                      />
                      <input
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        placeholder="Checkout link"
                        value={offer.checkoutUrl}
                        onChange={(event) =>
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  [offerKey]: { ...current[offerKey], checkoutUrl: event.target.value },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Business Settings"}
              </Button>
            </form>

            <div className="mt-8 rounded-2xl border p-4">
              <h3 className="font-semibold">Premium Groups</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create subscriber-only rooms or communities you can post around in the app.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="Group name" value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} />
                <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="Price label" value={groupForm.priceLabel} onChange={(event) => setGroupForm((current) => ({ ...current, priceLabel: event.target.value }))} />
                <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="Description" value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <Button
                className="mt-3"
                type="button"
                onClick={() =>
                  void createPremiumGroup(groupForm).then(async () => {
                    setGroupForm({ name: "", description: "", priceLabel: "" });
                    setGroups(await getOwnedPremiumGroups());
                  })
                }
              >
                Create Premium Group
              </Button>
              <div className="mt-4 space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="rounded-xl bg-muted p-4">
                    <p className="font-semibold">{group.name}</p>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{group.priceLabel} • {group.memberIds.length} members</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function BusinessPage() {
  return (
    <AuthProvider>
      <BusinessPageContent />
    </AuthProvider>
  );
}
