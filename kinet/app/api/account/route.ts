import { getAuth } from "firebase-admin/auth";

import { limitForUser, requireApiUser } from "@/lib/api-security";
import { getAdminFirestore, getFirebaseAdminApp } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const OWNED_COLLECTIONS: Array<[string, string]> = [
  ["posts", "userId"], ["stories", "userId"], ["drafts", "userId"],
  ["comments", "userId"], ["collections", "userId"], ["bookings", "requesterId"],
  ["loginHistory", "userId"], ["managedDevices", "userId"], ["consents", "userId"],
  ["guardianLinks", "athleteUid"], ["verificationRequests", "userId"],
  ["verificationAppeals", "userId"], ["reports", "reporterId"],
  ["supportTickets", "userId"], ["premiumGroups", "ownerId"],
  ["brandCampaigns", "ownerId"], ["contracts", "ownerId"], ["invoices", "ownerId"],
  ["discountCodes", "ownerId"], ["membershipTiers", "ownerId"], ["teamBundles", "ownerId"],
];

async function deleteOwnedDocuments(uid: string) {
  const database = getAdminFirestore();
  for (const [collectionName, ownerField] of OWNED_COLLECTIONS) {
    while (true) {
      const snapshot = await database.collection(collectionName).where(ownerField, "==", uid).limit(250).get();
      if (snapshot.empty) break;
      const batch = database.batch();
      snapshot.docs.forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }
  }
  await database.recursiveDelete(database.collection("users").doc(uid));
}

export async function DELETE(request: Request) {
  const authentication = await requireApiUser(request);
  if (authentication.response) return authentication.response;

  const rateLimited = limitForUser(request, authentication.user.uid, "delete-account", 3, 60 * 60_000);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json() as { confirmation?: string };
    if (body.confirmation !== "DELETE KINET ACCOUNT") {
      return Response.json({ error: "Confirmation phrase is incorrect." }, { status: 400 });
    }
    await deleteOwnedDocuments(authentication.user.uid);
    await getAuth(getFirebaseAdminApp()).deleteUser(authentication.user.uid);
    return Response.json({ status: "deleted" });
  } catch {
    return Response.json({ error: "Account deletion could not be completed. Please try again." }, { status: 500 });
  }
}
