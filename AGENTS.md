# AGENTS.md — Momo

Live portfolio wallpaper for macOS, built on the CoinMarketCap API for
**Build with CMC: API Hackathon, Round 2** (DoraHacks, 2026).

---

## 1. Why this exists

The hackathon asks for "something that runs on CMC data" — a bot, dashboard,
agent tool, screener, anything a real person would use — and scores it:

| Criterion | Weight |
|---|---|
| Does it work | 30 |
| Usefulness to a real person | 25 |
| Interesting use of the API | 20 |
| Code quality and documentation | 15 |
| Presentation | 10 |

**Track: Data and Visualisation.** That track's 25-point line is "reveals
something genuinely non-obvious", so the ambiguity is resolved differently than
in a dashboard: the wallpaper is an *ambient* readout. You learn the state of
your portfolio in half a second, without opening anything, because the desktop
itself carries the mood.

Every other entry will put numbers in a window someone has to open. Momo puts
one number on the one surface that is always visible, and makes the colour of
the room mean something.

**Deadline:** 2026-12-09 23:59 UTC (2026-12-10 05:29 IST).

## 2. What it is, mechanically

A native macOS app that paints the desktop itself:

- one borderless `NSWindow` per display, at `CGWindowLevelForKey(.desktopWindow)`
  — above the real wallpaper, below Finder icons
- `collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`, so it
  survives Spaces and Mission Control
- `ignoresMouseEvents = true` — desktop icons and clicks keep working
- window content is a `WKWebView` running `skin.html`
- a `LaunchAgent` (`com.suvog.momo`) keeps it alive across login and crashes
- an accessory app: no Dock icon, a `▞` status item is the whole UI

The scene is HTML/canvas inside the webview. Swift owns windows, networking and
the menu; the page owns pixels.

## 3. Why the API call happens in Swift, not JavaScript

Three hard reasons:

1. **CORS.** The page is loaded from `file://`, so `fetch` to
   `pro-api.coinmarketcap.com` is blocked — the API sends no CORS headers.
2. **Key safety.** A `.dmg` is unzipped and inspected; an API key in page source
   is a published key. The hackathon rules also score committed keys against you.
3. **Caching and rate discipline.** One poller in Swift means one request per
   interval no matter how many displays are open.

So: `MomoFeed` polls, builds a small JSON snapshot, and pushes it into every
webview with `evaluateJavaScript("window.Momo.update({...})")`.

The page refuses to start its demo cycle when `window.__MOMO_HOST` is set
(injected at document start), so a real launch never shows fake numbers.

## 4. What the CMC API actually gives us on the Startup tier

Verified against the real key, not the docs:

**Works**

| Endpoint | Use |
|---|---|
| `v1/cryptocurrency/quotes/latest` | price, 24h %, volume per holding — the core call |
| `v1/cryptocurrency/listings/latest` | ranked market table, tags, logos |
| `v1/cryptocurrency/quotes/historical` | price/mcap/volume history, hourly or daily |
| `v1/cryptocurrency/map` | symbol → id, contract addresses |
| `v1/cryptocurrency/categories`, `category` | sectors and their aggregate stats |
| `v1/global-metrics/quotes/latest` | total mcap, volume, BTC/ETH dominance |
| `v3/fear-and-greed/latest` | sentiment index |
| `v1/tools/price-conversion` | arbitrary pair conversion |
| `v1/dex/token`, `v1/dex/liquidity-pairs` | on-chain tokens and pools |
| `v1/exchange/info` | exchange metadata |

**Blocked on this plan** (`error_code 1006`): `ohlcv/historical`, `trending/*`,
`trending/gainers-losers`, `exchange/listings`, `market-pairs`, `content/*`
(news), `community/trending`, `blockchain/statistics`, `price-performance-stats`.

**Broken right now:** all `real-world-assets/*` and `dex/pairs/*` return
`500 system busy`.

Credit model measured on the live key: current data is **1 credit per request**
regardless of symbol count; historical is **~1 credit per 100 data points**,
rounded up. Startup plan = 15,000 credits/month, 50 req/min, resetting on the
1st.

Momo's budget: 10 symbols, 1 request per 60s ≈ **1,440 credits/day**. Adjust
the interval in settings if that is too much.

## 5. Data flow

```
CMC API ──URLSession──> MomoFeed ──JSON──> evaluateJavaScript ──> skin.html
                          │                                        │
                          └──> ~/Library/Application Support/Momo/settings.json
```

Snapshot shape (the only contract between Swift and the page):

```json
{
  "portfolio": { "value": 24810.42, "change24h": 0.0121, "currency": "USD" },
  "coins": [{ "symbol": "BTC", "price": 91204, "change24h": 0.0214 }],
  "at": 1763726400000
}
```

The portfolio's `change24h` is weighted by holdings: each coin's price a day ago
is derived from its own `percent_change_24h`, so the total percentage reflects
the actual bag, not an average of percentages.

## 6. Files

| File | Role |
|---|---|
| `main.swift` | app, windows, status item, settings window, message bridge |
| `MomoFeed.swift` | settings model, CMC polling, snapshot building |
| `skin.html` | the wallpaper itself — total, ten rows, demo fallback |
| `settings.html` | settings card (holdings, currency, refresh) |
| `build.sh` | compiles, assembles `Momo.app`, signs ad-hoc |
| `assets/logo.svg` | vector mark: `▞` on `#FF6B35` |
| `assets/render_icon.py` | rasterises the logo to `AppIcon.icns` (no deps) |
| `assets/AppIcon.icns` | generated icon, copied into the bundle |
| `SPEC.md` | original concept note (partly superseded — see §9) |

State lives outside the repo, in `~/Library/Application Support/Momo/`:
`settings.json`, plus `target.txt`-style leftovers from the parent project are
gone.

## 7. Design

Palette:

| Token | Hex | Use |
|---|---|---|
| teal | `#0A7C6E` | settings page background |
| amber | `#F59E0B` | accent / status dot |
| orange | `#FF6B35` | brand, primary action, menu mark |
| paper | `#FAFAFA` | card surface, symbol colour |

The mark is `▞` (quadrant upper-right + lower-left), drawn as geometry — never
as a font glyph — so it renders identically in the menu bar, the icon and the
SVG.

Wallpaper typography: system font, tabular numerals, one value + one percentage
and ten rows. Nothing tweened, nothing animated, no charts. A wallpaper gets
half a second of attention; a chart at that distance is texture.

## 8. Build, run, reload

```zsh
cd ~/momo
./build.sh                 # compile + assemble + ad-hoc sign
open Momo.app              # run
pkill -f "Momo.app/Contents/MacOS/momo"; open ~/momo/Momo.app   # reload
```

Gotchas learned the hard way:

- `open` on the bare `momo` binary does nothing useful — it must be the `.app`.
- Two instances paint two wallpapers. `singleInstance()` keeps the first.
- A menu item with a `nil` action is auto-disabled and its colours grey out;
  the menu sets `autoenablesItems = false` and enables the brand item by hand.
- macOS decorates a `⌘,` "preferences" item with a gear, so Settings has no key
  equivalent.
- The API key is read from `settings.json`, then `$CMC_API_KEY`, then
  `~/momo/.env`. It is gitignored and must never enter the bundle.
- Not sandboxed: `allowingReadAccessTo:` is needed for the local page and the
  key file path.

## 9. Status

Done and working:

- app bundle, ad-hoc signed, icon, LaunchAgent, single instance
- live CMC polling with holdings-weighted 24h change
- wallpaper theme with total + ten holdings
- settings card in the brand palette, saved through a WKWebView bridge
- three-item menu (brand, Settings, Quit)
- logo (SVG + `.icns`), menu bar mark

Not done:

- only **one** wallpaper theme exists; four more were specified
- no demo/exhibition mode for a machine without the key
- no browser preview page (needed for judges who won't install anything)
- `.dmg` packaging, quarantine instructions, download page
- README (endpoints used, a real request + response, API feedback) — required
- demo video (2–3 min, required)
- X post with `#BuildwithCMC` linking the submission (required)
- DoraHacks submission with the track selected

## 10. Open decisions

- **Themes.** Five worlds were discussed (forest, coast, desert, snow, neon);
  the current build is one dark panel. A theme is a palette + composition pair,
  selected in settings, with the same P&L → mood mapping in each.
- **Signing.** Ad-hoc means "unidentified developer" on a downloaded copy. For a
  hackathon, ship the `xattr -d com.apple.quarantine` line on the download page
  rather than paying for a Developer ID.
- **Preview.** Judges on Windows cannot run a `.dmg`. Either publish a static
  page with a recorded snapshot, or accept that the video carries it (the
  current lean — most judges are on macOS).

## 11. API feedback for the submission

Things worth telling the CMC team, all reproduced on the Startup tier:

- `quotes/latest` is fine for a portfolio, but there is no batched endpoint that
  returns `logo` and `id` alongside price — resolving a symbol to an icon takes
  two endpoints plus caching.
- `ohlcv/historical` is behind a higher tier than `quotes/historical`, yet the
  former is the one with sane candle semantics. Reconstructing candles from
  quotes means knowing which of the two sampling conventions a client expects.
- `content/*` being Professional-only removes the obvious way to explain a
  price move; an "explain this move" endpoint would be the single most valuable
  addition for anything agentic.
- RWA endpoints returned `500 system busy` on every call for a full session,
  which makes the RWA track impossible to prototype against.
- Error `1006` ("plan doesn't support this endpoint") is clear; the `500` from
  DEX and RWA paths returns a 200 status envelope, which is easy to mis-handle.
