/**
 * technews-port types.
 *
 * Story lists come back as the ranked item ids plus the parsed items
 * themselves, so a caller can show headlines without a second round of
 * lookups. Items are normalised across the two upstream shapes this
 * tool reads: the Firebase API's per-item records and Algolia's search
 * hits.
 */

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string>; redirect?: string },
) => Promise<HttpResponse>;

export interface HnItem {
  id: number;
  /** story, comment, job, poll, or pollopt. */
  type: string;
  by: string | null;
  /** Unix timestamp (seconds) when the item was created. */
  time: number;
  title: string | null;
  url: string | null;
  text: string | null;
  score: number;
  /** Number of comments in the item's tree, when reported. */
  descendants: number;
  kids: number[];
  deleted: boolean;
  dead: boolean;
}

export interface StoryListResult {
  /** Which ranked list these stories came from: top, new, or best. */
  list: string;
  count: number;
  item_ids: number[];
  items: HnItem[];
}

export interface HnUser {
  id: string;
  /** Unix timestamp (seconds) when the account was created. */
  created: number;
  karma: number;
  about: string | null;
  submitted: number[];
}

export interface SearchHit {
  id: number;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number;
  num_comments: number;
  /** Unix timestamp (seconds) when the story was posted. */
  created_at_i: number;
}

export interface SearchResult {
  query: string;
  count: number;
  results: SearchHit[];
}
