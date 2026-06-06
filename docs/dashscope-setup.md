# Step 6 prerequisite — DashScope (Alibaba Cloud Model Studio) API Key

Practical, current (2026) walkthrough to get the LLM + embeddings key Pulse needs for
worker embeddings (Step 5) and the RAG endpoint (Step 6), and the `.env` values to set.

> **Time:** ~10–15 min (longer if your account needs real-name/identity verification).

---

## 0. "DashScope is gone / renamed" — what's actually true

It wasn't deleted, just rebranded at the **console** layer. The naming is confusing, so:

| Name you'll see | What it is |
|-----------------|------------|
| **DashScope** | The **API service** brand. Still the API name, still the `DASHSCOPE_API_KEY` env var, still the `sk-...` key format, still the `dashscope-intl.aliyuncs.com` endpoint. |
| **Model Studio** | The **console/product** you log into to manage keys and models (English branding). |
| **Bailian / 百炼** | The **same product**, Chinese branding. "Model Studio" == "Bailian". |
| **Qwen / Tongyi Qianwen** | The **model family** (e.g. `qwen-plus`) you call through DashScope. |

**Bottom line:** you create a *Model Studio API key*, drop it into `DASHSCOPE_API_KEY`, and keep
the `dashscope-intl.aliyuncs.com/compatible-mode/v1` base URL. Nothing in Pulse's code changes.

---

## 1. Pick the right region — International (Singapore)

Pulse is hard-wired to the **International** deployment, hosted in **Singapore**:

```
https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

> ### ⚠️ Region keys are NOT interchangeable
>
> A Singapore key only works on the Singapore endpoint; a Beijing key only on the China endpoint.
> Mixing them gives `Invalid API-key` / `401`. Pulse uses **Singapore (International)**, so create
> your key in that region.
>
> | Region | OpenAI-compatible base URL |
> |--------|----------------------------|
> | **Singapore (International)** ✅ Pulse default | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
> | China (Beijing) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
> | US (Virginia) | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` |

> ### ⚠️ Newer Singapore accounts get a workspace-scoped domain
>
> Some accounts (especially newer ones, with `sk-ws-...` keys) are issued a **workspace-scoped**
> Singapore host instead of the shared `dashscope-intl` domain:
>
> ```
> https://ws-<your-workspace-id>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
> ```
>
> The console may show this URL ending in **`/api/v1`** — that's the *native DashScope* path and
> **will 404 with Pulse's OpenAI SDK**. You must use the **`/compatible-mode/v1`** suffix on the
> same host. Set the full URL in `DASHSCOPE_BASE_URL`.

> ### ⚠️ Don't grab a "Coding Plan" key
>
> Alibaba also sells **Coding Plan** keys (format `sk-sp-...`) that only work on
> `coding-intl.dashscope.aliyuncs.com`. That is **not** what Pulse wants. Create a **standard
> Model Studio API key** (format `sk-...`) and use the `compatible-mode` endpoint above.

---

## 2. Create / log into a Model Studio account

1. Go to the **Model Studio console**: <https://modelstudio.console.alibabacloud.com>
2. Click **Login** (top-right) and sign up or sign in with your Alibaba Cloud account
   (email signup works; this is the **international** site, not aliyun.com).
3. Confirm the region selector (top of the page / account area) is set to **Singapore**.

> **Identity verification:** International accounts must complete **account verification** before
> API calls succeed. If your first call returns an auth/permission error even with a valid-looking
> key, finish verification in the console (Account → Real-name/Identity verification).

---

## 3. Enable Model Studio & note the free quota

1. On first visit, accept any prompt to **activate / enable Model Studio** for your account.
2. New accounts get a **free trial quota** (a batch of free tokens per model, valid for a limited
   window). That's plenty for this demo's embeddings + a few RAG queries.

> No need to pre-purchase anything. If you exhaust free quota you can enable pay-as-you-go later.

---

## 4. Create the API key

1. In the left sidebar, open **API Keys** (a.k.a. *API-Key* / *Key Management*).
2. Click **Create API Key** (top-right).
3. (Optional) add a description like `pulse-demo`.
4. Copy the key immediately — format `sk-xxxxxxxx...`. You can reopen the page later to copy it again.

→ `.env`: `DASHSCOPE_API_KEY`

> Store it in `.env` only — never commit it. Pulse's `.gitignore` already excludes `.env`.

---

## 5. Fill in `.env`

```bash
# ── Alibaba Cloud DashScope / Model Studio (LLM + embeddings) ──
DASHSCOPE_API_KEY=sk-your-real-key
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Embeddings — text-embedding-v3 maxes at 1024 dims; the schema is vector(1536),
# so Pulse defaults to text-embedding-v4 (which supports 1536). Leave as-is.
EMBED_MODEL=text-embedding-v4
EMBED_DIMENSIONS=1536

# LLM for RAG answers
LLM_MODEL=qwen-plus
```

Only `DASHSCOPE_API_KEY` is strictly required — the other three have these exact defaults baked
into the code, so you can omit them unless you want to change models.

### Models Pulse uses

| Purpose | Model | Notes |
|---------|-------|-------|
| Embeddings | `text-embedding-v4` | Supports 1536 dims (and 2048/1024/768/512/256/128/64) |
| RAG answers | `qwen-plus` | Good balance of cost/quality; `qwen-max` for higher quality |

> ### Why not `text-embedding-v3`?
>
> The original project notes said `text-embedding-v3` @ 1536 dims — but per Alibaba's current docs,
> **v3 only supports 1024 / 768 / 512**. Only **v4** supports 1536. To keep the `vector(1536)`
> schema, Pulse uses **v4**. If you'd rather use v3, set `EMBED_MODEL=text-embedding-v3` +
> `EMBED_DIMENSIONS=1024` **and** change `event_embeddings.embedding` to `vector(1024)` in
> `infra/postgres/init.sql` (then recreate the DB volume).

---

## 6. Verify the key

### Embeddings (what the embed worker uses)

```bash
curl -s https://dashscope-intl.aliyuncs.com/compatible-mode/v1/embeddings \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-v4","input":"pulse smoke test","dimensions":1536,"encoding_format":"float"}' \
  | head -c 200
# → {"object":"list","data":[{"object":"embedding","index":0,"embedding":[ ...
```

### Chat (what the RAG endpoint uses)

```bash
curl -s https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"Say hi in 3 words"}]}' \
  | head -c 300
```

### End-to-end through Pulse

With a real key set, restart the API and the embed worker will populate vectors automatically:

```bash
pnpm infra:up
pnpm dev:api
# create/update a task via the Board (or curl), then:
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U pulse -d pulse -c "SELECT content_text, (embedding IS NOT NULL) AS has_vec FROM event_embeddings ORDER BY created_at DESC LIMIT 5;"
# has_vec should now be 't'
```

Before a real key is set, the worker stores `content_text` with a **NULL embedding** (text-only)
and logs a warning — the pipeline still runs; vectors backfill on re-embed once the key works.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `401` / `Invalid API-key` | Key is from the wrong **region** (e.g. Beijing key on the intl endpoint) or has a typo. Recreate in Singapore. |
| `InvalidApiKey` but key looks right | Account **verification** not finished. Complete identity verification in the console. |
| `Model not found` / `model not exist` | Model name typo, or the model isn't enabled in your region. Use `qwen-plus` and `text-embedding-v4`. |
| Embeddings return 1024-length vectors | You set `EMBED_MODEL=text-embedding-v3` (caps at 1024). Switch to v4 for 1536, or change the schema. |
| `coding-intl` / `sk-sp-` errors | You created a **Coding Plan** key. Create a standard Model Studio key (`sk-...`) instead. |
| `404` on `/embeddings` or `/chat/completions` | `DASHSCOPE_BASE_URL` ends in `/api/v1` (native DashScope path). Change the suffix to `/compatible-mode/v1` on the same host. |
| Worker logs "DashScope disabled (no API key)" | `DASHSCOPE_API_KEY` is empty or still `sk-placeholder`. Set the real key and restart. |
| `429` / throttling | Free-quota rate limit or quota exhausted. Wait, or enable pay-as-you-go. |

---

## Teardown

After the demo:

1. **Model Studio → API Keys →** delete the `pulse-demo` key.
2. If you enabled pay-as-you-go, confirm there are no lingering charges in **Billing**.
3. Remove `DASHSCOPE_API_KEY` from any shared `.env`.
