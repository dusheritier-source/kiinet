"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";

export function useAdminClaim() {
  const { user, loading } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user || !auth?.currentUser) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    void auth.currentUser.getIdTokenResult().then((token) => {
      if (active) setIsAdmin(token.claims.admin === true || token.claims.moderator === true);
    }).catch(() => { if (active) setIsAdmin(false); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [user, loading]);

  return { isAdmin, checking };
}
