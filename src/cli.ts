#!/usr/bin/env node
/**
 * technews-port CLI.
 *
 *   technews-port top [--limit n]
 *   technews-port new [--limit n]
 *   technews-port best [--limit n]
 *   technews-port item <item_id>
 *   technews-port user <username>
 *   technews-port search <query...> [--limit n]
 *   technews-port mcp
 *
 * Results print as JSON. Exit codes: 0 success, 1 lookup error,
 * 2 usage error.
 */
import {
  getBestStories,
  getItem,
  getNewStories,
  getTopStories,
  getUser,
  searchStories,
  VERSION,
} from "./hackernews.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  technews-port top [--limit n]
  technews-port new [--limit n]
  technews-port best [--limit n]
  technews-port item <item_id>
  technews-port user <username>
  technews-port search <query...> [--limit n]
  technews-port mcp
  technews-port --version`);
  process.exit(2);
}

function limitFlag(args: string[]): number | undefined {
  const idx = args.indexOf("--limit");
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  const value = Number.parseInt(args[idx + 1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function positional(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") i++;
    else out.push(args[i]);
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    let result: unknown;
    if (cmd === "top") {
      result = await getTopStories(fetchFn, limitFlag(rest));
    } else if (cmd === "new") {
      result = await getNewStories(fetchFn, limitFlag(rest));
    } else if (cmd === "best") {
      result = await getBestStories(fetchFn, limitFlag(rest));
    } else if (cmd === "item") {
      const [raw] = positional(rest);
      const id = Number.parseInt(raw ?? "", 10);
      if (!raw || !Number.isInteger(id)) usage();
      result = await getItem(fetchFn, id);
    } else if (cmd === "user") {
      const [username] = positional(rest);
      if (!username) usage();
      result = await getUser(fetchFn, username);
    } else if (cmd === "search") {
      const query = positional(rest).join(" ").trim();
      if (!query) usage();
      result = await searchStories(fetchFn, query, limitFlag(rest));
    } else {
      usage();
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
