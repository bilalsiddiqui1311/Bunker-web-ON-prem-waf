# Deployment Guide

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain: `bunkerweb.we-are-asap.com` (DNS already configured)
- Let's Encrypt email address

## Deploy to Production

### 1. Clone Repository

```bash
git clone <your-github-repo> bunkerweb-fresh
cd bunkerweb-fresh
```

### 2. Create .env File

```bash
cp .env.example .env
nano .env
```

Update only the email:
```
LE_EMAIL=your-email@example.com
```

(Domain and LE_STAGING are already set for production)

### 3. Set Permissions

```bash
sudo chown -R 101:101 bw-data
sudo chmod -R u=rwx,g=rwx,o= bw-data
```

### 4. Start Services

```bash
docker compose up -d
```

### 5. Monitor Certificate Issuance

```bash
docker compose logs -f bw-scheduler
```

Wait for:
```
[bw-scheduler] Certs created or already exist
```

This takes 1-2 minutes.

### 6. Verify WAF is Working

```bash
# Check certificate is valid (Let's Encrypt real cert)
curl -v https://bunkerweb.we-are-asap.com/ 2>&1 | grep -iE "subject:|issuer:"

# Test WAF blocks SQL injection attempt
curl -s -A "if(now()=sysdate(),sleep(15),0)" https://bunkerweb.we-are-asap.com/ \
  -o /dev/null -w "Status: %{http_code}\n"
```

Expected results:
- First command: Shows "Let's Encrypt Authority X3" (real certificate, not staging)
- Second command: Returns `403` (WAF blocking the malicious payload)

### 7. All Done! ✅

Your WAF is now live and protecting `bunkerweb.we-are-asap.com`.

## Attach Your Backend Application

Once verified, point to your real application:

**Option A: Environment Variable (Simpler)**

```bash
# Add to .env
REVERSE_PROXY_HOST=http://your-app-server:8000
```

Then restart:
```bash
docker compose up -d
```

**Option B: Edit docker-compose.yml**

```yaml
services:
  bunkerweb:
    environment:
      REVERSE_PROXY_HOST: "http://your-app:8000"
```

Then restart:
```bash
docker compose up -d
```

## Monitoring

### Check Status

```bash
docker compose ps
```

### View Logs

```bash
# All services
docker compose logs -f

# Just BunkerWeb
docker compose logs -f bunkerweb

# Just Scheduler (certificates, config)
docker compose logs -f bw-scheduler
```

### Check for Blocked Requests

```bash
docker compose logs bunkerweb | grep "403"
```

## Troubleshooting

### Permission Denied Error

If you see `Permission denied: '/data/configs/http'`:

```bash
docker compose down
sudo chown -R 101:101 bw-data
sudo chmod -R u=rwx,g=rwx,o= bw-data
docker compose up -d
```

The nginx user inside the container needs to own the `bw-data` directory (uid 101), not root.

### Certificate Not Issued

```bash
docker compose logs bw-scheduler | grep -iE "error|acme"
```

Common causes:
- **API whitelist not configured** - BunkerWeb API blocks scheduler communication
  - Fix: Ensure `docker-compose.yml` has `API_WHITELIST_IP: "172.18.0.0/16"` in both bunkerweb and bw-scheduler services
  - Error message: "IP is not in API_WHITELIST_IP"
- DNS not propagating (wait a few minutes)
- Email already used with Let's Encrypt (use different email)
- Port 80 or 443 not accessible from internet

### WAF Not Blocking

```bash
docker compose exec bunkerweb nginx -t
```

This tests the Nginx config. If there are errors, they'll appear here.

### Can't Reach Domain

```bash
# Verify DNS
nslookup bunkerweb.we-are-asap.com

# Check open ports
sudo netstat -tlnp | grep -E ":(80|443)"
```

## Maintenance

### View System Health

```bash
# Check all services are running
docker compose ps

# Check disk usage
du -sh bw-data/

# Check logs for errors
docker compose logs | grep -i error
```

### Update to Latest Image

```bash
docker compose pull
docker compose up -d
```

### Restart Services

```bash
docker compose restart
```

### Stop Everything

```bash
docker compose down
```

## Security Notes

- ✅ `.env` is in `.gitignore` - secrets not committed to git
- ✅ Let's Encrypt certificates auto-renew
- ✅ ModSecurity WAF blocks common attacks
- ✅ All traffic goes through reverse proxy
- 🔒 Keep docker secrets safe (LE_EMAIL in .env)

## Support

See `README.md` for:
- Configuration options
- Adding custom WAF rules
- Common commands
- References and links
