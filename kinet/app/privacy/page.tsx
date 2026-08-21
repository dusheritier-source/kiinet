import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <InfoPage eyebrow="Your information" title="Privacy Policy" description="A clear overview of the information Kinet uses and the choices available to you." icon={ShieldCheck} updated="August 21, 2026" sections={[
    { title: "Information you provide", content: <p>We process information you add to Kinet, such as account details, profile information, posts, messages, media, settings, reports, and communications with support.</p> },
    { title: "Information from your use of Kinet", content: <p>We may process device and browser information, app activity, interactions, approximate location derived from network information, and diagnostic data to operate and improve the service.</p> },
    { title: "How information is used", content: <p>We use information to provide and personalize Kinet, deliver communications, maintain safety, troubleshoot problems, analyze features, and comply with applicable legal obligations.</p> },
    { title: "Sharing and visibility", content: <p>Your audience depends on your account and post settings. We may use service providers to operate Kinet and disclose information when legally required or necessary to prevent harm, fraud, or abuse. We do not sell personal information for money.</p> },
    { title: "Your choices", content: <p>You can update profile information, manage audience and notification preferences, download available account data, or request account deletion from Kinet’s settings. Some records may be retained for security or legal compliance.</p> },
    { title: "Children and changes", content: <p>Kinet is not intended for children below the minimum age required in their country. We may update this policy as the service develops and will show the effective date when changes are made.</p> },
  ]} />;
}
