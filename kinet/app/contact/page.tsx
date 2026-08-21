import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle, ShieldAlert } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Contact", description: "Contact the Kinet team for support, safety, and general questions." };

export default function ContactPage() {
  return <InfoPage eyebrow="Contact Kinet" title="How can we help?" description="Choose the right channel so your question reaches the right people." icon={MessageCircle} sections={[
    { title: "Product support", content: <><p>For sign-in, account, posting, messaging, or notification problems, start in the Help Center.</p><Link href="/help" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><LifeBuoy className="h-4 w-4" />Visit the Help Center</Link></> },
    { title: "Contact our team", content: <><p>For general questions, partnerships, press, or feedback, email the Kinet team. Include your username when the question concerns an account.</p><a href="mailto:support@kinet.app" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><Mail className="h-4 w-4" />support@kinet.app</a></> },
    { title: "Safety concerns", content: <><p>If content or an account may violate our rules, use the report option in Kinet. In-app reports include the context our safety team needs.</p><Link href="/community-guidelines" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><ShieldAlert className="h-4 w-4" />Read our Community Guidelines</Link><p>If someone is in immediate danger, contact local emergency services first.</p></> },
  ]} />;
}
