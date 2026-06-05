# Step-by-Step Deployment Guide

This guide assumes:
- Internal VPS running Linux (Ubuntu/Debian recommended)
- VPS is on the same internal network as SQL Server
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

# Add your user to the docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installations
docker --version          # Should be 24+
docker compose version    # Should be 2+

# Log out and back in so group changes take effect
exit
ssh user@your-vps-ip
```

### 1.2 Install Cloudflare Tunnel Client

```bash
# Download and install cloudflared (needed for tunnel creation only)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Verify
cloudflared version
```

### 1.3 Verify Database Connectivity

```bash
# Test that the VPS can reach the SQL Server
nc -zv 192.168.0.207 1434
# Expected: "Connection to DB 1434 port [tcp/*] succeeded!"

# If nc is not installed:
sudo apt install netcat-openbsd -y
```

---

## Phase 2: DNS Setup

Choose ONE option.

### Option A: Transfer DNS to Cloudflare (Recommended)

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Add your domain (`nnpc.ai`): Dashboard → Add a Site → enter `nnpc.ai`
3. Cloudflare scans and imports existing DNS records
4. You'll get two nameserver addresses (e.g., `adam.ns.cloudflare.com`, `linda.ns.cloudflare.com`)
5. At your current registrar, replace the nameservers with Cloudflare's
6. Wait for propagation (often within an hour, can take up to 48)

Verify:
```bash
dig ns nnpc.ai
# Should show Cloudflare nameservers
```

### Option B: Keep DNS at Current Registrar (Partial CNAME)

1. Create a free Cloudflare account
2. Add domain → choose "Partial setup" when prompted
3. Add the verification CNAME records at your registrar
4. After tunnel creation, add this CNAME at your registrar:
   ```
   expenseform.nnpc.ai  CNAME  <tunnel-uuid>.cfargotunnel.com
   ```

---

## Phase 3: Cloudflare Tunnel Setup

### 3.1 Authenticate

```bash
cloudflared tunnel login

# This outputs a URL → open it in a browser
# Log into Cloudflare → select nnpc.ai → authorize
# Certificate saved to ~/.cloudflared/cert.pem
```

### 3.2 Create the Tunnel

```bash
cloudflared tunnel create nnpc-expense

# Output:
#   Created tunnel nnpc-expense with id 12345678-1234-1234-1234-123456789abc

# Remember the UUID — you'll need it for config.yml
```

The credentials file is saved at `~/.cloudflared/<tunnel-uuid>.json`.

### 3.3 Route DNS

**If DNS is on Cloudflare (Option A):**
```bash
cloudflared tunnel route dns nnpc-expense expenseform.nnpc.ai
# Automatically creates the CNAME record in Cloudflare DNS
```

**If DNS is at another registrar (Option B):**
Skip this command. After deployment, add manually at your registrar:
```
Type:   CNAME
Name:   expenseform
Value:  <tunnel-uuid>.cfargotunnel.com
```

### 3.4 Verify

```bash
cloudflared tunnel list
# Should show nnpc-expense with its UUID
```

---

## Phase 4: Application Deployment

### 4.1 Clone the Repository

```bash
cd /opt  # or preferred location
git clone <your-git-repo-url> nnpc-expense-form
cd nnpc-expense-form/nnpc-expense-form
```

### 4.2 Create Environment File

```bash
# Generate a secure auth secret
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
echo "Generated: $BETTER_AUTH_SECRET"

# Create .env
cat > .env << EOF
DATABASE_URL="sqlserver://ip;database=nnpcexpenseDB;user=nnpc;password=nnpc@admin;trustServerCertificate=true"
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}"
BETTER_AUTH_URL="https://expenseform.nnpc.ai"
EOF
```

> If `BETTER_AUTH_SECRET` changes after going live, all user sessions are invalidated.

### 4.3 Set Up Tunnel Credentials

```bash
mkdir -p cloudflared

# Copy the credentials file (replace <uuid> with actual)
cp ~/.cloudflared/<tunnel-uuid>.json cloudflared/credentials.json

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list --output json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Create config
cat > cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: expenseform.nnpc.ai
    service: http://app:3000
  - service: http_status:404
EOF
```

### 4.4 Verify Files Are in Place

```bash
ls -la

# Expected:
#   Dockerfile
#   docker-compose.yml
#   .dockerignore
#   .env
#   next.config.ts        (contains output: "standalone")
#   cloudflared/config.yml
#   cloudflared/credentials.json
```

### 4.5 Build and Start

```bash
docker compose up -d --build

# Watch logs
docker compose logs -f
```

You should see:
- **app:** `▲ Next.js 16.x.x` and `- Local: http://localhost:3000`
- **cloudflared:** `INF Registered tunnel connection` and `INF Connection <id> registered with protocol: quic`

### 4.6 Verify

```bash
# Check both containers are up
docker compose ps

# Expected:
#   nnpc-expense-app       Up (healthy)
#   nnpc-expense-tunnel    Up
```

Then visit `https://expenseform.nnpc.ai` — you should see the NNPC expense form login page.

---

## Phase 5: Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Tunnel shows `ERR Unable to reach the origin service` | App container not running or cloudflared can't resolve `app:3000` | `docker compose ps` — check app is Up. Verify both on same Docker network. |
| `ECONNREFUSED ip` in app logs | VPS can't reach SQL Server | `nc -zv ip` from VPS |
| Site loads without styles/JS | Static files not copied correctly | Verify `COPY .next/static ./.next/static` in Dockerfile, rebuild |
| Users logged out after deploy | `BETTER_AUTH_SECRET` changed | Restore previous secret value |
| `PrismaClientInitializationError` | Prisma client not generated or wrong arch | Add `npx prisma generate` in build stage, rebuild |
| Site doesn't load at all | DNS not propagated | `dig expenseform.nnpc.ai` |

### Logs

```bash
docker compose logs -f                  # All services
docker compose logs -f app              # Just Next.js
docker compose logs -f cloudflared      # Just tunnel
docker compose logs --tail=100 app      # Last 100 lines
```

### Restart After Code Changes

```bash
git pull
docker compose build app --no-cache
docker compose up -d --remove-orphans
```

### Stop Everything

```bash
docker compose down        # Stops and removes containers
docker compose down -v     # Also removes volumes
```

---

## Phase 6: Maintenance

### Updating Dependencies

```bash
# Dev machine: update package.json
npm install
git add package.json package-lock.json
git commit -m "chore: update dependencies"
git push

# VPS
git pull
docker compose build app --no-cache
docker compose up -d
```

### Database Migrations

```bash
# Dev machine: create migration
npx prisma migrate dev --name descriptive_name
git add prisma/migrations/
git commit -m "feat: migration for xyz"
git push

# VPS: apply migration
docker compose exec app npx prisma migrate deploy
```

### Updating cloudflared

```bash
docker compose pull cloudflared
docker compose up -d cloudflared
```

### Backups

The database is on a separate SQL Server at `ip` — back it up using SQL Server's native tools. Docker containers are stateless; only these files on the VPS need backup:
- `.env`
- `cloudflared/config.yml`
- `cloudflared/credentials.json`

---

## Quick Reference

```bash
# Build and start
docker compose up -d --build

# Status
docker compose ps

# Logs
docker compose logs -f

# Restart app after code change
git pull && docker compose build app --no-cache && docker compose up -d

# Stop
docker compose down

# DB migration
docker compose exec app npx prisma migrate deploy

# Tunnel status
docker compose logs cloudflared | grep INF
```

---

## Environment Checklist

Before going live:

| Variable | ☐ | Value |
|---|---|---|
| `DATABASE_URL` | ☐ | `sqlserver://ip;database=nnpcexpenseDB;user=nnpc;password=<real>;trustServerCertificate=true` |
| `BETTER_AUTH_SECRET` | ☐ | 64-char hex (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | ☐ | `https://expenseform.nnpc.ai` |

---

## Firewall (if VPS has ufw/iptables)

```bash
# OUTBOUND only — no inbound ports needed
sudo ufw allow out to ip port 1434 proto tcp   # SQL Server
sudo ufw allow out 443/tcp                                  # Cloudflare tunnel fallback
sudo ufw allow out 7844/udp                                # Cloudflare tunnel QUIC
```

