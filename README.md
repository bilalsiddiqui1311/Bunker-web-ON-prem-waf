# BunkerWeb + ModSecurity WAF

Production-ready Docker Compose setup for BunkerWeb reverse proxy with ModSecurity WAF protection.

**Domain:** `bunkerweb.we-are-asap.com`  
**Status:** Production (real Let's Encrypt certificates)

## Components

- **BunkerWeb** - Reverse proxy, TLS/HTTPS, WAF framework
- **ModSecurity** - Web Application Firewall with built-in rules
- **Nginx** - Backend application server

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/bilalsiddiqui1311/Bunker-web-ON-prem-waf.git
cd Bunker-web-ON-prem-waf
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

**Update** `LE_EMAIL` with your email address.

(Domain and LE_STAGING are already set for production)

### 3. Prepare Permissions

```bash
sudo chown -R 101:101 bw-data
sudo chmod -R u=rwx,g=rwx,o= bw-data
```

### 4. Launch

```bash
docker compose up -d
docker compose logs -f bw-scheduler
```

Wait for message: `Certs created or already exist`

### 5. Verify

```bash
# Check HTTPS works with real certificate
curl -v https://bunkerweb.we-are-asap.com/ 2>&1 | grep -iE "subject:|issuer:"
# Should show "Let's Encrypt Authority X3" (real cert, not staging)

# Test WAF blocks attacks
curl -s -A "if(now()=sysdate(),sleep(15),0)" https://bunkerweb.we-are-asap.com/ \
  -o /dev/null -w "Status: %{http_code}\n"
# Should return 403 Forbidden
```

✅ WAF is now live and protecting your domain.

## Configuration

### ModSecurity Rules

**Global rules** (all traffic):
```
bw-data/configs/modsec/1000-1099-global-core.conf
```

**Domain-specific rules** (add to `bw-data/configs/modsec/`):
```bash
mkdir -p bw-data/configs/modsec/bunkerweb.we-are-asap.com
```

Rule ID ranges:
- `1000-1099` - Global (all domains)
- `2000-2099` - Domain-specific

Never reuse IDs.

### Add a Custom Rule

Block requests with specific User-Agent:

```bash
cat > bw-data/configs/modsec/2000-custom.conf << 'EOF'
SecRule REQUEST_HEADERS:User-Agent "@contains badbot" \
  "id:2001,phase:1,deny,status:403,log,msg:'Blocked: BadBot'"
EOF

docker compose up -d
docker compose logs -f bw-scheduler
```

## Attach Backend Application

Update `docker-compose.yml`:

```yaml
services:
  bunkerweb:
    environment:
      REVERSE_PROXY_HOST: "http://your-app:8000"  # Change this
```

Or use environment variable in `.env`:
```bash
# Add to .env
REVERSE_PROXY_HOST=http://your-app:8000
```

Then restart:
```bash
docker compose up -d
curl https://bunkerweb.we-are-asap.com/  # Now hits your app
```

## Monitoring

### Check Services Running

```bash
docker compose ps
```

### View Logs

```bash
docker compose logs -f                   # All services
docker compose logs -f bunkerweb         # Main proxy logs
docker compose logs -f bw-scheduler      # Certificate management
```

### Check for Blocked Requests

```bash
docker compose logs bunkerweb | grep "403\|denied"
```

## Useful Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart a service
docker compose restart bunkerweb

# Test Nginx config
docker compose exec bunkerweb nginx -t

# View real-time logs
docker compose logs -f

# Access container shell
docker compose exec bunkerweb sh
```

## Troubleshooting

### Permission Errors

If you see `Permission denied: '/data/configs/http'`:

```bash
docker compose down
sudo chown -R 101:101 bw-data
sudo chmod -R u=rwx,g=rwx,o= bw-data
docker compose up -d
```

### Certificate Issues

```bash
# Check scheduler logs
docker compose logs bw-scheduler | grep -iE "error|acme|success"
```

### WAF Not Blocking

```bash
# Verify ModSecurity is enabled
docker compose exec bunkerweb nginx -T 2>&1 | grep -i modsecurity

# Check rule syntax
docker compose logs bw-scheduler | grep -iE "rule|error"
```

### Can't Access Domain

```bash
# Verify DNS points to this server
nslookup bunkerweb.we-are-asap.com

# Check if ports are open
sudo netstat -tlnp | grep -E ":80|:443"

# Test connectivity
curl -v http://localhost/
```

## WAF Rules Included

Default security rules:

1. Block missing User-Agent header
2. Block Host header with IP address
3. Block missing Host header
4. Block known malicious scanners (sqlmap, nikto, etc.)
5. Block SQL injection patterns
6. Block XSS attempts
7. Block sensitive file access (.env, .git, etc.)
8. Block path traversal attacks

## Production Checklist

- [x] Real Let's Encrypt certificates (LE_STAGING=no)
- [x] DNS configured to point to this server
- [x] WAF blocking test attacks (HTTP 403)
- [x] Services running and stable
- [ ] Backend application attached
- [ ] Firewall allows only ports 80, 443
- [ ] Monitor logs regularly
- [ ] Plan for certificate renewal

## Next Steps

1. Verify WAF is working (see verification tests above)
2. Attach your backend application
3. Fine-tune WAF rules for your application
4. Set up monitoring and log aggregation

## References

- [BunkerWeb Documentation](https://docs.bunkerweb.io/)
- [ModSecurity Rules](https://github.com/SpiderLabs/ModSecurity/wiki)
- [OWASP Core Rule Set](https://coreruleset.org/)
