# Architecture & Deployment Overview

## Application Summary

| Aspect | Detail |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Database** | Microsoft SQL Server (`192.168.0.207:1434`) |
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
                    │   DDoS protection)  │
                    └──────────┬──────────┘
                               │  encrypted tunnel (QUIC)
                               │
                    ┌──────────┴──────────┐
                    │   cloudflared       │  ◄── Docker container on VPS
                    │   (reverse tunnel)  │
                    └──────────┬──────────┘
                               │
═══════════════════ INTERNAL NETWORK ═══════════════════
                               │
                    ┌──────────┴──────────┐
                    │      nginx          │  ◄── Docker container, port 80
                    │   (reverse proxy)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Next.js App       │  ◄── Docker container, port 3000
                    │   (production)      │
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
3. Cloudflare terminates TLS, forwards through QUIC tunnel
4. cloudflared on VPS receives request, forwards to nginx:80
5. nginx proxies to app:3000 (Next.js server)
6. Next.js reads/writes SQL Server @ 192.168.0.207:1434
7. Response flows back through the same path
```

---

## Component Roles

### Cloudflare Tunnel (cloudflared)

- **Purpose:** Exposes the internal app to the public internet without opening firewall ports
- **How it works:** An outbound-only connection from VPS to Cloudflare's edge. Cloudflare then routes incoming HTTPS traffic through this tunnel.
- **No inbound ports needed** — no port forwarding, no firewall rule changes
- **Free tier** is sufficient for this workload

### nginx (Reverse Proxy)

- **Purpose:** Production-grade HTTP reverse proxy in front of Next.js
- **Features:**
  - Gzip compression (reduces bandwidth)
  - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
  - Static asset caching
  - WebSocket upgrade support
  - Request buffering and timeout handling

### Next.js App (Docker Container)

- **Purpose:** Serves the Next.js application in production mode
- **Mode:** `output: 'standalone'` — produces a minimal production build with only required dependencies
- **Environment:** Connects to SQL Server via `DATABASE_URL`

### SQL Server

- **Location:** Internal network at `192.168.0.207:1434`
- **Access:** The VPS is on the same internal network and can reach the database directly
- **No changes needed** to the database for this deployment

---

## Why Cloudflare Tunnel (Instead of Alternatives)

| Approach | Pros | Cons |
|---|---|---|
| **Cloudflare Tunnel** (chosen) | No open ports, free SSL, DDoS protection, simple | Requires Cloudflare account |
| Direct port forwarding | No dependency | Security risk, manual SSL management, firewall config needed |
| Reverse proxy on VPS only | Full control | Need public IP, manage SSL certs, configure firewall |
| VPN to external VPS | Full control | VPN overhead, additional latency, complex setup |

---

## Network Requirements

| Source | Destination | Protocol | Port | Required |
|---|---|---|---|---|
| VPS (Docker) | SQL Server (`192.168.0.207`) | TDS (SQL Server) | 1434 | Yes — DB queries |
| VPS (Docker) | Cloudflare edge | HTTPS (QUIC) | 7844 | Yes — tunnel outbound |
| VPS (Docker) | Cloudflare edge | HTTPS (fallback) | 443 | Yes — tunnel outbound |
| Public internet | VPS | — | — | **None** — tunnel is outbound only |

> The only outbound requirements from the VPS are reaching the internal SQL Server and Cloudflare's edge. No inbound ports need to be opened.

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
   Requires Cloudflare Business plan if you want full CDN/proxy benefits. With free plan you still get tunnel connectivity, just without the CDN caching layer.

