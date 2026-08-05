export async function verifyFirebaseIdToken(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
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
