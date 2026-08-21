import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Help Center" };

export default function HelpPage() {
  return <InfoPage eyebrow="Kinet Support" title="Help Center" description="Quick answers for the most common account and app questions." icon={HelpCircle} sections={[
    { title: "Account and sign-in", content: <><p>Update your profile from Profile → Edit profile. Change privacy and interaction controls from Settings. If you cannot sign in, use password recovery.</p><div className="flex flex-wrap gap-4"><Link href="/edit-profile" className="font-semibold text-primary hover:underline">Edit profile</Link><Link href="/forgot-password" className="font-semibold text-primary hover:underline">Reset password</Link><Link href="/security" className="font-semibold text-primary hover:underline">Account security</Link></div></> },
    { title: "Privacy and notifications", content: <><p>Settings lets you make your account private, choose who can contact you, and configure push, email, and quiet-hour notifications.</p><Link href="/settings" className="font-semibold text-primary hover:underline">Open Settings</Link></> },
    { title: "Reporting and blocking", content: <p>Use the report menu on content or profiles when something breaks Kinet’s rules. Block an account when you need to stop direct interaction. Reports are confidential.</p> },
    { title: "Still need help?", content: <p>Visit the <Link href="/contact" className="font-semibold text-primary hover:underline">Contact page</Link> to reach the Kinet team. Never send your password or recovery code.</p> },
  ]} />;
}
