# Momo

> Your portfolio, on your desktop.

A live macOS wallpaper that turns your crypto holdings into ambient light. Up, the room glows green. Down, it cools to red. You learn how your day is going in half a second, without opening anything.

## Download

**macOS 13+** — no build needed:

<p align="center">
  <a href="https://github.com/suvo-sos/momo/releases/latest">
    <img src="https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white" width="400" alt="Download Momo for Mac">
  </a>
</p>

1. Open `Momo.dmg`, drag **Momo.app** into **Applications**, run it. A `▞` appears in your menu bar.
2. First open is blocked (not notarized) — fix it with: `xattr -d com.apple.quarantine /Applications/Momo.app`

Works out of the box with Momo's built-in CoinMarketCap key. If it runs out of credits, paste your own free key into **Settings → Your own CMC key**. Prefer to build it? See [Quick start](#quick-start).

<p align="center">
  <a href="https://www.apple.com/macos/"><img src="https://img.shields.io/badge/macOS-13%2B-black?logo=apple" alt="macOS"></a>
  <a href="https://www.swift.org/"><img src="https://img.shields.io/badge/Swift-5-orange?logo=swift" alt="Swift"></a>
  <a href="https://coinmarketcap.com/api/"><img src="https://img.shields.io/badge/CoinMarketCap-API-3861FB" alt="CoinMarketCap API"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <a href="https://dorahacks.io/"><img src="https://img.shields.io/badge/Build%20with%20CMC-Round%202-3861FB" alt="Build with CMC — Round 2"></a>
</p>

Built for **Build with CMC: API Hackathon, Round 2** (DoraHacks, 2026) — Track: **Data and Visualisation**.

---

## Screenshots

| Ledger | Scale |
|---|---|
| ![Ledger](docs/screenshots/ledger.png) | ![Scale](docs/screenshots/scale.png) |

| Dashboard | Settings |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Settings](docs/screenshots/settings.png) |

*Demo data.*

---

## Themes

4 backgrounds × 5 contents, mixed freely, with a live preview in Settings.

**Backgrounds:** Chrome Arcs, Anodized Ink, Laser Flow, Plasma Wave. Anodized Ink re-tints with the market — green up, red down.

**Contents:** Minimal, Dashboard, Focus, Ledger, Scale. Ledger is a curved gallery that steers toward your cursor; Scale is an accordion that opens the coin under your cursor.

---

## Quick start

Requires macOS 13+ and Xcode Command Line Tools (`xcode-select --install`).

```bash
git clone https://github.com/suvo-sos/momo.git
cd momo
./build.sh
open Momo.app
```

A LaunchAgent keeps it alive across login and crashes. Settings (holdings, currency, refresh, theme, your own key) lives in the menu bar.

## How it works

Swift polls the CoinMarketCap API every 60s, builds a small JSON snapshot, and pushes it into a `WKWebView` that paints the desktop. The API call lives in Swift, not JavaScript: the page loads from `file://` so `fetch` is blocked by CORS, and a key in page source would be a published key.

One limit: the wallpaper ignores mouse events, so only the cursor *position* reaches it (polled 30×/s). Ledger and Scale react to where your cursor is, not to clicks.

## The API

| Endpoint | Use | Cost |
|---|---|---|
| `v1/cryptocurrency/quotes/latest` | Price and 24h % per holding | 1 credit / request |
| `v1/cryptocurrency/listings/latest` | Coin list, logos, market data | 1 credit / request |

~1,440 credits/day at the 60s default — a free Startup key (15,000/month) lasts ~10 days; set a 5-minute refresh to last the month.

```http
GET https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL&convert=USD
X-CMC_PRO_API_KEY: <your key>
```

```json
{ "data": { "BTC": { "id": 1, "symbol": "BTC",
  "quote": { "USD": { "price": 91204.0, "percent_change_24h": 2.14 } } } },
  "status": { "error_code": 0, "credit_count": 1 } }
```

**Feedback for the CMC team:** no batched endpoint returns `logo` + `id` with price; `ohlcv/historical` is a higher tier than `quotes/historical` yet has the sane candle semantics; `content/*` being Professional-only removes the obvious way to explain a move; RWA endpoints returned `500 system busy` all session; the `500` from DEX/RWA comes inside a 200 envelope, which is easy to mis-handle.

---

MIT © 2026 Suvo — free to use, modify, and share. See [LICENSE](LICENSE).
