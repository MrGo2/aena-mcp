# Contributing

Thanks for helping improve aena-mcp.

## Setup

```bash
git clone https://github.com/MrGo2/aena-mcp.git
cd aena-mcp
pnpm install        # pnpm is the supported lockfile (pnpm-lock.yaml)
pnpm build
pnpm test           # unit tests, no network and no credentials
```

Node 20 or newer is required. The tests run against captured fixtures, so they
never call AENA and need no client secret. They run on any OS.

## Ground rules

Every tool argument is validated with a zod `inputSchema`, and each tool
declares a `title` and a `description`.

The two AENA APIs are normalized behind one `Flight` shape. Parsing lives in
pure functions (`normalizeWebsiteRow`, `normalizeRestRow`) that take a raw row
and return a `Flight`. Network code only fetches and hands rows to them, so the
mapping is testable without a live call. A field the source cannot provide is
left undefined, never faked.

A bug fix ships together with the fixture and test that would have caught it.

## Pull requests

- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- CI must be green (Node 20 and 22, plus the MCP inspector smoke)
- Keep diffs surgical; unrelated refactors go in their own PR
