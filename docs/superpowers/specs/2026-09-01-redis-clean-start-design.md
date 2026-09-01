# Redis clean start

Date: 2026-09-01
Status: approved

## Goal

`npm run dev` starts on port 5000 without Redis connection errors. The current `.env` `REDIS_URL` is a token, not a Redis URL, so Redis must stay off until a real `redis://` or `rediss://` URL is provided.

Success: server listens on 5000; no `ENOTFOUND`; no `express-rate-limit` Redis store init error.

## Out of scope

- Installing or hosting a Redis server
- Swagger / OpenAPI
- Other modules (auth, catalog, cart, payments)

## Approach

A: comment out `REDIS_URL` in `.env`, and keep URL-shape validation in code so a future valid URL reconnects without another code change.

## Config

In `.env`, comment out the `REDIS_URL` line. Leave the Redis section header so it is obvious where to put a real URL later.

Example:

```
# REDIS_URL=
```

`env.ts` already treats `REDIS_URL` as optional. No schema change.

## Redis client (`src/lib/redis.ts`)

- Treat a value as a Redis URL only if it starts with `redis://` or `rediss://`.
- Missing or invalid URL: do not construct an ioredis client; export `redis = null`.
- If a non-empty invalid URL is present, log one warn: Redis disabled because the URL is not `redis://` / `rediss://`.
- If `REDIS_URL` is unset or commented out, create no client and do not warn.
- `redisGet` / `redisSet`: no-op when `redis` is null (return `null` / return).
- Do not default to `redis://127.0.0.1:6379` (that caused `ECONNREFUSED` spam).

This logic already exists in the working tree and stays.

## AI rate limiter (`src/common/middleware/rate-limit.middleware.ts`)

- If `redis` is non-null: use `RedisStore` with `passOnStoreError: true`.
- If `redis` is null: omit `store` (in-memory, 5 requests / 60s, keyed by user id or IP via `ipKeyGenerator`).
- Other limiters stay in-memory as they already are.

This conditional store already exists in the working tree and stays.

## Error handling

| Case | Behavior |
| --- | --- |
| `REDIS_URL` commented / missing | No Redis client, no Redis logs, in-memory AI limiter |
| Invalid `REDIS_URL` (token / host string) | No client, one warn, in-memory AI limiter |
| Valid URL but Redis down | Client may exist; `passOnStoreError` lets requests through; get/set warn and degrade |
| Valid URL and Redis up | Cache + Redis-backed AI limiter |

AI chat still returns the Bengali fallback when Gemini is unset. Product-context Redis cache simply misses.

## Verification

1. Comment out `REDIS_URL` in `.env`.
2. Stop any old `tsx watch` process.
3. Run `npm run dev`.
4. Expect: `Server running on port 5000`.
5. Expect not: `ENOTFOUND`, `Stream isn't writeable`, Redis store init error.
6. Optional: `GET /health` returns 200.

## Follow-up (not this change)

To enable Redis later, set `REDIS_URL=redis://...` or `rediss://...` and restart. No code change required.
