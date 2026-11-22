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
    var apiKey: String = ""
    var currency: String = "USD"
    var refreshSeconds: Double = 60
    var theme: String = "aurora-panel"
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

    func load() {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: MomoSettings.path)),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        if let k = obj["apiKey"] as? String, !k.isEmpty { apiKey = k }
        if let c = obj["currency"] as? String, !c.isEmpty { currency = c }
        if let r = obj["refreshSeconds"] as? Double, r >= 15 { refreshSeconds = r }
        if let t = obj["theme"] as? String, !t.isEmpty { theme = t }
        if let hs = obj["holdings"] as? [[String: Any]] {
            let parsed = hs.compactMap { h -> MomoHolding? in
                guard let s = h["symbol"] as? String, let a = (h["amount"] as? NSNumber)?.doubleValue ?? (h["amount"] as? Double) else { return nil }
                return MomoHolding(symbol: s.uppercased(), amount: a)
            }
            if !parsed.isEmpty { holdings = parsed }
        }

        // Key can also come from the environment or the local .env, so the
        // repo never holds it.
        if apiKey.isEmpty {
            if let env = ProcessInfo.processInfo.environment["CMC_API_KEY"], !env.isEmpty {
                apiKey = env
            } else if let dotenv = try? String(contentsOfFile: NSHomeDirectory() + "/momo/.env", encoding: .utf8) {
                for line in dotenv.split(separator: "\n") where line.hasPrefix("CMC_API_KEY=") {
                    apiKey = String(line.dropFirst("CMC_API_KEY=".count)).trimmingCharacters(in: .whitespaces)
                }
            }
        }
    }

    func save() {
        let obj: [String: Any] = [
            "apiKey": apiKey,
            "currency": currency,
            "refreshSeconds": refreshSeconds,
            "theme": theme,
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
        guard !settings.apiKey.isEmpty else {
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
        req.setValue(settings.apiKey, forHTTPHeaderField: "X-CMC_PRO_API_KEY")
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
            guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let payload = root["data"] as? [String: Any]
            else {
                NSLog("Momo: could not parse response")
                DispatchQueue.main.async { completion(nil, nil) }
                return
            }

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

            coins.append([
                "symbol": h.symbol,
                "price": price,
                "change24h": pct,
            ])
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
        guard !settings.apiKey.isEmpty else { completion([]); return }
        var comps = URLComponents(string: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest")!
        comps.queryItems = [
            URLQueryItem(name: "limit", value: "200"),
            URLQueryItem(name: "convert", value: currency),
        ]
        var req = URLRequest(url: comps.url!)
        req.setValue(settings.apiKey, forHTTPHeaderField: "X-CMC_PRO_API_KEY")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 20
        URLSession.shared.dataTask(with: req) { data, _, err in
            if let err = err { NSLog("Momo: listings request failed \(err.localizedDescription)"); DispatchQueue.main.async { completion([]) }; return }
            guard let data = data else { NSLog("Momo: listings no data"); DispatchQueue.main.async { completion([]) }; return }
            guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                NSLog("Momo: listings parse root failed: \(String(data: data, encoding: .utf8)?.prefix(200) ?? "")")
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
