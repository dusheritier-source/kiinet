function clean(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "").trim() || "";
}

function requireValues(values: Record<string, string>) {
  const missing = Object.entries(values).filter(([, value]) => !value || value.startsWith("your-")).map(([key]) => key);
  if (missing.length) throw new Error(`Kinet configuration is incomplete. Missing: ${missing.join(", ")}.`);
  return values;
}

export function getFirebaseClientConfig() {
  const values = requireValues({
    NEXT_PUBLIC_FIREBASE_API_KEY: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    NEXT_PUBLIC_FIREBASE_APP_ID: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  });
  return {
    apiKey: values.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: clean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) || undefined,
    projectId: values.NEXT_PUBLIC_FIREBASE_PROJECT_ID.split(/\s+/)[0],
    storageBucket: values.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: values.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: values.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: clean(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || undefined,
  };
}

export function getFirebaseApiKey() {
  return getFirebaseClientConfig().apiKey;
}
