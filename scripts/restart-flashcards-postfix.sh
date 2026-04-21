#!/usr/bin/env sh
# Run self-hosted Postfix (boky/postfix) for flashcards app mail on the Docker
# "web" network. Only containers on that network can reach it (not published
# to the host by default). Outbound delivery still requires DNS (SPF/DKIM) for
# good deliverability to Gmail, etc.
#
# Usage: restart-flashcards-postfix.sh [DOMAIN]
# Example:  DOMAIN=kzt24.duckdns.org ./restart-flashcards-postfix.sh
#
# After this, set in api.env (flashcards-api):
#   SMTP_HOST=flashcards-postfix
#   SMTP_PORT=587
#   SMTP_TLS_INSECURE=true
#   MAIL_FROM=Карточки <noreply@DOMAIN>

set -eu

DOMAIN="${1:-kzt24.duckdns.org}"
NAME="flashcards-postfix"
NET="${DOCKER_WEB_NETWORK:-web}"
IMAGE="boky/postfix:latest"

echo "Removing old $NAME (if any)…"
docker rm -f "$NAME" 2>/dev/null || true

echo "Starting $NAME on network $NET (sender domain: $DOMAIN)…"
docker pull "$IMAGE" >/dev/null
docker run -d --name "$NAME" --restart unless-stopped --network "$NET" \
  -e "ALLOWED_SENDER_DOMAINS=${DOMAIN}" \
  -e "POSTFIX_myhostname=${DOMAIN}" \
  -e "TZ=Europe/Moscow" \
  "$IMAGE"

# Postfix needs a few seconds after supervisord before smtp(587) accepts connections;
# otherwise the API may get ECONNREFUSED on the first e-mail.
echo "Waiting for Postfix to accept SMTP…"
i=0
while [ "$i" -lt 30 ]; do
  if docker exec "$NAME" sh -c 'nc -z 127.0.0.1 587' 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done
sleep 2

echo "OK. Logs: docker logs -f $NAME"
docker logs --tail 25 "$NAME" || true
