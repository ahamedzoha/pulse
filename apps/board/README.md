# @pulse/board

Pulse Board — App 1. SSO-gated Kanban task board.

**Port:** 3000 (host)  
**Auth:** redirect to API `GET /auth/login?app=board`  
**Roles:** `pulse-admin`, `pulse-member` (`pulse-viewer` blocked — use Intel)

## Features

- Kanban columns with health badges (green / amber / red)
- Mood picker on create, status change, comment, reassign
- Federated sign-out and account picker via API auth routes

```bash
pnpm dev:board
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` (see root `.env.example`).
