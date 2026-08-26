import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-kinet",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "users", "alice"), { uid: "alice", displayName: "Alice", createdAt: new Date() });
    await setDoc(doc(database, "users", "bob"), { uid: "bob", displayName: "Bob", createdAt: new Date() });
    await setDoc(doc(database, "users", "private-user"), { uid: "private-user", settings: { privateAccount: true } });
    await setDoc(doc(database, "posts", "public-post"), { userId: "bob", contentType: "post", visibility: "public", discoverable: true, createdAt: new Date() });
    await setDoc(doc(database, "posts", "private-post"), { userId: "private-user", contentType: "post", visibility: "public", discoverable: false, createdAt: new Date() });
    await setDoc(doc(database, "reports", "report-1"), { reporterId: "alice", status: "open" });
  });
});

after(async () => { await environment.cleanup(); });

test("anonymous users cannot read profiles", async () => {
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "users", "alice")));
});

test("users can update themselves but not another profile", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  await assertSucceeds(updateDoc(doc(alice, "users", "alice"), { displayName: "Alice Updated" }));
  await assertFails(updateDoc(doc(alice, "users", "bob"), { displayName: "Compromised" }));
});

test("ordinary users cannot mutate admin settings", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(alice, "appSettings", "access"), { maintenanceMode: true }));
  await assertFails(setDoc(doc(alice, "staffPermissionMatrix", "alice"), { admin: true }));
});

test("admin claims authorize protected operations", async () => {
  const admin = environment.authenticatedContext("staff", { admin: true }).firestore();
  await assertSucceeds(setDoc(doc(admin, "appSettings", "access"), { maintenanceMode: false }));
  await assertSucceeds(updateDoc(doc(admin, "reports", "report-1"), { status: "resolved" }));
});

test("reports remain private to their reporter and staff", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  await assertSucceeds(getDoc(doc(alice, "reports", "report-1")));
  await assertFails(getDoc(doc(bob, "reports", "report-1")));
});

test("the discovery feed can query only explicitly discoverable posts", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const snapshot = await assertSucceeds(getDocs(query(collection(alice, "posts"), where("discoverable", "==", true))));
  assert.deepEqual(snapshot.docs.map((entry) => entry.id), ["public-post"]);
});

test("private accounts cannot publish a post as discoverable", async () => {
  const privateUser = environment.authenticatedContext("private-user").firestore();
  await assertFails(setDoc(doc(privateUser, "posts", "spoofed-public-post"), {
    userId: "private-user",
    visibility: "public",
    discoverable: true,
  }));
});

test("post owners cannot change discovery eligibility after publishing", async () => {
  const privateUser = environment.authenticatedContext("private-user").firestore();
  await assertFails(updateDoc(doc(privateUser, "posts", "private-post"), { discoverable: true }));
});
