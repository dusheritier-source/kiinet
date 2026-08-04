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

