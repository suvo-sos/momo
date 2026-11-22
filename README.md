# Momo

Live portfolio wallpaper for macOS — one number on your desktop, powered by the CoinMarketCap API.

Momo paints your portfolio total and ten holdings straight onto the wallpaper, so you learn the state of your bag in half a second without opening anything. Built for **Build with CMC: API Hackathon 2026** — Data & Visualisation track.

## Download

Get the latest build (`.dmg` for drag-and-drop install, `.zip` as an alternative):

[![Download Momo](https://img.shields.io/github/v/release/suvo-sos/momo?include_prereleases&label=Momo%20v0.1.1&color=0070F3)](https://github.com/suvo-sos/momo/releases/latest)

**Direct links:**
- [Momo.dmg](https://github.com/suvo-sos/momo/releases/download/v0.1.1/Momo.dmg) — recommended (drag Momo.app into Applications)
- [Momo.zip](https://github.com/suvo-sos/momo/releases/download/v0.1.1/Momo.zip)

> **First launch:** Momo is ad-hoc signed (not notarized). macOS Gatekeeper will block it once. Right-click **Momo.app** → **Open** (then click Open), or go to **System Settings → Privacy & Security → Security** and click **Open Anyway** next to Momo. You only need to do this once.

## How it works

1. Launch Momo — it runs as a `▞` menu-bar item with no Dock icon.
2. Open **Settings** from the menu bar and add your crypto holdings (symbol + amount).
3. Your total + ten rows appear on the wallpaper and update automatically every 60 s.
4. Click **Reload** (⌘R) in the menu bar to fetch fresh prices on demand.

The API call happens in Swift, not JavaScript — one poller, one key (never in the page), no CORS issues. Works out of the box with a built-in CoinMarketCap key; add your own in Settings if you prefer.

## Build & run (macOS)

```zsh
git clone https://github.com/suvo-sos/momo.git
cd momo
./build.sh          # builds Momo.app, signs ad-hoc, makes Momo.dmg + Momo.zip
open Momo.app
```

Requires Xcode command line tools (`swiftc`). `Momo.app` and the built-in key (`BuiltinKey.swift`) are gitignored and never committed.

## Why this exists

Every other hackathon entry puts numbers in a window you have to open. Momo puts one number on the one surface that is always visible — the desktop itself — and makes the colour of the room mean something. Portfolio P&L → mood, ambient and instant.

**API used:** `v1/cryptocurrency/quotes/latest` (CoinMarketCap Startup tier). Current data is 1 credit per request regardless of symbol count; Momo's budget is ~10 symbols, 1 request per 60 s ≈ 1,440 credits/day.

---

Momo · suvo-sos · CMC API Hackathon 2026 · Data & Visualisation track