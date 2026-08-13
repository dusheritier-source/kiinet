const required = [
  "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "KINET_SESSION_SECRET", "CRON_SECRET",
];

const problems = [];
for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your-")) problems.push(`${name} is missing`);
}
for (const name of ["KINET_SESSION_SECRET", "CRON_SECRET"]) {
  if ((process.env[name]?.trim().length || 0) < 32) problems.push(`${name} must contain at least 32 characters`);
}
if (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.startsWith("https://")) problems.push("NEXT_PUBLIC_SITE_URL must use HTTPS");
const adminConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) || Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
if (!adminConfigured) problems.push("Firebase Admin credentials are missing");
if (process.env.DISABLE_MODERATION === "true") problems.push("DISABLE_MODERATION must not be true in production");
if (process.env.TEST_ALLOW_BYPASS === "true") problems.push("TEST_ALLOW_BYPASS must not be true in production");

if (problems.length) {
  console.error(`Release configuration failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("Release configuration passed.");
