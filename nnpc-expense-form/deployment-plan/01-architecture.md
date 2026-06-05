# Architecture & Deployment Overview

## Application Summary

| Aspect | Detail |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Database** | Microsoft SQL Server  |
| **ORM** | Prisma + @prisma/adapter-mssql |
| **Auth** | better-auth (email/password, MSSQL Kysely dialect) |
| **UI** | shadcn/ui + Tailwind CSS v4 |
| **Current Access** | Internal network only (onsite WiFi / VPN) |
| **Goal** | Public access via `expenseform.nnpc.ai` |

---

## Deployment Architecture

```
                          PUBLIC INTERNET
                               │
                    ┌──────────┴──────────┐
                    │   Cloudflare CDN    │
                    │  (SSL termination,  │
                    │   DDoS protection,  │
                    │   gzip compression) │
                    └──────────┬──────────┘
                               │  encrypted tunnel (QUIC)
                               │
                    ┌──────────┴──────────┐
                    │   cloudflared       │  ◄── Docker container
                    │   (reverse tunnel)  │
                    └──────────┬──────────┘
                               │
═══════════════════ INTERNAL NETWORK ═══════════════════
                               │
                    ┌──────────┴──────────┐
                    │   Next.js App       │  ◄── Docker container, port 3000
                    │   (standalone mode) │
                    └──────────┬──────────┘
                               │  sqlserver:// (TDS)
                    ┌──────────┴──────────┐
                    │   SQL Server        │  ◄── Bare metal / VM on network
                    │   192.168.0.207     │
                    └─────────────────────┘
```

### Request Flow

```
1. User opens https://expenseform.nnpc.ai
2. DNS resolves to Cloudflare edge (nearest data center)
3. Cloudflare terminates TLS, applies gzip, adds security headers
4. Cloudflare forwards through QUIC tunnel to cloudflared on VPS
5. cloudflared forwards to app:3000 (Next.js production server)
6. Next.js reads/writes SQL Server
   - better-auth: Tarn.js connection pool (max 10)
   - Prisma: adapter-managed connection pooling
7. Response flows back through the same path
```

---

## Why No nginx?

In this setup, nginx would be redundant because Cloudflare already provides:

| Concern | Handled By |
|---|---|
| SSL/TLS termination | Cloudflare at edge |
| Gzip/Brotli compression | Cloudflare at edge |
| Security headers | Cloudflare Transform Rules or `next.config.ts` |
| Static asset caching | `/_next/static` has immutable content hashes + Cloudflare CDN |
| DDoS protection | Cloudflare |
| HTTP server quality | Next.js standalone server (production-grade, not dev mode) |

Adding nginx would mean an extra service to build, configure, monitor, and debug — with no benefit for a single-app deployment.

---

## Why No Load Balancer?

Single Next.js container on a single VPS. No benefit. If you ever need horizontal scaling:
```bash
docker compose up -d --scale app=3
```
Docker's internal DNS round-robins across replicas. Add that when you need it.

---

## Why No Connection Pooler?

Both database access layers already manage their own pools:

| Layer | Pooling Mechanism |
|---|---|
| better-auth (Kysely) | Tarn.js — max 10 connections (`lib/auth.ts`) |
| Prisma (app data) | Adapter-managed pool via `@prisma/adapter-mssql` |

A separate pooler like PgBouncer or RDS Proxy would only add latency and another service to manage.

---

## Network Requirements

| Source | Destination | Protocol | Port | Required |
|---|---|---|---|---|
| VPS (Docker) | SQL Server | TDS | 1434 | Yes — DB queries |
| VPS (Docker) | Cloudflare edge | QUIC | 7844 | Yes — tunnel outbound |
| VPS (Docker) | Cloudflare edge | HTTPS (fallback) | 443 | Yes — tunnel outbound |
| Public internet | VPS | — | — | **None** — tunnel is outbound only |

---

## Domain & DNS

- **Domain:** `nnpc.ai`
- **Subdomain for app:** `expenseform.nnpc.ai`
- **Current registrar:** Not Cloudflare

Two options for DNS:

1. **Transfer DNS to Cloudflare** (recommended) — change nameservers at your registrar to Cloudflare's. Free. Takes 24-48 hours to propagate. Then `cloudflared tunnel route dns` works automatically.

2. **Partial CNAME setup** — keep DNS at current registrar. Manually add a CNAME record at your registrar:
   ```
   expenseform.nnpc.ai  CNAME  <tunnel-uuid>.cfargotunnel.com
   ```

