"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createBackgroundCheck,
  createBudgetRequest,
  createCaptainVote,
  createEmergencyBroadcast,
  createEmergencyContact,
  createEquipmentCheckout,
  createExpenseApproval,
  createFacilityAccessLog,
  createHarassmentReport,
  createIncidentTimeline,
  createJerseyAssignment,
  createLeadershipFeedback,
  createMedicalStaffNote,
  createPhotoRelease,
  createPurchaseOrder,
  createSafeSportItem,
  createSosAlert,
  createStaffOnboarding,
  createVolunteerWaiver,
  createWeatherAlert,
  getSafetyHubSnapshot,
} from "@/lib/phase7-safety";

function SafetyOpsPageContent() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getSafetyHubSnapshot>> | null>(null);

  const [teamId, setTeamId] = useState("");
  const [captainForm, setCaptainForm] = useState({ nomineeName: "", voterName: "", reason: "" });
  const [feedbackForm, setFeedbackForm] = useState({ subjectName: "", reviewerName: "", feedback: "", score: "8" });
  const [reportForm, setReportForm] = useState({ targetName: "", summary: "", severity: "medium", anonymous: true });
  const [safeSportForm, setSafeSportForm] = useState({ requirement: "", ownerName: "", status: "pending" });
  const [backgroundForm, setBackgroundForm] = useState({ staffName: "", role: "", status: "pending" });
  const [onboardingForm, setOnboardingForm] = useState({ staffName: "", checklistTitle: "", completedSteps: "2", totalSteps: "6" });
  const [waiverForm, setWaiverForm] = useState({ eventName: "", volunteerName: "", signed: true });
  const [facilityForm, setFacilityForm] = useState({ facilityName: "", memberName: "", action: "check_in" });
  const [equipmentForm, setEquipmentForm] = useState({ itemName: "", assignedTo: "", dueBack: "", status: "out" });
  const [jerseyForm, setJerseyForm] = useState({ athleteName: "", jerseyNumber: "", setLabel: "" });
  const [budgetForm, setBudgetForm] = useState({ requesterName: "", title: "", amountLabel: "", status: "pending" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amountLabel: "", approverName: "", status: "pending" });
  const [poForm, setPoForm] = useState({ vendorName: "", itemSummary: "", poNumber: "" });
  const [photoForm, setPhotoForm] = useState({ eventName: "", participantName: "", approved: true });
  const [medicalForm, setMedicalForm] = useState({ athleteName: "", staffName: "", note: "" });
  const [contactForm, setContactForm] = useState({ athleteName: "", contactName: "", relationship: "", phone: "" });
  const [weatherForm, setWeatherForm] = useState({ alertTitle: "", details: "", severity: "watch" });
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "" });
  const [sosForm, setSosForm] = useState({ senderName: "", locationLabel: "", message: "" });
  const [incidentForm, setIncidentForm] = useState({ incidentTitle: "", eventTime: "", note: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSnapshot = await getSafetyHubSnapshot();
      setSnapshot(nextSnapshot);
      setTeamId((current) => current || nextSnapshot.teamOptions[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async (action: () => Promise<void>, message: string, reset?: () => void) => {
    await action();
    reset?.();
    setStatus(message);
    await refresh();
  };

  if (loading || !snapshot) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Safety and Team Ops</h1>
          <p className="text-muted-foreground">Team leadership, staff compliance, equipment control, emergency response, and incident tracking in one workspace.</p>
          {status ? <p className="mt-2 text-sm text-primary">{status}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardContent className="p-5 text-center"><div className="text-2xl font-bold">{snapshot.harassmentReports.length}</div><div className="text-sm text-muted-foreground">Safety reports</div></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><div className="text-2xl font-bold">{snapshot.backgroundChecks.length}</div><div className="text-sm text-muted-foreground">Background checks</div></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><div className="text-2xl font-bold">{snapshot.equipmentCheckouts.length}</div><div className="text-sm text-muted-foreground">Equipment out</div></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><div className="text-2xl font-bold">{snapshot.broadcasts.length}</div><div className="text-sm text-muted-foreground">Broadcasts</div></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><div className="text-2xl font-bold">{snapshot.incidents.length}</div><div className="text-sm text-muted-foreground">Incidents logged</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Team Context</CardTitle><CardDescription>Choose the team space for the safety and ops records below.</CardDescription></CardHeader>
          <CardContent>
            <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose team</option>
              {snapshot.teamOptions.map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}
            </select>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Leadership and SafeSport</CardTitle><CardDescription>Run captain voting, feedback reviews, anonymous reporting, and compliance tracking.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={captainForm.nomineeName} onChange={(e) => setCaptainForm((c) => ({ ...c, nomineeName: e.target.value }))} placeholder="Captain nominee" />
                <Input value={captainForm.voterName} onChange={(e) => setCaptainForm((c) => ({ ...c, voterName: e.target.value }))} placeholder="Voter name" />
                <Input value={feedbackForm.subjectName} onChange={(e) => setFeedbackForm((c) => ({ ...c, subjectName: e.target.value }))} placeholder="Feedback subject" />
                <Input value={feedbackForm.reviewerName} onChange={(e) => setFeedbackForm((c) => ({ ...c, reviewerName: e.target.value }))} placeholder="Reviewer" />
                <Input value={feedbackForm.score} onChange={(e) => setFeedbackForm((c) => ({ ...c, score: e.target.value }))} placeholder="Score 1-10" />
                <Input value={reportForm.targetName} onChange={(e) => setReportForm((c) => ({ ...c, targetName: e.target.value }))} placeholder="Report target" />
                <Input value={safeSportForm.requirement} onChange={(e) => setSafeSportForm((c) => ({ ...c, requirement: e.target.value }))} placeholder="SafeSport requirement" />
                <Input value={safeSportForm.ownerName} onChange={(e) => setSafeSportForm((c) => ({ ...c, ownerName: e.target.value }))} placeholder="Owner name" />
              </div>
              <textarea value={captainForm.reason} onChange={(e) => setCaptainForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Why this nominee?" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <textarea value={feedbackForm.feedback} onChange={(e) => setFeedbackForm((c) => ({ ...c, feedback: e.target.value }))} placeholder="Leadership feedback" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <textarea value={reportForm.summary} onChange={(e) => setReportForm((c) => ({ ...c, summary: e.target.value }))} placeholder="Anonymous harassment report summary" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void submit(() => createCaptainVote({ teamId, ...captainForm }), "Captain vote recorded.", () => setCaptainForm({ nomineeName: "", voterName: "", reason: "" }))} disabled={!teamId || !captainForm.nomineeName.trim()}>Save Captain Vote</Button>
                <Button variant="outline" onClick={() => void submit(() => createLeadershipFeedback({ teamId, subjectName: feedbackForm.subjectName, reviewerName: feedbackForm.reviewerName, feedback: feedbackForm.feedback, score: Number(feedbackForm.score) }), "Leadership feedback saved.", () => setFeedbackForm({ subjectName: "", reviewerName: "", feedback: "", score: "8" }))} disabled={!teamId || !feedbackForm.subjectName.trim()}>Save Feedback</Button>
                <Button variant="outline" onClick={() => void submit(() => createHarassmentReport({ teamId, anonymous: reportForm.anonymous, targetName: reportForm.targetName, summary: reportForm.summary, severity: reportForm.severity as "low" | "medium" | "high" }), "Safety report submitted.", () => setReportForm({ targetName: "", summary: "", severity: "medium", anonymous: true }))} disabled={!teamId || !reportForm.summary.trim()}>Submit Report</Button>
                <Button variant="outline" onClick={() => void submit(() => createSafeSportItem({ teamId, requirement: safeSportForm.requirement, ownerName: safeSportForm.ownerName, status: safeSportForm.status as "pending" | "complete" }), "SafeSport item added.", () => setSafeSportForm({ requirement: "", ownerName: "", status: "pending" }))} disabled={!teamId || !safeSportForm.requirement.trim()}>Add SafeSport Item</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Staff Compliance and Facility Control</CardTitle><CardDescription>Track checks, onboarding, waivers, facility access, equipment, jerseys, and medical support.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={backgroundForm.staffName} onChange={(e) => setBackgroundForm((c) => ({ ...c, staffName: e.target.value }))} placeholder="Staff name" />
                <Input value={backgroundForm.role} onChange={(e) => setBackgroundForm((c) => ({ ...c, role: e.target.value }))} placeholder="Role" />
                <Input value={onboardingForm.staffName} onChange={(e) => setOnboardingForm((c) => ({ ...c, staffName: e.target.value }))} placeholder="Onboarding staff" />
                <Input value={onboardingForm.checklistTitle} onChange={(e) => setOnboardingForm((c) => ({ ...c, checklistTitle: e.target.value }))} placeholder="Checklist title" />
                <Input value={waiverForm.eventName} onChange={(e) => setWaiverForm((c) => ({ ...c, eventName: e.target.value }))} placeholder="Volunteer event" />
                <Input value={waiverForm.volunteerName} onChange={(e) => setWaiverForm((c) => ({ ...c, volunteerName: e.target.value }))} placeholder="Volunteer name" />
                <Input value={facilityForm.facilityName} onChange={(e) => setFacilityForm((c) => ({ ...c, facilityName: e.target.value }))} placeholder="Facility" />
                <Input value={facilityForm.memberName} onChange={(e) => setFacilityForm((c) => ({ ...c, memberName: e.target.value }))} placeholder="Member" />
                <Input value={equipmentForm.itemName} onChange={(e) => setEquipmentForm((c) => ({ ...c, itemName: e.target.value }))} placeholder="Equipment item" />
                <Input value={equipmentForm.assignedTo} onChange={(e) => setEquipmentForm((c) => ({ ...c, assignedTo: e.target.value }))} placeholder="Assigned to" />
                <Input value={equipmentForm.dueBack} onChange={(e) => setEquipmentForm((c) => ({ ...c, dueBack: e.target.value }))} placeholder="Due back" />
                <Input value={jerseyForm.athleteName} onChange={(e) => setJerseyForm((c) => ({ ...c, athleteName: e.target.value }))} placeholder="Athlete" />
                <Input value={jerseyForm.jerseyNumber} onChange={(e) => setJerseyForm((c) => ({ ...c, jerseyNumber: e.target.value }))} placeholder="Jersey #" />
                <Input value={jerseyForm.setLabel} onChange={(e) => setJerseyForm((c) => ({ ...c, setLabel: e.target.value }))} placeholder="Set label" />
                <Input value={medicalForm.athleteName} onChange={(e) => setMedicalForm((c) => ({ ...c, athleteName: e.target.value }))} placeholder="Athlete name" />
                <Input value={medicalForm.staffName} onChange={(e) => setMedicalForm((c) => ({ ...c, staffName: e.target.value }))} placeholder="Medical staff" />
              </div>
              <textarea value={medicalForm.note} onChange={(e) => setMedicalForm((c) => ({ ...c, note: e.target.value }))} placeholder="Medical staff note" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void submit(() => createBackgroundCheck({ teamId, ...backgroundForm, status: backgroundForm.status as "pending" | "cleared" | "expired" }), "Background check logged.", () => setBackgroundForm({ staffName: "", role: "", status: "pending" }))} disabled={!teamId || !backgroundForm.staffName.trim()}>Save Background Check</Button>
                <Button variant="outline" onClick={() => void submit(() => createStaffOnboarding({ teamId, staffName: onboardingForm.staffName, checklistTitle: onboardingForm.checklistTitle, completedSteps: Number(onboardingForm.completedSteps), totalSteps: Number(onboardingForm.totalSteps) }), "Staff onboarding checklist saved.", () => setOnboardingForm({ staffName: "", checklistTitle: "", completedSteps: "2", totalSteps: "6" }))} disabled={!teamId || !onboardingForm.staffName.trim()}>Save Onboarding</Button>
                <Button variant="outline" onClick={() => void submit(() => createVolunteerWaiver({ eventName: waiverForm.eventName, volunteerName: waiverForm.volunteerName, signed: waiverForm.signed }), "Volunteer waiver captured.", () => setWaiverForm({ eventName: "", volunteerName: "", signed: true }))} disabled={!waiverForm.eventName.trim()}>Save Waiver</Button>
                <Button variant="outline" onClick={() => void submit(() => createFacilityAccessLog({ facilityName: facilityForm.facilityName, memberName: facilityForm.memberName, action: facilityForm.action as "check_in" | "check_out" }), "Facility access logged.", () => setFacilityForm({ facilityName: "", memberName: "", action: "check_in" }))} disabled={!facilityForm.facilityName.trim()}>Log Access</Button>
                <Button variant="outline" onClick={() => void submit(() => createEquipmentCheckout({ teamId, itemName: equipmentForm.itemName, assignedTo: equipmentForm.assignedTo, dueBack: equipmentForm.dueBack, status: equipmentForm.status as "out" | "returned" }), "Equipment checkout saved.", () => setEquipmentForm({ itemName: "", assignedTo: "", dueBack: "", status: "out" }))} disabled={!teamId || !equipmentForm.itemName.trim()}>Save Equipment</Button>
                <Button variant="outline" onClick={() => void submit(() => createJerseyAssignment({ teamId, ...jerseyForm }), "Jersey assignment saved.", () => setJerseyForm({ athleteName: "", jerseyNumber: "", setLabel: "" }))} disabled={!teamId || !jerseyForm.athleteName.trim()}>Save Jersey</Button>
                <Button variant="outline" onClick={() => void submit(() => createMedicalStaffNote(medicalForm), "Medical note saved.", () => setMedicalForm({ athleteName: "", staffName: "", note: "" }))} disabled={!medicalForm.athleteName.trim()}>Save Medical Note</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Budgets, Expenses, and Operations</CardTitle><CardDescription>Handle budget requests, expense approvals, purchase orders, and photo release approvals by event.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={budgetForm.requesterName} onChange={(e) => setBudgetForm((c) => ({ ...c, requesterName: e.target.value }))} placeholder="Requester name" />
                <Input value={budgetForm.title} onChange={(e) => setBudgetForm((c) => ({ ...c, title: e.target.value }))} placeholder="Budget request" />
                <Input value={budgetForm.amountLabel} onChange={(e) => setBudgetForm((c) => ({ ...c, amountLabel: e.target.value }))} placeholder="$ amount" />
                <Input value={expenseForm.title} onChange={(e) => setExpenseForm((c) => ({ ...c, title: e.target.value }))} placeholder="Expense title" />
                <Input value={expenseForm.amountLabel} onChange={(e) => setExpenseForm((c) => ({ ...c, amountLabel: e.target.value }))} placeholder="Expense amount" />
                <Input value={expenseForm.approverName} onChange={(e) => setExpenseForm((c) => ({ ...c, approverName: e.target.value }))} placeholder="Approver" />
                <Input value={poForm.vendorName} onChange={(e) => setPoForm((c) => ({ ...c, vendorName: e.target.value }))} placeholder="Vendor name" />
                <Input value={poForm.itemSummary} onChange={(e) => setPoForm((c) => ({ ...c, itemSummary: e.target.value }))} placeholder="Item summary" />
                <Input value={poForm.poNumber} onChange={(e) => setPoForm((c) => ({ ...c, poNumber: e.target.value }))} placeholder="PO number" />
                <Input value={photoForm.eventName} onChange={(e) => setPhotoForm((c) => ({ ...c, eventName: e.target.value }))} placeholder="Photo release event" />
                <Input value={photoForm.participantName} onChange={(e) => setPhotoForm((c) => ({ ...c, participantName: e.target.value }))} placeholder="Participant name" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void submit(() => createBudgetRequest({ teamId, ...budgetForm, status: budgetForm.status as "pending" | "approved" | "denied" }), "Budget request saved.", () => setBudgetForm({ requesterName: "", title: "", amountLabel: "", status: "pending" }))} disabled={!teamId || !budgetForm.title.trim()}>Save Budget Request</Button>
                <Button variant="outline" onClick={() => void submit(() => createExpenseApproval({ teamId, ...expenseForm, status: expenseForm.status as "pending" | "approved" | "rejected" }), "Expense approval saved.", () => setExpenseForm({ title: "", amountLabel: "", approverName: "", status: "pending" }))} disabled={!teamId || !expenseForm.title.trim()}>Save Expense</Button>
                <Button variant="outline" onClick={() => void submit(() => createPurchaseOrder({ teamId, ...poForm }), "Purchase order saved.", () => setPoForm({ vendorName: "", itemSummary: "", poNumber: "" }))} disabled={!teamId || !poForm.vendorName.trim()}>Save PO</Button>
                <Button variant="outline" onClick={() => void submit(() => createPhotoRelease(photoForm), "Photo release approval saved.", () => setPhotoForm({ eventName: "", participantName: "", approved: true }))} disabled={!photoForm.eventName.trim()}>Save Photo Release</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Emergency Response</CardTitle><CardDescription>Quick contacts, weather alerts, emergency broadcasts, SOS alerts, and incident timeline recording.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={contactForm.athleteName} onChange={(e) => setContactForm((c) => ({ ...c, athleteName: e.target.value }))} placeholder="Athlete name" />
                <Input value={contactForm.contactName} onChange={(e) => setContactForm((c) => ({ ...c, contactName: e.target.value }))} placeholder="Emergency contact" />
                <Input value={contactForm.relationship} onChange={(e) => setContactForm((c) => ({ ...c, relationship: e.target.value }))} placeholder="Relationship" />
                <Input value={contactForm.phone} onChange={(e) => setContactForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" />
                <Input value={weatherForm.alertTitle} onChange={(e) => setWeatherForm((c) => ({ ...c, alertTitle: e.target.value }))} placeholder="Weather alert title" />
                <Input value={sosForm.senderName} onChange={(e) => setSosForm((c) => ({ ...c, senderName: e.target.value }))} placeholder="SOS sender" />
                <Input value={sosForm.locationLabel} onChange={(e) => setSosForm((c) => ({ ...c, locationLabel: e.target.value }))} placeholder="Location" />
                <Input value={incidentForm.incidentTitle} onChange={(e) => setIncidentForm((c) => ({ ...c, incidentTitle: e.target.value }))} placeholder="Incident title" />
                <Input value={incidentForm.eventTime} onChange={(e) => setIncidentForm((c) => ({ ...c, eventTime: e.target.value }))} placeholder="Incident time" />
                <Input value={broadcastForm.title} onChange={(e) => setBroadcastForm((c) => ({ ...c, title: e.target.value }))} placeholder="Broadcast title" />
              </div>
              <textarea value={weatherForm.details} onChange={(e) => setWeatherForm((c) => ({ ...c, details: e.target.value }))} placeholder="Weather details" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <textarea value={broadcastForm.message} onChange={(e) => setBroadcastForm((c) => ({ ...c, message: e.target.value }))} placeholder="Emergency broadcast message" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <textarea value={sosForm.message} onChange={(e) => setSosForm((c) => ({ ...c, message: e.target.value }))} placeholder="SOS message" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <textarea value={incidentForm.note} onChange={(e) => setIncidentForm((c) => ({ ...c, note: e.target.value }))} placeholder="Incident timeline note" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void submit(() => createEmergencyContact(contactForm), "Emergency contact saved.", () => setContactForm({ athleteName: "", contactName: "", relationship: "", phone: "" }))} disabled={!contactForm.athleteName.trim()}>Save Contact</Button>
                <Button variant="outline" onClick={() => void submit(() => createWeatherAlert({ teamId, alertTitle: weatherForm.alertTitle, details: weatherForm.details, severity: weatherForm.severity as "watch" | "warning" }), "Weather alert sent.", () => setWeatherForm({ alertTitle: "", details: "", severity: "watch" }))} disabled={!teamId || !weatherForm.alertTitle.trim()}>Save Weather Alert</Button>
                <Button variant="outline" onClick={() => void submit(() => createEmergencyBroadcast({ teamId, ...broadcastForm }), "Emergency broadcast saved.", () => setBroadcastForm({ title: "", message: "" }))} disabled={!teamId || !broadcastForm.title.trim()}>Save Broadcast</Button>
                <Button variant="outline" onClick={() => void submit(() => createSosAlert({ teamId, ...sosForm }), "SOS alert sent.", () => setSosForm({ senderName: "", locationLabel: "", message: "" }))} disabled={!teamId || !sosForm.senderName.trim()}>Send SOS</Button>
                <Button variant="outline" onClick={() => void submit(() => createIncidentTimeline({ teamId, ...incidentForm }), "Incident entry added.", () => setIncidentForm({ incidentTitle: "", eventTime: "", note: "" }))} disabled={!teamId || !incidentForm.incidentTitle.trim()}>Save Incident</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function SafetyOpsPage() {
  return (
    <AuthProvider>
      <SafetyOpsPageContent />
    </AuthProvider>
  );
}
