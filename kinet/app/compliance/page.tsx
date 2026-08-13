"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addTeamDocument,
  getSignedConsents,
  getTeamDocuments,
  signConsent,
  type ConsentRecord,
  type TeamDocumentRecord,
} from "@/lib/phase8";

function CompliancePageContent() {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [teamDocuments, setTeamDocuments] = useState<TeamDocumentRecord[]>([]);
  const [teamId, setTeamId] = useState("");
  const [docForm, setDocForm] = useState({ title: "", body: "" });

  const refresh = useCallback(async (nextTeamId = "") => {
    setConsents(await getSignedConsents());
    if (nextTeamId) {
      setTeamDocuments(await getTeamDocuments(nextTeamId));
    } else {
      setTeamDocuments([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Compliance</h1>
          <p className="text-muted-foreground">Legal consent, media release signatures, policy acknowledgment, code of conduct, and team document hub.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
              <CardDescription>Capture the core trust and participation acknowledgments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => void signConsent("legal_consent", "General legal consent").then(() => refresh())}>Sign Legal Consent</Button>
              <Button variant="outline" onClick={() => void signConsent("media_release", "Media release").then(() => refresh())}>Sign Media Release</Button>
              <Button variant="outline" onClick={() => void signConsent("policy_ack", "Policy acknowledgment").then(() => refresh())}>Acknowledge Policy</Button>
              <Button variant="outline" onClick={() => void signConsent("code_of_conduct", "Code of conduct").then(() => refresh())}>Sign Code of Conduct</Button>
              <div className="space-y-2">
                {consents.map((consent) => (
                  <div key={consent.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{consent.label}</p>
                    <p className="text-muted-foreground">{consent.type}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Document Hub</CardTitle>
              <CardDescription>Upload policy docs, playbooks, or staff-only compliance files as text records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Team id" />
              <Input value={docForm.title} onChange={(event) => setDocForm((current) => ({ ...current, title: event.target.value }))} placeholder="Document title" />
              <textarea value={docForm.body} onChange={(event) => setDocForm((current) => ({ ...current, body: event.target.value }))} placeholder="Document body" className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex gap-3">
                <Button onClick={() => void addTeamDocument(teamId, docForm.title, docForm.body).then(() => { setDocForm({ title: "", body: "" }); refresh(teamId); })}>Save Document</Button>
                <Button variant="outline" onClick={() => void refresh(teamId)}>Load Team Docs</Button>
              </div>
              <div className="space-y-2">
                {teamDocuments.map((document) => (
                  <div key={document.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{document.title}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{document.body}</p>
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

export default function CompliancePage() {
  return (
    <AuthProvider>
      <CompliancePageContent />
    </AuthProvider>
  );
}
