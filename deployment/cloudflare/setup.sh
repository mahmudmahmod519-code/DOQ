#!/usr/bin/env bash
# ============================================================================
# DOQ: Cloudflare setup on the FREE plan, through the Cloudflare API.
# Run it on the server, inside the DOQ folder, after the domain is added to Cloudflare:
#
#   sudo ./deployment/cloudflare/setup.sh                # asks for the API token (hidden)
#   sudo ./deployment/cloudflare/setup.sh --replace-dns  # also replace existing DNS records of the domain
#
# Safe to run again. It creates or updates:
#   1. Cloudflare Tunnel "doq" -> http://app:3000 (the server opens NO web ports)
#   2. DNS: DOQ_DOMAIN (+ www when INCLUDE_WWW=true) -> the tunnel (proxied, SSL by Cloudflare)
#   3. SSL/TLS: Always Use HTTPS, TLS 1.2 minimum, automatic HTTPS rewrites
#   4. Firewall (WAF custom rules): block vulnerability scanners, challenge /admin outside CF_ADMIN_COUNTRIES
#   5. Rate limiting (free plan: 1 rule): /auth (login, signup, OTP) max 20 requests / 10 s per IP
#   6. Cache rule: uploaded images cached at Cloudflare for 30 days
#   7. R2 bucket for encrypted backups + a copy of uploaded images (10 GB free)
# Then it writes EDGE_MODE=tunnel and TUNNEL_TOKEN to .env.production.
# Next step: sudo ./deploy.sh  (first time)  or  sudo ./update.sh --no-pull
#
# API token: dash.cloudflare.com -> My Profile -> API Tokens -> Create Token -> Custom token:
#   Account | Cloudflare Tunnel     | Edit
#   Account | Workers R2 Storage    | Edit      (for the R2 bucket)
#   Account | Account Rulesets      | Edit
#   Account | Account Filter Lists  | Edit
#   Zone    | Zone                  | Read
#   Zone    | DNS                   | Edit
#   Zone    | Zone Settings         | Edit
#   Zone    | Zone WAF              | Edit
#   Zone    | Cache Rules           | Edit
#   Zone Resources: Include -> Specific zone -> your domain
# The token is used for this run only: it is never written to disk or printed.
# ============================================================================
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root
cd "$DOQ_DIR"

REPLACE_DNS=false
for arg in "$@"; do
  case "$arg" in
    --replace-dns) REPLACE_DNS=true ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    *) die "Unknown option: $arg" ;;
  esac
done

command -v jq >/dev/null || apt-get install -y -qq jq >/dev/null
[[ -f "$ENV_FILE" ]] || install -m 600 "$ENV_TEMPLATE" "$ENV_FILE"
chmod 600 "$ENV_FILE"

DOMAIN="$(env_get DOQ_DOMAIN)"
if is_placeholder "$DOMAIN" && [[ -t 0 ]]; then
  read -r -p "Domain (already added to Cloudflare), e.g. doq.example.org: " DOMAIN
  DOMAIN="${DOMAIN#http*://}"; DOMAIN="${DOMAIN%%/*}"
  env_set DOQ_DOMAIN "$DOMAIN"
fi
[[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]] \
  || die "Set DOQ_DOMAIN in .env.production to your domain (for example doq.example.org)"
NAMES=("$DOMAIN")
[[ "$(env_get INCLUDE_WWW)" == "true" ]] && NAMES+=("www.${DOMAIN}")
TUNNEL_NAME="${CF_TUNNEL_NAME:-doq}"
BUCKET="$(env_get R2_BUCKET)"; BUCKET="${BUCKET:-doq-storage}"
ADMIN_COUNTRIES="$(env_get CF_ADMIN_COUNTRIES)"; ADMIN_COUNTRIES="${ADMIN_COUNTRIES:-EG}"

# ---------------------------------------------------------------- API helpers
TOKEN="${CF_API_TOKEN:-}"
if [[ -z "$TOKEN" && -t 0 ]]; then
  read -r -s -p "Cloudflare API token (input hidden): " TOKEN; echo
fi
[[ -n "$TOKEN" ]] || die "No API token. Create one as described in: $0 --help"
HDR="$(mktemp)"; chmod 600 "$HDR"
trap 'rm -f "$HDR"' EXIT
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$TOKEN" > "$HDR"
unset TOKEN CF_API_TOKEN
API="https://api.cloudflare.com/client/v4"

# cf METHOD PATH [JSON] -> prints the JSON answer (token stays in a root-only header file)
cf() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS --max-time 30 -X "$method" "$API$path" -H @"$HDR" --data "$body" || echo '{"success":false,"errors":[{"code":0,"message":"network error"}]}'
  else
    curl -sS --max-time 30 -X "$method" "$API$path" -H @"$HDR" || echo '{"success":false,"errors":[{"code":0,"message":"network error"}]}'
  fi
}
cf_ok()  { jq -e '.success == true' >/dev/null 2>&1 <<<"$1"; }
cf_err() { jq -r '[.errors[]? | "\(.code): \(.message)"] | join("; ")' 2>/dev/null <<<"$1"; }

# Replace only the DOQ rules of a zone phase, keep everybody else's rules.
# merge_phase PHASE RULES_JSON_ARRAY -> 0 on success
merge_phase() {
  local phase="$1" ours="$2" current others body res
  current="$(cf GET "/zones/${ZONE_ID}/rulesets/phases/${phase}/entrypoint")"
  if cf_ok "$current"; then
    others="$(jq -c '[.result.rules[]? | select((.description // "") | startswith("DOQ:") | not)
      | {action, expression, description, enabled, action_parameters, ratelimit, logging}
      | with_entries(select(.value != null))]' <<<"$current")"
  else
    others='[]'
  fi
  body="$(jq -cn --argjson a "$others" --argjson b "$ours" '{rules: ($a + $b)}')"
  res="$(cf PUT "/zones/${ZONE_ID}/rulesets/phases/${phase}/entrypoint" "$body")"
  if cf_ok "$res"; then return 0; fi
  warn "$(cf_err "$res")"
  return 1
}

# ---------------------------------------------------------------- 1. zone
step "1/7 Find the domain in Cloudflare"
ZONE_ID=""; ZONE_NAME=""; ACCOUNT_ID=""; ZONE_STATUS=""; ZONE_JSON=""
candidate="$DOMAIN"
while [[ "$candidate" == *.* ]]; do
  ZONE_JSON="$(cf GET "/zones?name=${candidate}")"
  if cf_ok "$ZONE_JSON" && [[ "$(jq -r '.result | length' <<<"$ZONE_JSON")" != "0" ]]; then
    ZONE_ID="$(jq -r '.result[0].id' <<<"$ZONE_JSON")"
    ZONE_NAME="$(jq -r '.result[0].name' <<<"$ZONE_JSON")"
    ACCOUNT_ID="$(jq -r '.result[0].account.id' <<<"$ZONE_JSON")"
    ZONE_STATUS="$(jq -r '.result[0].status' <<<"$ZONE_JSON")"
    break
  fi
  cf_ok "$ZONE_JSON" || die "Cloudflare API refused the token: $(cf_err "$ZONE_JSON")"
  candidate="${candidate#*.}"
done
[[ -n "$ZONE_ID" ]] || die "No Cloudflare zone found for ${DOMAIN}. Add the domain in the Cloudflare dashboard first (Add a domain, Free plan)."
ok "Zone ${ZONE_NAME} (status: ${ZONE_STATUS})"
if [[ "$ZONE_STATUS" != "active" ]]; then
  warn "The domain is not active on Cloudflare yet. At your domain registrar, set the nameservers to:"
  jq -r '.result[0].name_servers[]? | "         " + .' <<<"$ZONE_JSON" >&2
  warn "Everything below is still configured; the site goes live as soon as the nameservers change."
fi

# ---------------------------------------------------------------- 2. tunnel
step "2/7 Cloudflare Tunnel"
res="$(cf GET "/accounts/${ACCOUNT_ID}/cfd_tunnel?name=${TUNNEL_NAME}&is_deleted=false")"
cf_ok "$res" || die "Tunnel API: $(cf_err "$res") (token needs Account | Cloudflare Tunnel | Edit)"
TUNNEL_ID="$(jq -r '.result[0].id // empty' <<<"$res")"
if [[ -z "$TUNNEL_ID" ]]; then
  res="$(cf POST "/accounts/${ACCOUNT_ID}/cfd_tunnel" "$(jq -cn --arg n "$TUNNEL_NAME" '{name: $n, config_src: "cloudflare"}')")"
  cf_ok "$res" || die "Could not create the tunnel: $(cf_err "$res")"
  TUNNEL_ID="$(jq -r '.result.id' <<<"$res")"
  ok "Created tunnel ${TUNNEL_NAME} (${TUNNEL_ID})"
else
  ok "Using existing tunnel ${TUNNEL_NAME} (${TUNNEL_ID})"
fi
INGRESS="$(printf '%s\n' "${NAMES[@]}" | jq -R . | jq -cs '[.[] | {hostname: ., service: "http://app:3000", originRequest: {}}] + [{service: "http_status:404"}]')"
res="$(cf PUT "/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" "$(jq -cn --argjson i "$INGRESS" '{config: {ingress: $i}}')")"
cf_ok "$res" || die "Could not set the tunnel routes: $(cf_err "$res")"
ok "Tunnel routes: ${NAMES[*]} -> http://app:3000"
res="$(cf GET "/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/token")"
cf_ok "$res" || die "Could not read the tunnel token: $(cf_err "$res")"
env_set TUNNEL_TOKEN "$(jq -r '.result' <<<"$res")"
env_set EDGE_MODE tunnel
env_set CLOUDFLARE_PROXY true
env_set TRUST_CF_CONNECTING_IP true
[[ -n "$(env_get PUBLIC_URL)" && "$(env_get PUBLIC_URL)" != *example.com* ]] || env_set PUBLIC_URL "https://${DOMAIN}"
ok "TUNNEL_TOKEN saved in .env.production (not printed); EDGE_MODE=tunnel"

# ---------------------------------------------------------------- 3. DNS
step "3/7 DNS"
TARGET="${TUNNEL_ID}.cfargotunnel.com"
for name in "${NAMES[@]}"; do
  res="$(cf GET "/zones/${ZONE_ID}/dns_records?name=${name}")"
  cf_ok "$res" || die "DNS API: $(cf_err "$res") (token needs Zone | DNS | Edit)"
  if jq -e --arg t "$TARGET" '.result[] | select(.type == "CNAME" and .content == $t)' >/dev/null <<<"$res"; then
    ok "$name -> tunnel (already set)"
    continue
  fi
  existing="$(jq -r '.result[] | select(.type == "A" or .type == "AAAA" or .type == "CNAME") | "\(.id) \(.type) \(.content)"' <<<"$res")"
  if [[ -n "$existing" ]]; then
    if [[ "$REPLACE_DNS" != "true" ]]; then
      warn "$name already has DNS records:"; sed 's/^[^ ]* /         /' <<<"$existing" >&2
      RECOVERY_HINT="run again with --replace-dns to point $name to the tunnel (the old values are printed so you can restore them)"
      die "DNS for $name was not changed"
    fi
    while read -r rid rtype rcontent; do
      log "Removing old record: $name $rtype $rcontent"
      cf DELETE "/zones/${ZONE_ID}/dns_records/${rid}" >/dev/null
    done <<<"$existing"
  fi
  res="$(cf POST "/zones/${ZONE_ID}/dns_records" "$(jq -cn --arg n "$name" --arg c "$TARGET" '{type: "CNAME", name: $n, content: $c, proxied: true, ttl: 1, comment: "DOQ Cloudflare Tunnel"}')")"
  cf_ok "$res" || die "Could not create the DNS record for $name: $(cf_err "$res")"
  ok "$name -> tunnel (proxied)"
done

# ---------------------------------------------------------------- 4. SSL / TLS
step "4/7 SSL/TLS settings"
setting() {
  local res; res="$(cf PATCH "/zones/${ZONE_ID}/settings/$1" "$(jq -cn --arg v "$2" '{value: $v}')")"
  if cf_ok "$res"; then ok "$1 = $2"; else warn "$1: $(cf_err "$res")"; fi
}
setting always_use_https on
setting min_tls_version 1.2
setting automatic_https_rewrites on
setting tls_1_3 on
setting browser_check on
setting security_level medium

# ---------------------------------------------------------------- 5. WAF custom rules
step "5/7 Firewall rules (WAF custom rules, free plan: 5)"
COUNTRIES="$(tr ', ' '\n\n' <<<"$ADMIN_COUNTRIES" | grep -E '^[A-Za-z]{2}$' | tr 'a-z' 'A-Z' | jq -R . | jq -rs 'map("\"" + . + "\"") | join(" ")')"
[[ -n "$COUNTRIES" ]] || COUNTRIES='"EG"'
WAF_RULES="$(jq -cn --arg c "$COUNTRIES" '[
  {description: "DOQ: block vulnerability scanners", action: "block", enabled: true,
   expression: "(http.request.uri.path contains \"/wp-\" or http.request.uri.path contains \".php\" or starts_with(http.request.uri.path, \"/.env\") or starts_with(http.request.uri.path, \"/.git\") or http.request.uri.path contains \"phpmyadmin\" or http.request.uri.path contains \"/cgi-bin\")"},
  {description: "DOQ: challenge admin pages from outside allowed countries", action: "managed_challenge", enabled: true,
   expression: ("(starts_with(http.request.uri.path, \"/admin\") and not ip.src.country in {" + $c + "})")}
]')"
if merge_phase http_request_firewall_custom "$WAF_RULES"; then
  ok "Blocked: /wp-*, *.php, /.env, /.git, phpmyadmin, /cgi-bin"
  ok "/admin from outside ${ADMIN_COUNTRIES}: Cloudflare challenge first"
else
  warn "Firewall rules were not applied (token needs Zone | Zone WAF | Edit)"
fi

# ---------------------------------------------------------------- 6. rate limit + cache
step "6/7 Rate limiting and cache"
# Free plan: 1 rule, 10 s period, 10 s block, counted per IP and data center
RL_RULES='[{"description":"DOQ: login, signup and OTP flood protection","action":"block","enabled":true,
  "expression":"(starts_with(http.request.uri.path, \"/auth\"))",
  "ratelimit":{"characteristics":["cf.colo.id","ip.src"],"period":10,"requests_per_period":20,"mitigation_timeout":10}}]'
current="$(cf GET "/zones/${ZONE_ID}/rulesets/phases/http_ratelimit/entrypoint")"
foreign="$(jq -r '[.result.rules[]? | select((.description // "") | startswith("DOQ:") | not)] | length' <<<"$current" 2>/dev/null || echo 0)"
if [[ "${foreign:-0}" != "0" ]]; then
  warn "The zone already has another rate limiting rule (the free plan allows only one): DOQ rule skipped"
elif merge_phase http_ratelimit "$(jq -c . <<<"$RL_RULES")"; then
  ok "Rate limit: /auth max 20 requests per 10 s per IP, then blocked for 10 s (the app adds 15/min on top)"
else
  warn "Rate limiting rule was not applied (token needs Zone | Zone WAF | Edit)"
fi
CACHE_RULES='[{"description":"DOQ: cache uploaded images","action":"set_cache_settings","enabled":true,
  "expression":"(starts_with(http.request.uri.path, \"/upload/\") or starts_with(http.request.uri.path, \"/uploads/\"))",
  "action_parameters":{"cache":true,"edge_ttl":{"mode":"override_origin","default":2592000},"browser_ttl":{"mode":"override_origin","default":604800}}}]'
if merge_phase http_request_cache_settings "$(jq -c . <<<"$CACHE_RULES")"; then
  ok "Uploaded images (random file names, never change) cached 30 days at Cloudflare"
else
  warn "Cache rule was not applied (token needs Zone | Cache Rules | Edit)"
fi

# ---------------------------------------------------------------- 7. R2
step "7/7 R2 storage (backups + images)"
res="$(cf GET "/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}")"
if cf_ok "$res"; then
  ok "R2 bucket ${BUCKET} exists"
else
  res="$(cf POST "/accounts/${ACCOUNT_ID}/r2/buckets" "$(jq -cn --arg n "$BUCKET" '{name: $n}')")"
  if cf_ok "$res"; then
    ok "Created R2 bucket ${BUCKET} (private)"
  elif [[ "$(cf_err "$res")" == *10042* ]]; then
    warn "R2 is not enabled on this account yet: dashboard -> R2 Object Storage -> enable (free 10 GB), then run this script again."
  else
    warn "R2 bucket not created: $(cf_err "$res") (token needs Account | Workers R2 Storage | Edit)"
  fi
fi
env_set R2_ACCOUNT_ID "$ACCOUNT_ID"
env_set R2_BUCKET "$BUCKET"
if [[ -z "$(env_get R2_ACCESS_KEY_ID)" && -t 0 ]]; then
  echo
  log "R2 needs its own S3 keys: dashboard -> R2 -> Manage API tokens -> Create API token"
  log "(permission: Object Read & Write, bucket: ${BUCKET}). Leave empty to do it later."
  read -r -p "R2 Access Key ID: " R2KEY
  if [[ -n "$R2KEY" ]]; then
    read -r -s -p "R2 Secret Access Key (hidden): " R2SECRET; echo
    env_set R2_ACCESS_KEY_ID "$R2KEY"
    [[ -n "$R2SECRET" ]] && env_set R2_SECRET_ACCESS_KEY "$R2SECRET"
    unset R2KEY R2SECRET
  fi
fi
if r2_configured; then
  ok "R2 keys are in .env.production: deploy.sh turns on encrypted backups + image copies to R2"
else
  warn "R2 keys not set yet (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.production). Backups stay on the server until then."
fi

echo
echo "${C_GRN}================ Cloudflare is ready ================${C_OFF}"
cat <<DONE
  Site        : https://${DOMAIN}  (SSL, firewall, rate limit and cache by Cloudflare)
  Server      : no web ports open; traffic arrives through tunnel "${TUNNEL_NAME}"
  Next        : sudo ./deploy.sh          (first deployment)
                sudo ./update.sh --no-pull (already deployed: switches to the tunnel)
  Mobile app  : GitHub -> Settings -> Secrets and variables -> Actions -> Variables:
                DOQ_API_URL = https://${DOMAIN}
DONE
