#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
code=$(curl -s -o /tmp/cmc.json -w '%{http_code}' \
  -H "X-CMC_PRO_API_KEY: $CMC_API_KEY" \
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH")
echo "HTTP $code"
head -c 600 /tmp/cmc.json; echo
