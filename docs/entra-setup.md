# Step 2 — Microsoft Entra ID Setup

Practical, current (2026) walkthrough to wire Pulse to Microsoft Entra ID: tenant, users, security groups, one app registration, the `groups` claim, and the `.env` values you need.

> **Time:** ~20–30 min. Tear down after the demo (see [Teardown](#teardown)).

---

## 0. Do you need the P1/P2 trial? (No.)

The original project notes said the free tier was gone — **that's outdated.** As of 2026:

- **Microsoft Entra ID Free tier covers everything Pulse needs**: app registrations, security groups, and the `groups` token claim all work on Free.
- **P1/P2 is only required** for advanced features Pulse does *not* use (Conditional Access, dynamic group membership, PIM, access reviews).

So: create a free tenant and skip the trial. The P1/P2 trial steps are included at the end **only if** you want to explore premium features.

Two ways to get a tenant:

| Option | Best when | Result |
|--------|-----------|--------|
| **Free Entra tenant** (Azure free account) | You just need SSO + groups for Pulse | Entra ID Free — sufficient |
| **Microsoft 365 Developer Program** | You qualify (VS Enterprise/Pro sub, etc.) | E5 sandbox, pre-seeded users/groups, includes P2 |

This guide uses the **Free Entra tenant** path.

---

## 1. Access a tenant — use your existing Default Directory

1. Go to the **Microsoft Entra admin center**: <https://entra.microsoft.com>
2. Sign in with a Microsoft account / Azure free account.
3. **Use the existing "Default Directory"** that comes with your account — it's a Workforce
   tenant on the Free tier and supports everything Pulse needs (app registration, security
   groups, users, `groups` claim). Confirm it's selected in the top-right account switcher.

Note your **Tenant ID**: **Entra ID → Overview → Tenant ID** → copy.
→ `.env`: `ENTRA_TENANT_ID`

> ### ⚠️ Don't create a new tenant (2026 change)
>
> As of 2026, **Manage tenants → Create** is gated: *"Customers must own a paid license to
> create Microsoft Entra Workforce tenant."* Free/trial accounts **cannot** create an add-on
> workforce tenant. The "Choose a configuration" screen offers three options — none are a good
> free fit for a new tenant:
>
> | Option | Verdict |
> |--------|---------|
> | **Workforce (legacy)** | Correct model for Pulse, but creating a *new* one needs paid P1/P2 |
> | **External** | CIAM/consumer identity — wrong model (no security-group RBAC) |
> | **Governed Workforce** (preview) | Requires an MCA subscription + governance template |
>
> **Just use your Default Directory.** If you truly need a separate isolated tenant for free,
> the only no-cost path is signing up for a brand-new **Azure free account**, which provisions
> its own fresh directory.

---

## 2. Create test users

Create 3–4 cloud users to exercise each role.

1. **Entra ID → Users → All users → + New user → Create new user**
2. Fill in:
   - **User principal name**: e.g. `alice@<your-tenant>.onmicrosoft.com`
   - **Display name**: e.g. `Alice Admin`
   - **Password**: auto-generate or set; **untick** "require change on first login" to keep demo logins simple, or note the temp password.
3. Repeat for, e.g.:
   - `alice` → will be **admin**
   - `bob` → will be **member**
   - `carol` → will be **viewer**

> Use `.onmicrosoft.com` UPNs — no custom domain needed.

---

## 3. Create security groups

Create one **Security** group per role. The names are for humans; Pulse maps by **object ID**.

1. **Entra ID → Groups → All groups → + New group**
2. For each group:
   - **Group type**: `Security`
   - **Group name**: `pulse-admin`, then `pulse-member`, then `pulse-viewer`
   - **Membership type**: `Assigned` (dynamic needs P1/P2 — not used here)
   - **Members**: add the matching user (Alice→admin, Bob→member, Carol→viewer)
3. After creating each group, open it and copy its **Object Id**.

→ `.env`:
```
ENTRA_PULSE_ADMIN_GROUP_ID=<pulse-admin object id>
ENTRA_PULSE_MEMBER_GROUP_ID=<pulse-member object id>
ENTRA_PULSE_VIEWER_GROUP_ID=<pulse-viewer object id>
```

> Pulse precedence is admin > member > viewer; a user in no group falls back to least-privilege **viewer** (`apps/api/src/auth/role-mapping.ts`).

---

## 4. Register the application (single app)

Pulse uses **one** app registration; the NestJS API is the OIDC relying party for both frontends.

1. **Entra ID → App registrations → + New registration**
2. Configure:
   - **Name**: `pulse`
   - **Supported account types**: **Accounts in this organizational directory only** (single tenant)
   - **Redirect URI**: platform **Web**, value:
     ```
     http://localhost:4000/auth/callback
     ```
3. **Register.**
4. On the **Overview** page copy **Application (client) ID**.
   → `.env`: `ENTRA_CLIENT_ID`

> The redirect URI must match `ENTRA_REDIRECT_URI` exactly (scheme, host, port, path). The API default is `http://localhost:4000/auth/callback`.

### 4a. Client secret

1. **Manage → Certificates & secrets → Client secrets → + New client secret**
2. Description `pulse-local`, expiry e.g. **90 days**, **Add**.
3. **Copy the secret _Value_ immediately** (not the Secret ID — it's shown only once).
   → `.env`: `ENTRA_CLIENT_SECRET`

### 4b. Add the logout redirect URI (required for Sign out)

Federated sign-out redirects back through the API. Add a **second** Web redirect URI under **Manage → Authentication → Web → Redirect URIs**:

```
http://localhost:4000/auth/logged-out
```

Without this URI, **Sign out** may fail or bounce to an Entra error page because `post_logout_redirect_uri` must match a registered redirect.

No implicit/hybrid flow is required — Pulse uses the **authorization code flow** (MSAL confidential client), so leave "Access tokens"/"ID tokens" implicit-grant checkboxes **unchecked**.

---

## 5. Add the `groups` claim to tokens

This is what makes RBAC work — without it, the token has no `groups`.

1. Open your **pulse** app registration → **Manage → Token configuration**.
2. **+ Add groups claim.**
3. Select **Security groups**.
4. Expand **Customize token properties by type** and ensure **ID** and **Access** are checked; keep **Group ID** as the format (Pulse maps by object ID).
5. **Add.**

> Pulse reads `groups` from the **ID token claims** returned by MSAL `acquireTokenByCode` (`apps/api/src/auth/auth.service.ts`). Group ID format matches the object IDs you put in `.env`.

### Optional: also surface email/name explicitly

The `openid profile email` scopes already yield `name` and `preferred_username`/`email`. No extra optional claims are required for Pulse.

---

## 6. API permissions (delegated)

Default delegated permission **Microsoft Graph → User.Read** is added automatically and is enough. Pulse requests scopes `openid profile email` for sign-in. No admin consent needed for these on a single-tenant dev app; if prompted, **Grant admin consent for `<tenant>`** under **API permissions**.

---

## 7. Fill `.env` and test

```bash
cp .env.example .env
```

Set the six Entra values plus a JWT secret:

```
ENTRA_TENANT_ID=...
ENTRA_CLIENT_ID=...
ENTRA_CLIENT_SECRET=...
ENTRA_REDIRECT_URI=http://localhost:4000/auth/callback
ENTRA_PULSE_ADMIN_GROUP_ID=...
ENTRA_PULSE_MEMBER_GROUP_ID=...
ENTRA_PULSE_VIEWER_GROUP_ID=...
JWT_SECRET=<openssl rand -base64 32>
```

Run the stack and exercise the flow:

```bash
pnpm infra:up
pnpm dev:api
```

In a browser, open:

```
http://localhost:4000/auth/login?app=board
```

Expected:

1. Redirect to `login.microsoftonline.com` → sign in as **Alice**.
2. Redirect back to `http://localhost:4000/auth/callback`, then to `http://localhost:3000/#token=<jwt>`.
3. Copy the JWT from the fragment and verify the role mapping:

```bash
curl -s http://localhost:4000/auth/me -H "Authorization: Bearer <jwt>" | jq
# → { "id": "...", "displayName": "Alice Admin", "email": "...", "role": "pulse-admin" }
```

Sign in as Bob → `pulse-member`, Carol → `pulse-viewer`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `AADSTS50011` redirect mismatch | Redirect URI in Entra ≠ `ENTRA_REDIRECT_URI`. Must match exactly incl. port. |
| Sign out loops back signed-in / wrong user | Add `http://localhost:4000/auth/logged-out` as a Web redirect URI (Step 4b). Use **Sign in as a different user** (`prompt=select_account`) to switch accounts. |
| `/auth/me` role is always `pulse-viewer` | `groups` claim missing or group IDs wrong. Re-check Step 5 and the three `*_GROUP_ID` values. |
| `AADSTS700016` app not found | Wrong `ENTRA_CLIENT_ID` or signed into the wrong tenant. |
| `AADSTS7000215` invalid client secret | You copied the Secret **ID** instead of the **Value**, or it expired. Make a new secret. |
| `invalid_client` on callback | `ENTRA_CLIENT_SECRET` wrong/expired. |
| Token has no `groups`, user is in groups | Groups claim not added to **ID token** (Step 5), or user exceeds the group-overage limit (not a concern at demo scale). |
| Can't activate P2 trial (if you try it) | Known issue — create a separate cloud user, grant **Global Administrator**, activate the trial as that user. P2 is **not** needed for Pulse. |

---

## Teardown

After the demo:

1. **App registrations → pulse → Delete.**
2. **Groups →** delete `pulse-admin/member/viewer`.
3. **Users →** delete test users.
4. If you activated a **P1/P2 trial**: Microsoft 365 admin center → **Billing → Your products** → cancel before the 30-day trial bills.
5. Delete the demo tenant if it was created solely for this (Manage tenants → Delete; requires no active subscriptions/users).

---

## Appendix — Activating the P1/P2 trial (optional, not needed)

Only if you want to test premium features:

1. **Entra ID → Licenses → Overview → Quick tasks → Get a free trial.**
2. Choose **Entra ID P2 → Activate.**
3. If activation fails on your primary admin account (a common quirk): create a new cloud user, assign **Global Administrator**, sign in as that user, and activate. Complete any billing profile prompts (sold-to address, etc.).
