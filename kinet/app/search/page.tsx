"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Search as SearchIcon, Sparkles, Users, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";
import DefaultAvatar from "@/components/DefaultAvatar";
import { Input } from "@/components/ui/input";
import { getSuggestedProfiles, searchProfiles, type SearchProfile } from "@/lib/user-profile";

type SuggestedProfile = { profile: SearchProfile; mutualCount: number; score: number };

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      setLoading(true);
      try {
        const results = await searchProfiles(query);
        if (!cancelled) {
          setProfiles(results);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    void getSuggestedProfiles().then(setSuggestions);
  }, []);

  const visibleProfiles = useMemo(() => profiles.slice(0, 30), [profiles]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl py-4">
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-12 rounded-full border border-slate-800 bg-slate-950 pl-11 pr-10 text-slate-100 placeholder:text-slate-400 shadow-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-2.5 rounded-full p-1 text-slate-400 hover:bg-slate-800"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
          <div className="border-b border-slate-800 px-5 py-4">
            <h1 className="text-lg font-semibold text-white">People</h1>
            <p className="text-sm text-slate-400">
              {query.trim() ? "Accounts matching your search" : "Find people, creators, and communities"}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-cyan-400" />
            </div>
          ) : !query.trim() ? (
            <div>
              <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3 text-sm font-medium text-slate-300">
                <Sparkles className="h-4 w-4 text-cyan-400" /> Suggested for you
              </div>
              {suggestions.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="font-medium text-white">Start exploring people</p>
                  <p className="mt-2 text-sm text-slate-400">Use a name or @username to find an account.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {suggestions.map(({ profile, mutualCount }) => (
                    <ProfileRow key={profile.uid} profile={profile} mutualCount={mutualCount} />
                  ))}
                </div>
              )}
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium text-white">
                {query.trim() ? "No users found" : "Start typing to search people"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {query.trim()
                  ? "Try their name, @username, bio, interest, or location."
                  : "Search now focuses only on people, like a social app."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {visibleProfiles.map((profile) => <ProfileRow key={profile.uid} profile={profile} />)}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function ProfileRow({ profile, mutualCount = 0 }: { profile: SearchProfile; mutualCount?: number }) {
  const detail = [profile.role?.bio, profile.location, ...(profile.interests ?? [])].filter(Boolean).join(" • ");

  return (
    <Link href={`/profile/${profile.uid}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-900/90">
      {profile.photoURL ? (
        <img src={profile.photoURL} alt={profile.displayName} className="h-14 w-14 rounded-full object-cover" />
      ) : (
        <DefaultAvatar username={profile.displayName || profile.username || "User"} className="h-14 w-14 shrink-0 rounded-full" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-semibold text-white">
          {profile.username ? `@${profile.username}` : profile.displayName}
          {profile.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-cyan-400" aria-label="Verified" /> : null}
        </p>
        <p className="truncate text-sm text-slate-400">{profile.displayName}</p>
        {mutualCount > 0 ? <p className="mt-1 flex items-center gap-1 text-xs text-cyan-300"><Users className="h-3.5 w-3.5" /> {mutualCount} mutual connection{mutualCount === 1 ? "" : "s"}</p> : detail ? <p className="truncate text-sm text-slate-400">{detail}</p> : null}
      </div>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <SearchPageContent />
    </Suspense>
  );
}
