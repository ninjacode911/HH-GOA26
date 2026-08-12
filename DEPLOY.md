# Deploying to Linode at hhgoa.trencoders.com

Goal: serve this site from the existing Linode box under a **dedicated `hhgoa26`
user**, without touching any project already deployed there.

This is a static site — no process, no port, no database, no runtime. The only
shared component is nginx, and we only ever **add** a new server block; existing
ones are never edited. `nginx -t` runs before every reload, so a typo cannot take
the other sites down.

---

## 0. Push to GitHub (on your machine)

Confirm nothing sensitive is staged first. `.env` holds a real Gemini key that
this site does not use and must never ship:

```bash
cd "HH Goa"
git init
git add -A
git status --short                 # .env and MASTER_RULES.md must NOT appear
git check-ignore -v .env           # must print the .gitignore rule that covers it
```

Then commit and push:

```bash
git commit -m "Add HH Goa 2026 frame and Builder ID generator"
git branch -M main
git remote add origin https://github.com/ninjacode911/HH-GOA26.git
git push -u origin main
```

---

## 1. DNS

Add an **A record**: `hhgoa` → your Linode's public IPv4.
(The DNS name stays `hhgoa` — the site is `hhgoa.trencoders.com` everywhere in
the code, canonical tag, OG tags and QR target. Only the *system user* is
`hhgoa26`.)
If the box has IPv6, add a matching **AAAA** record.

```bash
dig +short hhgoa.trencoders.com    # should return your Linode IP
```

---

## 2. Create the isolated user and pull the code

```bash
# dedicated user: no password login, no sudo, no shell
sudo adduser --disabled-password --gecos "" --shell /usr/sbin/nologin hhgoa26

sudo -u hhgoa26 mkdir -p /home/hhgoa26/www
sudo -u hhgoa26 git clone https://github.com/ninjacode911/HH-GOA26.git \
  /home/hhgoa26/www/HH-GOA26

# let nginx (www-data) traverse in — read-only, nothing else changes
sudo chmod 755 /home/hhgoa26 /home/hhgoa26/www
```

---

## 3. Add the nginx server block (additive only)

```bash
sudo tee /etc/nginx/sites-available/hhgoa.trencoders.com > /dev/null <<'CONF'
server {
    listen 80;
    listen [::]:80;
    server_name hhgoa.trencoders.com;

    root /home/hhgoa26/www/HH-GOA26;
    index index.html;

    # ---- security headers ----
    # script-src allows cdnjs only because heic2any is lazy-loaded from there
    # when a HEIC file is selected. 'wasm-unsafe-eval' and worker-src blob: are
    # present because that decoder may spin up a worker; drop them if you ever
    # remove HEIC support. No 'unsafe-inline' is needed anywhere.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com; worker-src 'self' blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/xml text/plain application/ld+json;
    gzip_min_length 512;

    location / {
        try_files $uri $uri/ =404;
    }

    # hashed-forever assets can cache hard; the page itself must stay fresh
    location /assets/ {
        add_header Cache-Control "public, max-age=604800";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
}
CONF

sudo ln -s /etc/nginx/sites-available/hhgoa.trencoders.com /etc/nginx/sites-enabled/

sudo nginx -t          # MUST say "syntax is ok" — this protects the other sites
sudo systemctl reload nginx
```

> **Note on `add_header`:** headers set in a `server` block are dropped inside any
> `location` that adds its own. The two cache `location` blocks above therefore
> lose the security headers. If that matters to you, move the security headers
> into each `location`, or use the `always` form with nginx `more_set_headers`
> from `headers-more-nginx-module`. Verify with step 6 either way.

Check: `http://hhgoa.trencoders.com` should load the app.

---

## 4. HTTPS

Required: X link previews and camera-based QR scans both want TLS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hhgoa.trencoders.com
```

This issues a **separate certificate** for just this subdomain and edits only the
new server block. Existing certs and vhosts are untouched, and certbot's systemd
timer handles renewal.

After certbot has added the TLS block, add HSTS to it:

```bash
# inside the listen 443 server block
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```

Leave `preload` off until you are certain every `trencoders.com` subdomain is
HTTPS-only — the preload list is painful to leave.

---

## 5. Updating later

```bash
sudo -u hhgoa26 git -C /home/hhgoa26/www/HH-GOA26 pull
```

No reload needed — these are static files.

---

## 6. Verify the deployment

```bash
SITE=https://hhgoa.trencoders.com

# headers present?
curl -sI $SITE/ | grep -iE 'content-security-policy|strict-transport|x-content-type|referrer-policy'

# http -> https redirect
curl -sI http://hhgoa.trencoders.com/ | head -1

# launch-gate files reachable
for p in / /404.html /robots.txt /sitemap.xml /llms.txt /favicon.svg /og.png /apple-touch-icon.png; do
  printf '%-24s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' $SITE$p)"
done

# a missing page must return a real 404, not 200
curl -s -o /dev/null -w 'missing page: %{http_code}\n' $SITE/definitely-not-a-page

# no source maps served next to the JS
curl -s -o /dev/null -w 'app.js.map: %{http_code}\n' $SITE/assets/app.js.map

# no secret pattern anywhere in what is actually served
SECRET_PAT='AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_-]{20,}|ya29\.[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{40,}|hf_[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|-----BEGIN'
for a in / /assets/app.js /assets/styles.css /assets/vendor/qrcode.min.js; do
  curl -sL "$SITE$a" | grep -oE "$SECRET_PAT" && echo "LEAK in $a"
done
echo "served-asset scan done"
```

Then confirm by hand:

- `securityheaders.com` → aim for **A**
- `ssllabs.com/ssltest` → aim for **A**
- Open devtools on the live URL: **zero console errors**
- Paste the URL into X's post composer and confirm the preview shows `og.png`
- Scan the QR on a generated card with a phone — it must open the live site

---

## Why this cannot disturb the other projects

- **Static files only** — no PM2, no systemd service, no port binding, no runtime.
- **Separate unprivileged user** with `nologin`; nginx gets read traversal and nothing more.
- **nginx changes are additive** — one new file in `sites-available` plus one symlink, gated by `nginx -t`.
- **The TLS certificate is its own**, scoped to this subdomain only.
- **No shared dependency** — no database, no cache, no queue, no environment file.
