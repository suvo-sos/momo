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
    private let feed = MomoFeed()

    // MARK: - Paths

    static let agentLabel = "com.suvog.momo"
    static let agentPlist = NSHomeDirectory() + "/Library/LaunchAgents/" + agentLabel + ".plist"

    static let pageURL: URL = {
        if let res = Bundle.main.resourceURL,
           FileManager.default.fileExists(atPath: res.appendingPathComponent("skin.html").path) {
            return res.appendingPathComponent("skin.html")
        }
        return URL(fileURLWithPath: NSHomeDirectory() + "/momo/skin.html")
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
            WKUserScript(source: "window.__MOMO_HOST = true;",
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
        if let json = feed.lastJSON { push(json, to: webView) }
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

        // Brand line: the ▞ mark and the name, drawn as one image so the
        // menu cannot dim or re-tint it.
        let brand = NSMenuItem(title: "", action: nil, keyEquivalent: "")
        brand.image = MomoApp.brandImage()
        menu.addItem(brand)

        menu.addItem(.separator())

        let settings = NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settings.target = self
        menu.addItem(settings)

        let quit = NSMenuItem(title: "Quit Momo", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)

        statusItem.menu = menu
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
        if let existing = settingsWindow {
            existing.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let url: URL = {
            if let res = Bundle.main.resourceURL,
               FileManager.default.fileExists(atPath: res.appendingPathComponent("settings.html").path) {
                return res.appendingPathComponent("settings.html")
            }
            return URL(fileURLWithPath: NSHomeDirectory() + "/momo/settings.html")
        }()

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
        config.userContentController = controller

        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 540),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        win.title = "Momo"
        win.titlebarAppearsTransparent = true
        win.isMovableByWindowBackground = true
        win.backgroundColor = NSColor(srgbRed: 0.04, green: 0.48, blue: 0.43, alpha: 1)
        win.level = .floating
        win.isReleasedWhenClosed = false

        let web = WKWebView(frame: win.contentView!.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        win.contentView = web
        win.contentAspectRatio = NSSize(width: 4, height: 3)
        win.minSize = NSSize(width: 480, height: 360)
        win.center()

        win.setFrameAutosaveName("MomoSettings")

        settingsWindow = win
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
        ]
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "momoClose":
            settingsWindow?.close()
            settingsWindow = nil

        case "momoSave":
            guard let text = message.body as? String,
                  let data = text.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return }

            let settings = feed.settings
            if let c = obj["currency"] as? String, !c.isEmpty { settings.currency = c }
            if let r = obj["refreshSeconds"] as? Double, r >= 15 { settings.refreshSeconds = r }
            if let rows = obj["holdings"] as? [[String: Any]] {
                let parsed = rows.compactMap { row -> MomoHolding? in
                    guard let sym = row["symbol"] as? String, let amt = row["amount"] as? Double,
                          !sym.isEmpty, amt > 0 else { return nil }
                    return MomoHolding(symbol: sym.uppercased(), amount: amt)
                }
                if !parsed.isEmpty { settings.holdings = parsed }
            }
            settings.save()
            feed.restart()

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
