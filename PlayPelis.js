// PlayPelis GrayJay Source v12 - Scraper multi-sitio optimizado y corregido
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = new Date().getTime();
var _feedMixed = 2;
var _orderChrono = 1;
var _searchLimit = 50;

try {
    if (typeof Type !== "undefined") {
        _feedMixed = Type.Feed.Mixed;
        _orderChrono = Type.Order.Chronological;
    }
} catch (e) {}

function initPlatformID() {
    if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
}

// ===================== HTTP y Utilidades =====================
function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var resp = http.GET(url, h);
        return resp.body || "";
    } catch (e) {
        return "";
    }
}

function httpGetJson(url, headers) {
    var body = httpGet(url, headers);
    try { return JSON.parse(body); } catch (e) { return null; }
}

function httpPost(url, body, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var resp = http.POST(url, body, h);
        return resp.body || "";
    } catch (e) {
        return "";
    }
}

function htmlDecode(s) {
    if (!s) return "";
    return String(s)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
        .replace(/&#x([0-9a-fA-F]+);/g, function (m, x) { return String.fromCharCode(parseInt(x, 16)); });
}

function stripTags(s) {
    if (!s) return "";
    return htmlDecode(String(s).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function getHost(url) {
    try {
        var m = String(url).match(/^https?:\/\/([^\/?#]+)/);
        return m ? m[1].toLowerCase() : "";
    } catch (e) { return ""; }
}

function getRoot(url) {
    try {
        var m = String(url).match(/^(https?:\/\/[^\/?#]+)/);
        return m ? m[1] : "";
    } catch (e) { return ""; }
}

function fullUrl(base, u) {
    if (!u) return "";
    u = String(u).trim();
    if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    return getRoot(base) + (u.indexOf("/") === 0 ? u : "/" + u);
}

function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function b64decode(s) {
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    s = String(s || "").replace(/[^A-Za-z0-9+/=]/g, "");
    var out = "";
    var buf = 0;
    var bits = 0;
    for (var i = 0; i < s.length; i++) {
        if (s[i] === "=") break;
        var v = b64.indexOf(s[i]);
        if (v < 0) continue;
        buf = (buf << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buf >> bits) & 255);
        }
    }
    return out;
}

function sortSources(sources) {
    var playable = [];
    var downloads = [];
    for (var i = 0; i < sources.length; i++) {
        if ((sources[i].name || "").indexOf("(Descarga)") !== -1) downloads.push(sources[i]);
        else playable.push(sources[i]);
    }
    return playable.concat(downloads);
}

function uniqueUrls(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var u = (list[i] || "").trim();
        if (!u) continue;
        if (seen[u]) continue;
        seen[u] = 1;
        out.push(u);
    }
    return out;
}

// ===================== Modelos GrayJay =====================
function mkThumb(url) {
    if (!url) return new Thumbnails([]);
    return new Thumbnails([new Thumbnail(url, 100)]);
}

function mkVideo(id, title, thumb, url, uploadDate, authorName) {
    initPlatformID();
    return new PlatformVideo({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: title || "Sin titulo",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, authorName || "PlayPelis", "https://playpelis.app"),
        uploadDate: uploadDate || _now,
        url: url,
        duration: 0,
        viewCount: 0,
        isLive: false
    });
}

function mkVideoSource(url, name, isHls) {
    var container = isHls ? "application/x-mpegURL" : "video/mp4";
    try {
        if (typeof HLSSource !== "undefined" && isHls) return new HLSSource({ url: url, name: name, duration: 0 });
        if (typeof VideoUrlSource !== "undefined") return new VideoUrlSource({ width: 1920, height: 1080, container: container, codec: "avc1.640028", name: name, bitrate: 4000000, duration: 0, url: url });
    } catch (e) {}
    return { plugin_type: "VideoUrlSource", width: 1920, height: 1080, container: container, codec: "avc1.640028", name: name, bitrate: 4000000, duration: 0, url: url };
}

function mkVideoDescriptor(videoSources) {
    try {
        if (typeof VideoSourceDescriptor !== "undefined") return new VideoSourceDescriptor(videoSources);
    } catch (e) {}
    return { plugin_type: "MuxVideoSourceDescriptor", isUnMuxed: false, videoSources: videoSources };
}

function mkDetail(id, name, thumb, url, videoUrls, description) {
    initPlatformID();
    var sources = [];
    for (var i = 0; i < videoUrls.length; i++) {
        var vItem = videoUrls[i] || {};
        var vUrl = typeof vItem === "string" ? vItem : (vItem.url || "");
        if (!vUrl) continue;
        var vName = typeof vItem === "string" ? ("Servidor " + (i + 1)) : (vItem.name || "Servidor " + (i + 1));
        var isHls = vUrl.indexOf(".m3u8") !== -1;
        sources.push(mkVideoSource(vUrl, vName, isHls));
    }
    var videoDesc = mkVideoDescriptor(sources);
    var detailsObj;
    try {
        detailsObj = new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "PlayPelis",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now,
            url: url,
            duration: 0,
            viewCount: 0,
            isLive: false,
            description: description || "",
            video: videoDesc,
            rating: null
        });
    } catch (e) {
        detailsObj = {
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "PlayPelis",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now,
            url: url,
            duration: 0,
            viewCount: 0,
            isLive: false,
            description: description || "",
            plugin_type: "PlatformVideoDetails",
            contentType: 1,
            video: videoDesc,
            rating: null
        };
    }
    return detailsObj;
}

// ===================== Resolvedores de Players =====================
function resolveDood(u) {
    try {
        var host = getHost(u);
        var base = "https://" + host;
        var m = String(u).match(/\/e\/([^\/?#]+)/);
        if (!m) return null;
        var embedId = m[1];
        var page = httpGet(base + "/e/" + embedId, { "Referer": base });
        var matches = page.match(/\/pass_md5\/[^'"]*/g);
        if (!matches || matches.length === 0) return null;
        var path = matches[0].replace(/"/g, "").split(",")[0];
        var md5 = httpGet(base + path, { "Referer": base });
        if (!md5 || md5.length < 8) return null;
        return { url: base + "/" + md5.trim() + "zUEJeL3mUN?token=" + embedId, name: "DoodStream", hls: false };
    } catch (e) { return null; }
}

function resolveStreamTape(u) {
    try {
        var pageUrl = String(u).replace(/\/v\//, "/e/");
        var page = httpGet(pageUrl, { "Referer": getHost(pageUrl) });
        var re = /robotlink'\)\.innerHTML = '(.+?)'\+ \('(.+?)'\)/g;
        var m = re.exec(page);
        if (!m || !m[1] || !m[2]) return null;
        return { url: "https:" + m[1] + m[2].substring(3), name: "StreamTape", hls: false };
    } catch (e) { return null; }
}

function resolveUqload(u) {
    try {
        var pageUrl = String(u).indexOf(".html") === -1 ? String(u) + ".html" : String(u);
        var page = httpGet(pageUrl, { "Referer": getRoot(pageUrl) });
        var re = /sources:\s*\[(.*?)\]/g;
        var m = re.exec(page);
        if (!m || !m[1]) return null;
        var first = m[1].replace(/"/g, "").split(",")[0];
        if (!first) return null;
        return { url: first, name: "Uqload", hls: false };
    } catch (e) { return null; }
}

function resolveVoe(u) {
    try {
        var page = httpGet(u, { "Referer": getRoot(u) });
        var re = /'(hls|mp4)':\s*'([^']+)'/g;
        var m = re.exec(page);
        var url = null;
        var isHls = false;
        while (m) {
            if (m[1] === "hls" || m[2].indexOf(".m3u8") !== -1) { url = m[2]; isHls = true; break; }
            if (!url) url = m[2];
            m = re.exec(page);
        }
        if (!url) return null;
        return { url: url, name: "Voe", hls: isHls };
    } catch (e) { return null; }
}

function resolveStreamSB(u) {
    try {
        var m = String(u).match(/(?:embed-)?([A-Za-z0-9]+)(?:\.html)?(?:\?.*)?$/);
        if (!m) return null;
        var embedId = m[1];
        var turboPage = httpGet("https://lvturbo.com/e/" + embedId, { "Referer": "https://sblongvu.com/" });
        var fileMatch = turboPage.match(/https:\/\/lvturbo\.com\/375[^'"]*/);
        if (!fileMatch) return null;
        var apiUrl = fileMatch[0];
        var json = httpGetJson(apiUrl, { "Origin": "https://sblongvu.com", "Referer": "https://sblongvu.com/", "watchsb": "sbstream" });
        if (!json || !json.stream_data) return null;
        var file = json.stream_data.file || json.stream_data.backup;
        if (!file) return null;
        return { url: file, name: "StreamSB", hls: true };
    } catch (e) { return null; }
}

function hostNameOf(u) {
    var h = getHost(u);
    var known = { "doodstream.com": "DoodStream", "watchsb.com": "StreamSB", "sbotweak.com": "StreamSB", "streamhide.to": "Streamhide", "streamhide.com": "Streamhide", "streamtape.com": "StreamTape", "uqload.com": "Uqload", "uqload.co": "Uqload", "voe.sx": "Voe", "streamlare.com": "StreamLare", "upstream.to": "Upstream", "mixdrop.is": "Mixdrop", "mixdrop.co": "Mixdrop", "mixdrop.to": "Mixdrop", "mega.nz": "Mega (Descarga)", "mediafire.com": "MediaFire (Descarga)" };
    if (known[h]) return known[h];
    if (h.indexOf("dood") !== -1) return "DoodStream";
    if (h.indexOf("sbembed") !== -1 || h.indexOf("sbplay") !== -1 || h.indexOf("sbfull") !== -1 || h.indexOf("sblongvu") !== -1 || h.indexOf("lvturbo") !== -1) return "StreamSB";
    return h.replace(/^www\./, "");
}

function resolvePlayerUrl(u) {
    if (!u) return null;
    var h = getHost(u);
    var resolved = null;
    if (h.indexOf("dood") !== -1 || h.indexOf("doodstream") !== -1) resolved = resolveDood(u);
    else if (h.indexOf("streamtape") !== -1) resolved = resolveStreamTape(u);
    else if (h.indexOf("uqload") !== -1) resolved = resolveUqload(u);
    else if (h.indexOf("voe.") !== -1 || h === "voe.sx") resolved = resolveVoe(u);
    else if (h.indexOf("watchsb") !== -1 || h.indexOf("sbembed") !== -1 || h.indexOf("sbplay") !== -1 || h.indexOf("sbfull") !== -1 || h.indexOf("sblongvu") !== -1 || h.indexOf("lvturbo") !== -1 || h.indexOf("sfast.") !== -1) resolved = resolveStreamSB(u);
    if (resolved) return resolved;
    return { url: u, name: hostNameOf(u), hls: u.indexOf(".m3u8") !== -1 };
}

function playerHostRegex() {
    return /(streamtape|dood|voe|uqload|watchsb|sbembed|sbplay|sbfull|sblongvu|lvturbo|streamlare|upstream|mixdrop|vidhide|mega\.nz|mediafire|sfast\.|vidcloud|embed69|apialfa|mycdn)/i;
}

function collectPlayerLinks(html, baseUrl) {
    var links = [];
    var reIframe = /<iframe[^>]*\bsrc=["']([^"']+)["']/gi;
    var m;
    while ((m = reIframe.exec(html))) links.push(fullUrl(baseUrl, m[1]));
    var reDataSrc = /<iframe[^>]*\bdata-src=["']([^"']+)["']/gi;
    while ((m = reDataSrc.exec(html))) links.push(fullUrl(baseUrl, m[1]));
    var reDataVideo = /\bdata-video=["']([^"']+)["']/gi;
    while ((m = reDataVideo.exec(html))) links.push(fullUrl(baseUrl, m[1]));
    var rePlayerHref = /<a[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
    while ((m = rePlayerHref.exec(html))) {
        var href = m[1];
        if (playerHostRegex().test(href) || href.indexOf("/vidurl/") !== -1 || href.indexOf("/video/") !== -1) {
            links.push(fullUrl(baseUrl, href));
        }
    }
    return uniqueUrls(links);
}

function collectEpisodes(html, baseUrl) {
    var out = [];
    var re = /<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(html))) {
        var href = m[1];
        var label = stripTags(m[2]);
        if (!href) continue;
        var isEp = /\/capitulo\//i.test(href) || /\/episodio/i.test(href) || /\/episode\//i.test(href) || /-season-/i.test(href) || /\/ep\//i.test(href) || /\/ver\//i.test(href) || /\/temporada\//i.test(href) || /episodios/i.test(href);
        if (isEp) {
            var full = fullUrl(baseUrl, href);
            if (out.indexOf(full) === -1) {
                out.push({ url: full, name: label || ("Episodio " + (out.length + 1)) });
            }
        }
    }
    return out;
}

function metadataFromPage(html, url) {
    var title = "";
    var thumb = "";
    var desc = "";
    var m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (m) title = stripTags(m[1]);
    if (!title) {
        m = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (!m) m = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
        if (m) title = htmlDecode(m[1]);
    }
    if (!title) {
        m = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (m) title = stripTags(m[1]);
    }
    m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (m) thumb = htmlDecode(m[1]);
    if (!thumb) {
        m = html.match(/<img[^>]*class=["'][^"']*poster[^"']*["'][^>]*src=["']([^"']+)["']/i);
        if (!m) m = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*poster/i);
        if (!m) m = html.match(/<img[^>]*class=["'][^"']*film-poster-img[^"']*["'][^>]*src=["']([^"']+)["']/i);
        if (m) thumb = fullUrl(url, m[1]);
    }
    m = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (m) desc = htmlDecode(m[1]);
    if (!desc) {
        m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (m) desc = htmlDecode(m[1]);
    }
    return { title: title, thumb: thumb, desc: desc };
}

function buildSourcesFromPage(html, url, maxSources) {
    var sources = [];
    var players = collectPlayerLinks(html, url);
    for (var i = 0; i < players.length && sources.length < maxSources; i++) {
        var resolved = resolvePlayerUrl(players[i]);
        if (!resolved) continue;
        var key = resolved.url;
        var dup = false;
        for (var j = 0; j < sources.length; j++) {
            if (sources[j].url === key) { dup = true; break; }
        }
        if (dup) continue;
        sources.push({ url: key, name: resolved.name, hls: resolved.hls });
    }
    return sources;
}

function resolveEpisodeLinks(epList, maxSources) {
    var sources = [];
    for (var i = 0; i < epList.length && sources.length < maxSources; i++) {
        var epUrl = epList[i].url;
        var epName = epList[i].name;
        var html = httpGet(epUrl, { "Referer": getRoot(epUrl) });
        if (!html) continue;
        var found = buildSourcesFromPage(html, epUrl, 3);
        for (var j = 0; j < found.length; j++) {
            var ok = true;
            for (var k = 0; k < sources.length; k++) {
                if (sources[k].url === found[j].url) { ok = false; break; }
            }
            if (ok) {
                sources.push({ url: found[j].url, name: epName + " (" + found[j].name + ")", hls: found[j].hls });
            }
        }
    }
    return sortSources(sources);
}

// ===================== Sitio: JkAnime =====================
function siteJkanimeSearch(query, limit) {
    var out = [];
    try {
        var slug = slugify(query);
        if (!slug) return out;
        var url = "https://jkanime.net/" + slug + "/";
        var html = httpGet(url, { "Referer": "https://jkanime.net/" });
        if (!html || html.indexOf("no encontrada") !== -1 || html.indexOf("<title>404") !== -1) return out;
        var meta = metadataFromPage(html, url);
        var thumb = "";
        var m = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/);
        if (!m) m = html.match(/<img[^>]*src=["']([^"']+(?:cover|portada|\.jpg))["']/);
        if (m) thumb = fullUrl(url, m[1]);
        var title = meta.title.replace(/\s*-\s*anime .*JkAnime/i, "").replace(/JkAnime/i, "").trim() || query;
        out.push({ title: title, url: url, thumb: thumb, type: "anime", site: "JkAnime" });
    } catch (e) {}
    return out;
}

var JKA_DASH = ["dash", "usuario", "notificaciones", "guardado", "historial", "aplicacion", "salir", "comentarios", "solicitudes", "logros", "buscar", "animes", "peliculas", "top", "generos"];

function jkaDecodeServers(html) {
    var decoded = [];
    var reRemote = /"remote"\s*:\s*"([A-Za-z0-9+\/=\-_]+)"/g;
    var m;
    while ((m = reRemote.exec(html))) decoded.push(b64decode(m[1]));
    if (decoded.length === 0) {
        var reRemote2 = /remote"?\s*[:=]\s*"([A-Za-z0-9+\/=\-_]+)"/g;
        while ((m = reRemote2.exec(html))) decoded.push(b64decode(m[1]));
    }
    return decoded;
}

function jkaAjaxEpisodes(seriesHtml, slug) {
    var out = [];
    try {
        var idm = seriesHtml.match(/ajax\/episodes\/(\d+)\//);
        if (!idm) return out;
        var id = idm[1];
        var csrfM = seriesHtml.match(/name="csrf-token"\s+content="([^"]+)"/);
        var csrf = csrfM ? csrfM[1] : "";
        if (!csrf) return out;
        var limits = [1, 2, 3];
        for (var p = 0; p < limits.length; p++) {
            var body = httpPost(
                "https://jkanime.net/ajax/episodes/" + id + "/" + limits[p],
                "_token=" + encodeURIComponent(csrf),
                { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-CSRF-TOKEN": csrf, "X-Requested-With": "XMLHttpRequest", "Accept": "application/json", "Referer": "https://jkanime.net/" + slug + "/" }
            );
            var json = null;
            try { json = JSON.parse(body); } catch (e) {}
            if (!json || !json.data || json.data.length === 0) break;
            for (var i = 0; i < json.data.length; i++) {
                var num = json.data[i].number;
                out.push({ url: "https://jkanime.net/" + slug + "/" + num + "/", name: "Cap " + num });
            }
            if (out.length >= 60) break;
        }
    } catch (e) {}
    return out;
}

function siteJkanimeHome(limit) {
    var out = [];
    try {
        var html = httpGet("https://jkanime.net/", { "Referer": "https://jkanime.net/" });
        if (!html) return out;
        var re = /<div class="hero__items set-bg"[^>]*data-setbg="([^"]+)"/gi;
        var m;
        while ((m = re.exec(html)) && out.length < limit) {
            var img = m[1];
            var window = html.substring(m.index, m.index + 1800);
            var tm = window.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            var title = tm ? stripTags(tm[1]) : "";
            var am = window.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
            var link = am ? fullUrl("https://jkanime.net/", am[1]) : "";
            if (title && link) out.push({ title: title, url: link, thumb: img, type: "anime", site: "JkAnime" });
        }
    } catch (e) {}
    return out;
}

function siteJkanimeDetails(url) {
    var html = httpGet(url, { "Referer": "https://jkanime.net/" });
    var meta = metadataFromPage(html, url);
    var thumb = meta.thumb;
    var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/);
    var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/);
    var sources = [];
    var desc = meta.desc || "";
    if (episodeMatch) {
        var decoded = jkaDecodeServers(html);
        var seenEp = {};
        for (var i = 0; i < decoded.length && sources.length < 8; i++) {
            var u = decoded[i];
            if (!u || u.indexOf("http") !== 0) continue;
            var resolved = resolvePlayerUrl(u);
            if (!resolved) continue;
            if (seenEp[resolved.url]) continue;
            seenEp[resolved.url] = 1;
            sources.push({ url: resolved.url, name: "Ep " + episodeMatch[2] + " - " + resolved.name, hls: resolved.hls });
        }
        if (sources.length === 0) sources = buildSourcesFromPage(html, url, 6);
        return { title: meta.title || ("Anime " + episodeMatch[1]), thumb: thumb, sources: sortSources(sources), description: desc };
    }
    if (seriesMatch) {
        var slug = seriesMatch[1];
        var epList = jkaAjaxEpisodes(html, slug);
        if (epList.length > 0) {
            desc = (desc ? desc + " " : "") + "Serie anime - " + epList.length + " capitulos.";
            sources = resolveEpisodeLinks(epList, 15);
        } else {
            sources = buildSourcesFromPage(html, url, 6);
        }
        return { title: meta.title || slug, thumb: thumb, sources: sources, description: desc };
    }
    return { title: meta.title || "JkAnime", thumb: thumb, sources: buildSourcesFromPage(html, url, 6), description: desc };
}

// ===================== Sitio: PeliSmart =====================
function smartRoot() {
    return "https://pelismart.mov";
}

function collectSmartItems(html, baseUrl, limit) {
    var out = [];
    var re = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(html)) && out.length < limit) {
        var href = m[1];
        if (href.indexOf("/pelicula/") === -1 && href.indexOf("/serie/") === -1 && href.indexOf("/anime/") === -1) continue;
        var full = fullUrl(baseUrl, href);
        var imgm = m[2].match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/) || m[2].match(/<img[^>]*data-src="([^"]+)"[^>]*alt="([^"]*)"/);
        if (!imgm) continue;
        var title = htmlDecode(imgm[2]);
        if (!title) {
            var tm2 = m[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
            if (tm2) title = stripTags(tm2[1]);
        }
        var type = href.indexOf("/anime/") !== -1 ? "anime" : (href.indexOf("/serie/") !== -1 ? "serie" : "pelicula");
        out.push({ title: title || "Pelicula / Serie", url: full, thumb: imgm[1], type: type, site: "PeliSmart" });
    }
    return out;
}

function sitePeliSmartSearch(query, limit) {
    var out = [];
    try {
        var html = httpGet(smartRoot() + "/search?s=" + encodeURIComponent(query), { "Referer": smartRoot() + "/" });
        if (!html) return out;
        out = collectSmartItems(html, smartRoot(), limit);
    } catch (e) {}
    return out;
}

function sitePeliSmartHome(limit) {
    var out = [];
    try {
        var html = httpGet(smartRoot() + "/", { "Referer": smartRoot() + "/" });
        if (!html) return out;
        out = collectSmartItems(html, smartRoot(), limit);
    } catch (e) {}
    return out;
}

function sitePeliSmartDetails(url) {
    var html = httpGet(url, { "Referer": smartRoot() + "/" });
    var meta = metadataFromPage(html, url);
    var sources = buildSourcesFromPage(html, url, 6);
    var episodes = collectEpisodes(html, url);
    var desc = meta.desc || "";
    if (url.indexOf("/capitulo/") === -1 && episodes.length > 0) {
        desc = (desc ? desc + " " : "") + "Serie - " + episodes.length + " capitulos encontrados.";
        sources = resolveEpisodeLinks(episodes, 15);
    }
    return { title: meta.title || "PeliSmart", thumb: meta.thumb, sources: sources, description: desc };
}

// ===================== Sitios Genéricos (WordPress / Pelisplus) =====================
function collectWordPressTPost(html, baseUrl, limit) {
    var out = [];
    var re = /<article[^>]*class="[^"]*TPost[^"]*"[\s\S]*?<\/article>/gi;
    var m;
    while ((m = re.exec(html)) && out.length < limit) {
        var block = m[0];
        var am = block.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
        if (!am) continue;
        var full = fullUrl(baseUrl, am[1]);
        if (getHost(full) !== getHost(baseUrl)) continue;
        var tm = block.match(/class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\//i) || block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        var title = tm ? stripTags(tm[1]) : "";
        var imgm = block.match(/<img[^>]*src="([^"]+)"[^>]*>/) || block.match(/<img[^>]*data-src="([^"]+)"[^>]*>/);
        var thumb = imgm ? fullUrl(baseUrl, imgm[1]) : "";
        if (title) out.push({ title: title, url: full, thumb: thumb, type: "", site: "PlayPelis" });
    }
    return out;
}

function siteGenericSearch(name, baseUrls, query, limit) {
    var out = [];
    for (var b = 0; b < baseUrls.length && out.length < limit; b++) {
        try {
            var base = baseUrls[b];
            var candidates = [
                base + "/?s=" + encodeURIComponent(query),
                base + "/search/" + encodeURIComponent(query)
            ];
            for (var c = 0; c < candidates.length && out.length < limit; c++) {
                var html = httpGet(candidates[c], { "Referer": base + "/" });
                if (!html || html.length < 300) continue;
                var items = collectWordPressTPost(html, base, limit - out.length);
                for (var i = 0; i < items.length; i++) {
                    if (!items[i].site) items[i].site = name;
                    out.push(items[i]);
                }
            }
        } catch (e) {}
    }
    return out;
}

function siteGenericDetails(url) {
    var html = httpGet(url, { "Referer": getRoot(url) + "/" });
    var meta = metadataFromPage(html, url);
    var sources = buildSourcesFromPage(html, url, 6);
    var episodes = collectEpisodes(html, url);
    var desc = meta.desc || "";
    if (url.indexOf("/capitulo/") === -1 && episodes.length > 0) {
        desc = (desc ? desc + " " : "") + "Serie - " + episodes.length + " capitulos.";
        sources = resolveEpisodeLinks(episodes, 15);
    }
    return { title: meta.title, thumb: meta.thumb, sources: sources, description: desc };
}

// ===================== Búsqueda y Home =====================
function findByHost(url) {
    var h = getHost(url);
    if (h.indexOf("jkanime.net") !== -1) return "jkanime";
    if (h.indexOf("pelismart") !== -1 || h.indexOf("smartpeli") !== -1) return "pelismart";
    return "generic";
}

function doSearch(query) {
    var out = [];
    try {
        var tier1 = [
            { name: "JkAnime", run: function (q, lim) { return siteJkanimeSearch(q, lim); } },
            { name: "PeliSmart", run: function (q, lim) { return sitePeliSmartSearch(q, lim); } }
        ];
        var tier2 = [
            { name: "Gnula", run: function (q, lim) { return siteGenericSearch("Gnula", ["https://gnula.uno"], q, lim); } },
            { name: "Cuevana2", run: function (q, lim) { return siteGenericSearch("Cuevana2", ["https://cuevana2.biz"], q, lim); } },
            { name: "Pelisplushd", run: function (q, lim) { return siteGenericSearch("Pelisplushd", ["https://pelisplushd.nz", "https://pelisplushd.nu", "https://pelisplushd.net"], q, lim); } }
        ];
        for (var s = 0; s < tier1.length && out.length < _searchLimit; s++) {
            var items = tier1[s].run(query, 10);
            for (var i = 0; i < items.length; i++) out.push(items[i]);
        }
        for (var s2 = 0; s2 < tier2.length && out.length < _searchLimit; s2++) {
            var items2 = tier2[s2].run(query, 10);
            for (var i2 = 0; i2 < items2.length; i2++) out.push(items2[i2]);
        }
    } catch (e) {}
    
    var dedup = {};
    var final = [];
    for (var j = 0; j < out.length; j++) {
        var key = out[j].url;
        if (dedup[key]) continue;
        dedup[key] = 1;
        final.push(out[j]);
    }
    return final;
}

function doHome() {
    var videos = [];
    try {
        var jka = siteJkanimeHome(15);
        for (var i = 0; i < jka.length; i++) {
            var it = jka[i];
            videos.push(mkVideo("jka_" + it.url, it.title, it.thumb, it.url, _now, "JkAnime"));
        }
    } catch (e) {}
    try {
        var sm = sitePeliSmartHome(15);
        for (var i = 0; i < sm.length; i++) {
            var it = sm[i];
            videos.push(mkVideo("sm_" + it.url, it.title, it.thumb, it.url, _now, "PeliSmart"));
        }
    } catch (e) {}
    try {
        if (typeof ContentPager !== "undefined") return new ContentPager(videos, false, null);
    } catch (e) {}
    return videos;
}

function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", url, [], "Sin URL");
    var kind = findByHost(url);
    try {
        if (kind === "jkanime") {
            var jk = siteJkanimeDetails(url);
            return mkDetail("jk_" + url, jk.title, jk.thumb, url, jk.sources, jk.description);
        }
        if (kind === "pelismart") {
            var sm = sitePeliSmartDetails(url);
            return mkDetail("sm_" + url, sm.title, sm.thumb, url, sm.sources, sm.description);
        }
        var gd = siteGenericDetails(url);
        return mkDetail("pp_" + url, gd.title || "PlayPelis", gd.thumb, url, gd.sources, gd.description);
    } catch (e) {
        return mkDetail("pp_" + url, "PlayPelis", "", url, [], "Error: " + String(e));
    }
}

function isSiteHost(url) {
    if (!url) return false;
    var h = getHost(url);
    return h.indexOf("jkanime.net") !== -1 ||
        h.indexOf("pelismart") !== -1 ||
        h.indexOf("smartpeli") !== -1 ||
        h.indexOf("gnula.uno") !== -1 ||
        h.indexOf("cuevana2.biz") !== -1 ||
        h.indexOf("pelisplushd") !== -1 ||
        h.indexOf("pelisplus2.ai") !== -1 ||
        h.indexOf("0123movie.net") !== -1 ||
        h.indexOf("bflix.gg") !== -1 ||
        h.indexOf("new-movies123.link") !== -1;
}

// ===================== Bindings GrayJay =====================
if (typeof source !== "undefined") {
    source.setSettings = function (s) { _settings = s || {}; };
    source.enable = function (c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function () {
        try {
            var ft = _feedMixed, ot = _orderChrono;
            if (typeof Type !== "undefined") { ft = Type.Feed.Mixed; ot = Type.Order.Chronological; }
            return { types: [ft], sorts: [ot], filters: [] };
        } catch (e) {
            return { types: [2], sorts: [1], filters: [] };
        }
    };
    source.search = function (query, type, order, filters, continuationToken) {
        var items = doSearch(query || "");
        var videos = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            videos.push(mkVideo("pp_" + it.url, it.title, it.thumb, it.url, _now, it.site || "PlayPelis"));
        }
        try {
            if (typeof VideoPager !== "undefined") return new VideoPager(videos, false, null);
        } catch (e) {}
        return videos;
    };
    source.isContentDetailsUrl = function (url) {
        if (!url) return false;
        if (url.indexOf("esplay|") === 0) return true;
        return isSiteHost(url);
    };
    source.getContentDetails = function (url) { return doDetails(url); };
    source.isVideoDetailsUrl = function (url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function (url) { return doDetails(url); };
    source.getHome = function (continuationToken) { return doHome(); };
    source.isChannelUrl = function (url) { return false; };
    source.searchSuggestions = function (query) { return []; };
}
