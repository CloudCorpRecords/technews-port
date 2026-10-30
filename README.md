# technews-port

technews-port is a small reader for Hacker News that speaks to the
site's own public APIs, so there is no scraping and nothing to sign up
for. It pulls the ranked front-page lists (top, new, and best), any
single item by its numeric id, and any user's public profile from the
official Firebase API, and it searches story text through the Algolia
HN Search API — the one capability the Firebase API does not have.

Story lists come back with the items already fetched, in ranked
order, not just bare ids: the headline, author, score, and comment
count are right there for each entry.

## Install

```bash
npx @reneturcios/technews-port top --limit 10
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/technews-port
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

Every command prints JSON.

```bash
# The three ranked lists (default 30 stories, capped at 100)
technews-port top
technews-port new --limit 10
technews-port best --limit 5

# One item, one user
technews-port item 8863
technews-port user pg

# Full-text story search via Algolia (default 20 hits)
technews-port search "show hn" --limit 10

technews-port --version
```

Exit codes: `0` on success, `1` when the lookup fails (an unknown item
or user, or an upstream error, named in the message), `2` for usage
errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/technews-port mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "technews-port": {
      "command": "npx",
      "args": ["-y", "@reneturcios/technews-port", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `get_top_stories` | `limit` (integer, optional) | The current top stories: the ranked item ids plus each story parsed — title, author, score, comment count, URL, and timestamp. |
| `get_new_stories` | `limit` (integer, optional) | The newest stories, same shape as `get_top_stories`. |
| `get_best_stories` | `limit` (integer, optional) | The best stories, same shape as `get_top_stories`. |
| `get_item` | `item_id` (integer, required) | One item of any kind (story, comment, job, poll): its type, author, text or title, score, child comment ids, and deleted/dead flags. |
| `get_user` | `username` (string, required) | The user's public profile: creation time, karma, about text, and submitted item ids. |
| `search_stories` | `query` (string, required), `limit` (integer, optional) | Stories matching the query, from Algolia: title, URL, author, points, comment count, and posting time per hit. |

If an id in a ranked list disappears between reading the list and
fetching the item — it happens on a live site — the id stays in
`item_ids` and the item is simply absent from `items`.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network
npm run dev     # run the CLI from source via tsx
```

The core takes an injectable fetch function, and the test suite
routes a fake fetch by URL to hand-written payloads shaped like real
Firebase and Algolia responses — the tests never touch the network.

## License

MIT — see `LICENSE`.
