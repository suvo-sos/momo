import Foundation
import WebKit

// Momo — the data side.
//
// The webview cannot call the CMC API itself (no origin, no CORS, and the key
// would sit in plain sight inside an unzipped .app). So Swift owns the network:
// it polls the API, builds a small snapshot, and hands it to the page as JSON.

struct MomoHolding {
    var symbol: String
    var amount: Double
}

final class MomoSettings {
    /// The user's own key, typed in Settings. Empty means "use Momo's built-in key".
    var customApiKey: String = ""
    /// Last key from the old settings.json `apiKey` field. Dev fallback only:
    /// never shown in the UI, never written back to disk.
    var legacyApiKey: String = ""
    /// Key from $CMC_API_KEY / ~/momo/.env (dev machines). Never the built-in key.
    var devApiKey: String = ""
    /// Built-in key state, from the last CMC response: ok / exhausted / invalid / missing.
    var keyStatus: String = "ok"
    var currency: String = "USD"

    /// The key actually sent to CMC: the user's own key first, then the
    /// built-in key baked in at build time, then local dev sources.
    var activeKey: String {
        if !customApiKey.isEmpty { return customApiKey }
        if !BuiltinKey.value.isEmpty { return BuiltinKey.value }
        if !devApiKey.isEmpty { return devApiKey }
        return legacyApiKey
    }

    var keySource: String {
        if !customApiKey.isEmpty { return "custom" }
        if !BuiltinKey.value.isEmpty { return "builtin" }
        if !devApiKey.isEmpty || !legacyApiKey.isEmpty { return "local" }
        return "none"
    }

    /// Last 4 chars of the user's own key only, for a masked display.
    /// The built-in key is never shown, not even masked.
    var customKeyLast4: String {
        customApiKey.isEmpty ? "" : String(customApiKey.suffix(4))
    }
    var refreshSeconds: Double = 60
    var theme: String = "aurora-panel"
    var customBgs: [[String: String]] = [] // [{id, path, type, name}]
    var activeCustomBg: String = ""
    var launchAtLogin: Bool = true
    var holdings: [MomoHolding] = [
        MomoHolding(symbol: "BTC", amount: 0.12),
        MomoHolding(symbol: "ETH", amount: 1.4),
        MomoHolding(symbol: "SOL", amount: 9.5),
        MomoHolding(symbol: "BNB", amount: 0.8),
        MomoHolding(symbol: "XRP", amount: 320),
        MomoHolding(symbol: "DOGE", amount: 2400),
        MomoHolding(symbol: "ADA", amount: 900),
        MomoHolding(symbol: "AVAX", amount: 22),
        MomoHolding(symbol: "LINK", amount: 40),
        MomoHolding(symbol: "TON", amount: 120),
    ]

    static let path = NSHomeDirectory() + "/Library/Application Support/Momo/settings.json"
    static let backgroundsDir = NSHomeDirectory() + "/Library/Application Support/Momo/backgrounds"

    func load() {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: MomoSettings.path)),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        if let k = obj["customApiKey"] as? String { customApiKey = k }
        if let k = obj["apiKey"] as? String, !k.isEmpty { legacyApiKey = k }
        if let c = obj["currency"] as? String, !c.isEmpty { currency = c }
        if let r = obj["refreshSeconds"] as? Double, r >= 15 { refreshSeconds = r }
        if let t = obj["theme"] as? String, !t.isEmpty { theme = t }
        if let l = obj["launchAtLogin"] as? Bool { launchAtLogin = l }
        if let bgs = obj["customBgs"] as? [[String: Any]] {
            customBgs = bgs.compactMap { b in
                guard let id = b["id"] as? String, let path = b["path"] as? String else { return nil }
                return [
                    "id": id,
                    "path": path,
                    "type": (b["type"] as? String) ?? "image",
                    "name": (b["name"] as? String) ?? "Custom",
                ]
            }
        }
        if let a = obj["activeCustomBg"] as? String { activeCustomBg = a }
        if let hs = obj["holdings"] as? [[String: Any]] {
            let parsed = hs.compactMap { h -> MomoHolding? in
                guard let s = h["symbol"] as? String, let a = (h["amount"] as? NSNumber)?.doubleValue ?? (h["amount"] as? Double) else { return nil }
                return MomoHolding(symbol: s.uppercased(), amount: a)
            }
            if !parsed.isEmpty { holdings = parsed }
        }

        // Dev fallback: $CMC_API_KEY or ~/momo/.env. Only used when there is
        // no custom key and no built-in key was baked in at build time.
        if let env = ProcessInfo.processInfo.environment["CMC_API_KEY"], !env.isEmpty {
            devApiKey = env
        } else if let dotenv = try? String(contentsOfFile: NSHomeDirectory() + "/momo/.env", encoding: .utf8) {
            for line in dotenv.split(separator: "\n") where line.hasPrefix("CMC_API_KEY=") {
                devApiKey = String(line.dropFirst("CMC_API_KEY=".count)).trimmingCharacters(in: .whitespaces)
            }
        }
    }

    func save() {
        let dir = URL(fileURLWithPath: MomoSettings.path).deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let obj: [String: Any] = [
            // The built-in key is never written here, and the legacy `apiKey`
            // field is dropped on the next save, so the key stops living
            // in a plain-text file on the user's Mac.
            "customApiKey": customApiKey,
            "currency": currency,
            "refreshSeconds": refreshSeconds,
            "theme": theme,
            "customBgs": customBgs,
            "activeCustomBg": activeCustomBg,
            "launchAtLogin": launchAtLogin,
            "holdings": holdings.map { ["symbol": $0.symbol, "amount": $0.amount] },
        ]
        if let data = try? JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted]) {
            try? data.write(to: URL(fileURLWithPath: MomoSettings.path))
        }
    }
}

final class MomoFeed {
    let settings = MomoSettings()
    private var timer: Timer?
    private(set) var lastJSON: String?
    private(set) var latestPrices: [String: [String: Any]] = [:]

    // Cached market listings for token search (refreshed every 5 min).
    private var cachedListings: [[String: Any]] = []
    private var listingsCachedAt: Date?

    // Called on the main thread whenever a fresh snapshot exists.
    var onSnapshot: ((String) -> Void)?

    func start() {
        settings.load()
        // First run: write the defaults out so "Open Settings…" has a file to show.
        if !FileManager.default.fileExists(atPath: MomoSettings.path) { settings.save() }
        poll()
        schedule()
    }

    func schedule() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: max(15, settings.refreshSeconds), repeats: true) { [weak self] _ in
            self?.poll()
        }
    }

    func restart() {
        settings.load()
        schedule()
        poll()
    }

    func poll() {
        let symbols = settings.holdings.map { $0.symbol }
        guard !symbols.isEmpty else { return }
        fetchQuotes(symbols: symbols, currency: settings.currency) { [weak self] _, snapshot in
            guard let self = self, let snapshot = snapshot else { return }
            self.lastJSON = snapshot
            self.onSnapshot?(snapshot)
        }
    }

    func fetchQuotes(symbols: [String], currency: String, completion: @escaping ([String: [String: Any]]?, String?) -> Void) {
        let cleanSymbols = Array(Set(symbols.map { $0.trimmingCharacters(in: .whitespaces).uppercased() })).filter { !$0.isEmpty }
        guard !cleanSymbols.isEmpty else { completion(nil, nil); return }
        let key = settings.activeKey
        guard !key.isEmpty else {
            settings.keyStatus = "missing"
            NSLog("Momo: no API key configured")
            completion(nil, nil)
            return
        }

        var comps = URLComponents(string: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest")!
        comps.queryItems = [
            URLQueryItem(name: "symbol", value: cleanSymbols.joined(separator: ",")),
            URLQueryItem(name: "convert", value: currency),
        ]

        var req = URLRequest(url: comps.url!)
        req.setValue(key, forHTTPHeaderField: "X-CMC_PRO_API_KEY")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 20

        URLSession.shared.dataTask(with: req) { [weak self] data, _, err in
            guard let self = self else { return }
            if let err = err {
                NSLog("Momo: request failed \(err.localizedDescription)")
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }
            guard let data = data else {
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }
            guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                NSLog("Momo: could not parse response")
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }
            // CMC reports key problems in `status`, with no data payload.
            // This is how Settings learns the built-in key ran out of credits.
            if let status = root["status"] as? [String: Any],
               let code = (status["error_code"] as? NSNumber)?.intValue ?? (status["error_code"] as? Int),
               code != 0 {
                let msg = (status["error_message"] as? String ?? "").lowercased()
                if msg.contains("credit") || code == 1007 {
                    self.settings.keyStatus = "exhausted"
                } else if code == 1001 || code == 1002 {
                    self.settings.keyStatus = "invalid"
                } else {
                    self.settings.keyStatus = "error"
                }
                NSLog("Momo: CMC key error \(code): \(status["error_message"] as? String ?? "")")
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }
            guard let payload = root["data"] as? [String: Any] else {
                NSLog("Momo: could not parse response")
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }
            self.settings.keyStatus = "ok"

            var pricesMap: [String: [String: Any]] = [:]
            for sym in cleanSymbols {
                if let entry = self.findEntry(in: payload, for: sym),
                   let quotes = entry["quote"] as? [String: Any],
                   let q = quotes[currency] as? [String: Any],
                   let price = (q["price"] as? NSNumber)?.doubleValue ?? (q["price"] as? Double) {
                    let pct = ((q["percent_change_24h"] as? NSNumber)?.doubleValue ?? (q["percent_change_24h"] as? Double ?? 0))
                    pricesMap[sym] = [
                        "price": price,
                        "change24h": pct
                    ]
                }
            }

            let snapshot = self.buildSnapshot(from: payload, currency: currency)

            DispatchQueue.main.async {
                for (k, v) in pricesMap {
                    self.latestPrices[k] = v
                }
                completion(pricesMap, snapshot)
            }
        }.resume()
    }

    private func findEntry(in payload: [String: Any], for symbol: String) -> [String: Any]? {
        if let entry = payload[symbol] as? [String: Any] { return entry }
        if let arr = payload[symbol] as? [[String: Any]], let first = arr.first { return first }
        let upper = symbol.uppercased()
        if let entry = payload[upper] as? [String: Any] { return entry }
        if let arr = payload[upper] as? [[String: Any]], let first = arr.first { return first }

        for (k, v) in payload {
            if k.caseInsensitiveCompare(symbol) == .orderedSame {
                if let entry = v as? [String: Any] { return entry }
                if let arr = v as? [[String: Any]], let first = arr.first { return first }
            }
        }
        return nil
    }

    private func buildSnapshot(from payload: [String: Any], currency: String) -> String? {
        var coins: [[String: Any]] = []
        var value = 0.0
        var prevValue = 0.0

        for h in settings.holdings {
            guard let entry = findEntry(in: payload, for: h.symbol),
                  let quotes = entry["quote"] as? [String: Any],
                  let q = quotes[currency] as? [String: Any],
                  let price = (q["price"] as? NSNumber)?.doubleValue ?? (q["price"] as? Double)
            else { continue }

            let pct = (((q["percent_change_24h"] as? NSNumber)?.doubleValue ?? (q["percent_change_24h"] as? Double ?? 0))) / 100.0
            let bag = price * h.amount

            value += bag
            // value 24h ago, so the total's percentage is weighted by holdings
            prevValue += (price / (1 + pct)) * h.amount

            var coin: [String: Any] = [
                "symbol": h.symbol,
                "price": price,
                "change24h": pct,
                "amount": h.amount,
            ]
            if let id = (entry["id"] as? NSNumber)?.intValue ?? (entry["id"] as? Int) {
                coin["logo"] = "https://s2.coinmarketcap.com/static/img/coins/64x64/\(id).png"
            }
            coins.append(coin)
        }

        guard value > 0 else { return nil }

        let change = prevValue > 0 ? (value - prevValue) / prevValue : 0
        let snapshot: [String: Any] = [
            "portfolio": ["value": value, "change24h": change, "currency": currency],
            "coins": coins,
            "at": Int(Date().timeIntervalSince1970 * 1000),
        ]

        guard let out = try? JSONSerialization.data(withJSONObject: snapshot) else { return nil }
        return String(data: out, encoding: .utf8)
    }

    // MARK: - Token search via CMC listings

    func searchTokens(query: String, currency: String, completion: @escaping ([[String: Any]]) -> Void) {
        NSLog("Momo: searchTokens query='\(query)' currency='\(currency)' cached=\(cachedListings.count)")
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let stale = listingsCachedAt == nil || Date().timeIntervalSince(listingsCachedAt!) > 300
        if stale {
            fetchListings(currency: currency) { [weak self] listings in
                guard let self = self else { completion([]); return }
                NSLog("Momo: fetchListings returned \(listings.count) items")
                self.cachedListings = listings
                self.listingsCachedAt = Date()
                DispatchQueue.main.async { completion(self.filterListings(query: q)) }
            }
        } else {
            DispatchQueue.main.async { completion(self.filterListings(query: q)) }
        }
    }

    private func filterListings(query: String) -> [[String: Any]] {
        guard !query.isEmpty else {
            return Array(cachedListings.prefix(12))
        }
        let matches = cachedListings.filter { item in
            let sym = (item["symbol"] as? String ?? "").lowercased()
            let name = (item["name"] as? String ?? "").lowercased()
            return sym.contains(query) || name.contains(query)
        }
        return Array(matches.prefix(15))
    }

    private func fetchListings(currency: String, completion: @escaping ([[String: Any]]) -> Void) {
        let key = settings.activeKey
        guard !key.isEmpty else { completion([]); return }
        var comps = URLComponents(string: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest")!
        comps.queryItems = [
            URLQueryItem(name: "limit", value: "200"),
            URLQueryItem(name: "convert", value: currency),
        ]
        var req = URLRequest(url: comps.url!)
        req.setValue(key, forHTTPHeaderField: "X-CMC_PRO_API_KEY")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 20
        URLSession.shared.dataTask(with: req) { data, _, err in
            if let err = err { NSLog("Momo: listings request failed \(err.localizedDescription)"); DispatchQueue.main.async { completion([]) }; return }
            guard let data = data else { NSLog("Momo: listings no data"); DispatchQueue.main.async { completion([]) }; return }
            guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                NSLog("Momo: listings parse root failed: \(String(data: data, encoding: .utf8)?.prefix(200) ?? "")")
                DispatchQueue.main.async { completion([]) }; return
            }
            if let status = root["status"] as? [String: Any],
               let code = (status["error_code"] as? NSNumber)?.intValue ?? (status["error_code"] as? Int),
               code != 0 {
                let msg = (status["error_message"] as? String ?? "").lowercased()
                if msg.contains("credit") || code == 1007 {
                    self.settings.keyStatus = "exhausted"
                } else if code == 1001 || code == 1002 {
                    self.settings.keyStatus = "invalid"
                }
                NSLog("Momo: listings CMC key error \(code)")
                DispatchQueue.main.async { completion([]) }; return
            }
            guard let arr = root["data"] as? [[String: Any]] else {
                NSLog("Momo: listings no data array; status=\(root["status"] ?? "")")
                DispatchQueue.main.async { completion([]) }; return
            }
            var out: [[String: Any]] = []
            for entry in arr {
                guard let sym = entry["symbol"] as? String,
                      let name = entry["name"] as? String,
                      let id = entry["id"] as? Int else { continue }
                var price = 0.0
                var pct = 0.0
                if let quotes = entry["quote"] as? [String: Any],
                   let q = quotes[currency] as? [String: Any] {
                    price = (q["price"] as? NSNumber)?.doubleValue ?? (q["price"] as? Double ?? 0)
                    pct = (q["percent_change_24h"] as? NSNumber)?.doubleValue ?? (q["percent_change_24h"] as? Double ?? 0)
                }
                out.append([
                    "symbol": sym,
                    "name": name,
                    "id": id,
                    "price": price,
                    "change24h": pct,
                    "logo": "https://s2.coinmarketcap.com/static/img/coins/64x64/\(id).png",
                ])
            }
            DispatchQueue.main.async { completion(out) }
        }.resume()
    }
}
