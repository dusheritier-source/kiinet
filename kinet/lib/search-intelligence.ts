const synonyms: Record<string, string[]> = {
  photo: ["photography", "picture", "image"], video: ["reel", "clip", "movie"],
  music: ["song", "audio", "artist"], tech: ["technology", "software", "coding"],
  food: ["cooking", "recipe", "restaurant"], travel: ["trip", "vacation", "destination"],
};

export function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9@#\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function editDistance(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    let diagonal = previous[0]; previous[0] = i;
    for (let j = 1; j <= second.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (first[i - 1] === second[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return previous[second.length];
}

export function expandQuery(query: string) {
  const tokens = normalizeSearchText(query).replace(/^[@#]/, "").split(" ").filter(Boolean);
  return Array.from(new Set(tokens.flatMap((token) => [token, ...(synonyms[token] ?? [])])));
}

export function intelligentMatch(haystack: string, query: string) {
  const text = normalizeSearchText(haystack);
  const words = text.split(" ");
  const terms = expandQuery(query);
  if (!terms.length) return { matches: true, score: 0 };
  let score = 0;
  for (const term of terms) {
    if (text === term) score += 100;
    else if (text.startsWith(term)) score += 60;
    else if (text.includes(term)) score += 35;
    else {
      const distance = Math.min(...words.map((word) => editDistance(word, term)));
      if (distance <= (term.length >= 7 ? 2 : 1)) score += 18 - distance * 4;
    }
  }
  return { matches: score > 0, score };
}

export function parseSearchIntent(query: string) {
  const normalized = normalizeSearchText(query);
  const creator = normalized.match(/(?:by|from)\s+@?([a-z0-9._-]+)/)?.[1] ?? null;
  return {
    contentType: /\b(videos?|reels?|clips?)\b/.test(normalized) ? "videos" : /\b(posts?|photos?|pictures?)\b/.test(normalized) ? "posts" : /\b(people|users|accounts|creators)\b/.test(normalized) ? "people" : null,
    recent: /\b(recent|latest|new|today|this week)\b/.test(normalized),
    popular: /\b(popular|trending|viral|top)\b/.test(normalized),
    creator,
  };
}

export function suggestCorrection(query: string, candidates: string[]) {
  const normalized = normalizeSearchText(query).replace(/^[@#]/, "");
  if (!normalized || normalized.includes(" ")) return null;
  const ranked = candidates.map((candidate) => ({ candidate, distance: editDistance(normalized, normalizeSearchText(candidate).replace(/^[@#]/, "")) })).sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  return best && best.distance > 0 && best.distance <= (normalized.length >= 7 ? 2 : 1) ? best.candidate : null;
}
