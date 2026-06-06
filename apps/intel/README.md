# @pulse/intel

Pulse Intel — App 2. Intelligence dashboard and RAG Q&A.

**Port:** 3001 (host)  
**Auth:** redirect to API `GET /auth/login` (backend owns the MSAL OIDC flow)  
**Roles:** `pulse-admin`, `pulse-member`, `pulse-viewer` (read-only)

## Planned features

- SSE live activity feed
- Task health leaderboard (lowest scores first)
- Team momentum meter (24h mood rolling average)
- AI summary panel with streaming RAG responses

See root **README.md** build order step 8.
