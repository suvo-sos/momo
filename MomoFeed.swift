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
        if let hs = obj["holdings"] as? [[String: Any]] {
            let parsed = hs.compactMap { h -> MomoHolding? in
                guard let s = h["symbol"] as? String, let a = h["amount"] as? Double else { return nil }
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

    // Called on the main thread whenever a fresh snapshot exists.
    var onSnapshot: ((String) -> Void)?

    func start() {
        settings.load()
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
        let symbols = settings.holdings.map { $0.symbol }.joined(separator: ",")
        guard !symbols.isEmpty else { return }
        guard !settings.apiKey.isEmpty else {
            NSLog("Momo: no API key configured")
            return
        }

        var comps = URLComponents(string: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest")!
        comps.queryItems = [
            URLQueryItem(name: "symbol", value: symbols),
            URLQueryItem(name: "convert", value: settings.currency),
        ]

        var req = URLRequest(url: comps.url!)
        req.setValue(settings.apiKey, forHTTPHeaderField: "X-CMC_PRO_API_KEY")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 20

        URLSession.shared.dataTask(with: req) { [weak self] data, _, err in
            guard let self else { return }
            if let err { NSLog("Momo: request failed \(err.localizedDescription)"); return }
            guard let data else { return }
            guard let json = self.buildSnapshot(from: data) else {
                NSLog("Momo: could not parse response")
                return
            }
            DispatchQueue.main.async {
                self.lastJSON = json
                self.onSnapshot?(json)
            }
        }.resume()
    }

    private func buildSnapshot(from data: Data) -> String? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let payload = root["data"] as? [String: Any]
        else { return nil }

        let currency = settings.currency
        var coins: [[String: Any]] = []
        var value = 0.0
        var prevValue = 0.0

        for h in settings.holdings {
            guard let entry = payload[h.symbol] as? [String: Any],
                  let quotes = entry["quote"] as? [String: Any],
                  let q = quotes[currency] as? [String: Any],
                  let price = q["price"] as? Double
            else { continue }

            let pct = (q["percent_change_24h"] as? Double ?? 0) / 100
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
}
