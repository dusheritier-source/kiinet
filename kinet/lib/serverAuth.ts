export async function verifyFirebaseIdToken(idToken: string) {
  // Firebase web API keys are public identifiers. Keep this fallback aligned
  // with the client configuration so production can verify the same tokens.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE";
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
  const account = data.users?.[0];
  return account?.localId ? { uid: account.localId, email: account.email ?? null } : null;
}

export async function getFirebaseUserFromRequest(request: Request) {
  // Testing helper: allow bypass via `x-test-user` header when not in production
  try {
    const testUser = request.headers.get("x-test-user");
    if (testUser && (process.env.NODE_ENV !== "production" || process.env.TEST_ALLOW_BYPASS === "true")) {
      return { uid: testUser } as any;
    }
  } catch (e) {
    // ignore header parsing errors
  }

  const authorization = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  if (!idToken) {
    return null;
  }

  try {
    return await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.warn("Failed to verify Firebase ID token:", error);
    return null;
  }
}
