# AGENTS.md — Momo

Native macOS web wallpaper. Shows image / video / HTML on the desktop
without touching the real system wallpaper.

## How it works (no system wallpaper change)

It does NOT call any wallpaper API (`NSWorkspace.setDesktopImage`,
`defaults com.apple.desktop`, etc.). The System Settings wallpaper stays
whatever it was.

Instead it fakes a wallpaper:

1. `main.swift` builds an `NSApplication` with `.accessory` policy
   (no Dock icon).
2. For each `NSScreen` it creates a borderless `NSWindow`:
   - `level = CGWindowLevelForKey(.desktopWindow)` — above the real
     wallpaper, below Finder icons
   - `collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`
     so it sticks on all Spaces and Mission Control
   - `isOpaque = true`, `hasShadow = false`
   - `ignoresMouseEvents = true` — click-through, desktop icons keep working
3. Each window hosts a full-frame `WKWebView` that loads:
   - HTML directly via `loadFileURL(target, allowingReadAccessTo: /)`
   - image (`png/jpg/webp/gif/svg/...`) via a generated `wrapper.html`
     (fullscreen `<img cover>` + clock overlay, zero fade)
   - video (`mp4/mov/m4v/webm`) via `wrapper.html` with
     `<video autoplay muted playsinline> + loop when enabled`
4. A `LaunchAgent` (`com.suvog.webwallpaper`) keeps it alive across
   login/crash: `RunAtLoad + KeepAlive`.
5. A Menu Bar item (`WALL`) exposes controls. Apple gives no third-party
   Control Center API, so Menu Bar is the control panel.

## Files

- `main.swift` — all logic (windows, webviews, menu, persistence)
- `web-wallpaper` — compiled binary (`swiftc -O`)
- `mac-home-screen.html` — original centered clock page (legacy)
- `mac-home-screen-flip.html` — current page: bg photo + top-left white
  `HH:MM:SS` + bottom-left Bengali date, no overlay fade
- `target.txt` — one line, absolute path of current bg
  (html, image, or video). Falls back to `mac-home-screen.html`.
- `hackathons.json` — source of truth for Hackathon Process card:
  array of `{name, start, end, prize, url}`. Pages fetch it at runtime.
- `hack_hidden.txt` — `1` hides Hackathon card, `0`/missing shows it.
- `datetime_hidden.txt` — `1` hides date & time, `0`/missing shows it.
- Loop is enforced on every page (not just wrapper): `didFinish` installs a persistent enforcer (1s sweep + MutationObserver) that sets `v.loop`, replays `ended` videos, and adds `loop=1&playlist=id` to YouTube embed iframes. Finite-loop gif/webp get `data-loop-ms` (probed in Swift from file headers) and restart via timestamp-tracked offscreen preload + swap (survives node replacement). Video supervisor (500ms) force-seeks paused-near-end freezes, reloads on decoder error, and rescues mid-stream stalls; healthy playback is never touched.
- `video_muted.txt` — `1`/missing mutes video, `0` enables sound.
- `video_loop.txt` — `1`/missing loops video, `0` plays once.
- `video_fit.txt` — `cover` (default, fullscreen fill) / `contain`
  (fit inside, letterbox) / `stretch` (fill, ignore aspect).
- `wrapper.html` — generated at runtime for image/video picks
- `~/Library/LaunchAgents/com.suvog.momo.plist` — autostart
  (outside repo, points at this dir's binary)

Background photo itself (e.g. `5e2a5c12....jpg`) lives outside the repo
and is referenced by absolute `file://` URL.

## Current UI

- Time: top-left, white, `HH:MM:SS` 24h, `text-shadow` for readability.
- Date: bottom-left (`left:42px bottom:36px`), white, Bengali:
  days `রবিবার..শনিবার`, months `জানুয়ারি..ডিসেম্বর`,
  digits converted `0-9 → ০-৯`. Bengali font stack:
  `'Noto Sans Bengali','Bangla MN'`.
- No scrim/fade — image shows as-is per user request.

## Build / run

```zsh
# build
swiftc -O -o /Users/suvog/momo/momo \
  /Users/suvog/momo/main.swift -framework Cocoa -framework WebKit

# restart under launchd
pkill -f "momo/momo"
launchctl unload ~/Library/LaunchAgents/com.suvog.momo.plist 2>/dev/null
launchctl load -w ~/Library/LaunchAgents/com.suvog.momo.plist

# status
ps aux | grep "[m]omo/momo"
launchctl list | grep momo
cat "$HOME/Library/Application Support/Momo/target.txt"
```

## Menu (WALL icon)

- `Set Background…` — `NSOpenPanel`, writes choice to `target.txt`,
  calls `loadTargetInAllWindows()`.
- `Reset Background` — deletes `target.txt`, reloads default.
- `Pause / Start Wallpaper` — `orderOut` / `orderFrontRegardless`.
- `Reload` — re-runs `loadTargetInAllWindows()`.
- `✓ Start at Login` — `launchctl load -w / unload -w` toggle.
- `Hide/Show Date & Time (⌘T)` — JS toggles `.top-right,.date-bottom` + default page clock, persists in `datetime_hidden.txt`, re-applied on every load.
- `Hide/Show Hackathon Card (⌘H)` — JS toggles `.hack-wrap`,
  persists in `hack_hidden.txt`, re-applied on every load.
- `🔁 Video Loop: On / Off (⌘L)` — toggles repeat for videos AND finite-loop gif/webp, persists in `video_loop.txt`, reloads when turning On. Videos: `loop` attr + `ended` re-play listener + 500ms watchdog (`VIDEO_LOOP` in wrapper). Animated gif/webp with finite loop count are auto-restarted at their natural duration (parsed from file headers); native-infinite and static images untouched.
- `Video Fit: Fill Screen / Fit Inside / Stretch (⌘F)` — cycles how any
  video fills the screen, persists in `video_fit.txt`, reloads.
- `Edit Hackathons… (⌘E)` — popup JSON editor for
  `hackathons.json` (name, start, end, prize, url), saves + Reloads.
- `Quit Wallpaper` — `launchctl unload` (no `-w`, so next login still
  starts) + `NSApp.terminate`. With `KeepAlive`, a bare terminate would
  respawn, so unload-first is required to actually quit.

## Notes / gotchas

- App is unsandboxed, so `allowingReadAccessTo: /` works for arbitrary
  local images/videos. Sandboxing it would break file access.
- `allowedFileTypes` uses deprecated API (warning only) — still works.
- Multi-display: one window per `NSScreen.screens` at launch; plugging a
  monitor later needs a Reload/restart to pick it up.
- Real desktop icons/Finder stay interactive because windows ignore mouse.
  Flip to `ignoresMouseEvents = false` in `main.swift` if an interactive
  page is ever needed (breaks icon clicks).
- `wrapper.html` is overwritten on every image/video load — don't hand-edit.
- To change clock style, edit BOTH `mac-home-screen-flip.html` (live page)
  and `wrapperHTML()` in `main.swift` (future picks), then rebuild.
