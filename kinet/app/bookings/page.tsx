"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createBookingRequest,
  subscribeToIncomingBookings,
  subscribeToOutgoingBookings,
  updateBookingStatus,
  type BookingRequestRecord,
} from "@/lib/business";
import { getUserProfileById } from "@/lib/user-profile";

function BookingsPageInner() {
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const [incoming, setIncoming] = useState<BookingRequestRecord[]>([]);
  const [outgoing, setOutgoing] = useState<BookingRequestRecord[]>([]);
  const [hostName, setHostName] = useState("");
  const [form, setForm] = useState({
    hostId: "",
    type: "training" as "training" | "consultation",
    scheduledFor: "",
    note: "",
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const hostId = searchParams.get("host") ?? "";
    const type = searchParams.get("type");
    if (hostId) {
      setForm((current) => ({
        ...current,
        hostId,
        type: type === "consultation" ? "consultation" : "training",
      }));
      void getUserProfileById(hostId).then((profile) =>
        setHostName(String((profile as { displayName?: string } | null)?.displayName ?? "Creator"))
      );
    }

    const unsubscribeIncoming = subscribeToIncomingBookings(user.uid, setIncoming);
    const unsubscribeOutgoing = subscribeToOutgoingBookings(user.uid, setOutgoing);
    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [searchParams, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createBookingRequest(form);
    setForm((current) => ({ ...current, note: "", scheduledFor: "" }));
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Card>
          <CardHeader>
            <CardTitle>Request Booking</CardTitle>
            <CardDescription>
              Book paid training sessions or coach consultations from public profiles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
              <input
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Host UID"
                value={form.hostId}
                onChange={(event) => setForm((current) => ({ ...current, hostId: event.target.value }))}
                required
              />
              <select
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value === "consultation" ? "consultation" : "training",
                  }))
                }
              >
                <option value="training">Training</option>
                <option value="consultation">Consultation</option>
              </select>
              <input
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))}
                required
              />
              <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                {hostName ? `Booking with ${hostName}` : "Choose a creator or coach profile to prefill this form."}
              </div>
              <textarea
                className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="Share your goals, age group, team context, or questions"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              />
              <Button type="submit" className="md:col-span-2" disabled={!form.hostId}>
                Send Booking Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Bookings</CardTitle>
              <CardDescription>Requests other members have sent to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {incoming.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No incoming bookings yet.</div>
              ) : (
                incoming.map((booking) => (
                  <div key={booking.id} className="rounded-xl border p-4">
                    <p className="font-semibold">{booking.requesterName}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.type} • {booking.priceLabel || "Price on profile"} • {booking.scheduledFor}
                    </p>
                    <p className="mt-2 text-sm">{booking.note || "No extra note."}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => void updateBookingStatus(booking.id, "accepted")}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => void updateBookingStatus(booking.id, "declined")}>Decline</Button>
                      <Button size="sm" variant="outline" onClick={() => void updateBookingStatus(booking.id, "completed")}>Complete</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outgoing Bookings</CardTitle>
              <CardDescription>Requests you have sent to other creators and coaches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {outgoing.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No outgoing bookings yet.</div>
              ) : (
                outgoing.map((booking) => (
                  <div key={booking.id} className="rounded-xl border p-4">
                    <p className="font-semibold">{booking.hostName}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.type} • {booking.priceLabel || "Price on profile"} • {booking.scheduledFor}
                    </p>
                    <p className="mt-2 text-sm">Status: {booking.status}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function BookingsPageContent() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
        <BookingsPageInner />
      </Suspense>
    </AuthProvider>
  );
}

export default function BookingsPage() {
  return <BookingsPageContent />;
}
