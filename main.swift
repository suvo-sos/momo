import Cocoa
import WebKit

// Momo — a live wallpaper for your portfolio.
//
// The app owns no chart and no window chrome: it paints one full-screen web
// view per display, pinned at desktop level so it sits above the real
// wallpaper and below your icons, and keeps it fed with market data.
//
// Live data comes from MomoFeed (MomoFeed.swift): the page cannot call the API
// itself, and the key must never travel inside the bundle.

final class MomoApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var windows: [NSWindow] = []
    private var statusItem: NSStatusItem!
    private var settingsWindow: NSWindow?
    private var settingsWeb: WKWebView?
    private var dragTimer: Timer?
    private let feed = MomoFeed()

    // MARK: - Paths

    static let agentLabel = "com.suvog.momo"
    static let agentPlist = NSHomeDirectory() + "/Library/LaunchAgents/" + agentLabel + ".plist"

    static let pageURL: URL = {
        let local = URL(fileURLWithPath: NSHomeDirectory() + "/momo/skin.html")
        if FileManager.default.fileExists(atPath: local.path) { return local }
        if let res = Bundle.main.resourceURL,
           FileManager.default.fileExists(atPath: res.appendingPathComponent("skin.html").path) {
            return res.appendingPathComponent("skin.html")
        }
        return local
    }()

    // Settings page. The working copy in ~/momo wins over the bundled copy so
    // edits to settings.html show up on the next open without a rebuild.
    static let settingsURL: URL = {
        let local = URL(fileURLWithPath: NSHomeDirectory() + "/momo/settings.html")
        if FileManager.default.fileExists(atPath: local.path) { return local }
        if let res = Bundle.main.resourceURL {
            let bundled = res.appendingPathComponent("settings.html")
            if FileManager.default.fileExists(atPath: bundled.path) { return bundled }
        }
        return local
    }()

    // MARK: - Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard singleInstance() else { return }

        buildWindows()
        buildMenu()
        ensureAgentPlist()

        feed.onSnapshot = { [weak self] json in self?.push(json) }
        feed.start()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    /// Two Momo processes would paint two wallpapers; keep the first.
    private func singleInstance() -> Bool {
        let me = ProcessInfo.processInfo.processIdentifier
        let others = NSWorkspace.shared.runningApplications.filter {
            $0.bundleIdentifier == Bundle.main.bundleIdentifier
                && $0.processIdentifier != me
                && $0.activationPolicy == .accessory
        }
        if let first = others.first, first.processIdentifier < me {
            NSApp.terminate(nil)
            return false
        }
        return true
    }

    // MARK: - Windows

    private func buildWindows() {
        for screen in NSScreen.screens {
            windows.append(makeWindow(for: screen))
        }
        loadPage()
    }

    private func makeWindow(for screen: NSScreen) -> NSWindow {
        let frame = screen.frame
        let win = NSWindow(contentRect: frame, styleMask: .borderless,
                           backing: .buffered, defer: false, screen: screen)
        win.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        win.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        win.isOpaque = true
        win.backgroundColor = NSColor.black
        win.hasShadow = false
        win.ignoresMouseEvents = true
        win.isReleasedWhenClosed = false
        win.setFrame(frame, display: true)

        let config = WKWebViewConfiguration()
        config.userContentController.addUserScript(
            WKUserScript(source: "window.__MOMO_HOST = true; window.__MOMO_THEME = \"\(feed.settings.theme)\";",
                         injectionTime: .atDocumentStart,
                         forMainFrameOnly: true)
        )

        let web = WKWebView(frame: frame, configuration: config)
        web.navigationDelegate = self
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")

        win.contentView = web
        win.orderFrontRegardless()
        return win
    }

    private func loadPage() {
        for win in windows {
            (win.contentView as? WKWebView)?.loadFileURL(
                MomoApp.pageURL,
                allowingReadAccessTo: MomoApp.pageURL.deletingLastPathComponent()
            )
        }
    }

    @objc private func screensChanged() {
        for win in windows { win.orderOut(nil); win.contentView = nil }
        windows.removeAll()
        buildWindows()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // A page that just loaded needs the current numbers, not the next poll.
        applyTheme(to: webView)
        if let json = feed.lastJSON { push(json, to: webView) }
    }

    // MARK: - Theme

    private func applyTheme(to only: WKWebView? = nil) {
        let js = "if(window.Momo){window.Momo.setTheme(\"\(feed.settings.theme)\");}"
        if let web = only {
            web.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    // MARK: - Data

    private func push(_ json: String, to only: WKWebView? = nil) {
        let js = "if(window.Momo){window.Momo.update(\(json));}"
        if let web = only {
            web.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
            if let pricesData = try? JSONSerialization.data(withJSONObject: feed.latestPrices),
               let pricesJson = String(data: pricesData, encoding: .utf8) {
                settingsWeb?.evaluateJavaScript("if(window.updatePriceData){window.updatePriceData(\(pricesJson));}", completionHandler: nil)
            }
        }
    }

    // MARK: - Menu

    private func buildMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = MomoApp.quartileImage()
            button.imagePosition = .imageOnly
            button.toolTip = "Momo"
        }

        let menu = NSMenu()

        // Brand line: the ▞ mark and the name in Momo orange. The menu must
        // not auto-disable it (nil action) or AppKit will grey the colour out.
        menu.autoenablesItems = false
        let orange = NSColor(srgbRed: 1.0, green: 0x6B / 255.0, blue: 0x35 / 255.0, alpha: 1)
        let brand = NSMenuItem(title: "Momo", action: nil, keyEquivalent: "")
        brand.isEnabled = true

        let title = NSMutableAttributedString()
        let mark = NSTextAttachment()
        let markImage = MomoApp.quartileImage(size: 22, color: orange)
        markImage.size = NSSize(width: 11, height: 11)
        mark.image = markImage
        mark.bounds = NSRect(x: 0, y: -2, width: 11, height: 11)
        title.append(NSAttributedString(attachment: mark))
        title.append(NSAttributedString(string: "  Momo", attributes: [
            .foregroundColor: orange,
            .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
        ]))
        brand.attributedTitle = title
        menu.addItem(brand)

        menu.addItem(.separator())

        // No key equivalent: macOS 26 decorates the "preferences" shortcut
        // with a gear, and this menu is branding, not a menu bar app.
        let settings = NSMenuItem(title: "Settings", action: #selector(openSettings), keyEquivalent: "")
        settings.target = self
        // A zero-area transparent image blanks the leading icon slot, which
        // macOS otherwise fills with a gear for anything settings-shaped.
        settings.image = MomoApp.blankImage()
        menu.addItem(settings)

        let quit = NSMenuItem(title: "Quit Momo", action: #selector(quit), keyEquivalent: "")
        quit.target = self
        quit.image = MomoApp.blankImage()
        menu.addItem(quit)

        statusItem.menu = menu
    }

    /// A 1×1 fully transparent image, used to occupy (and so blank) the
    /// leading icon slot of a menu item.
    static func blankImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 1, height: 1))
        image.lockFocus()
        NSColor.clear.set()
        NSRect(x: 0, y: 0, width: 1, height: 1).fill(using: .copy)
        image.unlockFocus()
        return image
    }

    /// ▞ + "Momo" baked into a single image, in brand orange.
    static func brandImage() -> NSImage {
        let orange = NSColor(srgbRed: 1.0, green: 0x6B / 255.0, blue: 0x35 / 255.0, alpha: 1)
        let height: CGFloat = 14
        let text = NSAttributedString(string: "Momo", attributes: [
            .foregroundColor: orange,
            .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
        ])
        let textSize = text.size()
        let markSize: CGFloat = 11
        let gap: CGFloat = 6
        let width = markSize + gap + ceil(textSize.width)

        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()

        let markRect = NSRect(x: 0, y: (height - markSize) / 2, width: markSize, height: markSize)
        orange.setFill()
        let q = (markSize - markSize * 0.1) / 2
        let r = q * 0.18
        NSBezierPath(roundedRect: NSRect(x: markRect.midX + markSize * 0.05, y: markRect.midY + markSize * 0.05,
                                        width: q, height: q), xRadius: r, yRadius: r).fill()
        NSBezierPath(roundedRect: NSRect(x: markRect.minX, y: markRect.minY,
                                        width: q, height: q), xRadius: r, yRadius: r).fill()

        text.draw(at: NSPoint(x: markSize + gap, y: (height - textSize.height) / 2))
        image.unlockFocus()
        return image
    }

    /// ▞ — quadrant upper-right + lower-left, same geometry as assets/logo.svg.
    static func quartileImage(size: CGFloat = 18, color: NSColor = .black) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size))
        image.lockFocus()
        color.setFill()

        let pad = size * 0.12
        let inner = size - pad * 2
        let gap = inner * 0.1
        let q = (inner - gap) / 2
        let r = q * 0.18

        NSBezierPath(roundedRect: NSRect(x: pad + q + gap, y: pad + q + gap, width: q, height: q),
                     xRadius: r, yRadius: r).fill()
        NSBezierPath(roundedRect: NSRect(x: pad, y: pad, width: q, height: q),
                     xRadius: r, yRadius: r).fill()

        image.unlockFocus()
        image.isTemplate = (color == .black)
        return image
    }



    // MARK: - Settings

    @objc private func openSettings() {
        let url = MomoApp.settingsURL

        // Reopening builds a brand-new web view every time, so an edited
        // settings.html (and the current saved config) is always picked up
        // from disk instead of being served from the previous window.
        if let existing = settingsWindow {
            existing.close()
            settingsWindow = nil
            settingsWeb = nil
        }

        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()

        // Hand the current config to the page before it boots; it renders the
        // form from this and never reads a file itself.
        if let data = try? JSONSerialization.data(withJSONObject: settingsDictionary()),
           let json = String(data: data, encoding: .utf8) {
            controller.addUserScript(WKUserScript(
                source: "window.__MOMO_SETTINGS = \(json);",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true))
        }
        controller.add(self, name: "momoSave")
        controller.add(self, name: "momoClose")
        controller.add(self, name: "momoDrag")
         controller.add(self, name: "momoFetchPrices")
         controller.add(self, name: "momoSearchTokens")
        config.userContentController = controller

        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 680, height: 820),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
         win.title = ""
         win.titleVisibility = .hidden
         win.titlebarAppearsTransparent = true
        win.isMovableByWindowBackground = true
        win.backgroundColor = .black
        win.level = .floating
        win.isReleasedWhenClosed = false

        let web = WKWebView(frame: win.contentView!.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        win.contentView = web
        win.center()

        win.setFrameAutosaveName("MomoSettings2")

        settingsWindow = win
        settingsWeb = web
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())

        NSApp.activate(ignoringOtherApps: true)
        win.makeKeyAndOrderFront(nil)
    }

    private func settingsDictionary() -> [String: Any] {
        let s = feed.settings
        return [
            "currency": s.currency,
            "refreshSeconds": s.refreshSeconds,
            "holdings": s.holdings.map { ["symbol": $0.symbol, "amount": $0.amount] },
            "theme": s.theme,
            "apiKey": s.apiKey,
            "prices": feed.latestPrices,
        ]
    }

    // Dragging the card by its header. The page owns the whole window surface,
    // so a mousedown in the header asks Swift to move the window: we follow the
    // real mouse position from the run loop instead of trusting web coordinates.
    private func beginHeaderDrag() {
        guard let win = settingsWindow else { return }
        dragTimer?.invalidate()

        let startMouse = NSEvent.mouseLocation
        let startOrigin = win.frame.origin

        let timer = Timer(timeInterval: 1.0 / 120.0, repeats: true) { [weak self, weak win] t in
            guard let self else { t.invalidate(); return }
            guard let win, NSEvent.pressedMouseButtons & 1 != 0 else {
                t.invalidate()
                self.dragTimer = nil
                return
            }
            let now = NSEvent.mouseLocation
            win.setFrameOrigin(NSPoint(x: startOrigin.x + (now.x - startMouse.x),
                                       y: startOrigin.y + (now.y - startMouse.y)))
        }
        // .common so the timer keeps firing while the mouse button is held.
        RunLoop.main.add(timer, forMode: .common)
        dragTimer = timer
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "momoDrag":
            beginHeaderDrag()

        case "momoClose":
            settingsWindow?.close()
            settingsWindow = nil
            settingsWeb = nil

        case "momoSave":
            guard let text = message.body as? String,
                  let data = text.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return }

            let settings = feed.settings
            if let k = obj["apiKey"] as? String, !k.isEmpty { settings.apiKey = k }
            if let c = obj["currency"] as? String, !c.isEmpty { settings.currency = c }
            if let r = obj["refreshSeconds"] as? Double, r >= 15 { settings.refreshSeconds = r }
            if let t = obj["theme"] as? String, !t.isEmpty { settings.theme = t }
            if let rows = obj["holdings"] as? [[String: Any]] {
                let parsed = rows.compactMap { row -> MomoHolding? in
                    guard let sym = row["symbol"] as? String,
                          let amt = (row["amount"] as? NSNumber)?.doubleValue ?? (row["amount"] as? Double),
                          !sym.isEmpty, amt > 0 else { return nil }
                    return MomoHolding(symbol: sym.uppercased(), amount: amt)
                }
                if !parsed.isEmpty { settings.holdings = parsed }
            }
            settings.save()
            feed.restart()
            applyTheme()

        case "momoFetchPrices":
            var symbols = feed.settings.holdings.map { $0.symbol }
            var currency = feed.settings.currency
            if let text = message.body as? String,
               let data = text.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let reqSymbols = obj["symbols"] as? [String], !reqSymbols.isEmpty {
                    symbols = reqSymbols
                }
                if let reqCurrency = obj["currency"] as? String, !reqCurrency.isEmpty {
                    currency = reqCurrency
                }
            }
            feed.fetchQuotes(symbols: symbols, currency: currency) { [weak self] prices, _ in
                guard let self = self, let prices = prices,
                      let data = try? JSONSerialization.data(withJSONObject: prices),
                      let json = String(data: data, encoding: .utf8) else { return }
                self.settingsWeb?.evaluateJavaScript("if(window.updatePriceData){window.updatePriceData(\(json));}")
            }

         case "momoSearchTokens":
             var query = ""
             var currency = feed.settings.currency
             if let text = message.body as? String,
                let data = text.data(using: .utf8),
                let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                 if let q = obj["query"] as? String { query = q }
                 if let c = obj["currency"] as? String, !c.isEmpty { currency = c }
             }
             feed.searchTokens(query: query, currency: currency) { [weak self] results in
                 guard let self = self,
                       let data = try? JSONSerialization.data(withJSONObject: results),
                       let json = String(data: data, encoding: .utf8) else { return }
                 self.settingsWeb?.evaluateJavaScript("if(window.renderTokenResults){window.renderTokenResults(\(json));}")
             }

         default:
             break
         }
    }


    @objc private func quit() {
        launchctl("unload", MomoApp.agentPlist)
        NSApp.terminate(nil)
    }

    // MARK: - Login item

    private func ensureAgentPlist() {
        let exe = Bundle.main.executablePath ?? NSHomeDirectory() + "/momo/momo"
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>Label</key><string>\(MomoApp.agentLabel)</string>
            <key>ProgramArguments</key><array><string>\(exe)</string></array>
            <key>RunAtLoad</key><true/>
            <key>KeepAlive</key><true/>
        </dict>
        </plist>
        """
        try? plist.write(toFile: MomoApp.agentPlist, atomically: true, encoding: .utf8)
    }

    private func launchctl(_ args: String...) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        p.arguments = args
        try? p.run()
        p.waitUntilExit()
    }
}

// MARK: - Entry point

let app = NSApplication.shared
let delegate = MomoApp()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
