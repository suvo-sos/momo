# CMC Skin — your portfolio as weather

CMC API Hackathon Round 2 · Track: Data and Visualisation · #BuildwithCMC

## One line

CMC Skin turns your Mac wallpaper into a live mirror of your portfolio: green
morning when you are up, volcanic sunset when you are down, fog when nothing
is happening.

## Why it is different

Every other entry will put numbers on a screen. CMC Skin puts the numbers
somewhere you already look, and encodes them as mood rather than text: the
scene's palette, sun height, haze, and drift are driven by the portfolio's
24h move, so you read your day in half a second without opening anything.

That makes the CMC data load-bearing: remove the API call and there is no
wallpaper at all.

## Core loop

1. Local companion server polls CMC on a timer and writes a cached snapshot.
2. `quotes/latest` for the basket, once per minute (1 credit per poll).
3. `global-metrics/quotes/latest` every 15 min for market context.
4. `fear-and-greed/latest` every 30 min for the weather's mood.
5. The wallpaper page reads the snapshot and renders a scene, lerping palette
   and terrain continuously instead of snapping between images.

## Scene mapping

| Portfolio 24h | Scene |
|---|---|
| > +3% | bright forest, high sun, clear ridges, slow upward drift |
| +0.5% .. +3% | calm green morning, soft haze |
| -0.5% .. +0.5% | grey fog, still air |
| -3% .. -0.5% | amber dusk, low sun |
| < -3% | volcanic red, sun on the horizon, heat shimmer |

Intensity scales with magnitude; per-coin contribution is visible as ridge
height, so one bad bag shows as one dark peak instead of hiding in the total.

## Screens

- **Wallpaper** — procedurally drawn landscape (canvas), portfolio value and
  24h % in small type at the edge, optional per-coin ribbon.
- **Settings** — token basket with weights, scene sensitivity, type size,
  refresh interval, alert threshold.
- **Browser preview** — same page served over HTTP so judges on any OS can
  open it.

## Architecture

```
CMC API ──> companion (Node, localhost) ──> snapshot.json
                        │
                        └──> serves the page at 127.0.0.1:PORT
                                     │
            ┌────────────────────────┴───────────────────────┐
        WKWebView (Swift wallpaper window)          any browser
```

The wallpaper engine is a fork of the author's own `web-wallpaper` macOS app:
a borderless window at `desktopWindow` level hosting a full-frame web view.
CMC integration is new; the window plumbing is pre-existing and disclosed.

Why the companion: a `file://` page cannot call the CMC API (CORS, no origin),
and the API key must never live in page source.

## Endpoints used

- `v1/cryptocurrency/quotes/latest` — per-coin price, 24h change, volume, market cap
- `v1/global-metrics/quotes/latest` — total market cap, BTC dominance, 24h volume
- `v1/fear-and-greed/latest` — sentiment index for the fog/haze amount
- `v1/tools/price-conversion` — non-USD display currencies

## Credits

- 1 credit per basket poll, 1/min = 1,440/day
- global metrics 96/day, fear & greed 48/day
- total ≈ 1,600/day, within the 15,000/month Startup tier

## Submission checklist

- [ ] Public repo, no key in history
- [ ] README: endpoints, one real request + response, setup, API feedback
- [ ] Demo video 2-3 min: wallpaper turning red live
- [ ] Deployed preview link (browser mode)
- [ ] X post with #BuildwithCMC
- [ ] Track: Data and Visualisation
