// PlayPelis GrayJay Source v36 - Extractor Avanzado Integrado
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

var PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
var _settings = {};
var _debugLog = "";

var IPTV_URL = "https://plpro.org";
var IPTV_USER = "p";
var IPTV_PASS = "p";
var JK = "https://jkanime.net";
var TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function addDebug(msg) {
    _debugLog += msg + "\n";
}

function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var r = http.GET(url, h);
        return (r && r.body) ? r.body : "";
    } catch (e) {
        addDebug("HTTP Exception en " + url + ": " + String(e));
        return "";
    }
}

function getHost(url) {
    try {
        var m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
        return m ? m[1].toLowerCase() : "";
    } catch (e) { return ""; }
}

function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function slugToTitle(s) {
    return String(s || "").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function b64decode(s) {
    try {
        return decodeURIComponent(atob(s).split("").map(function(c) { return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join(""));
    } catch (e) {
        try { return atob(s); } catch (e2) { return ""; }
    }
}

function htmlDecode(s) {
    if (!s) return "";
    return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, function(m, d) { return String.fromCharCode(parseInt(d, 10)); });
}

function stripTags(s) {
    if (!s) return "";
    return htmlDecode(String(s).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function fixImg(u) {
    if (!u) return "";
    var s = String(u).trim();
    if (s.indexOf("ttps://") === 0) s = "https" + s.substring(4);
    if (s.indexOf("http") === 0) return s;
    if (s.indexOf("/") === -1 && s.indexOf(".") !== -1) {
        if (s.indexOf(".jpg") === -1 && s.indexOf(".png") === -1 && s.indexOf(".webp") === -1) s += ".jpg";
        return TMDB_IMG + "/" + s;
    }
    return "";
}

function mkThumb(url) {
    if (!url) return new Thumbnails([]);
    return new Thumbnails([new Thumbnail(url, 100)]);
}

function mkVideo(id, title, thumb, url, authorName) {
    return new PlatformVideo({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: title || "Sin titulo",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, authorName || "PlayPelis", "https://playpelis.app", "", 0),
        uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false
    });
}

function mkHls(url, name, duration) {
    if (!url) return null;
    return new HLSSource({ name: name || "HLS", url: url, duration: duration || 0 });
}

function mkDetail(id, name, thumb, url, videoSources, description) {
    var valid = [];
    var src = videoSources || [];
    for (var i = 0; i < src.length; i++) {
        if (src[i]) valid.push(src[i]);
    }
    
    if (valid.length === 0) {
        valid.push(mkHls("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", "Video de Prueba (Fallo de Extracción)"));
        description += "\n\n⚠️ SE CARGÓ UN VIDEO DE PRUEBA PORQUE NO SE ENCONTRÓ M3U8.";
    }

    if (_debugLog.length > 0) {
        description += "\n\n=== REPORTE TÉCNICO ===\n" + _debugLog;
    }

    return new PlatformVideoDetails({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: name || "Sin titulo",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app", "", 0),
        uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false,
        video: new VideoSourceDescriptor(valid),
        description: description || ""
    });
}

// =========================================================
// BUSCADOR MULTINIVEL DE MEDIOS
// =========================================================
function findDirectMedia(html) {
    if (!html) return null;

    var m = html.match(/https?:\/\/[^"'\\<>\s]+?\.(?:m3u8|mp4)(?:\?[^"'\\<>\s]*)?/i);
    if (m && m[0]) return m[0];

    m = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i);
    if (m && m[1]) return m[1];

    m = html.match(/source\s*:\s*["']([^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i);
    if (m && m[1]) return m[1];

    m = html.match(/src\s*:\s*["']([^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i);
    if (m && m[1]) return m[1];

    return null;
}

function tryExtractM3u8(pageUrl) {
    addDebug("Intentando extraer: " + pageUrl);
    var html = httpGet(pageUrl, { "User-Agent": UA, "Referer": pageUrl });
    if (!html) {
        addDebug("HTML devuelto fue NULO.");
        return null;
    }
    
    addDebug("Tamaño HTML recibido: " + html.length + " bytes");
    addDebug("HTML Inicio: " + html.substring(0, 200).replace(/\s+/g, " "));

    var host = getHost(pageUrl).toLowerCase();

    var direct = findDirectMedia(html);
    if (direct) {
        addDebug("FUENTE DIRECTA ENCONTRADA: " + direct);
        return direct;
    }

    var patterns = [
        /["']file["']\s*:\s*["']([^"']+)["']/i,
        /["']src["']\s*:\s*["']([^"']+)["']/i,
        /["']source["']\s*:\s*["']([^"']+)["']/i,
        /["']url["']\s*:\s*["']([^"']+)["']/i,
        /["']video["']\s*:\s*["']([^"']+)["']/i,
        /["']stream["']\s*:\s*["']([^"']+)["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var pm = html.match(patterns[i]);
        if (!pm || !pm[1]) continue;
        var candidate = pm[1];
        if (candidate.indexOf(".m3u8") !== -1 || candidate.indexOf(".mp4") !== -1) {
            addDebug("FUENTE EN CONFIGURACIÓN: " + candidate);
            return candidate;
        }
    }

    var base64Patterns = [
        /atob\(\s*['"]([^'"]+)['"]\s*\)/i,
        /base64\s*[:=]\s*['"]([^'"]+)['"]/i
    ];

    for (var b = 0; b < base64Patterns.length; b++) {
        var bm = html.match(base64Patterns[b]);
        if (!bm || !bm[1]) continue;
        try {
            var decoded = b64decode(bm[1]);
            if (!decoded) continue;
            addDebug("Cadena Base64 encontrada.");
            var decodedMedia = findDirectMedia(decoded);
            if (decodedMedia) {
                addDebug("FUENTE ENCONTRADA DESPUÉS DE BASE64: " + decodedMedia);
                return decodedMedia;
            }
        } catch (e) {
            addDebug("Error decodificando Base64: " + String(e));
        }
    }

    if (html.indexOf("Redirecting") !== -1 || html.indexOf("redirecting") !== -1) {
        addDebug("REDIRECCIÓN DETECTADA en el HTML.");
    }
    if (html.indexOf("Loading...") !== -1 || html.indexOf("<title>Loading") !== -1) {
        addDebug("PÁGINA DE CARGA DETECTADA en el HTML.");
    }

    addDebug("No se encontró patrón m3u8/mp4 válido.");
    return null;
}

function ppGet(path) {
    try {
        var sep = path.indexOf("?") !== -1 ? "&" : "?";
        var url = IPTV_URL + path + sep + "username=" + encodeURIComponent(IPTV_USER) + "&password=" + encodeURIComponent(IPTV_PASS);
        var response = http.GET(url, { "User-Agent": "PLPro/8" });
        if (!response || !response.body) return null;
        return JSON.parse(response.body);
    } catch (e) { return null; }
}

function ppHome() {
    var videos = [];
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) return videos;
        for (var i = 0; i < data.movies.length && i < 40; i++) {
            var m = data.movies[i];
            if (m.b) videos.push(mkVideo("pp_m_" + m.a, (m.l ? "[" + m.l + "] " : "") + m.b + (m.f ? " (" + m.f + ")" : ""), fixImg(m.d) || fixImg(m.c) || "", "pp://movie/" + m.a, "PlayPelis"));
        }
    } catch (e) {}
    return videos;
}

function ppSearch(query) {
    var videos = [];
    var q = String(query || "").toLowerCase();
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) return videos;
        for (var i = 0; i < data.movies.length && videos.length < 30; i++) {
            var m = data.movies[i];
            var name = String(m.b || "").toLowerCase();
            if (name.indexOf(q) !== -1) {
                videos.push(mkVideo("pp_m_" + m.a, (m.l ? "[" + m.l + "] " : "") + m.b, fixImg(m.d) || fixImg(m.c) || "", "pp://movie/" + m.a, "PlayPelis"));
            }
        }
    } catch (e) {}
    return videos;
}

function ppMovieDetails(id) {
    _debugLog = ""; 
    var data = ppGet("/movies/" + id);
    if (!data) return mkDetail("pp_m_" + id, "Sin resultado", "", "pp://movie/" + id, [], "");

    var title = data.b || "";
    var thumb = fixImg(data.d) || fixImg(data.c) || "";
    var desc = data.e || "";
    var linksData = ppGet("/movies/" + id + "/links");
    var sources = [];

    if (linksData && linksData.length) {
        desc += "\n\n--- Servidores ---";
        for (var i = 0; i < linksData.length; i++) {
            var link = linksData[i];
            var linkUrl = link.a || "";
            desc += "\n" + (link.b || "srv") + " [" + (link.c || "") + "] → " + linkUrl;

            var extracted = tryExtractM3u8(linkUrl);
            if (extracted) sources.push(mkHls(extracted, (link.b || "") + " " + (link.c || "")));
        }
    }
    return mkDetail("pp_m_" + id, title, thumb, "pp://movie/" + id, sources, desc);
}

function jkaSearch(query) {
    var out = [];
    try {
        var slug = slugify(query);
        if (!slug) return out;
        var html = httpGet(JK + "/buscar/" + slug + "/", { "Referer": JK + "/" });
        if (!html) return out;

        var re = /<div class="anime__item">\s*<a\s+href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/)"[^>]*>[\s\S]*?<div[^>]*data-setbg="([^"]*)"[\s\S]*?<h5><a[^>]*>([^<]+)<\/a><\/h5>/gi;
        var m;
        while ((m = re.exec(html)) && out.length < 30) out.push({ title: htmlDecode(m[3]), url: m[1], thumb: m[2] });
    } catch (e) {}
    return out;
}

function jkaDetails(url) {
    _debugLog = "";
    var html = httpGet(url, { "Referer": JK + "/" });
    if (!html) return mkDetail("jk_" + url, "Sin resultado", "", url, [], "No se pudo cargar");

    var title = "";
    var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (tm) title = stripTags(tm[1]);
    title = (title || "").replace(/\s*-\s*anime.*JkAnime/i, "").replace(/JkAnime/i, "").trim();

    var thumb = "";
    var im = html.match(/<img[^>]*src=["']([^"']*animes\/(?:image|video)\/[^"']+)["']/i);
    if (im) thumb = im[1].indexOf("http") === 0 ? im[1] : JK + "/" + im[1].replace(/^\/+/, "");

    var desc = "";
    var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/i);
    var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/i);

    if (seriesMatch && !episodeMatch) {
        var episodes = [];
        var re = /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;
        var slug = seriesMatch[1];
        var m;
        while ((m = re.exec(html)) && episodes.length < 200) {
            if (m[1] === slug) episodes.push({ number: parseInt(m[2], 10), url: JK + "/" + m[1] + "/" + m[2] + "/" });
        }
        episodes.sort(function(a, b) { return a.number - b.number; });
        desc += "\n\n--- Episodios (" + episodes.length + ") ---";
        for (var ei = 0; ei < episodes.length; ei++) desc += "\nEp " + episodes[ei].number + " → " + episodes[ei].url;

        var sources = [];
        if (episodes.length > 0) {
            var firstSrc = jkaExtractVideo(episodes[0].url);
            if (firstSrc) sources.push(firstSrc);
        }
        return mkDetail("jk_" + url, title || slugToTitle(slug), thumb, url, sources, desc);
    }

    var episodeSources = jkaExtractVideo(url);
    var srcArray = episodeSources ? [episodeSources] : [];
    return mkDetail("jk_" + url, title || "Anime", thumb, url, srcArray, desc);
}

function jkaExtractVideo(episodeUrl) {
    addDebug("JKA: Extrayendo episodio " + episodeUrl);
    var html = httpGet(episodeUrl, { "Referer": JK + "/" });
    if (!html) return null;

    var re = /video\[\d+\]\s*=\s*'[^']*src="(https?:\/\/jkanime\.net\/jkplayer\/um[^"]*)"/i;
    var m = html.match(re);
    if (!m || !m[1]) {
        re = /src="(https?:\/\/jkanime\.net\/jkplayer\/um\?[^"]+)"/i;
        m = html.match(re);
    }
    if (!m || !m[1]) return null;

    var playerUrl = m[1].replace(/&amp;/g, "&");
    var playerHtml = httpGet(playerUrl, { "Referer": episodeUrl });
    if (!playerHtml) return null;

    var m3u8 = playerHtml.match(/url\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
    if (m3u8 && m3u8[1]) return mkHls(m3u8[1], "JkAnime");

    return null;
}

function doSearch(query) {
    var results = [];
    try { 
        var r = ppSearch(query); 
        for (var i = 0; i < r.length; i++) results.push(r[i]); 
    } catch (e) {}
    try {
        var jka = jkaSearch(query);
        for (var j = 0; j < jka.length; j++) {
            results.push(mkVideo("jk_" + jka[j].url, "[Anime] " + jka[j].title, jka[j].thumb, jka[j].url, "JkAnime"));
        }
    } catch (e) {}
    return results;
}

function doDetails(url) {
    if (!url) return mkDetail("", "", "", "", [], "URL vacía");
    if (url.indexOf("jkanime.net") !== -1) return jkaDetails(url);
    if (url.indexOf("pp://movie/") === 0) {
        var mm = url.match(/pp:\/\/movie\/(\d+)/);
        if (mm) return ppMovieDetails(mm[1]);
    }
    return mkDetail("", "", "", url, [], "");
}

function doHome() {
    var videos = [];
    try { 
        var r = ppHome(); 
        for (var i = 0; i < r.length; i++) videos.push(r[i]); 
    } catch (e) {}
    try {
        var jkHtml = httpGet(JK + "/", { "Referer": JK + "/" });
        if (jkHtml) {
            var re = /data-setbg="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            var m;
            while ((m = re.exec(jkHtml)) && videos.length < 60) {
                var linkRe = /href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"/i;
                var anchor = jkHtml.substring(Math.max(0, jkHtml.indexOf(m[0]) - 500), jkHtml.indexOf(m[0]) + m[0].length);
                var lm = anchor.match(linkRe);
                videos.push(mkVideo("jk_home_" + (lm ? lm[1] : JK + "/"), "[Anime] " + stripTags(m[2]), m[1], lm ? lm[1] : JK + "/", "JkAnime"));
            }
        }
    } catch (e) {}
    return videos;
}

if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() { return { types: [2], sorts: [], filters: [] }; };
    
    source.search = function(query) { 
        return new VideoPager(doSearch(query || ""), false, null); 
    };
    
    source.isContentDetailsUrl = function(url) { 
        return url && (url.indexOf("jkanime.net") !== -1 || url.indexOf("pp://") !== -1); 
    };
    
    source.getVideoDetails = function(url) { 
        return source.getContentDetails(url); 
    };
    
    source.getHome = function() { 
        return new VideoPager(doHome(), false, null); 
    };
    
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };

    source.getContentDetails = function(url) {
        try {
            var r = doDetails(url);
            if (r) return r;
            throw new Error("doDetails retornó null");
        } catch (e) {
            return new PlatformVideoDetails({
                id: new PlatformID("PlayPelis", "error_fallo", PID),
                name: "Error de Extractor",
                thumbnails: new Thumbnails([new Thumbnail("https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", 100)]),
                author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app", "", 0),
                uploadDate: 0,
                url: url || "https://playpelis.app",
                duration: 0,
                viewCount: 0,
                isLive: false,
                description: "CRASH CRÍTICO: " + String(e) + "\n\nLOG TÉCNICO:\n" + _debugLog,
                video: new VideoSourceDescriptor([new HLSSource({name: "Log", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", duration: 0})])
            });
        }
    };
}
