import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function CommunityGuidelinesPage() {
  return <InfoPage eyebrow="Our community" title="Community Guidelines" description="Kinet works best when people can create, connect, and disagree without being harmed." icon={UsersRound} updated="August 21, 2026" sections={[
    { title: "Be human", content: <p>Do not harass, threaten, shame, or target people. Hate speech and attacks based on protected characteristics are not allowed. Respect boundaries and do not encourage pile-ons.</p> },
    { title: "Keep people safe", content: <p>Do not promote violence, exploitation, self-harm, dangerous challenges, or sexual content involving minors. Never share another person’s private information or intimate content without consent.</p> },
    { title: "Be authentic", content: <p>Do not impersonate others, coordinate fake engagement, deceive people for money, spread malicious misinformation, or automate spam. Clearly disclose meaningful commercial relationships.</p> },
    { title: "Respect ownership", content: <p>Share content you created or have permission to use. Credit creators where appropriate and respond promptly when a rights holder raises a valid concern.</p> },
    { title: "How enforcement works", content: <p>We consider context, severity, intent, and prior violations. Responses may include reducing distribution, removing content, restricting features, suspending an account, or permanently disabling it.</p> },
  ]} />;
}
