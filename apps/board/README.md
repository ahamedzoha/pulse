# @pulse/board

Pulse Board — App 1. SSO-gated Kanban task board.

**Port:** 3000 (host)  
**Auth:** redirect to API `GET /auth/login` (backend owns the MSAL OIDC flow)  
**Roles:** `pulse-admin`, `pulse-member`

## Planned features

- Kanban columns with health score badges (green/amber/red)
- Mood picker on every task update
- Entra SSO login

See root **README.md** build order step 7.
