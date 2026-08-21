import type { Metadata } from "next";
import { FileText } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return <InfoPage eyebrow="Using Kinet" title="Terms of Use" description="The basic agreement that applies when you create an account or use Kinet." icon={FileText} updated="August 21, 2026" sections={[
    { title: "Your account", content: <p>You must provide accurate information, meet the minimum age required where you live, and protect your sign-in credentials. You are responsible for activity through your account unless you promptly tell us it was compromised.</p> },
    { title: "Your content", content: <p>You keep ownership of content you create. You give Kinet a non-exclusive, worldwide license to host, process, display, and distribute it only as needed to operate and improve the service, according to your audience settings.</p> },
    { title: "Acceptable use", content: <p>Do not use Kinet to break the law, harm others, impersonate people, manipulate engagement, distribute malware, scrape the service without permission, or interfere with its operation. The Community Guidelines form part of these terms.</p> },
    { title: "Enforcement and availability", content: <p>We may limit content or accounts that violate these terms, create risk, or expose Kinet or others to legal liability. Features may change, experience interruptions, or be discontinued as the service evolves.</p> },
    { title: "Ending use and disputes", content: <p>You may stop using Kinet or request account deletion. Provisions that reasonably need to survive termination will remain effective. Applicable consumer protections and mandatory local laws continue to apply.</p> },
  ]} />;
}
