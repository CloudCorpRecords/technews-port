# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `technews-port top|new|best [--limit n]` prints the ranked
  story lists with items included; `technews-port item <item_id>` and
  `technews-port user <username>` fetch single records;
  `technews-port search <query...> [--limit n]` searches stories.
  All commands print JSON.
- MCP server (`technews-port mcp`, stdio) with six tools:
  `get_top_stories`, `get_new_stories`, `get_best_stories`,
  `get_item`, `get_user`, and `search_stories`.
- Built on the public Hacker News Firebase API for lists, items, and
  users, and the Algolia HN Search API for full-text story search.
- Core logic takes an injectable fetch function, so the whole tool is
  testable offline against fixture payloads.
