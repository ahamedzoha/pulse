# @pulse/intel

Pulse Intel — App 2. Intelligence dashboard and RAG chat.

**Port:** 3001 (host)  
**Auth:** redirect to API `GET /auth/login?app=intel`  
**Roles:** `pulse-admin`, `pulse-member`, `pulse-viewer` (read-only)

## Features

- SSE live activity feed (+ `feed/recent` hydration on load)
- Health leaderboard and 24h momentum meter
- Persistent per-user AI chat (`GET/DELETE /intel/chat`, streaming RAG with live health snapshot + enriched sources)
- Expandable task detail drawer (`GET /intel/tasks/:id`) from leaderboard, feed, and AI sources
- Eight quick-prompt chips on empty chat (see root README § Intel AI quick prompts)

```bash
pnpm dev:intel
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` (see root `.env.example`).
