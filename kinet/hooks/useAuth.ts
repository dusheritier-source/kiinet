"use client";

import { useEffect, useState } from "react";
import { onAuthChange } from "@/lib/firebase-auth";

interface AuthUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        void firebaseUser.getIdToken().then((token) => fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })).catch(() => undefined);
        setState({
          user: {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          },
          loading: false,
        });
      } else {
        void fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
        setState({
          user: null,
          loading: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
}

