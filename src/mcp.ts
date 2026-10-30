/**
 * technews-port MCP server. Tools: get_top_stories, get_new_stories,
 * get_best_stories, get_item, get_user, search_stories.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas, while zod still
 * validates every tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const LimitArgs = z.object({
  limit: z.number().int().optional(),
});

const ItemArgs = z.object({
  item_id: z.number().int(),
});

const UserArgs = z.object({
  username: z.string(),
});

const SearchArgs = z.object({
  query: z.string(),
  limit: z.number().int().optional(),
});

const TOOLS = [
  {
    name: "get_top_stories",
    description: "Get the current top stories on Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { description: "Maximum number of top stories to return; defaults to 30, clamped to 1-100.", type: "integer" },
      },
      required: [],
    },
  },
  {
    name: "get_new_stories",
    description: "Get the newest stories on Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { description: "Maximum number of newest stories to return; defaults to 30, clamped to 1-100.", type: "integer" },
      },
      required: [],
    },
  },
  {
    name: "get_best_stories",
    description: "Get the best stories on Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { description: "Maximum number of best stories to return; defaults to 30, clamped to 1-100.", type: "integer" },
      },
      required: [],
    },
  },
  {
    name: "get_item",
    description: "Get a Hacker News item by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_id: { description: "Numeric ID of the Hacker News item to retrieve.", type: "integer" },
      },
      required: ["item_id"],
    },
  },
  {
    name: "get_user",
    description: "Get a Hacker News user profile by username.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { description: "Hacker News username of the profile to retrieve.", type: "string" },
      },
      required: ["username"],
    },
  },
  {
    name: "search_stories",
    description: "Search Hacker News stories by query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { description: "Full-text search query to match against Hacker News stories.", type: "string" },
        limit: { description: "Maximum number of search results to return; defaults to 20, clamped to 1-100.", type: "integer" },
      },
      required: ["query"],
    },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const fetchFn = globalThis.fetch as unknown as FetchFn;

const server = new Server(
  { name: "technews-port", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "get_top_stories") {
      const parsed = LimitArgs.parse(args ?? {});
      return textResult(await getTopStories(fetchFn, parsed.limit));
    }
    if (name === "get_new_stories") {
      const parsed = LimitArgs.parse(args ?? {});
      return textResult(await getNewStories(fetchFn, parsed.limit));
    }
    if (name === "get_best_stories") {
      const parsed = LimitArgs.parse(args ?? {});
      return textResult(await getBestStories(fetchFn, parsed.limit));
    }
    if (name === "get_item") {
      const parsed = ItemArgs.parse(args ?? {});
      return textResult(await getItem(fetchFn, parsed.item_id));
    }
    if (name === "get_user") {
      const parsed = UserArgs.parse(args ?? {});
      return textResult(await getUser(fetchFn, parsed.username));
    }
    if (name === "search_stories") {
      const parsed = SearchArgs.parse(args ?? {});
      return textResult(await searchStories(fetchFn, parsed.query, parsed.limit));
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
