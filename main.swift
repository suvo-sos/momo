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

final class MomoApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var windows: [NSWindow] = []
    private var statusItem: NSStatusItem!
    private var pauseItem: NSMenuItem!
    private var loginItem: NSMenuItem!
    private var isPaused = false
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
        guard !isPaused else { return }
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

        pauseItem = NSMenuItem(title: "Pause Wallpaper", action: #selector(togglePause), keyEquivalent: "p")
        pauseItem.target = self
        menu.addItem(pauseItem)

        let reload = NSMenuItem(title: "Reload", action: #selector(reload), keyEquivalent: "r")
        reload.target = self
        menu.addItem(reload)

        let settings = NSMenuItem(title: "Open Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settings.target = self
        menu.addItem(settings)

        menu.addItem(.separator())

        loginItem = NSMenuItem(title: "Start at Login", action: #selector(toggleLogin), keyEquivalent: "")
        loginItem.target = self
        loginItem.state = FileManager.default.fileExists(atPath: MomoApp.agentPlist) ? .on : .off
        menu.addItem(loginItem)

        menu.addItem(.separator())

        let quit = NSMenuItem(title: "Quit Momo", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)

        statusItem.menu = menu
    }

    /// ▞ — quadrant upper-right + lower-left, same geometry as assets/logo.svg.
    static func quartileImage(size: CGFloat = 18) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size))
        image.lockFocus()
        NSColor.black.setFill()

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
        image.isTemplate = true
        return image
    }

    @objc private func togglePause() {
        isPaused.toggle()
        for win in windows {
            isPaused ? win.orderOut(nil) : win.orderFrontRegardless()
        }
        pauseItem.title = isPaused ? "Start Wallpaper" : "Pause Wallpaper"
        if !isPaused, let json = feed.lastJSON { push(json) }
    }

    @objc private func reload() {
        loadPage()
    }

    @objc private func openSettings() {
        NSWorkspace.shared.open(URL(fileURLWithPath: MomoSettings.path))
    }

    @objc private func toggleLogin() {
        let loaded = FileManager.default.fileExists(atPath: MomoApp.agentPlist)
        if loaded {
            launchctl("unload", "-w", MomoApp.agentPlist)
            try? FileManager.default.removeItem(atPath: MomoApp.agentPlist)
            loginItem.state = .off
        } else {
            ensureAgentPlist()
            launchctl("load", "-w", MomoApp.agentPlist)
            loginItem.state = .on
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
