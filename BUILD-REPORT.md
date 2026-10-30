# technews-port — Build Report

MCP Rebuild 100, Tier A. Clean-room rebuild of the "hackernews" MCP
server, built from the public tool spec only: tool names, parameters,
and required sets derived from the public Hacker News API
documentation, recorded in
`harness/fixtures/hackernews-tools-original.json` (`_source` states
docs-derived, not hand-probed). Local build only — nothing pushed or
published.

Identity: repo `technews-port`, npm `@reneturcios/technews-port`,
MCP name `io.github.CloudCorpRecords/technews-port`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `technews-port: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Hacker News top, new, and best stories,
  items, users, and full-text search." = **75 chars** (≤100 ✓); npm
  entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/technews-port:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT `node /app/dist/cli.js`,
  CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/technews-port"`
- `tsconfig.json` (copied unchanged from clockport), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md` (fresh
  text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`top`, `new`, `best`, `item`, `user`,
  `search`, `mcp`, `--version`; exit 2 usage / 1 lookup error),
  `src/mcp.ts`, `src/types.ts`, `src/hackernews.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/hackernews.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (copied from clockport; image name and smoke-test server name changed)

## Implementation notes

- Tools: `get_top_stories`, `get_new_stories`, `get_best_stories`,
  `get_item`, `get_user`, `search_stories` — 6/6 from the spec.
- Core talks to the real public Hacker News APIs: the Firebase API
  (`hacker-news.firebaseio.com/v0`) for the ranked id lists
  (top/new/best), per-item records, and user profiles; the Algolia HN
  Search API (`hn.algolia.com/api/v1/search`, `tags=story`) for
  full-text story search. Story-list calls fetch the id array, keep
  the first `limit` ids, then fetch each item in ranked order; the
  result carries both `item_ids` and the parsed `items`.
- All network access goes through an injected `FetchFn`
  (pageport/shipcheck pattern). **Behaviour was tested via fake fetch
  only — no live call was made** (VM egress is blocked); tests use a
  URL-routed fake fetch with hand-written payloads shaped like real
  Firebase and Algolia responses.
- `src/mcp.ts` uses the SDK's low-level `Server` (zod still validates
  every `tools/call`), serving `tools/list` with the spec's exact
  input schemas — same deviation from the TEMPLATE §2.12 pattern as
  clockport, for the same reason (McpServer injects `$schema` /
  `additionalProperties` keys absent from the spec).

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 12
ℹ pass 12
ℹ fail 0
```
Covers: item normalisation (full, sparse, deleted, non-object),
all three story lists with per-endpoint URLs asserted, list limit
slicing, single-item fetch + missing/invalid-id errors, user profile
parsing + unknown-user error, Algolia hit parsing + query/limit
parameters asserted on the requested URL, HTTP errors.

### 3. CLI smoke
`--version` -> `0.1.0`; unknown command exits 2 with Usage. (Live CLI
lookups not run — no network; see Implementation notes.)

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/hackernews-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/technews-port/dist/cli.js mcp" \
    --out /home/hatch/workspace/mcp-rebuild-100/builds/technews-port/parity-out
verdict=PASS parity_pct=100.0 original_tools=6 rebuild_tools=6 missing=[] extra=[] schema_diffs=[]
(exit 0)
```

## Lockfile status

`package-lock.json` was copied from clockport's and edited with the
file edit tool: top-level `name`, root package `name`, and root
package `bin` key changed clockport -> technews-port (dependency
ranges are identical, so the tree is unchanged). **Clean lockfile
regen required before publish** — per TEMPLATE.md §2 item 6, the
lockfile must be regenerated clean (no `node_modules` present)
before first publish; do not publish from this lockfile as-is.
`node_modules` in this build dir is a `cp -a` copy of clockport's
(local build only, gitignored).

## Blockers

None for the local build. Notes for the publish wave:
- Regenerate `package-lock.json` clean before first publish (above).
- No live Hacker News / Algolia call has been made yet; first live
  smoke belongs to an environment with working egress.
- Container build not exercised locally (no Docker run in this wave);
  the publish-container workflow smoke-tests the image at publish time.

## Publish-gate remediation (2026-10-27)

Recorded under Rene's 2026-10-27 decision ("Remediate the 6: add param
descriptions + capability-class vet policy, then re-gate") and
`publish/GATE-POLICY.md`, following the standing Wave 2 remediation
pattern. This is an authorized deviation from the parity-faithful
state: descriptions were added to every tool parameter that lacked
one (tools: `get_top_stories`, `get_new_stories`, `get_best_stories`,
`get_item`, `get_user`, `search_stories`), in the `src/mcp.ts` schema
literals only — parameter names, types, required lists and enums are
unchanged, and no other code was touched.

- Descriptions added: 7 (all served parameters: `get_top_stories`
  `limit`; `get_new_stories` `limit`; `get_best_stories` `limit`;
  `get_item` `item_id`; `get_user` `username`; `search_stories`
  `query` + `limit`).
- Rebuild: `npm run build` (tsc) exit 0; `tsc --noEmit` exit 0; full
  test suite 12/12 pass (tests 12, pass 12, fail 0).
- Parity harness re-run, verbatim: **PARTIAL, parity_pct 50.0** — all
  7 schema diffs are description additions
  (`*.description: present in rebuild but not in original`; 0
  structural diffs). Structural parity proven independently under the
  corrected strip-proof procedure: stripping `description` keys from
  BOTH the post-remediation and pre-remediation tools/list deep-equals
  (strip-both-equal: true); every description present in the
  pre-remediation list is byte-identical in the post-remediation list
  (changed-descriptions: 0, removed-descriptions: 0), and the only
  additions are the 7 at `inputSchema` property paths:
  $[0] (get_top_stories).inputSchema.properties.limit.description,
  $[1] (get_new_stories).inputSchema.properties.limit.description,
  $[2] (get_best_stories).inputSchema.properties.limit.description,
  $[3] (get_item).inputSchema.properties.item_id.description,
  $[4] (get_user).inputSchema.properties.username.description,
  $[5] (search_stories).inputSchema.properties.limit.description,
  $[5] (search_stories).inputSchema.properties.query.description.
  Adjudication: the description-only diffs are the authorized
  remediation itself; structural parity is unchanged. Full record:
  `publish/parity-remediation/technews-port/parity.json`
  (tools-pre.json / tools-post.json, strip-proof.py /
  strip-proof.txt alongside).
- Re-gate: not run in this remediation pass — mcpaudit / mcpvet were
  not run and nothing was published, per the remediation brief.
