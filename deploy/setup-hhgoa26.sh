#!/usr/bin/env bash
#
# Deploy the HH Goa 2026 frame generator to an existing nginx box under a
# dedicated, unprivileged system user.
#
# Safe to re-run. Every step is additive: it creates one new system user, one
# new directory, one new nginx server block and one symlink. It never edits or
# removes anything that is already on the box, and it refuses to reload nginx
# unless `nginx -t` passes, so a mistake here cannot take an existing site down.
#
#   Run as root:   sudo bash deploy/setup-hhgoa26.sh
#
set -euo pipefail

USER_NAME="hhgoa26"
REPO="https://github.com/ninjacode911/HH-GOA26.git"
DOMAIN="hhgoa.trencoders.com"
HOME_DIR="/home/${USER_NAME}"
WEB_ROOT="${HOME_DIR}/www/HH-GOA26"
SITE_FILE="/etc/nginx/sites-available/${DOMAIN}"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
die() { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this as root (sudo bash $0)"
command -v nginx >/dev/null || die "nginx is not installed"
command -v git   >/dev/null || die "git is not installed"

# ---------------------------------------------------------------- 0. backup
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/nginx-backup-${STAMP}.tar.gz"
say "Backing up the current nginx config to ${BACKUP}"
tar czf "$BACKUP" /etc/nginx 2>/dev/null || die "could not back up /etc/nginx"

say "nginx sites enabled BEFORE this run:"
ls -1 /etc/nginx/sites-enabled/ | sed 's/^/    /'

# ------------------------------------------------------- 1. isolated user
if id "$USER_NAME" >/dev/null 2>&1; then
  say "User ${USER_NAME} already exists — leaving it alone"
else
  say "Creating ${USER_NAME}: no password, no shell, no sudo"
  adduser --disabled-password --gecos "" --shell /usr/sbin/nologin "$USER_NAME"
fi

# the new user must not be able to escalate
if id -nG "$USER_NAME" | tr ' ' '\n' | grep -qxE 'sudo|admin|wheel'; then
  die "${USER_NAME} is in an admin group — that is not the isolation we want"
fi

# --------------------------------------------------------------- 2. code
say "Fetching the site into ${WEB_ROOT}"
install -d -o "$USER_NAME" -g "$USER_NAME" "${HOME_DIR}/www"
if [ -d "${WEB_ROOT}/.git" ]; then
  sudo -u "$USER_NAME" git -C "$WEB_ROOT" pull --ff-only
else
  sudo -u "$USER_NAME" git clone --depth 1 "$REPO" "$WEB_ROOT"
fi

# nginx (www-data) only needs to traverse in and read
chmod 755 "$HOME_DIR" "${HOME_DIR}/www"
[ -f "${WEB_ROOT}/index.html" ] || die "index.html missing — clone did not work"

# ------------------------------------------------------- 3. nginx server block
say "Writing ${SITE_FILE}"
cat > "$SITE_FILE" <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${WEB_ROOT};
    index index.html;

    # Security headers are repeated inside each location that sets its own
    # add_header, because nginx drops inherited headers the moment a location
    # adds one of its own.
    set \$hh_csp "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com; worker-src 'self' blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests";

    add_header Content-Security-Policy \$hh_csp always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/xml text/plain application/ld+json;
    gzip_min_length 512;

    # Never serve VCS metadata, dotfiles or repo tooling. A git clone leaves a
    # complete .git directory in the web root, and /.git/config being fetchable
    # hands an attacker the whole repository. The negative lookahead keeps
    # /.well-known/ reachable, which certbot's HTTP-01 challenge requires.
    location ~ /\.(?!well-known/) {
        access_log off;
        log_not_found off;
        return 404;
    }
    location ^~ /deploy/ { return 404; }
    location ~* \.(sh|bak|orig|log)$ { return 404; }

    location / {
        try_files \$uri \$uri/ =404;
    }

    location /assets/ {
        add_header Content-Security-Policy \$hh_csp always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Cache-Control "public, max-age=604800";
    }

    location = /index.html {
        add_header Content-Security-Policy \$hh_csp always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cache-Control "no-cache";
    }

    error_page 404 /404.html;
    location = /404.html { internal; }
}
CONF

ln -sfn "$SITE_FILE" "/etc/nginx/sites-enabled/${DOMAIN}"

# ------------------------------------------------------------- 4. gate
say "Testing the nginx config — nothing reloads unless this passes"
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/${DOMAIN}"
  die "nginx -t failed. The new site was unlinked and nothing was reloaded; the existing sites are untouched."
fi

say "Reloading nginx"
systemctl reload nginx

# ------------------------------------------------------------- 5. verify
say "Verifying over HTTP using a Host header (works before DNS is live)"
# `systemctl reload` returns as soon as the signal is sent; the new workers take
# a moment to take over, so a single immediate curl can still hit the old config.
CODE=000
for attempt in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" http://127.0.0.1/ || echo 000)
  [ "$CODE" = "200" ] && break
  sleep 1
done
echo "    GET / -> HTTP ${CODE}"
[ "$CODE" = "200" ] || die "expected 200 from the new site, got ${CODE}"

say "Confirming private paths are not served"
for p in /.git/config /deploy/setup-hhgoa26.sh /.env; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1${p}" || echo 000)
  printf '    %-28s -> HTTP %s\n' "$p" "$c"
  [ "$c" = "404" ] || die "${p} is reachable (HTTP ${c}) — it must not be"
done

for p in /assets/app.js /assets/styles.css /og.png /robots.txt /favicon.svg; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1${p}" || echo 000)
  printf '    %-22s -> HTTP %s\n' "$p" "$c"
done
NF=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" http://127.0.0.1/no-such-page || echo 000)
echo "    missing page          -> HTTP ${NF} (must be 404)"

say "Confirming the existing sites still answer"
ls -1 /etc/nginx/sites-enabled/ | sed 's/^/    /'
systemctl is-active nginx | sed 's/^/    nginx: /'

cat <<'NEXT'

==> Done. The site is served over HTTP on this box.

Remaining, in order:

  1. DNS — point hhgoa.trencoders.com (A record) at this server's public IPv4
     in Cloudflare. If the record is proxied (orange cloud), turn the proxy OFF
     (grey cloud) until certbot has issued, or the HTTP-01 challenge will fail.

  2. Once `dig +short hhgoa.trencoders.com` returns this box's IP:

         sudo certbot --nginx -d hhgoa.trencoders.com

     That issues a certificate for this subdomain only and edits only this
     server block. Existing certificates and vhosts are not touched.

  3. Add HSTS inside the new `listen 443` block certbot creates:

         add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

  4. Re-run the verification block in DEPLOY.md section 6 against the live URL.

To update the site later:

     sudo -u hhgoa26 git -C /home/hhgoa26/www/HH-GOA26 pull

NEXT
