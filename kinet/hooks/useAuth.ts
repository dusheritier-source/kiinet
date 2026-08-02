"use client";

import { useSyncExternalStore } from "react";

interface AuthUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

interface AuthStoreState {
  user: AuthUser | null;
  loading: boolean;
}

const localUser: AuthUser = {
  uid: "local-user",
  displayName: "Local User",
  email: "local@kinet.app",
  photoURL: null,
};

let authStore: AuthStoreState = {
  user: localUser,
  loading: false,
};

const subscribers = new Set<() => void>();

function emitAuthChange() {
  subscribers.forEach((listener) => listener());
}

export function useAuth() {
  return useSyncExternalStore(
    (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    () => authStore,
    () => authStore
  );
}

