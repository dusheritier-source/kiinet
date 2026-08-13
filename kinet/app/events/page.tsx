"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addEventInternalNote,
  assignEventStaff,
  checkInTicket,
  getAttendanceCertificates,
  getEventDiscovery,
  getEventInternalNotes,
  getEventStaffAssignments,
  getMyEventTickets,
  getMyShowcaseRegistrations,
  issueEventTicket,
  registerForShowcase,
  type AttendanceCertificate,
  type EventDiscoveryRecord,
  type EventInternalNote,
  type EventStaffAssignment,
  type EventTicketRecord,
} from "@/lib/phase5";
import { searchProfiles, type SearchProfile } from "@/lib/user-profile";

function EventsPageContent() {
  const [city, setCity] = useState("");
  const [events, setEvents] = useState<EventDiscoveryRecord[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [ticketName, setTicketName] = useState("");
  const [ticketEmail, setTicketEmail] = useState("");
  const [tickets, setTickets] = useState<EventTicketRecord[]>([]);
  const [qrTicketId, setQrTicketId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [certificates, setCertificates] = useState<AttendanceCertificate[]>([]);
  const [staffUid, setStaffUid] = useState("");
  const [staffRole, setStaffRole] = useState("check-in");
  const [staffAssignments, setStaffAssignments] = useState<EventStaffAssignment[]>([]);
  const [eventNote, setEventNote] = useState("");
  const [internalNotes, setInternalNotes] = useState<EventInternalNote[]>([]);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async (nextCity = "", nextEventId = "") => {
    const [nextEvents, nextProfiles, nextTickets, nextCertificates] = await Promise.all([
      getEventDiscovery(nextCity),
      searchProfiles(""),
      getMyEventTickets(),
      getAttendanceCertificates(),
    ]);
    setEvents(nextEvents);
    setProfiles(nextProfiles);
    setTickets(nextTickets);
    setCertificates(nextCertificates);

    if (nextEventId) {
      const [nextStaff, nextNotes] = await Promise.all([
        getEventStaffAssignments(nextEventId),
        getEventInternalNotes(nextEventId),
      ]);
      setStaffAssignments(nextStaff);
      setInternalNotes(nextNotes);
    } else {
      setStaffAssignments([]);
      setInternalNotes([]);
    }
  }, []);

  useEffect(() => {
    void Promise.all([refresh(), getMyShowcaseRegistrations()]);
  }, [refresh]);

  useEffect(() => {
    if (!selectedEventId) {
      setStaffAssignments([]);
      setInternalNotes([]);
      return;
    }
    void refresh(city, selectedEventId);
  }, [city, refresh, selectedEventId]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Event Hub</h1>
          <p className="text-muted-foreground">
            Discover showcases by city, register, issue tickets, check guests in with QR codes, assign staff, and issue attendance certificates.
          </p>
          {status ? <p className="mt-2 text-sm text-primary">{status}</p> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Discovery</CardTitle>
            <CardDescription>Browse game, tryout, and showcase-style events by city.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Search city" />
              <Button onClick={() => void refresh(city, selectedEventId)}>Search</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`rounded-xl border p-4 text-left ${selectedEventId === event.id ? "border-primary bg-primary/5" : ""}`}
                >
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[event.teamName, event.teamSport, event.city, event.date].filter(Boolean).join(" • ")}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Showcase Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={registrationMessage}
                onChange={(event) => setRegistrationMessage(event.target.value)}
                placeholder="Why are you attending or what should organizers know?"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                className="w-full"
                disabled={!selectedEventId}
                onClick={() =>
                  void registerForShowcase(selectedEventId, registrationMessage).then(() => {
                    setRegistrationMessage("");
                    setStatus("Showcase registration saved.");
                  })
                }
              >
                Register For Event
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticketing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={ticketName} onChange={(event) => setTicketName(event.target.value)} placeholder="Ticket holder name" />
              <Input value={ticketEmail} onChange={(event) => setTicketEmail(event.target.value)} placeholder="Email" />
              <Button
                className="w-full"
                disabled={!selectedEventId}
                onClick={() =>
                  void issueEventTicket(selectedEventId, ticketName, ticketEmail).then(() => {
                    setTicketName("");
                    setTicketEmail("");
                    setStatus("Ticket issued.");
                    return refresh(city, selectedEventId);
                  })
                }
              >
                Create Ticket
              </Button>
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{ticket.holderName}</p>
                    <p className="text-muted-foreground">{ticket.email}</p>
                    <p className="mt-1 text-xs">{ticket.qrCode}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Check-In</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select value={qrTicketId} onChange={(event) => setQrTicketId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose ticket</option>
                {tickets.map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.holderName}
                  </option>
                ))}
              </select>
              <Input value={qrCode} onChange={(event) => setQrCode(event.target.value)} placeholder="Paste QR code string" />
              <Button
                className="w-full"
                disabled={!qrTicketId || !qrCode}
                onClick={() =>
                  void checkInTicket(qrTicketId, qrCode).then(() => {
                    setQrCode("");
                    setStatus("Ticket checked in and certificate issued.");
                    return refresh(city, selectedEventId);
                  })
                }
              >
                Check In
              </Button>
              <div className="space-y-2">
                {certificates.map((certificate) => (
                  <div key={certificate.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{certificate.title}</p>
                    <p className="text-muted-foreground">Event {certificate.eventId}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Event Staffing Directory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select value={staffUid} onChange={(event) => setStaffUid(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose staff profile</option>
                {profiles.map((profile) => (
                  <option key={profile.uid} value={profile.uid}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
              <Input value={staffRole} onChange={(event) => setStaffRole(event.target.value)} placeholder="Role" />
              <Button
                className="w-full"
                disabled={!selectedEventId || !staffUid}
                onClick={() => {
                  const profile = profiles.find((entry) => entry.uid === staffUid);
                  return void assignEventStaff(selectedEventId, staffUid, staffRole, profile?.displayName || "Staff").then(() => {
                    setStatus("Staff member assigned.");
                    return refresh(city, selectedEventId);
                  });
                }}
              >
                Assign Staff
              </Button>
              <div className="space-y-2">
                {staffAssignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{assignment.displayName}</p>
                    <p className="text-muted-foreground">{assignment.role}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal Event Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={eventNote}
                onChange={(event) => setEventNote(event.target.value)}
                placeholder="Internal notes for staffing, run of show, or operations"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                className="w-full"
                disabled={!selectedEventId}
                onClick={() =>
                  void addEventInternalNote(selectedEventId, eventNote).then(() => {
                    setEventNote("");
                    setStatus("Internal event note saved.");
                    return refresh(city, selectedEventId);
                  })
                }
              >
                Save Note
              </Button>
              <div className="space-y-2">
                {internalNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">Note</p>
                    <p className="text-muted-foreground">{note.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function EventsPage() {
  return (
    <AuthProvider>
      <EventsPageContent />
    </AuthProvider>
  );
}
