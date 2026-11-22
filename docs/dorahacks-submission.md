# DoraHacks submission copy — Momo

Fill this into the "Create a new Build" form at
dorahacks.io/hackathon/coinmarketcap-api-202611/build

## Name of your Build

Momo

## Brief description

Momo is a live macOS wallpaper that shows your crypto portfolio on your desktop. It turns green when you are up and red when you are down, so you always know how your day is going without opening an app.

## Tags

macOS, Crypto, Portfolio, CoinMarketCap, Data Visualization, Swift, Wallpaper

## Describe your Build

### The problem

I kept opening a portfolio app twenty times a day just to see one number. The desktop is the one surface that is always visible, and nothing lives there except a picture. So I put the portfolio on the desktop instead.

### How it works

Momo is a native macOS app I built with Swift. It polls the CoinMarketCap API for my holdings, builds a small snapshot (total value, holdings-weighted 24h change, price and change per coin), and pushes it into a web view that paints the desktop. One borderless window per display sits above the real wallpaper and below the icons, so the desktop itself becomes the readout. Holdings, currency, refresh rate, and theme all live in a menu bar Settings card.

### Key features

- Live prices from CoinMarketCap, refreshed every 60 seconds (adjustable)
- 4 backgrounds (Chrome Arcs, Anodized Ink, Laser Flow, Plasma Wave) and 5 contents (Minimal, Dashboard, Focus, Ledger, Scale), mixed freely
- Anodized Ink re-tints with the market: green when you are up, red when you are down
- Ledger is a curved gallery of holding cards that steers toward your cursor; Scale is an accordion that opens the coin under your cursor
- Your own CoinMarketCap key supported, with a built-in key so it works out of the box
- Download as a .dmg, no build needed

### Tech stack

Swift (Cocoa, WebKit, URLSession), HTML, CSS, JavaScript, CoinMarketCap API (quotes/latest and listings/latest).

### Hackathon requirements

- Track: Data and Visualisation
- GitHub: https://github.com/suvo-sos/momo
- Download: https://github.com/suvo-sos/momo/releases/latest (Momo.dmg for macOS 13+)
- Demo video: TODO (2-3 min, required)
- X post with #BuildwithCMC: TODO (required)

## Links for the form

- GitHub Repo: https://github.com/suvo-sos/momo
- Video: TODO — no demo video yet (required, 2-3 min)
- Website: https://github.com/suvo-sos/momo (no separate site; use the repo)
- X: TODO — post with #BuildwithCMC linking the submission (required)
- LinkedIn: (leave blank unless you want it)
