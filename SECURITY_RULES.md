# Security Rules - BunkerWeb WAF

## Overview

Your BunkerWeb deployment includes **8 core security rules** protecting against common web attacks.

**Access Dashboard:** `https://bunkerweb.we-are-asap.com:5000`

---

## Custom ModSecurity Rules (1000-1099)

### Rule 1001: Missing User-Agent Header
- **ID:** 1001
- **Severity:** Medium
- **Phase:** 1 (Request headers)
- **Action:** Block (403 Forbidden)
- **Purpose:** Rejects requests without a User-Agent header (suspicious bots/scripts)
- **Example Block:** Curl without `-A` flag

```bash
# This request gets blocked:
curl https://bunkerweb.we-are-asap.com/

# This request passes:
curl -A "Mozilla/5.0" https://bunkerweb.we-are-asap.com/
```

---

### Rule 1002: Host Header is IP Address
- **ID:** 1002
- **Severity:** Medium
- **Phase:** 1 (Request headers)
- **Action:** Block (403 Forbidden)
- **Purpose:** Prevents direct IP access (forces use of domain name)
- **Pattern:** Matches IPv4 addresses (e.g., 192.168.1.1)
- **Example Block:**
```bash
curl https://44.211.21.221/  # Blocked
curl https://bunkerweb.we-are-asap.com/  # Allowed
```

---

### Rule 1003: Missing Host Header
- **ID:** 1003
- **Severity:** High
- **Phase:** 1 (Request headers)
- **Action:** Block (403 Forbidden)
- **Purpose:** Rejects malformed HTTP requests without Host header
- **Example Block:** Custom clients that omit Host header

---

### Rule 1004: Malicious Bot Detection
- **ID:** 1004
- **Severity:** High
- **Phase:** 1 (Request headers)
- **Action:** Block (403 Forbidden)
- **Purpose:** Blocks known security scanning tools
- **Blocked Scanners:**
  - `sqlmap` - SQL injection scanner
  - `nikto` - Web server scanner
  - `nessus` - Vulnerability scanner
  - `nmap` - Network mapper
  - `masscan` - Port scanner
  - `metasploit` - Exploitation framework
  - `shodan` - Search engine for devices

**Example Block:**
```bash
curl -A "sqlmap/1.0" https://bunkerweb.we-are-asap.com/  # Blocked
curl -A "Mozilla/5.0" https://bunkerweb.we-are-asap.com/  # Allowed
```

---

### Rule 1005: SQL Injection Detection
- **ID:** 1005
- **Severity:** Critical
- **Phase:** 2 (Request body)
- **Action:** Block (403 Forbidden)
- **Purpose:** Detects SQL injection attack patterns
- **Detected Patterns:**
  - `UNION SELECT`
  - `SELECT FROM`
  - `INSERT INTO`
  - `DELETE FROM`
  - `UPDATE SET`

**Example Block:**
```bash
# Blocks SQL injection attempts:
curl "https://bunkerweb.we-are-asap.com/?id=1' UNION SELECT 1"
curl "https://bunkerweb.we-are-asap.com/?name=admin' DELETE FROM users"

# Normal requests pass:
curl "https://bunkerweb.we-are-asap.com/?id=123"
curl "https://bunkerweb.we-are-asap.com/?search=hello"
```

---

### Rule 1006: XSS (Cross-Site Scripting) Detection
- **ID:** 1006
- **Severity:** Critical
- **Phase:** 2 (Request body)
- **Action:** Block (403 Forbidden)
- **Purpose:** Prevents JavaScript injection attacks
- **Detected Patterns:**
  - `<script>` tags
  - `javascript:` protocol
  - `onerror=` attribute
  - `onload=` attribute

**Example Block:**
```bash
# Blocks XSS attempts:
curl "https://bunkerweb.we-are-asap.com/?msg=<script>alert('xss')</script>"
curl "https://bunkerweb.we-are-asap.com/?onclick=javascript:void(0)"

# Normal requests pass:
curl "https://bunkerweb.we-are-asap.com/?msg=hello%20world"
```

---

### Rule 1007: Sensitive File Access
- **ID:** 1007
- **Severity:** Critical
- **Phase:** 1 (Request URI)
- **Action:** Block (403 Forbidden)
- **Purpose:** Prevents access to sensitive configuration files
- **Blocked Files:**
  - `.env` - Environment variables
  - `.git` - Git repository
  - `.aws` - AWS credentials
  - `dockerfile` - Container config
  - `docker-compose` - Compose file
  - `.htaccess` - Web server config
  - `web.config` - IIS config

**Example Block:**
```bash
# Blocks these requests:
curl https://bunkerweb.we-are-asap.com/.env
curl https://bunkerweb.we-are-asap.com/.git/config
curl https://bunkerweb.we-are-asap.com/dockerfile

# Normal requests pass:
curl https://bunkerweb.we-are-asap.com/
curl https://bunkerweb.we-are-asap.com/api/users
```

---

### Rule 1008: Path Traversal Detection
- **ID:** 1008
- **Severity:** Critical
- **Phase:** 1 (Request URI)
- **Action:** Block (403 Forbidden)
- **Purpose:** Prevents directory traversal attacks
- **Detected Patterns:**
  - `../` - Unix/Linux directory traversal
  - `..\` - Windows directory traversal

**Example Block:**
```bash
# Blocks path traversal:
curl https://bunkerweb.we-are-asap.com/../../etc/passwd
curl https://bunkerweb.we-are-asap.com/files/..\..\windows\system32

# Normal requests pass:
curl https://bunkerweb.we-are-asap.com/files/document.pdf
```

---

## Built-in BunkerWeb Protection (Always Active)

These features are enabled by default and don't require custom rules:

### ✅ TLS/HTTPS Enforcement
- Automatic Let's Encrypt certificate provisioning
- TLS 1.2+ enforcement
- HSTS headers (HTTPS strict transport security)

### ✅ Rate Limiting
- Protects against brute force attacks
- DDoS mitigation
- Connection throttling

### ✅ Real IP Detection
- Identifies true client IP behind proxies
- Prevents IP spoofing

### ✅ Geographic Blocking (Optional)
- Can block traffic from specific countries
- Requires configuration

### ✅ Reverse Proxy Security
- Hides backend server details
- Prevents direct backend access
- Rewrites headers securely

### ✅ Log Aggregation
- All blocked requests logged
- Available in BunkerWeb dashboard
- Request metadata captured

---

## Test the WAF

### Test SQL Injection Detection
```bash
curl -sk -A "if(now()=sysdate(),sleep(15),0)" https://bunkerweb.we-are-asap.com/
# Expected: 403 Forbidden
```

### Test XSS Detection
```bash
curl -sk "https://bunkerweb.we-are-asap.com/?msg=<script>alert(1)</script>"
# Expected: 403 Forbidden
```

### Test Path Traversal
```bash
curl -sk https://bunkerweb.we-are-asap.com/../../../etc/passwd
# Expected: 403 Forbidden
```

### Test Sensitive File Access
```bash
curl -sk https://bunkerweb.we-are-asap.com/.env
# Expected: 403 Forbidden
```

### Test Normal Request
```bash
curl -sk https://bunkerweb.we-are-asap.com/
# Expected: 200 OK + content
```

---

## Adding Custom Rules

To add domain-specific rules:

1. Create folder:
```bash
mkdir -p bw-data/configs/modsec/bunkerweb.we-are-asap.com
```

2. Create rule file with ID range 2000-2099:
```bash
cat > bw-data/configs/modsec/bunkerweb.we-are-asap.com/2000-custom-rules.conf << 'EOF'
# Block requests with "admin" in User-Agent
SecRule REQUEST_HEADERS:User-Agent "@contains admin" \
  "id:2001,phase:1,deny,status:403,log,msg:'Admin scanner detected'"
EOF
```

3. Restart services:
```bash
docker compose restart
docker compose logs -f bw-scheduler
```

---

## Rule ID Ranges

- **1000-1099:** Global rules (all domains)
- **2000-2099:** Domain-specific rules
- **Never reuse IDs** - each rule must have a unique identifier

---

## Dashboard Access

**URL:** `https://bunkerweb.we-are-asap.com:5000`

Features:
- View real-time logs
- See blocked requests
- Configure settings
- Manage ModSecurity rules
- Monitor certificate status
- Check service health

---

## Client Demo Talking Points

1. **8 Active Security Rules** - Comprehensive coverage of common attacks
2. **Real-time Blocking** - All attacks rejected with 403 status
3. **Zero Configuration** - Works out of the box
4. **Production Ready** - Let's Encrypt, HTTPS, rate limiting
5. **Transparent Logging** - All blocks visible in dashboard
6. **Easy to Extend** - Add custom rules without restarting services

---

## References

- [ModSecurity Rules Syntax](https://github.com/SpiderLabs/ModSecurity/wiki/Reference-Manual)
- [OWASP Top 10 Attacks](https://owasp.org/www-project-top-ten/)
- [BunkerWeb Documentation](https://docs.bunkerweb.io/)
