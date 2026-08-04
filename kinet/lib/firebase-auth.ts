"use client";

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from "firebase/auth";
import { auth } from "./firebase";

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function friendlyAuthError(error: unknown) {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code || "";
  if (code === "auth/unauthorized-domain") {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "this domain";
    return `Google sign-in is not authorized for ${hostname}. Add ${hostname} in Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === "auth/operation-not-allowed") return "This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "The email or password is incorrect.";
  if (code === "auth/email-already-in-use") return "An account already exists with this email. Try signing in instead.";
  if (code === "auth/weak-password") return "Use a stronger password with at least 6 characters.";
  if (code === "auth/popup-closed-by-user") return "The Google sign-in window was closed before sign-in finished.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow popups for this site and try again.";
  if (code === "auth/network-request-failed") return "Firebase could not be reached. Check your connection and try again.";
  return firebaseError.message || "Authentication failed. Please try again.";
}

export const signInWithEmail = async (email: string, password: string) => {
  if (!auth) {
    return { user: null, error: "Firebase is not configured" };
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
};

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  if (!auth) {
    return { user: null, error: "Firebase is not configured" };
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name if provided
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
};

export const signInWithGoogle = async () => {
  if (!auth) {
    return { user: null, error: "Firebase is not configured" };
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
};

export const signOut = async () => {
  if (!auth) {
    return { error: "Firebase is not configured" };
  }
  
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: unknown) {
    return { error: friendlyAuthError(error) };
  }
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth?.currentUser || null;
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};
