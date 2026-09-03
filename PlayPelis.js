// PlayPelis GrayJay Source v37 - Home de Emergencia y Depuración
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

function findDirectMedia(html) {
    if (!html) return null;
    var m = html.match(/https?:\/\/[^"'\\<>\s]+?\.(?:m3u8|mp4)(?:\?[^"'\\<>\s]*)?/i);
    if (m && m[0]) return m[0];
    m = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i);
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
    var direct = findDirectMedia(html);
    if (direct) return direct;
    return null;
}

function ppGet(path) {
    try {
        var sep = path.indexOf("?") !== -1 ? "&" : "?";
        var url = IPTV_URL + path + sep + "username=" + encodeURIComponent(IPTV_USER) + "&password=" + encodeURIComponent(IPTV_PASS);
        var response = http.GET(url, { "User-Agent": "PLPro/8" });
        if (!response || !response.body) {
            addDebug("PPGet vacío en " + path);
            return null;
        }
        return JSON.parse(response.body);
    } catch (e) {
        addDebug("PPGet Exception en " + path + ": " + String(e));
        return null;
    }
}

function ppHome() {
    var videos = [];
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) {
            addDebug("ppHome: No se encontraron películas en /movies/resume");
            return videos;
        }
        for (var i = 0; i < data.movies.length && i < 40; i++) {
            var m = data.movies[i];
            if (m.b) videos.push(mkVideo("pp_m_" + m.a, (m.l ? "[" + m.l + "] " : "") + m.b, fixImg(m.d) || fixImg(m.c) || "", "pp://movie/" + m.a, "PlayPelis"));
        }
    } catch (e) {
        addDebug("ppHome Error: " + String(e));
    }
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
    if (!data) return mkDetail("pp_m_" + id, "Sin resultado", "", "pp://movie/" + id, [], "Error al conectar con PlayerPro");

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
            desc += "\n" + (link.b || "srv") + " → " + linkUrl;
            var extracted = tryExtractM3u8(linkUrl);
            if (extracted) sources.push(mkHls(extracted, link.b || "srv"));
        }
    }
    return mkDetail("pp_m_" + id, title, thumb, "pp://movie/" + id, sources, desc);
}

function doSearch(query) {
    var results = [];
    try { 
        var r = ppSearch(query); 
        for (var i = 0; i < r.length; i++) results.push(r[i]); 
    } catch (e) {}
    
    // Si no encuentra nada, añadimos un elemento de prueba para verificar que la búsqueda responde
    if (results.length === 0) {
        results.push(mkVideo("test_res", "Resultado de prueba para: " + query, "https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", "pp://movie/0", "PlayPelis"));
    }
    return results;
}

function doDetails(url) {
    if (!url) return mkDetail("", "", "", "", [], "URL vacía");
    if (url.indexOf("pp://movie/") === 0) {
        var mm = url.match(/pp:\/\/movie\/(\d+)/);
        if (mm) {
            if (mm[1] === "0") {
                return mkDetail("test_res", "Video de Prueba", "https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", url, [mkHls("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", "Test")], "Este es un video de prueba del sistema.");
            }
            return ppMovieDetails(mm[1]);
        }
    }
    return mkDetail("", "", "", url, [], "Ruta no soportada");
}

function doHome() {
    var videos = [];
    try { 
        var r = ppHome(); 
        for (var i = 0; i < r.length; i++) videos.push(r[i]); 
    } catch (e) {}
    
    // RED DE SEGURIDAD: Si PlayerPro no devuelve nada, mostramos videos estáticos de prueba para que la app no quede en blanco
    if (videos.length === 0) {
        videos.push(mkVideo("emergency_1", "[Prueba] Servidor IPTV Sin Conexión", "https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", "pp://movie/0", "PlayPelis"));
    }
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
