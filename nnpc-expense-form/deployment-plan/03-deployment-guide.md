# Step-by-Step Deployment Guide

This guide assumes:
- Internal VPS running Linux (Ubuntu/Debian recommended)
- VPS is on the same internal network as `192.168.0.207` (SQL Server)
- Domain `nnpc.ai` is registered and you have DNS control
- You have SSH access to the VPS

---

## Phase 1: VPS Preparation

### 1.1 Install Docker & Docker Compose

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installations
docker --version          # Should be 24+
docker compose version    # Should be 2+

# Log out and back in for group changes to take effect
exit
ssh user@your-vps-ip
```

### 1.2 Install Cloudflare Tunnel Client

```bash
# Download and install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Verify
cloudflared version
```

### 1.3 Verify Database Connectivity

```bash
# Test that the VPS can reach the SQL Server
# Using netcat to check if port is open
nc -zv 192.168.0.207 1434
# Expected: "Connection to 192.168.0.207 1434 port [tcp/*] succeeded!"

# If nc is not installed:
sudo apt install netcat-openbsd -y
```

---

## Phase 2: DNS Setup

You have two options. Choose ONE.

### Option A: Transfer DNS to Cloudflare (Recommended)

**Step 1:** Create a free Cloudflare account at https://dash.cloudflare.com/sign-up

**Step 2:** Add your domain (`nnpc.ai`) to Cloudflare:
- In Cloudflare dashboard, click "Add a Site"
- Enter `nnpc.ai` and follow the wizard
- Cloudflare will scan existing DNS records and import them
- At the end, you'll get two nameserver addresses (e.g., `adam.ns.cloudflare.com`, `linda.ns.cloudflare.com`)

**Step 3:** At your current domain registrar, replace the nameservers with Cloudflare's:
- Log into your registrar (Namecheap, GoDaddy, etc.)
- Find DNS/Nameserver settings for `nnpc.ai`
- Replace existing nameservers with the ones Cloudflare provided
- Save changes

**Step 4:** Wait for DNS propagation (24-48 hours, but often much faster)

**Step 5:** Verify DNS is on Cloudflare:
```bash
dig ns nnpc.ai
# Should show Cloudflare nameservers
```

### Option B: Keep DNS at Current Registrar (Partial CNAME)

If you keep DNS at your current registrar, Cloudflare Tunnel works with a CNAME setup:

**Step 1:** Create a free Cloudflare account at https://dash.cloudflare.com/sign-up

**Step 2:** In Cloudflare, add your domain using "Partial (CNAME) setup":
- Add Site → enter `nnpc.ai`
- Choose "Free" plan
- When prompted, select "Partial setup" instead of full nameserver change

**Step 3:** Cloudflare will provide CNAME verification records. Add these at your current registrar.

**Step 4:** After the tunnel is created (in Phase 3), you'll add the tunnel CNAME record at your registrar:
```
expenseform.nnpc.ai  CNAME  <tunnel-uuid>.cfargotunnel.com
```

> With the free plan on partial CNAME setup, you won't get Cloudflare's CDN caching or DDoS protection — only the tunnel connectivity. For full protection, use Option A.

---

## Phase 3: Cloudflare Tunnel Setup

### 3.1 Authenticate cloudflared

```bash
# Run on the VPS
cloudflared tunnel login

# This will:
# 1. Open a URL in the terminal
# 2. Copy that URL, open in a browser
# 3. Log into Cloudflare
# 4. Select the domain (nnpc.ai)
# 5. Authorize the tunnel

# The certificate is saved to ~/.cloudflared/cert.pem
```

### 3.2 Create the Tunnel

```bash
# Create a named tunnel
cloudflared tunnel create nnpc-expense

# Output will show something like:
#   Created tunnel nnpc-expense with id 12345678-1234-1234-1234-123456789abc

# Note down the tunnel UUID — you'll need it for the config
```

This creates a credentials file at `~/.cloudflared/<tunnel-uuid>.json`.

### 3.3 Route DNS to the Tunnel

**If your DNS is on Cloudflare (Option A):**
```bash
# This automatically creates a CNAME record in Cloudflare DNS
cloudflared tunnel route dns nnpc-expense expenseform.nnpc.ai
```

**If your DNS is at another registrar (Option B):**
Skip this command. Instead, after creating the tunnel config, add this CNAME record at your registrar:
```
Type:   CNAME
Name:   expenseform
Value:  <tunnel-uuid>.cfargotunnel.com
TTL:    Auto
```

### 3.4 Verify Tunnel

```bash
# List tunnels
cloudflared tunnel list

# Should show:
#   nnpc-expense  <uuid>  (active status depends on whether it's running)
```

---

## Phase 4: Application Deployment

### 4.1 Clone the Repository on the VPS

```bash
# On the VPS
cd /opt  # Or wherever you want to deploy
git clone <your-git-repo-url> nnpc-expense-form
cd nnpc-expense-form/nnpc-expense-form
```

### 4.2 Create Environment File

```bash
# Generate a secure auth secret
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
echo "Generated secret: $BETTER_AUTH_SECRET"

# Create .env file
cat > .env << 'EOF'
DATABASE_URL="sqlserver://192.168.0.207:1434;database=nnpcexpenseDB;user=nnpc;password=nnpc@admin;trustServerCertificate=true"
BETTER_AUTH_SECRET="<paste-the-generated-secret-here>"
BETTER_AUTH_URL="https://expenseform.nnpc.ai"
EOF

# Replace the placeholder with the actual generated secret
# You can edit the file with:
nano .env
```

> **SECURITY:** Ensure `BETTER_AUTH_SECRET` is a strong random string. This is used to encrypt session tokens. If it changes, all users will be logged out.

### 4.3 Set Up Cloudflare Tunnel Credentials

```bash
# Create the cloudflared config directory
mkdir -p cloudflared

# Copy the tunnel credentials file
# Replace <tunnel-uuid> with the actual UUID from Phase 3 step 2
cp ~/.cloudflared/<tunnel-uuid>.json cloudflared/credentials.json

# Create the tunnel config file
# First, get your tunnel UUID
TUNNEL_ID=$(cloudflared tunnel list --output json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Tunnel ID: $TUNNEL_ID"

# Create config.yml
cat > cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: expenseform.nnpc.ai
    service: http://nginx:80
  - service: http_status:404
EOF
```

### 4.4 Create nginx Config Directory

```bash
mkdir -p nginx
```

Create `nginx/nginx.conf` with the content from the configuration document (`02-configuration.md`, section 6). You can copy it directly:

```bash
# Create the nginx config file
cat > nginx/nginx.conf << 'NGINXEOF'
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    access_log  /var/log/nginx/access.log;
    error_log   /var/log/nginx/error.log warn;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;

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

    upstream nextjs {
        server app:3000;
    }

    server {
        listen 80;
        server_name expenseform.nnpc.ai;

        client_max_body_size 20M;

        add_header X-Frame-Options         "SAMEORIGIN"   always;
        add_header X-Content-Type-Options  "nosniff"      always;
        add_header X-XSS-Protection        "1; mode=block" always;
        add_header Referrer-Policy         "strict-origin-when-cross-origin" always;

        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;

            proxy_set_header Host              \$host;
            proxy_set_header X-Real-IP         \$remote_addr;
            proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header X-Forwarded-Host  \$host;

            proxy_set_header Upgrade    \$http_upgrade;
            proxy_set_header Connection "upgrade";

            proxy_connect_timeout 60s;
            proxy_send_timeout    60s;
            proxy_read_timeout    60s;
        }

        location /_next/static {
            proxy_pass http://nextjs;
            proxy_cache_valid 200 1y;
            add_header Cache-Control "public, immutable, max-age=31536000";
        }

        location /public {
            proxy_pass http://nextjs;
            proxy_cache_valid 200 7d;
            add_header Cache-Control "public, max-age=604800";
        }
    }
}
NGINXEOF
```

### 4.5 Verify All Files Are in Place

```bash
# Check that everything is ready
ls -la

# You should see at minimum:
#   Dockerfile
#   docker-compose.yml
#   .dockerignore
#   .env
#   nginx/nginx.conf
#   cloudflared/config.yml
#   cloudflared/credentials.json
#   next.config.ts (contains output: "standalone")
```

### 4.6 Build and Start

```bash
# Build the app image and start all services
docker compose up -d --build

# This will:
# 1. Build the Dockerfile (npm ci → prisma generate → next build → copy to runtime)
# 2. Pull the nginx:alpine image
# 3. Pull the cloudflared image
# 4. Start all three containers

# Watch the logs to verify everything is working
docker compose logs -f
```

### 4.7 Verify Services Are Running

```bash
# Check container status
docker compose ps

# Expected output:
#   NAME                    STATUS
#   nnpc-expense-app        Up (healthy)
#   nnpc-expense-nginx      Up (healthy)
#   nnpc-expense-tunnel     Up

# Check individual logs
docker compose logs app        # Next.js startup logs
docker compose logs nginx      # nginx access/error logs
docker compose logs cloudflared # Tunnel connection logs
```

Look for these log lines to confirm success:

**app logs:** Should show Next.js starting on port 3000:
```
  ▲ Next.js 16.x.x
  - Local: http://localhost:3000
```

**nginx logs:** Should show it started and is ready for connections.

**cloudflared logs:** Should show the tunnel connected:
```
INF Registered tunnel connection
INF Connection <id> registered with protocol: quic
```

### 4.8 Test the Application

```bash
# Test nginx → app connectivity (run on VPS)
curl -I http://localhost:80
# Should return HTTP 200 with the app's HTML

# Test with host header to match your domain
curl -I -H "Host: expenseform.nnpc.ai" http://localhost:80
# Should also return HTTP 200
```

Then open `https://expenseform.nnpc.ai` in a browser. You should see the NNPC expense form login page.

---

## Phase 5: Verify & Troubleshoot

### 5.1 Verify SSL/TLS

When you visit `https://expenseform.nnpc.ai`, check that:
- The URL shows `https://` with a lock icon
- The certificate is issued by Cloudflare (click the lock → Certificate)
- The page loads without mixed content warnings

### 5.2 Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Cloudflared shows `ERR Unable to reach the origin service` | nginx or app not running, or wrong hostname in config | Check `docker compose ps`, verify nginx is up |
| `502 Bad Gateway` in nginx logs | App container not running or can't connect to port 3000 | `docker compose logs app` — check for startup errors |
| `ECONNREFUSED 192.168.0.207:1434` in app logs | VPS can't reach SQL Server | Verify network connectivity: `nc -zv 192.168.0.207 1434` |
| Tunnel connected but site doesn't load | DNS not propagated or CNAME missing | Check DNS: `dig expenseform.nnpc.ai` |
| Users get logged out after deploy | `BETTER_AUTH_SECRET` changed | Restore the previous secret value in `.env` |
| `PrismaClientInitializationError` | Prisma client not generated for production | Rebuild: `docker compose build app --no-cache` |

### 5.3 Restarting After Code Changes

```bash
# Pull latest code
git pull

# Rebuild and restart only the app (nginx and cloudflared unchanged)
docker compose build app --no-cache
docker compose up -d --remove-orphans

# If you also changed nginx config:
docker compose restart nginx

# If you also changed docker-compose.yml:
docker compose up -d --remove-orphans
```

### 5.4 Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f nginx
docker compose logs -f cloudflared

# Last 100 lines
docker compose logs --tail=100 app

# Timestamped logs from last 30 minutes
docker compose logs --since=30m
```

### 5.5 Stopping Everything

```bash
# Stop but don't remove containers
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and remove everything (including volumes)
docker compose down -v
```

---

## Phase 6: Maintenance

### 6.1 Updating Dependencies

When you update `package.json` dependencies:

```bash
# On your dev machine
npm install    # updates package-lock.json
git add package.json package-lock.json
git commit -m "chore: update dependencies"
git push

# On VPS
git pull
docker compose build app --no-cache
docker compose up -d
```

### 6.2 Database Migrations

Prisma migrations are applied manually. When you have schema changes:

```bash
# On dev machine, create migration
npx prisma migrate dev --name descriptive_name

# Commit the migration files
git add prisma/migrations/
git commit -m "feat: add xyz migration"
git push

# On VPS, apply migration
docker compose exec app npx prisma migrate deploy
```

### 6.3 Backup Considerations

Since the database is on a separate SQL Server at `192.168.0.207`, back it up at the SQL Server level:
- Use SQL Server's native backup tools
- The Docker containers are stateless — no data is stored in them
- Only config files (`.env`, `nginx.conf`, `cloudflared/config.yml`) need to be backed up

### 6.4 Updating cloudflared

```bash
# Pull the latest image and restart
docker compose pull cloudflared
docker compose up -d cloudflared
```

---

## Quick Reference: Commands

```bash
# Build and start everything
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# Restart app after code change
docker compose build app --no-cache && docker compose up -d

# Stop everything
docker compose down

# Apply database migration
docker compose exec app npx prisma migrate deploy

# Check tunnel status
docker compose logs cloudflared | grep INF
```

---

## Environment Variables Checklist

Before going live, verify all these are set correctly in `.env`:

| Variable | Set? | Value |
|---|---|---|
| `DATABASE_URL` | ☐ | `sqlserver://192.168.0.207:1434;database=nnpcexpenseDB;user=nnpc;password=<real_password>;trustServerCertificate=true` |
| `BETTER_AUTH_SECRET` | ☐ | Random 64-char hex string (from `openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | ☐ | `https://expenseform.nnpc.ai` |

---

## Firewall Reference

If the VPS has a firewall (ufw/iptables), ensure these OUTBOUND connections are allowed:

```bash
# Allow outbound to SQL Server
sudo ufw allow out to 192.168.0.207 port 1434 proto tcp

# Allow outbound HTTPS (for Docker pulls, cloudflared tunnel)
sudo ufw allow out 443/tcp
sudo ufw allow out 7844/udp  # cloudflared QUIC

# NO inbound ports need to be opened — the tunnel handles ingress
```

