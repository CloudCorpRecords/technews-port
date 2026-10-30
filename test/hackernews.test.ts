import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBestStories,
  getItem,
  getNewStories,
  getTopStories,
  getUser,
  parseItem,
  searchStories,
} from "../src/hackernews.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

const ITEM_100 = {
  by: "alice",
  descendants: 42,
  id: 100,
  kids: [201, 202],
  score: 157,
  time: 1760000000,
  title: "A story about parsers",
  type: "story",
  url: "https://example.com/parsers",
};

const ITEM_101 = {
  by: "bob",
  id: 101,
  score: 12,
  text: "Ask HN: what are you building?",
  time: 1760003600,
  title: "Ask HN: weekend projects",
  type: "story",
};

const ITEM_102 = {
  by: "carol",
  deleted: true,
  id: 102,
  type: "story",
};

const USER_PG = {
  about: "Writes essays and runs a startup school.",
  created: 1234567890,
  id: "pg",
  karma: 157745,
  submitted: [100, 555, 777],
};

const ALGOLIA_PAYLOAD = {
  hits: [
    {
      objectID: "100",
      title: "A story about parsers",
      url: "https://example.com/parsers",
      author: "alice",
      points: 157,
      num_comments: 42,
      created_at_i: 1760000000,
      story_text: null,
    },
    {
      objectID: "101",
      title: "Ask HN: weekend projects",
      url: null,
      author: "bob",
      points: 12,
      num_comments: 3,
      created_at_i: 1760003600,
      story_text: "Ask HN: what are you building?",
    },
  ],
  nbHits: 2,
  page: 0,
  hitsPerPage: 20,
};

/**
 * Fake fetch routed by URL substring, like the real APIs are keyed:
 * list endpoints return id arrays, item/user endpoints return records.
 */
function routedFetch(seen?: string[]): FetchFn {
  const json = (payload: unknown): HttpResponse => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(payload),
  });
  return async (url: string) => {
    seen?.push(url);
    if (url.includes("hn.algolia.com")) return json(ALGOLIA_PAYLOAD);
    if (url.includes("/topstories.json")) return json([100, 101, 102]);
    if (url.includes("/newstories.json")) return json([101, 100]);
    if (url.includes("/beststories.json")) return json([100]);
    if (url.includes("/item/100.json")) return json(ITEM_100);
    if (url.includes("/item/101.json")) return json(ITEM_101);
    if (url.includes("/item/102.json")) return json(ITEM_102);
    if (url.includes("/item/999.json")) return json(null);
    if (url.includes("/item/")) return json(null);
    if (url.includes("/user/pg.json")) return json(USER_PG);
    if (url.includes("/user/")) return json(null);
    return json(null);
  };
}

function failingFetch(status: number): FetchFn {
  return async () => ({
    ok: false,
    status,
    statusText: "Error",
    headers: { get: () => null },
    text: async () => "",
  });
}

describe("parseItem", () => {
  it("normalises a full story record", () => {
    const item = parseItem(ITEM_100);
    assert.equal(item?.id, 100);
    assert.equal(item?.title, "A story about parsers");
    assert.equal(item?.by, "alice");
    assert.equal(item?.score, 157);
    assert.equal(item?.descendants, 42);
    assert.deepEqual(item?.kids, [201, 202]);
    assert.equal(item?.deleted, false);
    assert.equal(item?.dead, false);
  });

  it("fills defaults for sparse records and flags deleted ones", () => {
    const item = parseItem(ITEM_102);
    assert.equal(item?.deleted, true);
    assert.equal(item?.title, null);
    assert.equal(item?.url, null);
    assert.deepEqual(item?.kids, []);
  });

  it("returns null for non-objects", () => {
    assert.equal(parseItem(null), null);
    assert.equal(parseItem(42), null);
  });
});

describe("story lists", () => {
  it("getTopStories fetches the id list then each item in order", async () => {
    const seen: string[] = [];
    const r = await getTopStories(routedFetch(seen), 2);
    assert.equal(r.list, "top");
    assert.deepEqual(r.item_ids, [100, 101]);
    assert.equal(r.count, 2);
    assert.equal(r.items[0].title, "A story about parsers");
    assert.equal(r.items[1].by, "bob");
    assert.ok(seen[0].includes("/topstories.json"));
    assert.ok(seen[1].includes("/item/100.json"));
  });

  it("getNewStories and getBestStories hit their own endpoints", async () => {
    const seenNew: string[] = [];
    const n = await getNewStories(routedFetch(seenNew));
    assert.equal(n.list, "new");
    assert.deepEqual(n.item_ids, [101, 100]);
    assert.ok(seenNew[0].includes("/newstories.json"));

    const seenBest: string[] = [];
    const b = await getBestStories(routedFetch(seenBest), 10);
    assert.equal(b.list, "best");
    assert.deepEqual(b.item_ids, [100]);
    assert.ok(seenBest[0].includes("/beststories.json"));
  });

  it("surfaces HTTP errors from the list endpoint", async () => {
    await assert.rejects(getTopStories(failingFetch(500)), /HTTP 500/);
  });
});

describe("getItem", () => {
  it("parses a single item", async () => {
    const item = await getItem(routedFetch(), 100);
    assert.equal(item.id, 100);
    assert.equal(item.url, "https://example.com/parsers");
  });

  it("throws for a missing item and for invalid ids", async () => {
    await assert.rejects(getItem(routedFetch(), 999), /item not found/);
    await assert.rejects(getItem(routedFetch(), 0), /positive integer/);
    await assert.rejects(getItem(routedFetch(), -3), /positive integer/);
    await assert.rejects(getItem(routedFetch(), 1.5), /positive integer/);
  });
});

describe("getUser", () => {
  it("parses a user profile", async () => {
    const seen: string[] = [];
    const user = await getUser(routedFetch(seen), "pg");
    assert.equal(user.id, "pg");
    assert.equal(user.karma, 157745);
    assert.equal(user.created, 1234567890);
    assert.deepEqual(user.submitted, [100, 555, 777]);
    assert.ok(seen[0].includes("/user/pg.json"));
  });

  it("throws for an unknown user and an empty name", async () => {
    await assert.rejects(getUser(routedFetch(), "ghost-user"), /user not found/);
    await assert.rejects(getUser(routedFetch(), "  "), /username is required/);
  });
});

describe("searchStories", () => {
  it("parses Algolia hits", async () => {
    const seen: string[] = [];
    const r = await searchStories(routedFetch(seen), "parsers", 5);
    assert.equal(r.query, "parsers");
    assert.equal(r.count, 2);
    assert.equal(r.results[0].id, 100);
    assert.equal(r.results[0].author, "alice");
    assert.equal(r.results[0].points, 157);
    assert.equal(r.results[0].num_comments, 42);
    assert.equal(r.results[1].url, null);
    assert.ok(seen[0].includes("hn.algolia.com/api/v1/search"));
    assert.ok(seen[0].includes("tags=story"));
    assert.ok(seen[0].includes("hitsPerPage=5"));
  });

  it("rejects an empty query", async () => {
    await assert.rejects(searchStories(routedFetch(), ""), /query is required/);
  });
});
