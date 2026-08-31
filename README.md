# BunkerWeb + CrowdSec + Assembly UI

## Run locally

This repository runs a small React application behind BunkerWeb and CrowdSec.
It intentionally uses plain HTTP for local development; only port `80` is
published and no certificates or DNS are required.

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Open [http://app.localhost](http://app.localhost). If `app.localhost` does not
resolve on your machine, use `curl -H 'Host: app.localhost' http://127.0.0.1/`
or add `127.0.0.1 app.localhost` to your hosts file.

The request path is `BunkerWeb -> assembly-app`; BunkerWeb sends access logs to
the local syslog service, and CrowdSec reads those logs from the shared volume.
Check the integration with:

```bash
docker compose logs -f bw-scheduler crowdsec
docker compose exec crowdsec cscli metrics
```

Stop the environment with `docker compose down`. Add `-v` only when you want to
remove the persisted BunkerWeb and CrowdSec data.

## Production notes

Before exposing this stack publicly, use a strong `CROWDSEC_API_KEY`, configure
real DNS names, and add TLS. The local HTTP configuration is deliberately not a
production security posture.

---

## Previous server migration notes

This replaces the package-installed (systemd + Postgres) BunkerWeb on
`44.211.21.221`. That box is being retired for this project because it
accumulated three separate platform-level problems this week:

1. A duplicate ModSecurity rule ID (our own authoring bug) that silently
   blocked every config reload until a real `nginx -t` finally ran.
2. A Postgres uniqueness-constraint gap (`NULL service_id` never satisfies
   `UNIQUE`) that let the custom-config table quietly accumulate duplicate
   global-scope rows, and meant our "site-specific" rules for alphansn.com
   were **never actually scoped to that site** — they applied to every
   domain on the box the whole time.
3. A scheduler bug that recursively nested `.bw-staging` directories inside
   themselves once file permissions were corrected.

None of that is fixable by "trying harder" on the same install — it's
cheaper and safer to start clean. This setup avoids all three:

- Custom configs are plain files in `bw-data/configs/`, scoped by **folder
  path** (subfolder named after the domain = that domain only, top level =
  global). There is no database step that can silently un-scope something.
- Rule IDs are assigned from **reserved, non-overlapping ranges** per file
  (documented at the top of each `.conf` file), so the exact bug that took
  the old server down cannot happen again by accident.
- Everything here is a plain file you can put in git and diff. No hidden
  state, no UI-driven config upload.

## What this does NOT do yet

On purpose — this stands up **BunkerWeb only**, protecting a placeholder
page, so the whole pipeline (DNS → TLS → WAF → reverse proxy) can be proven
solid before the real application is wired in. Swapping in the real app
later is a one-line change (see "Attaching the real application" below).

---

## 1. Launch a new, clean server

Any small Ubuntu 24.04 LTS instance works. Via the AWS Console:

1. EC2 → Launch Instance → Ubuntu Server 24.04 LTS, `t3.small` (or your
   usual size).
2. Security group: allow inbound `22` (SSH, from your IP only), `80` and
   `443` (from anywhere).
3. Allocate and associate an Elastic IP so the address doesn't change on
   reboot.
4. Note the new public IP — you'll point DNS at it in step 4 below.

(If you use the AWS CLI locally instead of the console, the equivalent is
`aws ec2 run-instances ...` with the same AMI/security group — happy to
give you the exact command if you tell me the VPC/subnet/key-pair names to
use.)

## 2. Install Docker on the new server

SSH into the new instance, then:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version && docker compose version
```

## 3. Copy this project to the new server

From your machine (wherever you downloaded this folder to):

```bash
scp -r bunkerweb-fresh ubuntu@<NEW_SERVER_IP>:~/bunkerweb-fresh
```

Then on the new server:

```bash
cd ~/bunkerweb-fresh
cp .env.example .env
nano .env   # fill in LE_EMAIL, confirm SERVER_NAMES, keep LE_STAGING=yes for now

# BunkerWeb's scheduler runs as UID/GID 101 and needs write access:
sudo chown -R root:101 bw-data
sudo chmod -R 770 bw-data
```

## 4. Point DNS at the new server (staging certs first)

For each domain (`alphansn.com`, `www.alphansn.com`,
`bunkerweb.we-are-asap.com`), update the A record to the new server's
Elastic IP. DNS propagation can take a few minutes to a few hours — no rush,
`LE_STAGING=yes` means we won't burn Let's Encrypt's production rate limit
while waiting.

## 5. Bring it up

```bash
docker compose up -d
docker compose ps          # all three containers should show "running"
docker compose logs -f bw-scheduler   # watch it issue staging certs once DNS resolves
```

## 6. Verify (staging cert first, then flip to production)

Once DNS has propagated for a domain:

```bash
curl -vk https://alphansn.com/ 2>&1 | grep -iE "subject:|issuer:"
```

You should see a `(STAGING) Let's Encrypt` issuer — that confirms the whole
pipeline works (DNS → TLS handshake → BunkerWeb → placeholder app). Browsers
will still show a security warning for staging certs; that's expected.

Once every domain shows a staging cert successfully:

```bash
# edit .env: LE_STAGING=no
docker compose up -d   # re-applies env, scheduler reissues real production certs
```

Then re-run the same curl check and confirm the issuer is the real
`Let's Encrypt` (not `(STAGING)`).

## 7. Run the behavior-verification battery

Same four tests as before, now against the new server, one domain at a
time:

```bash
DOMAIN=alphansn.com

# 1. Normal request — expect 200
curl -sk -o /dev/null -w "normal: %{http_code}\n" https://$DOMAIN/

# 2. Blocked User-Agent (curl itself, if you add BLACKLIST_USER_AGENT=curl later) — expect 403
curl -sk -A "curl/8.0" -o /dev/null -w "curl-UA: %{http_code}\n" https://$DOMAIN/

# 3. Host-header-is-IP rule (id:1002) — expect 403
curl -sk -H "Host: <NEW_SERVER_IP>" -o /dev/null -w "host-is-ip: %{http_code}\n" https://$DOMAIN/

# 4. SQLi sleep payload (id:1008) — expect 403, fast (no actual sleep)
curl -sk -A "if(now()=sysdate(),sleep(15),0)" -o /dev/null -w "sqli: %{http_code} time:%{time_total}s\n" https://$DOMAIN/
```

## 8. Attaching the real application

When the app server is ready, either:

- Point `REVERSE_PROXY_HOST` in `docker-compose.yml` at it (e.g.
  `http://<app-server-ip>:<port>` or a Docker network alias if it's
  containerized on the same host), then `docker compose up -d`, **or**
- Remove the `placeholder-app` service entirely once every domain's
  `REVERSE_PROXY_HOST` points at the real app.

## 9. Re-adding the extra protections, one at a time

The old server also had country blocking, an antibot challenge, and a
search-bot exemption list. Add these back **one setting at a time, testing
after each**, rather than all at once — that incremental discipline is what
kept things stable before, and abandoning it mid-project is part of how
things spiraled this week:

```yaml
# example — add under bw-scheduler.environment, one block at a time:
alphansn.com_BLACKLIST_COUNTRY: "<countries>"
alphansn.com_USE_ANTIBOT: "captcha"
alphansn.com_ANTIBOT_ONLY_COUNTRY: "<countries>"
alphansn.com_ANTIBOT_IGNORE_USER_AGENT: "Googlebot Bingbot PerplexityBot GPTBot ChatGPT-User Mediapartners-Google AdsBot-Google"
alphansn.com_ANTIBOT_IGNORE_RDNS: ".googlebot.com .google.com .search.msn.com .bing.com"
```

After each addition: `docker compose up -d`, then re-run the verification
battery above before adding the next one.

## ID range ledger (keep this updated)

| Range | Owner |
|---|---|
| 1000-1099 | Global (`bw-data/configs/modsec/1000-1099-global-core.conf`) |
| 2000-2099 | alphansn.com / www.alphansn.com |
| 3000-3099 | bunkerweb.we-are-asap.com |
| 4000-4099 | next site |

Add a site-specific rule by creating
`bw-data/configs/modsec/<domain>/2000-....conf` — the folder name is what
scopes it to that domain only.
