/**
 * technews-port core: Hacker News reading over the public APIs.
 *
 * Two public services cover everything here:
 *  - the Hacker News Firebase API (hacker-news.firebaseio.com/v0) for
 *    the ranked story lists (top/new/best id arrays), individual items,
 *    and user profiles;
 *  - the Algolia HN Search API (hn.algolia.com/api/v1) for full-text
 *    story search, which the Firebase API does not offer.
 *
 * A story-list call fetches the id array first, keeps the first
 * `limit` ids, then fetches each of those items in ranked order. Ids
 * whose item comes back null (removed between the two reads) are
 * skipped in `items` but stay visible in `item_ids`.
 *
 * All network access goes through an injected FetchFn, so the parsing
 * logic is fully testable with recorded-style fixtures and no network.
 */
import type {
  FetchFn,
  HnItem,
  HnUser,
  SearchResult,
  StoryListResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const HN_BASE = "https://hacker-news.firebaseio.com/v0";
export const ALGOLIA_BASE = "https://hn.algolia.com/api/v1";

export const USER_AGENT = "technews-port/0.1.0 (MCP server; +https://github.com/CloudCorpRecords/technews-port)";

export const DEFAULT_LIST_LIMIT = 30;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(limit)));
}

async function fetchJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  let response;
  try {
    response = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      redirect: "follow",
    });
  } catch (err) {
    throw new Error(
      `Hacker News request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Hacker News request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    );
  }
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new Error("Hacker News request failed: response was not JSON");
  }
}

/** Normalise one raw Firebase item record; null in, null out. */
export function parseItem(raw: unknown): HnItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    type: String(r.type ?? ""),
    by: typeof r.by === "string" ? r.by : null,
    time: Number(r.time ?? 0),
    title: typeof r.title === "string" ? r.title : null,
    url: typeof r.url === "string" ? r.url : null,
    text: typeof r.text === "string" ? r.text : null,
    score: Number(r.score ?? 0),
    descendants: Number(r.descendants ?? 0),
    kids: Array.isArray(r.kids) ? r.kids.map((k) => Number(k)) : [],
    deleted: r.deleted === true,
    dead: r.dead === true,
  };
}

export async function getItem(fetchFn: FetchFn, itemId: number): Promise<HnItem> {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error("item_id must be a positive integer");
  }
  const item = parseItem(await fetchJson(fetchFn, `${HN_BASE}/item/${itemId}.json`));
  if (!item) throw new Error(`Hacker News item not found: ${itemId}`);
  return item;
}

async function getStoryList(
  fetchFn: FetchFn,
  list: "top" | "new" | "best",
  limit?: number,
): Promise<StoryListResult> {
  const endpoint = `${list}stories` as const;
  const raw = await fetchJson(fetchFn, `${HN_BASE}/${endpoint}.json`);
  if (!Array.isArray(raw)) {
    throw new Error(`Hacker News request failed: ${endpoint} did not return an id list`);
  }
  const ids = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .slice(0, clampLimit(limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT));
  const items: HnItem[] = [];
  for (const id of ids) {
    const item = parseItem(await fetchJson(fetchFn, `${HN_BASE}/item/${id}.json`));
    if (item) items.push(item);
  }
  return { list, count: items.length, item_ids: ids, items };
}

export function getTopStories(fetchFn: FetchFn, limit?: number): Promise<StoryListResult> {
  return getStoryList(fetchFn, "top", limit);
}

export function getNewStories(fetchFn: FetchFn, limit?: number): Promise<StoryListResult> {
  return getStoryList(fetchFn, "new", limit);
}

export function getBestStories(fetchFn: FetchFn, limit?: number): Promise<StoryListResult> {
  return getStoryList(fetchFn, "best", limit);
}

export async function getUser(fetchFn: FetchFn, username: string): Promise<HnUser> {
  const name = typeof username === "string" ? username.trim() : "";
  if (!name) throw new Error("username is required");
  const raw = await fetchJson(
    fetchFn,
    `${HN_BASE}/user/${encodeURIComponent(name)}.json`,
  );
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Hacker News user not found: ${name}`);
  }
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? name),
    created: Number(r.created ?? 0),
    karma: Number(r.karma ?? 0),
    about: typeof r.about === "string" ? r.about : null,
    submitted: Array.isArray(r.submitted) ? r.submitted.map((v) => Number(v)) : [],
  };
}

export async function searchStories(
  fetchFn: FetchFn,
  query: string,
  limit?: number,
): Promise<SearchResult> {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) throw new Error("query is required");
  const params = new URLSearchParams({
    query: q,
    tags: "story",
    hitsPerPage: String(clampLimit(limit, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT)),
  });
  const raw = await fetchJson(fetchFn, `${ALGOLIA_BASE}/search?${params.toString()}`);
  const hits =
    typeof raw === "object" && raw !== null && Array.isArray((raw as { hits?: unknown }).hits)
      ? ((raw as { hits: unknown[] }).hits as Array<Record<string, unknown>>)
      : [];
  const results = hits.map((h) => ({
    id: Number(h.objectID ?? 0),
    title: typeof h.title === "string" ? h.title : null,
    url: typeof h.url === "string" ? h.url : null,
    author: typeof h.author === "string" ? h.author : null,
    points: Number(h.points ?? 0),
    num_comments: Number(h.num_comments ?? 0),
    created_at_i: Number(h.created_at_i ?? 0),
  }));
  return { query: q, count: results.length, results };
}
