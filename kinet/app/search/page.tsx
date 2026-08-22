"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, BellOff, Bookmark, Check, Clock, Film, MessageCircle, Search, Share2, Trash2, TrendingUp, Users, X } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DefaultAvatar from "@/components/DefaultAvatar";
import KinetVerifiedBadge from "@/components/KinetVerifiedBadge";
import OptimizedMedia from "@/components/OptimizedMedia";
import { Button } from "@/components/ui/button";
import { searchPeopleDirectory, universalSearch, type SearchCategory, type UniversalSearchResults } from "@/lib/search";
import { auth } from "@/lib/firebase";
import { toggleFollowUser, type SearchProfile } from "@/lib/user-profile";
import { clearSearchHistory, recordSearch, removeSavedSearch, saveSearch, subscribeSearchPreferences, toggleSearchAlert, type SavedSearch, type SearchPreferences } from "@/lib/search-preferences";

const emptyResults: UniversalSearchResults = { people: [], posts: [], videos: [], groups: [], messages: [] };
const tabs: Array<{ id: SearchCategory; label: string }> = [
  { id: "all", label: "All" }, { id: "people", label: "People" }, { id: "posts", label: "Posts" },
  { id: "videos", label: "Videos" }, { id: "groups", label: "Groups" }, { id: "messages", label: "Messages" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<SearchCategory>((searchParams.get("type") as SearchCategory) || "people");
  const [results, setResults] = useState(emptyResults);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showFilters, setShowFilters] = useState(["sort", "date", "verified", "following", "location", "exact", "creator", "saved", "liked", "messages"].some((key) => searchParams.has(key)));
  const [sortBy, setSortBy] = useState<"relevance" | "recent" | "popular">((searchParams.get("sort") as "relevance" | "recent" | "popular") || "relevance");
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get("verified") === "1");
  const [followingOnly, setFollowingOnly] = useState(searchParams.get("following") === "1");
  const [locationFilter, setLocationFilter] = useState(searchParams.get("location") ?? "");
  const [dateRange, setDateRange] = useState<"any" | "week" | "month">((searchParams.get("date") as "any" | "week" | "month") || "any");
  const [exactPhrase, setExactPhrase] = useState(searchParams.get("exact") === "1");
  const [creatorFilter, setCreatorFilter] = useState(searchParams.get("creator") ?? "");
  const [savedOnly, setSavedOnly] = useState(searchParams.get("saved") === "1");
  const [likedOnly, setLikedOnly] = useState(searchParams.get("liked") === "1");
  const [messageScope, setMessageScope] = useState<"all" | "files" | "pinned" | "saved" | "archived" | "requests">((searchParams.get("messages") as "all" | "files" | "pinned" | "saved" | "archived" | "requests") || "all");
  const [preferences, setPreferences] = useState<SearchPreferences>({ history: [], savedSearches: [] });
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    setRecentSearches(JSON.parse(localStorage.getItem("kinet:recent-searches") || "[]") as string[]);
  }, []);

  useEffect(() => subscribeSearchPreferences((next) => {
    setPreferences(next);
    if (next.history.length) {
      setRecentSearches(next.history.slice(0, 8));
      localStorage.setItem("kinet:recent-searches", JSON.stringify(next.history.slice(0, 8)));
    }
  }), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (term.trim()) params.set("q", term.trim());
      if (category !== "people") params.set("type", category);
      if (sortBy !== "relevance") params.set("sort", sortBy);
      if (dateRange !== "any") params.set("date", dateRange);
      if (verifiedOnly) params.set("verified", "1");
      if (followingOnly) params.set("following", "1");
      if (locationFilter.trim()) params.set("location", locationFilter.trim());
      if (exactPhrase) params.set("exact", "1");
      if (creatorFilter.trim()) params.set("creator", creatorFilter.trim());
      if (savedOnly) params.set("saved", "1");
      if (likedOnly) params.set("liked", "1");
      if (messageScope !== "all") params.set("messages", messageScope);
      // Keep shareable search parameters without triggering a Next.js route
      // navigation and server-component reload on every keystroke.
      const nextUrl = `/search${params.size ? `?${params}` : ""}`;
      window.history.replaceState(window.history.state, "", nextUrl);
      setLoading(true); setError(""); setVisibleCount(12);
      const sequence = ++requestSequence.current;
      // People are a single lightweight query. Show them as soon as they arrive
      // instead of holding them behind posts, comments, groups, and messages.
      void searchPeopleDirectory(term).then((people) => {
        if (sequence === requestSequence.current) {
          setResults((current) => ({ ...current, people }));
          if (category === "people") setLoading(false);
        }
      }).catch((cause) => { if (sequence === requestSequence.current) { setError(cause instanceof Error ? cause.message : "Search failed."); setLoading(false); } });
      if (category !== "people") {
        void universalSearch(term).then((next) => { if (sequence === requestSequence.current) setResults(next); }).catch((cause) => { if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Search failed."); }).finally(() => { if (sequence === requestSequence.current) setLoading(false); });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [category, creatorFilter, dateRange, exactPhrase, followingOnly, likedOnly, locationFilter, messageScope, savedOnly, sortBy, term, verifiedOnly]);

  const filteredResults = useMemo<UniversalSearchResults>(() => {
    const cutoff = dateRange === "week" ? Date.now() / 1000 - 7 * 86400 : dateRange === "month" ? Date.now() / 1000 - 30 * 86400 : 0;
    const phrase = term.trim().replace(/^[@#]/, "").toLowerCase();
    const phraseMatches = (value: string) => !exactPhrase || value.toLowerCase().includes(phrase);
    const scorePost = (post: UniversalSearchResults["posts"][number]) => post.likes.length + post.commentsCount * 2 + post.shares * 3 + (post.views ?? 0) / 10;
    const sortPosts = (items: UniversalSearchResults["posts"]) => [...items].sort((a, b) => sortBy === "recent" ? (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0) : sortBy === "popular" ? scorePost(b) - scorePost(a) : 0);
    const filterContent = (items: UniversalSearchResults["posts"]) => sortPosts(items
      .filter((post) => !cutoff || (post.createdAt?.seconds ?? 0) >= cutoff)
      .filter((post) => phraseMatches(`${post.caption} ${post.hashtags.join(" ")}`))
      .filter((post) => !creatorFilter.trim() || `${post.author.name} ${post.author.username}`.toLowerCase().includes(creatorFilter.trim().replace(/^@/, "").toLowerCase()))
      .filter((post) => !savedOnly || post.saves.includes(auth.currentUser?.uid ?? ""))
      .filter((post) => !likedOnly || post.likes.includes(auth.currentUser?.uid ?? "")));
    const people = results.people
      .filter((profile) => !verifiedOnly || profile.verified)
      .filter((profile) => !followingOnly || (profile.followers ?? []).includes(auth.currentUser?.uid ?? ""))
      .filter((profile) => !locationFilter.trim() || String(profile.location ?? "").toLowerCase().includes(locationFilter.trim().toLowerCase()))
      .filter((profile) => phraseMatches(`${profile.displayName} ${profile.username ?? ""}`))
      .sort((a, b) => sortBy === "popular" ? (b.followers ?? []).length - (a.followers ?? []).length : 0);
    return {
      people,
      posts: filterContent(results.posts),
      videos: filterContent(results.videos),
      groups: [...results.groups].sort((a, b) => sortBy === "popular" ? b.members - a.members : 0),
      messages: results.messages
        .filter((message) => !cutoff || (message.updatedAt?.seconds ?? 0) >= cutoff)
        .filter((message) => messageScope === "all" || (messageScope === "files" && Boolean(message.attachmentType)) || (messageScope === "pinned" && message.pinned) || (messageScope === "saved" && message.saved) || (messageScope === "archived" && message.archived) || (messageScope === "requests" && message.request))
        .sort((a, b) => sortBy === "recent" ? (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0) : 0),
    };
  }, [creatorFilter, dateRange, exactPhrase, followingOnly, likedOnly, locationFilter, messageScope, results, savedOnly, sortBy, term, verifiedOnly]);
  const total = filteredResults.people.length + filteredResults.posts.length + filteredResults.videos.length + filteredResults.groups.length + filteredResults.messages.length;
  const currentCount = category === "all" ? total : filteredResults[category].length;
  const noResults = !loading && term.trim() && currentCount === 0;
  const sections: Array<Exclude<SearchCategory, "all">> = category === "all"
    ? ["people", "posts", "videos", "groups", "messages"]
    : [category];
  const autocomplete = Array.from(new Set([
    ...filteredResults.people.flatMap((profile) => [profile.displayName, profile.username ? `@${profile.username}` : ""]),
    ...filteredResults.posts.flatMap((post) => post.hashtags.map((hashtag) => `#${hashtag.replace(/^#/, "")}`)),
    ...filteredResults.groups.map((group) => group.name),
  ].filter(Boolean))).filter((item) => item.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 7);
  const suggestedSearches = ["photography", "music", "technology", "art", "travel"];
  const relatedTopics = Array.from(new Set([...filteredResults.posts, ...filteredResults.videos].flatMap((post) => post.hashtags))).slice(0, 8);
  const trendingTopics = useMemo(() => {
    const counts = new Map<string, { count: number; recent: number }>();
    const recentCutoff = Date.now() / 1000 - 7 * 86400;
    [...results.posts, ...results.videos].forEach((post) => post.hashtags.forEach((rawTag) => {
      const tag = rawTag.replace(/^#/, "").toLowerCase();
      if (!tag) return;
      const current = counts.get(tag) ?? { count: 0, recent: 0 };
      current.count += 1 + post.likes.length + post.commentsCount * 2 + post.shares * 3;
      if ((post.createdAt?.seconds ?? 0) >= recentCutoff) current.recent += 1;
      counts.set(tag, current);
    }));
    return Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  }, [results.posts, results.videos]);
  const popularPosts = useMemo(() => [...results.posts].sort((a, b) => (b.likes.length + b.commentsCount * 2 + b.shares * 3) - (a.likes.length + a.commentsCount * 2 + a.shares * 3)).slice(0, 6), [results.posts]);
  const popularVideos = useMemo(() => [...results.videos].sort((a, b) => ((b.views ?? 0) + b.likes.length * 5) - ((a.views ?? 0) + a.likes.length * 5)).slice(0, 6), [results.videos]);
  const popularCreators = useMemo(() => [...results.people].sort((a, b) => (b.followers ?? []).length - (a.followers ?? []).length).slice(0, 6), [results.people]);
  const exploreCategories = ["Art", "Music", "Photography", "Technology", "Fashion", "Food", "Travel", "Gaming"];

  const chooseSearch = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    setTerm(cleaned);
    setSearchFocused(false);
    const next = [cleaned, ...recentSearches.filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
    setRecentSearches(next);
    localStorage.setItem("kinet:recent-searches", JSON.stringify(next));
    void recordSearch(cleaned, preferences);
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setTerm(saved.query); setCategory(saved.category); setSortBy(saved.sortBy); setDateRange(saved.dateRange);
    setVerifiedOnly(saved.verifiedOnly); setFollowingOnly(saved.followingOnly); setLocationFilter(saved.location);
    setExactPhrase(saved.exactPhrase); setCreatorFilter(saved.creator); setSavedOnly(saved.savedOnly); setLikedOnly(saved.likedOnly);
    setMessageScope(saved.messageScope ?? "all");
    setShowFilters(true); void recordSearch(saved.query, preferences);
  };

  const saveCurrentSearch = async () => {
    if (!term.trim()) return;
    setPreferenceBusy(true);
    try {
      await saveSearch({ name: term.trim(), query: term.trim(), category, sortBy, dateRange, verifiedOnly, followingOnly, location: locationFilter.trim(), exactPhrase, creator: creatorFilter.trim(), savedOnly, likedOnly, messageScope, alertsEnabled: false }, preferences);
    } finally { setPreferenceBusy(false); }
  };

  const shareCurrentSearch = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch { setError("Could not copy the search link."); }
  };

  return <ProtectedRoute><main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-6">
    <header className="mb-6"><h1 className="text-3xl font-bold">Search</h1><p className="text-sm text-muted-foreground">Find people, posts, videos, groups and conversations.</p></header>
    <div className="sticky top-16 z-30 mb-6 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur">
      <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" /><input value={term} onChange={(event) => { setTerm(event.target.value); setActiveSuggestion(-1); }} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveSuggestion((index) => Math.min(index + 1, autocomplete.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveSuggestion((index) => Math.max(index - 1, 0)); } else if (event.key === "Enter") { chooseSearch(activeSuggestion >= 0 ? autocomplete[activeSuggestion] : term); } else if (event.key === "Escape") { setSearchFocused(false); } }} autoFocus placeholder="Search Kinet" className="h-12 w-full rounded-full bg-muted pl-12 pr-12 text-base outline-none ring-primary focus:ring-2" />{term ? <button onClick={() => setTerm("")} className="absolute right-4 top-3.5" aria-label="Clear search"><X className="h-5 w-5" /></button> : null}
        {searchFocused ? <div className="absolute inset-x-0 top-14 z-50 overflow-hidden rounded-2xl border bg-background shadow-2xl">{term.trim() && autocomplete.length ? <div className="p-2">{autocomplete.map((suggestion, index) => <button key={suggestion} type="button" onMouseDown={() => chooseSearch(suggestion)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${activeSuggestion === index ? "bg-muted" : "hover:bg-muted/60"}`}><Search className="h-4 w-4 text-muted-foreground" /><Highlight text={suggestion} query={term} /></button>)}</div> : !term.trim() ? <div className="p-3"><div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4" />Recent searches</p>{recentSearches.length ? <button type="button" onMouseDown={() => { setRecentSearches([]); localStorage.removeItem("kinet:recent-searches"); void clearSearchHistory(preferences); }} className="text-xs text-primary">Clear all</button> : null}</div>{recentSearches.map((item) => <div key={item} className="flex items-center"><button type="button" onMouseDown={() => chooseSearch(item)} className="flex-1 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">{item}</button><button type="button" aria-label={`Remove ${item}`} onMouseDown={() => { const next = recentSearches.filter((recent) => recent !== item); setRecentSearches(next); localStorage.setItem("kinet:recent-searches", JSON.stringify(next)); }}><X className="h-4 w-4 text-muted-foreground" /></button></div>)}<p className="mb-2 mt-3 flex items-center gap-2 text-sm font-medium"><TrendingUp className="h-4 w-4" />Try searching</p><div className="flex flex-wrap gap-2">{suggestedSearches.map((item) => <button key={item} type="button" onMouseDown={() => chooseSearch(item)} className="rounded-full bg-muted px-3 py-1.5 text-xs">{item}</button>)}</div></div> : <p className="p-4 text-sm text-muted-foreground">Keep typing to refine your search.</p>}</div> : null}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} onClick={() => setCategory(tab.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${category === tab.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>{tab.label}</button>)}<button type="button" onClick={() => setShowFilters((current) => !current)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${showFilters ? "bg-primary/15 text-primary" : "border"}`}>Filters</button>{term.trim() ? <button type="button" disabled={preferenceBusy} onClick={() => void saveCurrentSearch()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><Bookmark className="h-4 w-4" />Save search</button> : null}{term.trim() ? <button type="button" onClick={() => void shareCurrentSearch()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">{linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}{linkCopied ? "Copied" : "Share"}</button> : null}</div>
      {showFilters ? <div className="mt-3 grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-medium">Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="relevance">Relevance</option><option value="recent">Most recent</option><option value="popular">Most popular</option></select></label><label className="text-xs font-medium">Date<select value={dateRange} onChange={(event) => setDateRange(event.target.value as typeof dateRange)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="any">Any time</option><option value="week">Past week</option><option value="month">Past month</option></select></label><label className="text-xs font-medium">Location<input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="Any location" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" /></label><label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />Verified only</label><div className="space-y-2 pt-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={followingOnly} onChange={(event) => setFollowingOnly(event.target.checked)} />People I follow</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exactPhrase} onChange={(event) => setExactPhrase(event.target.checked)} />Exact phrase</label><button type="button" onClick={() => { setSortBy("relevance"); setDateRange("any"); setLocationFilter(""); setVerifiedOnly(false); setFollowingOnly(false); setExactPhrase(false); }} className="text-xs text-primary">Reset filters</button></div></div> : null}
      {showFilters ? <div className="mt-2 flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3"><label className="min-w-52 flex-1 text-xs font-medium">Content creator<input value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)} placeholder="Name or @username" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" /></label><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} />Saved by me</label><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={likedOnly} onChange={(event) => setLikedOnly(event.target.checked)} />Liked by me</label><button type="button" onClick={() => { setCreatorFilter(""); setSavedOnly(false); setLikedOnly(false); }} className="h-9 text-xs text-primary">Clear content filters</button></div> : null}
      {showFilters ? <div className="mt-2 flex items-end gap-3 rounded-xl border bg-muted/20 p-3"><label className="w-full max-w-xs text-xs font-medium">Message results<select value={messageScope} onChange={(event) => setMessageScope(event.target.value as typeof messageScope)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="all">All messages</option><option value="files">Photos, videos and files</option><option value="pinned">Pinned messages</option><option value="saved">Saved messages</option><option value="archived">Archived chats</option><option value="requests">Message requests</option></select></label></div> : null}
    </div>
    {!loading && term.trim() && results.intelligence?.interpretedAs ? <div className="mb-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Interpreted as: </span><span className="font-medium">{results.intelligence.interpretedAs}</span></div> : null}
    {!loading && term.trim() && results.intelligence?.correction ? <div className="mb-4 text-sm">Did you mean <button type="button" onClick={() => chooseSearch(results.intelligence!.correction!)} className="font-semibold text-primary underline">{results.intelligence.correction}</button>?</div> : null}
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div> : null}
    {!loading && !term.trim() ? <><SavedSearches preferences={preferences} onApply={applySavedSearch} onRemove={(id) => void removeSavedSearch(id, preferences)} onToggleAlert={(id) => void toggleSearchAlert(id, preferences)} /><ExploreView topics={trendingTopics} posts={popularPosts} videos={popularVideos} creators={popularCreators} categories={exploreCategories} onSearch={chooseSearch} /></> : null}
    {noResults ? <div className="rounded-3xl border border-dashed p-12 text-center"><h2 className="font-semibold">No results for “{term}”</h2><p className="mt-1 text-sm text-muted-foreground">Check the spelling or try a broader search.</p></div> : null}
    {!loading && term.trim() && relatedTopics.length ? <div className="mb-6 flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Related topics:</span>{relatedTopics.map((topic) => <button key={topic} type="button" onClick={() => chooseSearch(`#${topic.replace(/^#/, "")}`)} className="rounded-full bg-muted px-3 py-1.5 text-xs hover:bg-primary/10">#{topic.replace(/^#/, "")}</button>)}</div> : null}
    {!loading && term.trim() ? <div className="space-y-8">{sections.map((section) => <ResultSection key={section} section={section} results={filteredResults} limit={category === "all" ? 6 : visibleCount} />)}{category !== "all" && visibleCount < currentCount ? <div className="text-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + 12)}>Load more</Button></div> : null}</div> : null}
  </main></ProtectedRoute>;
}

function SavedSearches({ preferences, onApply, onRemove, onToggleAlert }: {
  preferences: SearchPreferences;
  onApply: (saved: SavedSearch) => void;
  onRemove: (id: string) => void;
  onToggleAlert: (id: string) => void;
}) {
  if (!preferences.savedSearches.length) return null;
  return <section className="mb-9">
    <div className="mb-3 flex items-center gap-2"><Bookmark className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Saved searches</h2></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{preferences.savedSearches.map((saved) => <article key={saved.id} className="rounded-2xl border p-4">
      <button type="button" onClick={() => onApply(saved)} className="w-full text-left"><p className="truncate font-semibold">{saved.name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{saved.category} · {saved.sortBy}{saved.dateRange !== "any" ? ` · ${saved.dateRange}` : ""}</p></button>
      <div className="mt-3 flex gap-2"><Button size="sm" className="flex-1" variant="outline" onClick={() => onApply(saved)}>Run search</Button><Button size="icon" variant="ghost" onClick={() => onToggleAlert(saved.id)} aria-label={saved.alertsEnabled ? "Disable search alerts" : "Enable search alerts"}>{saved.alertsEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}</Button><Button size="icon" variant="ghost" onClick={() => onRemove(saved.id)} aria-label="Delete saved search"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
    </article>)}</div>
  </section>;
}

function ExploreView({ topics, posts, videos, creators, categories, onSearch }: {
  topics: Array<[string, { count: number; recent: number }]>;
  posts: UniversalSearchResults["posts"];
  videos: UniversalSearchResults["videos"];
  creators: UniversalSearchResults["people"];
  categories: string[];
  onSearch: (value: string) => void;
}) {
  return <div className="space-y-9">
    <section><div className="mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Trending now</h2></div>{topics.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{topics.map(([topic, data], index) => <button key={topic} onClick={() => onSearch(`#${topic}`)} className="rounded-2xl border p-4 text-left hover:border-primary/40 hover:bg-muted/40"><p className="text-xs text-muted-foreground">{index + 1} · Trending</p><p className="mt-1 font-semibold">#{topic}</p><p className="mt-1 text-xs text-muted-foreground">{data.count} activity points{data.recent ? ` · ${data.recent} recent` : ""}</p></button>)}</div> : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Trends will appear as public posts gain activity.</p>}</section>
    <section><h2 className="mb-3 text-xl font-semibold">Explore categories</h2><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => onSearch(category)} className="rounded-full bg-muted px-4 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground">{category}</button>)}</div></section>
    {posts.length ? <section><h2 className="mb-3 text-xl font-semibold">Popular posts</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <Link key={post.id} href={`/post/${post.id}`} className="overflow-hidden rounded-2xl border hover:shadow-md">{post.mediaUrl ? post.mediaType === "video" ? <video src={post.mediaUrl} preload="metadata" muted className="aspect-video w-full object-cover" /> : <OptimizedMedia src={post.mediaUrl} alt="" width={640} height={360} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="aspect-video w-full object-cover" /> : null}<div className="p-4"><p className="line-clamp-2 text-sm">{post.caption || "Untitled post"}</p><p className="mt-2 text-xs text-muted-foreground">{post.likes.length} likes · {post.commentsCount} comments</p></div></Link>)}</div></section> : null}
    {videos.length ? <section><h2 className="mb-3 text-xl font-semibold">Trending videos</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{videos.map((post) => <Link key={post.id} href={`/post/${post.id}`} className="relative overflow-hidden rounded-2xl border"><video src={post.mediaUrl} preload="metadata" muted className="aspect-video w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 pt-10 text-sm text-white"><Film className="mb-1 h-5 w-5" /><p className="line-clamp-1">{post.caption || "Video"}</p></div></Link>)}</div></section> : null}
    {creators.length ? <section><h2 className="mb-3 text-xl font-semibold">Creators to discover</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{creators.map((profile) => <PeopleCard key={profile.uid} profile={profile} />)}</div></section> : null}
  </div>;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return <>{text}</>;
  const index = text.toLowerCase().indexOf(normalized);
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark className="rounded bg-primary/20 px-0.5 text-inherit">{text.slice(index, index + normalized.length)}</mark>{text.slice(index + normalized.length)}</>;
}

function ResultSection({ section, results, limit }: { section: Exclude<SearchCategory, "all">; results: UniversalSearchResults; limit: number }) {
  const items = results[section].slice(0, limit);
  if (!items.length) return null;
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold capitalize">{section}</h2><span className="text-sm text-muted-foreground">{results[section].length} result{results[section].length === 1 ? "" : "s"}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {section === "people" ? results.people.slice(0, limit).map((profile) => <PeopleCard key={profile.uid} profile={profile} />) : null}
    {section === "posts" || section === "videos" ? (section === "posts" ? results.posts : results.videos).slice(0, limit).map((post) => <Link key={post.id} href={`/post/${post.id}`} className="overflow-hidden rounded-2xl border hover:bg-muted/50">{post.mediaUrl ? post.mediaType === "video" ? <div className="relative"><video src={post.mediaUrl} className="aspect-video w-full object-cover" /><Film className="absolute right-2 top-2 h-5 w-5 text-white" /></div> : <OptimizedMedia src={post.mediaUrl} alt="" width={640} height={360} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="aspect-video w-full object-cover" /> : null}<div className="p-4"><p className="line-clamp-2 text-sm">{post.caption || "Untitled post"}</p><p className="mt-2 text-xs text-muted-foreground">@{post.author.username}</p></div></Link>) : null}
    {section === "groups" ? results.groups.slice(0, limit).map((group) => <Link key={group.id} href={`/messages?conversation=${group.id}`} className="rounded-2xl border p-4 hover:bg-muted/50"><Users className="mb-3 h-8 w-8 text-primary" /><p className="font-semibold">{group.name}</p><p className="text-sm text-muted-foreground">{group.members} members</p><p className="mt-2 truncate text-xs text-muted-foreground">{group.lastMessage}</p></Link>) : null}
    {section === "messages" ? results.messages.slice(0, limit).map((message) => <Link key={message.id} href={`/messages?conversation=${message.conversationId}&message=${message.id}`} className="rounded-2xl border p-4 hover:bg-muted/50"><MessageCircle className="mb-2 h-7 w-7 text-primary" /><p className="font-semibold">{message.name}</p><p className="text-xs text-muted-foreground">From {message.senderName}</p><p className="mt-2 line-clamp-2 text-sm">{message.lastMessage || message.attachmentName || "Attachment"}</p>{message.attachmentType ? <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[11px]">{message.attachmentName || message.attachmentType}</span> : null}</Link>) : null}
  </div></section>;
}

function PeopleCard({ profile }: { profile: SearchProfile }) {
  const [following, setFollowing] = useState(Boolean(profile.discoveryIsFollowing));
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const isCurrentUser = auth.currentUser?.uid === profile.uid;
  const bio = profile.role?.bio || profile.interests?.slice(0, 3).join(" · ") || "";

  return <article className="rounded-2xl border p-4 transition hover:border-primary/30 hover:shadow-sm">
    <Link href={`/profile/${profile.uid}`} className="flex items-start gap-3">
      {profile.photoURL ? <OptimizedMedia src={profile.photoURL} alt="" width={56} height={56} sizes="56px" className="h-14 w-14 rounded-full object-cover" /> : <DefaultAvatar username={profile.displayName || "User"} className="h-14 w-14 rounded-full" />}
      <div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate font-semibold">{profile.displayName}{profile.verified ? <KinetVerifiedBadge compact /> : null}</p><p className="truncate text-sm text-muted-foreground">@{profile.username || profile.uid.slice(0, 8)}</p><div className="flex gap-1">{profile.role?.type ? <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize">{profile.role.type}</span> : null}{profile.privateAccount ? <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px]">Private</span> : null}</div></div>
    </Link>
    {bio ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{bio}</p> : null}
    <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">{profile.location ? <span>{profile.location}</span> : null}<span>{(profile.followers ?? []).length} with them</span>{profile.discoveryMutualCount ? <span className="text-primary">{profile.discoveryMutualCount} mutual</span> : null}</div>
    {!isCurrentUser ? <div className="mt-4 flex gap-2"><Button size="sm" className="flex-1" variant={following || requested ? "outline" : "default"} disabled={busy || requested} onClick={() => { setBusy(true); void toggleFollowUser(profile.uid, following).then((result) => { if (result === "requested") setRequested(true); else setFollowing(result === "following"); }).finally(() => setBusy(false)); }}>{following ? "Connected on Kinet" : requested ? "Request sent" : profile.privateAccount ? "Request to follow" : "Kinet With"}</Button><Button size="sm" variant="outline" asChild><Link href={`/messages?user=${profile.uid}`}>Message</Link></Button></div> : null}
  </article>;
}

export default function SearchPage() { return <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}><SearchContent /></Suspense>; }
