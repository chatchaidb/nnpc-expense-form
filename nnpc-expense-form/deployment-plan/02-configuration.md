# Configuration Files

All configuration files needed for production deployment.

---

## 1. `next.config.ts` — Enable Standalone Output

**File:** `nnpc-expense-form/next.config.ts` (modify existing)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        destination: "/dashboard",
        permanent: false,
        source: "/",
      },
    ];
  },
};

export default nextConfig;
```

`output: "standalone"` tells Next.js to produce an optimized production build with a pruned `node_modules` and a self-contained `server.js` entry point under `.next/standalone/`.

---

## 2. `.env.example` — Environment Variables Template

**File:** `nnpc-expense-form/.env.example` (new)

```env
# Database connection (SQL Server)
# Format: sqlserver://<host>:<port>;database=<db>;user=<user>;password=<pass>;trustServerCertificate=true
DATABASE_URL="sqlserver://192.168.0.207:1434;database=nnpcexpenseDB;user=nnpc;password=YOUR_PASSWORD;trustServerCertificate=true"

# Auth secret for better-auth session encryption
# Generate with: openssl rand -hex 32
BETTER_AUTH_SECRET="change-me-to-a-random-64-character-hex-string"

# Base URL of the deployed application (used by auth for callback URLs)
BETTER_AUTH_URL="https://expenseform.nnpc.ai"
```

---

## 3. `.dockerignore` — Exclude Unnecessary Files

**File:** `nnpc-expense-form/.dockerignore` (new)

```
Dockerfile
.dockerignore
.git
.gitignore
*.md
README.md
LICENSE
.vscode
.idea
node_modules
.next
out
dist
.env
.env.*
coverage
.DS_Store
Thumbs.db
deployment-plan
docker-compose.yml
supabase
docs
```

---

## 4. `Dockerfile` — Multi-Stage Production Build

**File:** `nnpc-expense-form/Dockerfile` (new)

```dockerfile
# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
RUN npm run build

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

> If the app doesn't have a `/api/health` route, remove or adjust the `HEALTHCHECK` directive. You can add one at `app/api/health/route.ts`:
> ```ts
> import { NextResponse } from "next/server";
> export async function GET() {
>   return NextResponse.json({ status: "ok" });
> }
> ```

---

## 5. `docker-compose.yml` — Service Orchestration

**File:** `nnpc-expense-form/docker-compose.yml` (new)

```yaml
version: "3.8"

services:
  # ===========================================================================
  # Next.js Application
  # ===========================================================================
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nnpc-expense-app
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - internal

  # ===========================================================================
  # Cloudflare Tunnel
  # ===========================================================================
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: nnpc-expense-tunnel
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared/config.yml:/etc/cloudflared/config.yml:ro
      - ./cloudflared/credentials.json:/etc/cloudflared/credentials.json:ro
    networks:
      - internal
    depends_on:
      - app

networks:
  internal:
    driver: bridge
```

**Key points:**
- Only 2 services — `app` and `cloudflared`
- No ports exposed to host. Cloudflared → `app:3000` happens entirely on the Docker bridge network.
- If you ever need to debug without the tunnel, add temporarily: `ports: ["3000:3000"]` to the `app` service.

---

## 6. `cloudflared/config.yml` — Tunnel Configuration

**File:** `nnpc-expense-form/cloudflared/config.yml` (new, create after tunnel setup)

```yaml
# Replace <tunnel-id> with the UUID from `cloudflared tunnel create`
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/credentials.json

ingress:
  # Route this hostname directly to the Next.js app
  - hostname: expenseform.nnpc.ai
    service: http://app:3000

  # Catch-all: return 404 for any other hostname
  - service: http_status:404
```

**How to get the tunnel ID:**
Run `cloudflared tunnel create nnpc-expense` — the output includes a UUID. Copy the credentials from `~/.cloudflared/<uuid>.json` to `./cloudflared/credentials.json`.

---

## 7. `deploy.sh` — Deployment Script (Optional)

**File:** `nnpc-expense-form/deploy.sh` (new, optional helper)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Pulling latest changes ==="
git pull origin main

echo "=== Building and restarting ==="
docker compose build app --no-cache
docker compose up -d --remove-orphans

echo "=== Checking status ==="
docker compose ps

echo "=== Done ==="
```

```bash
chmod +x deploy.sh
```

---

## File Summary

```
nnpc-expense-form/
├── deployment-plan/           # Documentation
│   ├── 01-architecture.md
│   ├── 02-configuration.md
│   └── 03-deployment-guide.md
│
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # 2 services: app + cloudflared
├── .dockerignore
├── .env.example               # Template
├── .env                       # Actual values (gitignored)
│
├── cloudflared/
│   ├── config.yml             # Tunnel config → app:3000
│   └── credentials.json       # Tunnel credentials
│
├── next.config.ts             # output: "standalone"
│
└── (rest of project)
```

