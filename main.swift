import Cocoa
import WebKit

class WallDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var windows: [NSWindow] = []
    var statusItem: NSStatusItem!
    var pauseItem: NSMenuItem!
    var hackItem: NSMenuItem!
    var loginItem: NSMenuItem!
    var clickItem: NSMenuItem!
    var videoSoundItem: NSMenuItem!
    var videoLoopItem: NSMenuItem!
    var clockItem: NSMenuItem!
    var fitItem: NSMenuItem!
    var isPaused = false
    var isHackHidden = false
    var isClockHidden = false
    var isClickable = false
    var autoClick = true
    var videoMuted = true
    var videoLooped = true
    var hoverTimer: Timer?
    // Read-only assets: inside the .app bundle when packaged, repo dir in dev.
    static let baseDir: String = {
        if let res = Bundle.main.resourceURL,
           FileManager.default.fileExists(atPath: res.appendingPathComponent("skin.html").path) {
            return res.path
        }
        return "/Users/suvog/momo"
    }()

    // Writable state: never inside the bundle.
    static let stateDir: String = {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory() + "/Library/Application Support")
        let dir = support.appendingPathComponent("Momo")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.path
    }()

    let agentPlist = NSHomeDirectory() + "/Library/LaunchAgents/com.suvog.momo.plist"
    let defaultHTML = WallDelegate.baseDir + "/skin.html"
    let targetStore = WallDelegate.stateDir + "/target.txt"
    let hackFlag = WallDelegate.stateDir + "/hack_hidden.txt"
    let clockFlag = WallDelegate.stateDir + "/datetime_hidden.txt"
    let hackStore = WallDelegate.stateDir + "/hackathons.json"
    let wrapperPath = WallDelegate.stateDir + "/wrapper.html"
    let videoFlag = WallDelegate.stateDir + "/video_muted.txt"
    let videoLoopFlag = WallDelegate.stateDir + "/video_loop.txt"
    let videoFitFlag = WallDelegate.stateDir + "/video_fit.txt"
    var editWindow: NSWindow!
    var editText: NSTextView!

    func run(_ args: String...) {
        let p = Process()
        p.launchPath = "/bin/launchctl"
        p.arguments = args
        try? p.run()
    }

    func currentTargetURL() -> URL {
        if let s = try? String(contentsOfFile: targetStore, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           !s.isEmpty, FileManager.default.fileExists(atPath: s) {
            return URL(fileURLWithPath: s)
        }
        return URL(fileURLWithPath: defaultHTML)
    }

    func saveTarget(_ url: URL) {
        try? url.path.write(toFile: targetStore, atomically: true, encoding: .utf8)
    }

    func hackathonsJS() -> String {
        if let s = try? String(contentsOfFile: hackStore, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           !s.isEmpty, s.hasPrefix("[") {
            return s
        }
        return "[]"
    }

    func wrapperHTML(mediaTag: String, videoLoop: Bool? = nil) -> String {
        let loopJS = (videoLoop == false) ? "0" : "1"
        return """
        <!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
        *{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
        body{font-family:'SF Pro Display',Helvetica,Arial,'Noto Sans Bengali','Bangla MN',sans-serif;overflow:hidden;background:#000}
        .bg{position:fixed;inset:0}.bg img,.bg video{width:100%;height:100%;object-fit:cover;display:block;background:#000}
        .bg video.fit-contain{object-fit:contain}.bg video.fit-stretch{object-fit:fill}
        .top-right{position:fixed;top:36px;right:42px;z-index:5;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.55);pointer-events:none;text-align:right}
        .time{font-family:'Poppins',-apple-system,'SF Pro Display','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:62px;font-weight:400;letter-spacing:.01em;line-height:1;font-variant-numeric:tabular-nums}
        .date-bottom{position:fixed;left:42px;bottom:36px;z-index:5;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.55);pointer-events:none;font-family:'Noto Sans Bengali','Bangla MN','Bangla Sangam MN',sans-serif;font-size:21px;font-weight:400;letter-spacing:.02em}
        :root{--hack-bg:linear-gradient(165deg,rgba(28,28,34,.82),rgba(14,14,18,.72));--hack-border:rgba(255,255,255,.14);--hack-text:#fff;--hack-muted:rgba(255,255,255,.68);--hack-pill:rgba(255,255,255,.12)}
        .hack-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;pointer-events:none;padding:24px}
        .hack-card{width:min(600px,92vw);min-height:420px;background:var(--hack-bg);border:1px solid var(--hack-border);border-radius:24px;padding:28px 28px 20px;color:var(--hack-text);backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);box-shadow:0 32px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);font-family:'Poppins',-apple-system,'SF Pro Display','Helvetica Neue',Arial,'Noto Sans Bengali','Bangla MN',sans-serif;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;pointer-events:auto}
        .hack-card::before{content:"";position:absolute;top:0;left:28px;right:28px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)}
        .hack-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .hack-title{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;display:flex;align-items:center;gap:9px}
        .hack-title::before{content:"";width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 12px #4ade80;animation:hackpulse 2s infinite}
        @keyframes hackpulse{50%{opacity:.35}}
        .hack-count{font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:999px;background:rgba(74,222,128,.14);border:1px solid rgba(74,222,128,.32);color:#bbf7d0}
        .hack-sub{font-size:13px;color:var(--hack-muted);margin-bottom:16px}
        .hack-list{list-style:none;display:flex;flex-direction:column;gap:12px}
        .hack-item{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045));border:1px solid rgba(255,255,255,.13);border-radius:16px;padding:18px 20px}
        .hack-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
        .hack-name{font-size:19px;font-weight:600;line-height:1.3;letter-spacing:-.01em;flex:1;min-width:0}
        .hack-prize{font-weight:600;color:#ffd88a;background:rgba(255,216,138,.1);border:1px solid rgba(255,216,138,.25);padding:4px 11px;border-radius:8px;white-space:nowrap;flex-shrink:0}
        .hack-dates{font-size:11.5px;color:var(--hack-muted);margin-bottom:4px;letter-spacing:.06em;text-transform:uppercase}
        .hack-progress{height:6px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin:10px 0 0}
        .hack-progress i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#4ade80,#22d3ee);border-radius:999px;transition:width 1s linear}
        .hack-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
        .hack-left{color:#fff;font-weight:600;font-variant-numeric:tabular-nums;background:rgba(255,255,255,.08);padding:4px 11px;border-radius:8px;white-space:nowrap;flex-shrink:0}
        .hack-link{flex:1;min-width:0;display:inline-block;margin-top:0;font-size:12.5px;color:#9ecbff;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;background:rgba(158,203,255,.08);padding:6px 11px;border-radius:8px;border:1px solid rgba(158,203,255,.18);pointer-events:auto;cursor:pointer}
        .hack-foot{margin-top:16px;font-size:11px;color:var(--hack-muted);text-align:center;opacity:.75}
        </style></head><body>
        <div class="bg">\(mediaTag)</div>
        <div class="top-right"><div class="time" id="t">—</div></div>
        <div class="date-bottom" id="d">—</div>
        <section class="hack-wrap" aria-label="Hackathon process"><div class="hack-card" role="region" aria-labelledby="hack-title"><div class="hack-header"><div class="hack-title" id="hack-title">Hackathon Process</div><div class="hack-count" id="hack-count">— ongoing</div></div><div class="hack-sub">Joined &bull; live submission countdown (Kolkata time)</div><ul class="hack-list" id="hack-list"></ul><div class="hack-foot">Hover the card and click the link directly • WALL → Open Links works too</div></div></section>
        <script>
        var bnDigits=['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
        function bn(s){return String(s).replace(/[0-9]/g,function(ch){return bnDigits[+ch];});}
        function tick(){var d=new Date();var pad=function(n){return String(n).padStart(2,'0');};var days=['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];var months=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];var h12=d.getHours()%12||12;document.getElementById('t').textContent=h12+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+' '+(d.getHours()<12?'AM':'PM');document.getElementById('d').textContent=days[d.getDay()]+', '+months[d.getMonth()]+' '+bn(d.getDate());}
        tick();setInterval(tick,1000);
        var HACKATHONS=\(hackathonsJS());
        function fmtLeft(ms){if(ms<=0)return 'Submissions closed';var s=Math.floor(ms/1000);var d=Math.floor(s/86400);s%=86400;var h=Math.floor(s/3600);var m=Math.floor(s%3600/60);var sec=s%60;var p=function(n){return String(n).padStart(2,'0');};if(d>0)return d+'d '+p(h)+'h '+p(m)+'m';if(h>0)return h+'h '+p(m)+'m '+p(sec)+'s';return p(m)+'m '+p(sec)+'s';}
        function fmtD(iso){var d=new Date(iso);if(isNaN(d.getTime()))return '';try{var f=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});var p={};f.formatToParts(d).forEach(function(x){p[x.type]=x.value;});return p.day+' '+p.month+' '+p.year+', '+p.hour+':'+p.minute+' IST';}catch(e){var q=function(n){return String(n).padStart(2,'0');};return d.getFullYear()+'-'+q(d.getMonth()+1)+'-'+q(d.getDate());}}
        function renderHacks(){var now=Date.now();var ul=document.getElementById('hack-list');if(!ul)return;ul.innerHTML='';var open=0;HACKATHONS.forEach(function(h){var endKey=h.end||h.deadline;var endT=new Date(endKey).getTime();var startT=h.start?new Date(h.start).getTime():NaN;var t=endT-now;if(t>0)open++;var prog=0;if(!isNaN(startT)&&!isNaN(endT)&&endT>startT){prog=Math.min(100,Math.max(0,(now-startT)/(endT-startT)*100));}else if(t<=0){prog=100;}var li=document.createElement('li');li.className='hack-item';var left=fmtLeft(t);li.innerHTML='<div class="hack-top"><div class="hack-name"></div><span class="hack-prize"></span></div><div class="hack-dates"></div><div class="hack-progress"><i></i></div><div class="hack-bottom"><a class="hack-link" rel="noopener"></a><span class="hack-left" aria-live="polite"></span></div>';li.querySelector('.hack-name').textContent=h.name;li.querySelector('.hack-dates').textContent=(h.start?fmtD(h.start)+' - ':'')+fmtD(endKey);li.querySelector('.hack-prize').textContent='● '+(h.prize||'');li.querySelector('.hack-left').textContent='⏳ '+left;li.querySelector('.hack-progress i').style.width=prog.toFixed(1)+'%';var a=li.querySelector('.hack-link');a.href=h.url;a.textContent=String(h.url).split('//').pop()+' ↗';ul.appendChild(li);});var c=document.getElementById('hack-count');if(c)c.textContent=open+' ongoing';}
        renderHacks();setInterval(renderHacks,1000);
        fetch('hackathons.json').then(function(r){return r.json();}).then(function(j){if(j&&j.length){HACKATHONS=j;renderHacks();}}).catch(function(){});
        var VIDEO_LOOP=\(loopJS);
        function nearEnd(v){try{var d=v.duration,ct=v.currentTime;return (isFinite(d)&&d>1&&isFinite(ct)&&ct>=d-0.25);}catch(e){return false;}}
        function kickPlay(v){try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
        function enforceVideoLoop(){var vs=document.querySelectorAll('video');vs.forEach(function(v){var want=(typeof VIDEO_LOOP==='undefined'||VIDEO_LOOP!==0);try{v.loop=want;}catch(e){}if(!v.__loopHooked){v.__loopHooked=true;try{v.addEventListener('ended',function(){if(typeof VIDEO_LOOP!=='undefined'&&VIDEO_LOOP===0)return;try{v.currentTime=0;}catch(e){}kickPlay(v);});}catch(e){}try{v.addEventListener('canplay',function(){if(typeof VIDEO_LOOP==='undefined'||VIDEO_LOOP!==0){if(v.paused)kickPlay(v);}});}catch(e){}}if(!want)return;if(v.error){try{v.load();}catch(e){}kickPlay(v);v.__supStall=0;return;}if(v.ended||(v.paused&&nearEnd(v))){try{v.currentTime=0;}catch(e){}kickPlay(v);v.__supStall=0;return;}if(v.paused){v.__supStall=(v.__supStall||0)+1;if(v.__supStall>=12&&!nearEnd(v)){try{v.currentTime=0;}catch(e){}v.__supStall=0;}kickPlay(v);return;}try{var ct=v.currentTime;if(ct===v.__supT){v.__supStall=(v.__supStall||0)+1;if(v.__supStall>=6)kickPlay(v);if(v.__supStall>=12){try{v.currentTime=0;}catch(e){}kickPlay(v);v.__supStall=0;}}else{v.__supStall=0;v.__supT=ct;}}catch(e){}});}
        function swapRestartImg(im){try{var s=im.getAttribute('src');if(!s)return;var ni=new Image();ni.className=im.className;var ms=im.getAttribute('data-loop-ms');if(ms)ni.setAttribute('data-loop-ms',ms);ni.onload=function(){try{if(im.parentNode)im.parentNode.replaceChild(ni,im);}catch(e){}};ni.src=s;}catch(e){}}
        function gifLoopInfo(u8){var total=0,n=0,hasNet=false,loopN=0;for(var i=0;i+8<=u8.length;i++){if(u8[i]===33&&u8[i+1]===249&&u8[i+2]===4){var cs=u8[i+4]|(u8[i+5]<<8);total+=(cs===0?10:cs)*10;n++;}}for(var j=0;j+19<=u8.length;j++){if(u8[j]===33&&u8[j+1]===255&&u8[j+2]===11){var tag='';for(var k=0;k<11;k++)tag+=String.fromCharCode(u8[j+3+k]);if(tag==='NETSCAPE2.0'&&u8[j+14]===3&&u8[j+15]===1){hasNet=true;loopN=u8[j+16]|(u8[j+17]<<8);}}}return{frames:n,total:total,infinite:(hasNet&&loopN===0)};}
        function webpLoopInfo(u8){if(u8.length<21||!(u8[0]===82&&u8[1]===73&&u8[2]===70&&u8[3]===70))return{frames:0,total:0,infinite:true};var total=0,frames=0,loopN=0,hasAnim=false;var dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);var off=12;while(off+8<=u8.length){var tag=String.fromCharCode(u8[off],u8[off+1],u8[off+2],u8[off+3]);var sz=dv.getUint32(off+4,true);if(tag==='ANIM'&&off+14<=u8.length){hasAnim=true;loopN=u8[off+12]|(u8[off+13]<<8);}if(tag==='ANMF'){if(off+24>u8.length)break;var dur=u8[off+20]|(u8[off+21]<<8)|(u8[off+22]<<16);total+=dur;frames++;}if(sz>u8.length)break;off+=8+sz+(sz&1);}return{frames:frames,total:total,infinite:(hasAnim&&loopN===0)};}
        function scheduleImgLoop(im){if(im.__imgLoopScheduled)return;im.__imgLoopScheduled=true;if(im.getAttribute('data-loop-ms'))return;var att=im.getAttribute('src')||'';fetch(im.src).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer();}).then(function(buf){var u8=new Uint8Array(buf);var low=att.toLowerCase().split('#')[0].split('?')[0];var info={frames:0,total:0,infinite:true};if(low.slice(-4)==='.gif')info=gifLoopInfo(u8);else if(low.slice(-5)==='.webp')info=webpLoopInfo(u8);if(!info.infinite&&info.frames>1&&info.total>0){try{im.setAttribute('data-loop-ms',String(info.total));}catch(e){}}}).catch(function(){});}
        function enforceImgLoop(){try{if(typeof VIDEO_LOOP!=='undefined'&&VIDEO_LOOP===0)return;var list=document.querySelectorAll('.bg img');var now=Date.now();var any=false;for(var i=0;i<list.length;i++){var im=list[i];var ms=parseInt(im.getAttribute('data-loop-ms')||'0',10);if(!(ms>0)){var s=(' '+(im.getAttribute('src')||'')).toLowerCase();if(s.indexOf('.gif')>=0||s.indexOf('.webp')>=0)scheduleImgLoop(im);continue;}any=true;var last=parseInt(im.getAttribute('data-loop-last')||'0',10);if(!last){im.setAttribute('data-loop-last',String(now));continue;}if(now-last>=ms){im.setAttribute('data-loop-last',String(now));swapRestartImg(im);}}if(any&&!window.__imgLoopTimer){window.__imgLoopTimer=setInterval(function(){try{enforceImgLoop();}catch(e){}},500);}}catch(e){}}
        enforceVideoLoop();enforceImgLoop();setInterval(enforceVideoLoop,500);
        </script></body></html>
        """
    }

    func loadTargetInAllWindows() {
        let target = currentTargetURL()
        let ext = target.pathExtension.lowercased()
        let imgExts = ["png","jpg","jpeg","webp","gif","bmp","tiff","tif","svg"]
        let vidExts = ["mp4","mov","m4v","webm"]
        for w in windows {
            guard let web = w.contentView as? WKWebView else { continue }
            if imgExts.contains(ext) {
                var imgTag = "<img src=\"\(target.absoluteString)\" />"
                if let ms = finiteAnimDurationMS(file: target) {
                    imgTag = "<img src=\"\(target.absoluteString)\" data-loop-ms=\"\(ms)\" />"
                }
                let html = wrapperHTML(mediaTag: imgTag, videoLoop: videoLooped)
                try? html.write(to: URL(fileURLWithPath: wrapperPath), atomically: true, encoding: .utf8)
                web.loadFileURL(URL(fileURLWithPath: wrapperPath), allowingReadAccessTo: URL(fileURLWithPath: "/"))
            } else if vidExts.contains(ext) {
                let loopAttr = videoLooped ? " loop" : ""
                let html = wrapperHTML(mediaTag: "<video class=\"fit-\(videoFitMode())\" autoplay muted\(loopAttr) playsinline preload=\"auto\"><source src=\"\(target.absoluteString)\"></video>", videoLoop: videoLooped)
                try? html.write(to: URL(fileURLWithPath: wrapperPath), atomically: true, encoding: .utf8)
                web.loadFileURL(URL(fileURLWithPath: wrapperPath), allowingReadAccessTo: URL(fileURLWithPath: "/"))
            } else {
                web.loadFileURL(target, allowingReadAccessTo: URL(fileURLWithPath: "/"))
            }
        }
        updateMouseIgnoring()
        if isPaused { togglePause() }
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        if let s = try? String(contentsOfFile: hackFlag, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) {
            isHackHidden = (s == "1")
        }
        if let s = try? String(contentsOfFile: clockFlag, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) {
            isClockHidden = (s == "1")
        }
        if let s = try? String(contentsOfFile: videoFlag, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) {
            videoMuted = (s != "0")
        }
        if let s = try? String(contentsOfFile: videoLoopFlag, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) {
            videoLooped = (s != "0")
        }

        for screen in NSScreen.screens {
            let frame = screen.frame
            let win = NSWindow(
                contentRect: frame,
                styleMask: .borderless,
                backing: .buffered,
                defer: false,
                screen: screen
            )
            win.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
            win.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            win.isOpaque = true
            win.backgroundColor = NSColor.white
            win.hasShadow = false
            win.ignoresMouseEvents = true
            win.isReleasedWhenClosed = false
            win.setFrame(frame, display: true)

            let config = WKWebViewConfiguration()
            let web = WKWebView(frame: frame, configuration: config)
            web.navigationDelegate = self
            web.uiDelegate = self
            web.autoresizingMask = [.width, .height]
            web.setValue(false, forKey: "drawsBackground")
            // allow file + remote images (picsum)
            web.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
            win.contentView = web
            win.orderFrontRegardless()
            windows.append(win)
        }
        loadTargetInAllWindows()
        setupMenu()
        startHoverTimer()
    }

    func hackCount() -> Int {
        if let data = try? Data(contentsOf: URL(fileURLWithPath: hackStore)),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            return max(1, arr.count)
        }
        return 1
    }

    func startHoverTimer() {
        hoverTimer?.invalidate()
        hoverTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { [weak self] _ in
            self?.updateMouseIgnoring()
        }
    }

    func updateMouseIgnoring() {
        if isPaused || isHackHidden {
            for w in windows { w.ignoresMouseEvents = true }
            return
        }
        if !autoClick {
            for w in windows { w.ignoresMouseEvents = !isClickable }
            return
        }
        let mouse = NSEvent.mouseLocation
        let n = hackCount()
        for w in windows {
            let f = w.frame
            let cardW = min(600.0, f.width * 0.92)
            var cardH = 250.0 + Double(n) * 160.0
            cardH = max(420.0, min(cardH, f.height * 0.9))
            let cardX = f.minX + (f.width - cardW) / 2
            let cardY = f.minY + (f.height - cardH) / 2
            let inside = mouse.x >= cardX - 10 && mouse.x <= cardX + cardW + 10
                && mouse.y >= cardY - 10 && mouse.y <= cardY + cardH + 10
            w.ignoresMouseEvents = !inside
        }
    }

    func setupMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let btn = statusItem.button {
            btn.title = "MOMO"
            if let img = NSImage(systemSymbolName: "clock.fill", accessibilityDescription: "Wallpaper") {
                img.isTemplate = true
                btn.image = img
            }
        }
        let menu = NSMenu()
        let setBG = NSMenuItem(title: "Set Background…", action: #selector(setBackground), keyEquivalent: "")
        setBG.target = self
        menu.addItem(setBG)
        let resetBG = NSMenuItem(title: "Reset Background", action: #selector(resetBackground), keyEquivalent: "")
        resetBG.target = self
        menu.addItem(resetBG)
        menu.addItem(NSMenuItem.separator())
        pauseItem = NSMenuItem(title: "Pause Wallpaper", action: #selector(togglePause), keyEquivalent: "")
        pauseItem.target = self
        menu.addItem(pauseItem)
        let reload = NSMenuItem(title: "Reload", action: #selector(reloadAll), keyEquivalent: "r")
        reload.target = self
        menu.addItem(reload)
        hackItem = NSMenuItem(title: isHackHidden ? "Show Hackathon Card" : "Hide Hackathon Card", action: #selector(toggleHack), keyEquivalent: "h")
        hackItem.target = self
        menu.addItem(hackItem)
        clockItem = NSMenuItem(title: isClockHidden ? "Show Date & Time" : "Hide Date & Time", action: #selector(toggleClock), keyEquivalent: "t")
        clockItem.target = self
        menu.addItem(clockItem)
        let editHack = NSMenuItem(title: "Edit Hackathons…", action: #selector(openHackEditor), keyEquivalent: "e")
        editHack.target = self
        menu.addItem(editHack)
        let openLinks = NSMenuItem(title: "Open Hackathon Links", action: #selector(openHackLinks), keyEquivalent: "o")
        openLinks.target = self
        menu.addItem(openLinks)
        clickItem = NSMenuItem(title: "✓ Auto Click (links work)", action: #selector(toggleClickable), keyEquivalent: "c")
        clickItem.target = self
        menu.addItem(clickItem)
        videoSoundItem = NSMenuItem(title: videoMuted ? "🔇 Video Sound: Off" : "🔊 Video Sound: On", action: #selector(toggleVideoSound), keyEquivalent: "m")
        videoSoundItem.target = self
        menu.addItem(videoSoundItem)
        videoLoopItem = NSMenuItem(title: videoLooped ? "🔁 Video Loop: On" : "➡️ Video Loop: Off", action: #selector(toggleVideoLoop), keyEquivalent: "l")
        videoLoopItem.target = self
        menu.addItem(videoLoopItem)
        fitItem = NSMenuItem(title: fitTitle(for: videoFitMode()), action: #selector(cycleVideoFit), keyEquivalent: "f")
        fitItem.target = self
        menu.addItem(fitItem)
        loginItem = NSMenuItem(title: "✓ Start at Login", action: #selector(toggleLogin), keyEquivalent: "")
        loginItem.target = self
        menu.addItem(loginItem)
        menu.addItem(NSMenuItem.separator())
        let quit = NSMenuItem(title: "Quit Wallpaper", action: #selector(quitWall), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        statusItem.menu = menu
    }

    @objc func togglePause() {
        isPaused.toggle()
        for w in windows {
            if isPaused { w.orderOut(nil) } else { w.orderFrontRegardless() }
        }
        pauseItem.title = isPaused ? "Start Wallpaper" : "Pause Wallpaper"
    }

    @objc func reloadAll() {
        loadTargetInAllWindows()
    }

    func applyHackVisibility(to target: WKWebView? = nil) {
        let js = isHackHidden
            ? "var e=document.querySelector('.hack-wrap');if(e)e.style.display='none';"
            : "var e=document.querySelector('.hack-wrap');if(e)e.style.display='';"
        if let w = target {
            w.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        applyHackVisibility(to: webView)
        applyClockVisibility(to: webView)
        applyVideoSound(to: webView)
        applyVideoLoop(to: webView)
        installLoopEnforcer(to: webView)
    }

    func applyVideoSound(to target: WKWebView? = nil) {
        let js = videoMuted
            ? "var vs=document.querySelectorAll('video');vs.forEach(function(v){v.muted=true;});"
            : "var vs=document.querySelectorAll('video');vs.forEach(function(v){v.muted=false;v.volume=1;var p=v.play();if(p&&p.catch)p.catch(function(){});});"
        if let w = target {
            w.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    @objc func toggleVideoSound() {
        videoMuted.toggle()
        try? (videoMuted ? "1" : "0").write(toFile: videoFlag, atomically: true, encoding: .utf8)
        videoSoundItem.title = videoMuted ? "🔇 Video Sound: Off" : "🔊 Video Sound: On"
        applyVideoSound()
    }

    func applyVideoLoop(to target: WKWebView? = nil) {
        let js = videoLooped
            ? "try{VIDEO_LOOP=1;}catch(e){}var vs=document.querySelectorAll('video');vs.forEach(function(v){v.loop=true;if(v.ended){try{v.currentTime=0;}catch(e2){}}if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){});}});try{enforceImgLoop();}catch(e3){}"
            : "try{VIDEO_LOOP=0;}catch(e){}var vs=document.querySelectorAll('video');vs.forEach(function(v){v.loop=false;v.removeAttribute('loop');});"
        if let w = target {
            w.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    @objc func toggleVideoLoop() {
        videoLooped.toggle()
        try? (videoLooped ? "1" : "0").write(toFile: videoLoopFlag, atomically: true, encoding: .utf8)
        videoLoopItem.title = videoLooped ? "🔁 Video Loop: On" : "➡️ Video Loop: Off"
        if videoLooped {
            loadTargetInAllWindows()
        } else {
            applyVideoLoop()
            installLoopEnforcer()
        }
    }

    func finiteAnimDurationMS(file: URL) -> Int? {
        let ext = file.pathExtension.lowercased()
        guard ext == "gif" || ext == "webp" else { return nil }
        guard let data = try? Data(contentsOf: file, options: .mappedIfSafe),
              data.count > 16, data.count < 80_000_000 else { return nil }
        let b = [UInt8](data)
        if ext == "gif" {
            guard b.count > 13, b[0] == 0x47, b[1] == 0x49, b[2] == 0x46 else { return nil }
            var total = 0, n = 0
            var i = 0
            while i + 8 <= b.count {
                if b[i] == 0x21, b[i+1] == 0xF9, b[i+2] == 0x04 {
                    let cs = Int(b[i+4]) | (Int(b[i+5]) << 8)
                    total += (cs == 0 ? 10 : cs) * 10
                    n += 1
                }
                i += 1
            }
            var hasNet = false, loopN = 0
            let net: [UInt8] = [0x4E,0x45,0x54,0x53,0x43,0x41,0x50,0x45,0x32,0x2E,0x30]
            var j = 0
            while j + 19 <= b.count {
                if b[j] == 0x21, b[j+1] == 0xFF, b[j+2] == 0x0B {
                    var ok = true
                    for k in 0..<11 { if b[j+3+k] != net[k] { ok = false; break } }
                    if ok, b[j+14] == 0x03, b[j+15] == 0x01 {
                        hasNet = true
                        loopN = Int(b[j+16]) | (Int(b[j+17]) << 8)
                    }
                }
                j += 1
            }
            if hasNet, loopN == 0 { return nil }
            if n > 1, total > 0 { return total }
            return nil
        }
        guard b[0] == 0x52, b[1] == 0x49, b[2] == 0x46, b[3] == 0x46,
              b[8] == 0x57, b[9] == 0x45, b[10] == 0x42, b[11] == 0x50 else { return nil }
        func u32le(_ o: Int) -> Int {
            return Int(b[o]) | (Int(b[o+1]) << 8) | (Int(b[o+2]) << 16) | (Int(b[o+3]) << 24)
        }
        var off = 12, total = 0, frames = 0, hasAnim = false, loopN = 0
        while off + 8 <= b.count {
            let isAnim = b[off] == 65 && b[off+1] == 78 && b[off+2] == 73 && b[off+3] == 77
            let isANMF = b[off] == 65 && b[off+1] == 78 && b[off+2] == 77 && b[off+3] == 70
            let sz = u32le(off + 4)
            if isAnim, off + 14 <= b.count {
                hasAnim = true
                loopN = Int(b[off+12]) | (Int(b[off+13]) << 8)
            } else if isANMF {
                if off + 24 > b.count { break }
                total += Int(b[off+20]) | (Int(b[off+21]) << 8) | (Int(b[off+22]) << 16)
                frames += 1
            }
            if sz > b.count { break }
            off += 8 + sz + (sz & 1)
        }
        if hasAnim, loopN == 0 { return nil }
        if frames > 1, total > 0 { return total }
        return nil
    }

    func webLoopEnforcerJS() -> String {
        let flag = videoLooped ? "1" : "0"
        return """
        try{VIDEO_LOOP=\(flag);}catch(e){}(function(){if(window.__wallLoopInstalled)return;window.__wallLoopInstalled=true;
        function wantLoop(){return (typeof VIDEO_LOOP==='undefined'||VIDEO_LOOP!==0);}
        function fixVideo(v){try{v.loop=wantLoop();}catch(e){}if(!v.__wallHooked){v.__wallHooked=true;try{v.addEventListener('ended',function(){if(!wantLoop())return;try{v.currentTime=0;}catch(e){}try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}});}catch(e){}try{v.addEventListener('canplay',function(){if(wantLoop()&&(v.muted||v.hasAttribute('muted'))&&v.paused){try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}});}catch(e){}}}
        function fixYT(f){try{var s=f.getAttribute('src')||'';var tag1='youtube.com/embed/';var tag2='youtube-nocookie.com/embed/';var yi=s.indexOf(tag1);var tl=tag1.length;if(yi<0){yi=s.indexOf(tag2);tl=tag2.length;}if(yi<0)return;var rest=s.substring(yi+tl);var id='';for(var k=0;k<rest.length;k++){var c=rest.charAt(k);if(c==='?'||c==='&'||c==='#'||c==='/')break;id+=c;}if(!id)return;var u=s;if(u.indexOf('loop=')<0)u+=(u.indexOf('?')>=0?'&':'?')+'loop=1';if(u.indexOf('playlist=')<0)u+=(u.indexOf('?')>=0?'&':'?')+'playlist='+id;if(u!==s)f.setAttribute('src',u);}catch(e){}}
        function nearEndW(v){try{var d=v.duration,ct=v.currentTime;return (isFinite(d)&&d>1&&isFinite(ct)&&ct>=d-0.25);}catch(e){return false;}}
        function sweep(){try{var vs=document.querySelectorAll('video');for(var i=0;i<vs.length;i++){var v=vs[i];fixVideo(v);if(wantLoop()&&(v.ended||(v.paused&&nearEndW(v)))){try{v.currentTime=0;}catch(e){}try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}}var fs=document.querySelectorAll('iframe');for(var j=0;j<fs.length;j++){fixYT(fs[j]);}}catch(e){}}
        try{sweep();}catch(e){}try{setInterval(sweep,1000);}catch(e){}try{new MutationObserver(function(){sweep();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}})();
        """
    }

    func installLoopEnforcer(to target: WKWebView? = nil) {
        let js = webLoopEnforcerJS()
        if let w = target {
            w.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    @objc func cycleVideoFit() {
        let next: String
        switch videoFitMode() {
        case "cover": next = "contain"
        case "contain": next = "stretch"
        default: next = "cover"
        }
        try? next.write(toFile: videoFitFlag, atomically: true, encoding: .utf8)
        fitItem.title = fitTitle(for: next)
        loadTargetInAllWindows()
    }

    func videoFitMode() -> String {
        if let s = try? String(contentsOfFile: videoFitFlag, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           s == "contain" || s == "stretch" {
            return s
        }
        return "cover"
    }

    func fitTitle(for mode: String) -> String {
        switch mode {
        case "contain": return "Video Fit: Fit Inside"
        case "stretch": return "Video Fit: Stretch"
        default: return "Video Fit: Fill Screen"
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated,
           let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https" {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    @objc func toggleClickable() {
        if autoClick {
            autoClick = false
            isClickable = false
            clickItem.title = "Enable Auto Click"
        } else {
            autoClick = true
            clickItem.title = "✓ Auto Click (links work)"
        }
        updateMouseIgnoring()
    }

    @objc func openHackLinks() {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: hackStore)),
            let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            NSSound.beep()
            return
        }
        var opened = 0
        for h in arr {
            if let urlStr = h["url"] as? String,
               let url = URL(string: urlStr),
               let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                NSWorkspace.shared.open(url)
                opened += 1
            }
        }
        if opened == 0 { NSSound.beep() }
    }

    @objc func toggleHack() {
        isHackHidden.toggle()
        try? (isHackHidden ? "1" : "0").write(toFile: hackFlag, atomically: true, encoding: .utf8)
        hackItem.title = isHackHidden ? "Show Hackathon Card" : "Hide Hackathon Card"
        applyHackVisibility()
    }

    func applyClockVisibility(to target: WKWebView? = nil) {
        let js = isClockHidden
            ? "var s=document.querySelectorAll('.top-right,.date-bottom,.center,#t,#d,#big-time,#big-date');s.forEach(function(e){e.style.display='none';});"
            : "var s=document.querySelectorAll('.top-right,.date-bottom,.center,#t,#d,#big-time,#big-date');s.forEach(function(e){e.style.display='';});"
        if let w = target {
            w.evaluateJavaScript(js, completionHandler: nil)
        } else {
            for win in windows {
                (win.contentView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    @objc func toggleClock() {
        isClockHidden.toggle()
        try? (isClockHidden ? "1" : "0").write(toFile: clockFlag, atomically: true, encoding: .utf8)
        clockItem.title = isClockHidden ? "Show Date & Time" : "Hide Date & Time"
        applyClockVisibility()
    }

    @objc func openHackEditor() {
        NSApp.activate(ignoringOtherApps: true)
        if editWindow != nil {
            editWindow.makeKeyAndOrderFront(nil)
            return
        }
        let rect = NSRect(x: 0, y: 0, width: 620, height: 520)
        editWindow = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        editWindow.title = "Edit Hackathons"
        editWindow.center()
        editWindow.isReleasedWhenClosed = false
        guard let content = editWindow.contentView else { return }
        let scroll = NSScrollView(frame: NSRect(x: 20, y: 60, width: 580, height: 420))
        scroll.hasVerticalScroller = true
        scroll.autoresizingMask = [.width, .height]
        editText = NSTextView(frame: scroll.bounds)
        editText.isEditable = true
        editText.isRichText = false
        editText.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        editText.string = (try? String(contentsOfFile: hackStore, encoding: .utf8)) ?? "[]"
        editText.autoresizingMask = [.width, .height]
        scroll.documentView = editText
        content.addSubview(scroll)
        let hint = NSTextField(labelWithString: "JSON array — keys: name, start, end (ISO8601), prize, url")
        hint.frame = NSRect(x: 20, y: 36, width: 580, height: 18)
        content.addSubview(hint)
        let saveBtn = NSButton(title: "Save", target: self, action: #selector(saveHackEditor))
        saveBtn.frame = NSRect(x: 500, y: 8, width: 100, height: 28)
        saveBtn.keyEquivalent = "\r"
        content.addSubview(saveBtn)
        let cancelBtn = NSButton(title: "Cancel", target: self, action: #selector(closeHackEditor))
        cancelBtn.frame = NSRect(x: 390, y: 8, width: 100, height: 28)
        content.addSubview(cancelBtn)
        editWindow.makeKeyAndOrderFront(nil)
    }

    @objc func saveHackEditor() {
        let s = editText.string
        guard let data = s.data(using: .utf8),
            let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: String]],
            arr.allSatisfy({ $0["name"] != nil && $0["end"] != nil }) else {
            NSSound.beep()
            return
        }
        try? s.write(toFile: hackStore, atomically: true, encoding: .utf8)
        editWindow.orderOut(nil)
        loadTargetInAllWindows()
    }

    @objc func closeHackEditor() {
        editWindow.orderOut(nil)
    }

    @objc func setBackground() {
        NSApp.activate(ignoringOtherApps: true)
        let p = NSOpenPanel()
        p.canChooseFiles = true
        p.canChooseDirectories = false
        p.allowsMultipleSelection = false
        p.allowedFileTypes = ["png","jpg","jpeg","webp","gif","bmp","tiff","tif","svg","mp4","mov","m4v","webm","html","htm"]
        p.message = "Choose image, video or HTML for wallpaper"
        if p.runModal() == .OK, let url = p.url {
            saveTarget(url)
            loadTargetInAllWindows()
        }
    }

    @objc func resetBackground() {
        try? FileManager.default.removeItem(atPath: targetStore)
        loadTargetInAllWindows()
    }

    @objc func toggleLogin() {
        let enabled = loginItem.title.hasPrefix("✓")
        if enabled {
            run("unload", "-w", agentPlist)
            loginItem.title = "Start at Login"
        } else {
            run("load", "-w", agentPlist)
            loginItem.title = "✓ Start at Login"
        }
    }

    @objc func quitWall() {
        run("unload", agentPlist)
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let del = WallDelegate()
app.delegate = del
app.run()
