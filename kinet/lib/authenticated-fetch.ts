import { auth } from "@/lib/firebase";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in.");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
