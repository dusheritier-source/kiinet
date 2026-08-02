export async function verifyFirebaseIdToken(_idToken: string) {
  return null;
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
