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

`output: "standalone"` tells Next.js to produce an optimized production build containing only the files and dependencies needed to run. The output is a self-contained directory under `.next/standalone/` with its own pruned `node_modules` and an entry `server.js`.

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

**Important:** The actual `.env` file should NEVER be committed to git. Create it manually on the VPS with real values. The `BETTER_AUTH_SECRET` must be the same across deployments or all user sessions will be invalidated.

---

## 3. `.dockerignore` — Exclude Unnecessary Files

**File:** `nnpc-expense-form/.dockerignore` (new)

```
Dockerfile
.dockerignore
.git
.gitignore
.gitattributes
*.md
README.md
LICENSE
.vscode
.idea

# Dependencies
node_modules
.pnp
.pnp.js

# Build output
.next
out
dist

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage
.nyc_output

# OS files
.DS_Store
Thumbs.db

# Deployment
deployment-plan
docker-compose.yml
nginx

# Supabase (legacy, not needed in production)
supabase

# Docs
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

# Enable corepack if using pnpm/yarn (not needed for npm)
# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy prisma schema and config before source code for layer caching
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application source
COPY . .

# Build the Next.js application in standalone mode
RUN npm run build

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files (these are separate from standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy prisma schema and generated client for runtime (needed for Prisma queries)
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

**Layer caching strategy:**
1. `package.json` / `package-lock.json` copied first — only invalidates when dependencies change
2. `prisma/` and `prisma.config.ts` copied before source code — schema changes trigger rebuild
3. Application source copied last — most frequent changes only rebuild this layer

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
    # Port not exposed to host — only nginx can reach it
    # If you need to debug without nginx, uncomment:
    # ports:
    #   - "3000:3000"

  # ===========================================================================
  # nginx Reverse Proxy
  # ===========================================================================
  nginx:
    image: nginx:1.27-alpine
    container_name: nnpc-expense-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      # Port 443 is NOT needed — Cloudflare handles TLS termination
      # The tunnel connects to nginx on port 80 internally
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - internal
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ===========================================================================
  # Cloudflare Tunnel
  # ===========================================================================
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: nnpc-expense-tunnel
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      # Config file (created manually)
      - ./cloudflared/config.yml:/etc/cloudflared/config.yml:ro
      # Credentials file (generated by `cloudflared tunnel create`)
      - ./cloudflared/credentials.json:/etc/cloudflared/credentials.json:ro
    networks:
      - internal
    depends_on:
      - nginx

networks:
  internal:
    driver: bridge
```

**Key points:**
- The `app` service does NOT expose ports to the host — only nginx can reach it on the Docker network
- Port 80 is exposed on the host for nginx, but this is only accessible from within the Docker network. The host itself doesn't need to expose 80 to the internet because cloudflared connects internally.
- Cloudflared forwards traffic to `nginx:80` (Docker DNS resolves this to the nginx container's IP)
- All three services share the `internal` bridge network

---

## 6. `nginx/nginx.conf` — Reverse Proxy Configuration

**File:** `nnpc-expense-form/nginx/nginx.conf` (new)

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # =========================================================================
    # Logging
    # =========================================================================
    access_log  /var/log/nginx/access.log;
    error_log   /var/log/nginx/error.log warn;

    # =========================================================================
    # Performance
    # =========================================================================
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;

    # =========================================================================
    # Gzip Compression
    # =========================================================================
    gzip              on;
    gzip_vary         on;
    gzip_proxied      any;
    gzip_comp_level   6;
    gzip_min_length   256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/x-javascript
        image/svg+xml
        font/woff2;

    # =========================================================================
    # Upstream: Next.js App
    # =========================================================================
    upstream nextjs {
        server app:3000;
    }

    # =========================================================================
    # Server Block
    # =========================================================================
    server {
        listen 80;
        server_name expenseform.nnpc.ai;

        # Allow large file uploads (receipt images, etc.)
        client_max_body_size 20M;

        # =====================================================================
        # Security Headers
        # =====================================================================
        add_header X-Frame-Options         "SAMEORIGIN"   always;
        add_header X-Content-Type-Options  "nosniff"      always;
        add_header X-XSS-Protection        "1; mode=block" always;
        add_header Referrer-Policy         "strict-origin-when-cross-origin" always;

        # =====================================================================
        # Proxy to Next.js
        # =====================================================================
        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;

            # Headers for the upstream app
            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host  $host;

            # WebSocket support (Next.js uses WebSockets for HMR in dev,
            # and cloudflared uses them for tunnel communication)
            proxy_set_header Upgrade    $http_upgrade;
            proxy_set_header Connection "upgrade";

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout    60s;
            proxy_read_timeout    60s;
        }

        # =====================================================================
        # Static Assets — Longer Cache
        # =====================================================================
        location /_next/static {
            proxy_pass http://nextjs;
            proxy_cache_valid 200 1y;
            add_header Cache-Control "public, immutable, max-age=31536000";
        }

        # =====================================================================
        # Public Assets
        # =====================================================================
        location /public {
            proxy_pass http://nextjs;
            proxy_cache_valid 200 7d;
            add_header Cache-Control "public, max-age=604800";
        }
    }
}
```

**Notes:**
- `server_name` should match your actual domain
- `client_max_body_size: 20M` allows uploading receipt images
- Static assets under `/_next/static` are cached for 1 year (they have content hashes)
- WebSocket headers support both Next.js HMR and cloudflared tunnel communication

---

## 7. `cloudflared/config.yml` — Tunnel Configuration

**File:** `nnpc-expense-form/cloudflared/config.yml` (new, create after tunnel setup)

```yaml
# Replace <tunnel-id> with the UUID from `cloudflared tunnel create`
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/credentials.json

# Routing rules
ingress:
  # Route this hostname to the nginx container
  - hostname: expenseform.nnpc.ai
    service: http://nginx:80

  # Catch-all: return 404 for any other hostname
  - service: http_status:404
```

**How to get the tunnel ID:**
After running `cloudflared tunnel create nnpc-expense`, the output will show a UUID. Use that UUID as the `tunnel` value. The credentials file will be at `~/.cloudflared/<uuid>.json` — copy it to `./cloudflared/credentials.json`.

---

## 8. `deploy.sh` — Deployment Script (Optional)

**File:** `nnpc-expense-form/deploy.sh` (new, optional helper)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Pulling latest changes ==="
git pull origin main

echo "=== Building and restarting app ==="
docker compose build app --no-cache
docker compose up -d --remove-orphans

echo "=== Checking status ==="
docker compose ps

echo "=== Done ==="
echo "Check logs with: docker compose logs -f"
```

```bash
chmod +x deploy.sh
```

---

## File Summary

After setting up all files, your project structure should look like:

```
nnpc-expense-form/
├── deployment-plan/           # These documentation files
│   ├── 01-architecture.md
│   ├── 02-configuration.md
│   └── 03-deployment-guide.md
│
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # 3 services: app, nginx, cloudflared
├── .dockerignore              # Exclude unnecessary files from build context
├── .env.example               # Environment variables template
├── .env                       # ACTUAL env vars (gitignored, create manually)
│
├── nginx/
│   └── nginx.conf             # Reverse proxy config
│
├── cloudflared/
│   ├── config.yml             # Tunnel config (create after tunnel setup)
│   └── credentials.json       # Tunnel credentials (generated by cloudflared)
│
├── next.config.ts             # Modified: added output: "standalone"
│
└── (rest of existing project files)
```

