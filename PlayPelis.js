// PlayPelis GrayJay Source v25
// PlayerPro API (catálogo) + JkAnime (video m3u8)
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = Math.floor(Date.now() / 1000);

var IPTV_URL = "https://plpro.org";
var IPTV_USER = "p";
var IPTV_PASS = "p";
var JK = "https://jkanime.net";

function initPlatformID() { if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID); }

function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        return (http.GET(url, h).body || "");
    } catch (e) { return ""; }
}

function httpPost(url, body, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        return (http.POST(url, body, h).body || "");
    } catch (e) { return ""; }
}

function htmlDecode(s) {
    if (!s) return "";
    return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,function(m,d){return String.fromCharCode(parseInt(d,10));}).replace(/&#x([0-9a-fA-F]+);/g,function(m,x){return String.fromCharCode(parseInt(x,16));});
}

function stripTags(s) {
    if (!s) return "";
    return htmlDecode(String(s).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).trim();
}

function getHost(url) {
    try { var m = String(url).match(/^https?:\/\/([^\/?#]+)/); return m ? m[1].toLowerCase() : ""; }
    catch (e) { return ""; }
}

function getRoot(url) {
    try { var m = String(url).match(/^(https?:\/\/[^\/?#]+)/); return m ? m[1] : ""; }
    catch (e) { return ""; }
}

function fullUrl(base, u) {
    if (!u) return "";
    u = String(u).trim();
    if (u.indexOf("http") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    return getRoot(base) + (u.indexOf("/") === 0 ? u : "/" + u);
}

function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function slugToTitle(slug) {
    return String(slug || "").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function b64decode(s) {
    try { return decodeURIComponent(atob(s).split("").map(function(c) { return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join("")); }
    catch (e) { try { return atob(s); } catch (e2) { return ""; } }
}

function fixImg(u) {
    if (!u) return "";
    var s = String(u).trim();
    if (s.indexOf("http") !== 0) s = "https://" + s;
    return s;
}

// ===================== GrayJay Models =====================
function mkThumb(url) {
    if (!url) return new Thumbnails([]);
    return new Thumbnails([new Thumbnail(url, 100)]);
}

function mkVideo(id, title, thumb, url, authorName) {
    initPlatformID();
    return new PlatformVideo({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: title || "Sin titulo",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, authorName || "PlayPelis", "https://playpelis.app"),
        uploadDate: _now, url: url, duration: -1, viewCount: -1, isLive: false
    });
}

function mkHls(url, name) {
    if (!url) return null;
    return new HLSSource({ name: name || "HLS", url: url, duration: 0 });
}

function mkSrc(valid) {
    try { return new VideoSourceDescriptor(valid); } catch (e) {}
    return { plugin_type: "MuxVideoSourceDescriptor", isUnMuxed: false, videoSources: valid };
}

function mkDetail(id, name, thumb, url, videoSources, description) {
    initPlatformID();
    var sources = videoSources || [];
    var valid = [];
    for (var i = 0; i < sources.length; i++) { if (sources[i]) valid.push(sources[i]); }
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "Sin titulo",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now, url: url, duration: -1, viewCount: -1, isLive: false,
            video: mkSrc(valid), description: description || ""
        });
    } catch (e) {
        try {
            return new PlatformVideo({
                id: new PlatformID("PlayPelis", String(id), PID),
                name: name || "Sin titulo",
                thumbnails: mkThumb(thumb),
                author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
                uploadDate: _now, url: url, duration: -1, viewCount: -1, isLive: false
            });
        } catch (e2) { return null; }
    }
}

// ===================== PlayerPro API =====================
function ppGet(path) {
    var sep = path.indexOf("?") !== -1 ? "&" : "?";
    var url = IPTV_URL + path + sep + "username=" + IPTV_USER + "&password=" + IPTV_PASS;
    var resp = httpGet(url, { "User-Agent": "PLPro/8" });
    if (!resp) return null;
    try { return JSON.parse(resp); } catch (e) { return null; }
}

function ppHome() {
    var videos = [];
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) return videos;
        var movies = data.movies;
        for (var i = 0; i < movies.length && i < 40; i++) {
            var m = movies[i];
            var id = m.a;
            var title = m.b || "";
            var poster = fixImg(m.c || "");
            var backdrop = fixImg(m.d || "");
            var year = m.f || "";
            var quality = m.l || "";
            var thumb = backdrop || poster;
            if (title) videos.push(mkVideo("pp_m_" + id, (quality ? "[" + quality + "] " : "") + title + (year ? " (" + year + ")" : ""), thumb, "pp://movie/" + id, "PlayPelis"));
        }
    } catch (e) {}
    return videos;
}

function ppSearch(query) {
    var videos = [];
    var q = query.toLowerCase();
    try {
        var data = ppGet("/movies/resume");
        if (data && data.movies) {
            for (var i = 0; i < data.movies.length && videos.length < 30; i++) {
                var m = data.movies[i];
                var t = (m.b || "").toLowerCase();
                var o = (m.i || "").toLowerCase();
                if (t.indexOf(q) !== -1 || o.indexOf(q) !== -1) {
                    var poster = fixImg(m.c || "");
                    var backdrop = fixImg(m.d || "");
                    var year = m.f || "";
                    var quality = m.l || "";
                    videos.push(mkVideo("pp_m_" + m.a, (quality ? "[" + quality + "] " : "") + m.b + (year ? " (" + year + ")" : ""), backdrop || poster, "pp://movie/" + m.a, "PlayPelis"));
                }
            }
        }
        var sd = ppGet("/series");
        if (sd && sd.series) {
            for (var j = 0; j < sd.series.length && videos.length < 50; j++) {
                var s = sd.series[j];
                var st = (s.b || "").toLowerCase();
                var so = (s.i || "").toLowerCase();
                if (st.indexOf(q) !== -1 || so.indexOf(q) !== -1) {
                    videos.push(mkVideo("pp_s_" + s.a, "[Serie] " + s.b, fixImg(s.d || s.c || ""), "pp://serie/" + s.a, "PlayPelis"));
                }
            }
        }
    } catch (e) {}
    return videos;
}

function ppMovieDetails(id) {
    try {
        var data = ppGet("/movies/" + id);
        if (!data) return mkDetail("pp_m_" + id, "Sin resultado", "", "pp://movie/" + id, [], "");
        var title = data.b || "";
        var poster = fixImg(data.c || "");
        var backdrop = fixImg(data.d || "");
        var overview = data.e || "";
        var thumb = backdrop || poster;
        var linksData = ppGet("/movies/" + id + "/links");
        var desc = overview;
        if (linksData && linksData.length) {
            desc += "\n\n--- Servidores disponibles ---";
            for (var i = 0; i < linksData.length; i++) {
                var link = linksData[i];
                desc += "\n" + (link.b || "") + " " + (link.c || "") + " → " + link.a;
            }
            desc += "\n\n(Usa otro reproductor para ver estos links)";
        }
        return mkDetail("pp_m_" + id, title, thumb, "pp://movie/" + id, [], desc);
    } catch (e) {
        return mkDetail("", "Error", "", "pp://movie/" + id, [], "Error: " + String(e));
    }
}

function ppSerieDetails(id) {
    try {
        var data = ppGet("/series/" + id);
        if (!data) return mkDetail("pp_s_" + id, "Sin resultado", "", "pp://serie/" + id, [], "");
        var title = data.name || "";
        var poster = fixImg(data.poster || "");
        var backdrop = fixImg(data.backdrop || "");
        var overview = data.overview || "";
        var thumb = backdrop || poster;
        var desc = overview;
        if (data.seasonList) {
            for (var si = 0; si < data.seasonList.length; si++) {
                var season = data.seasonList[si];
                if (season.episodes) {
                    desc += "\n\n--- Temporada " + season.num + " (" + season.episodes.length + " episodios) ---";
                    for (var ei = 0; ei < season.episodes.length; ei++) {
                        var ep = season.episodes[ei];
                        desc += "\nEp " + season.num + "x" + ep.num + " " + (ep.name || "") + " → pp://serie/" + id + "/links/" + season.num + "/" + ep.num;
                    }
                }
            }
        }
        return mkDetail("pp_s_" + id, title, thumb, "pp://serie/" + id, [], desc);
    } catch (e) {
        return mkDetail("", "Error", "", "pp://serie/" + id, [], "Error: " + String(e));
    }
}

function ppEpisodeLinks(serieId, season, episode) {
    try {
        var data = ppGet("/series/" + serieId + "/links/" + season + "/" + episode);
        var sources = [];
        var desc = "Servidores disponibles:";
        if (data && data.length) {
            for (var i = 0; i < data.length; i++) {
                desc += "\n" + (data[i].b || "") + " " + (data[i].c || "") + " → " + data[i].a;
            }
        }
        return mkDetail("pp_ep_" + serieId + "_" + season + "_" + episode, "Ep " + season + "x" + episode, "", "pp://serie/" + serieId + "/links/" + season + "/" + episode, sources, desc);
    } catch (e) {
        return mkDetail("", "Error", "", "", [], "Error: " + String(e));
    }
}

// ===================== JkAnime =====================
function jkaSearch(query) {
    var out = [];
    try {
        var slug = slugify(query);
        if (!slug) return out;
        var url = JK + "/" + slug + "/";
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html || html.indexOf("no encontrada") !== -1 || html.indexOf("<title>404") !== -1) return out;
        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm) title = htmlDecode(tm[1]); }
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i, "").replace(/JkAnime/i, "").trim() || query;
        var thumb = "";
        var im = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/);
        if (!im) im = html.match(/<img[^>]*src=["']([^"']+(?:cover|portada))[^"']*["']/);
        if (im) thumb = fullUrl(url, im[1]);
        out.push({title: title, url: url, thumb: thumb});
    } catch (e) {}
    return out;
}

function jkaExtractM3u8(jkplayerUrl) {
    var html = httpGet(jkplayerUrl, {"Referer": JK + "/"});
    if (!html) return null;
    var m = html.match(/url\s*:\s*'([^']*\.m3u8[^']*)'/);
    if (m) return m[1];
    m = html.match(/<source[^>]*src=['"]([^'"]+\.m3u8[^'"]*)['"]/i);
    if (m) return m[1];
    m = html.match(/atob\('([^']+)'\)/);
    if (m) { try { var decoded = b64decode(m[1]); if (decoded.indexOf(".m3u8") !== -1) return decoded; } catch (e) {} }
    return null;
}

function jkaGetSources(url) {
    var sources = [];
    var html = httpGet(url, {"Referer": JK + "/"});
    if (!html) return sources;
    var re = /<iframe[^>]*class="player_conte"[^>]*src="([^"]*jkplayer[^"]*)"/gi;
    var m;
    while ((m = re.exec(html))) {
        var jkUrl = m[1];
        if (jkUrl.indexOf("http") !== 0) jkUrl = JK + (jkUrl.indexOf("/") === 0 ? "" : "/") + jkUrl;
        var m3u8 = jkaExtractM3u8(jkUrl);
        if (m3u8) {
            var exists = false;
            for (var si = 0; si < sources.length; si++) { if (sources[si].url === m3u8) { exists = true; break; } }
            if (!exists) sources.push(mkHls(m3u8, "Servidor " + (sources.length + 1)));
        }
    }
    var re2 = /<iframe[^>]*src="([^"]*jkplayer[^"]*)"/gi;
    while ((m = re2.exec(html))) {
        var jkUrl2 = m[1];
        if (jkUrl2.indexOf("http") !== 0) jkUrl2 = JK + (jkUrl2.indexOf("/") === 0 ? "" : "/") + jkUrl2;
        var m3u8_2 = jkaExtractM3u8(jkUrl2);
        if (m3u8_2) {
            var exists2 = false;
            for (var si2 = 0; si2 < sources.length; si2++) { if (sources[si2].url === m3u8_2) { exists2 = true; break; } }
            if (!exists2) sources.push(mkHls(m3u8_2, "Servidor " + (sources.length + 1)));
        }
    }
    return sources;
}

function jkaDetails(url) {
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return mkDetail("jk_" + url, "Sin resultado", "", url, [], "No se pudo cargar");
        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm) title = htmlDecode(tm[1]); }
        var thumb = "";
        var im = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/);
        if (im) thumb = fullUrl(url, im[1]);
        var desc = "";
        tm = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i, "").replace(/JkAnime/i, "").trim();
        var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/);
        var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/);
        if (seriesMatch && !episodeMatch) {
            var episodes = [];
            var re = /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;
            var m;
            var slug = seriesMatch[1];
            while ((m = re.exec(html)) && episodes.length < 200) {
                if (m[1] === slug) episodes.push({ number: parseInt(m[2]), url: JK + "/" + m[1] + "/" + m[2] + "/" });
            }
            episodes.sort(function(a, b) { return a.number - b.number; });
            if (episodes.length > 0) {
                var firstDetail = jkaDetails(episodes[0].url);
                if (firstDetail) {
                    var epList = "\n\n--- Episodios (" + episodes.length + ") ---";
                    for (var ei = 0; ei < episodes.length; ei++) {
                        epList += "\nEp " + episodes[ei].number + " → " + episodes[ei].url;
                    }
                    firstDetail.description = (firstDetail.description || "") + epList;
                    return firstDetail;
                }
            }
            return mkDetail("jk_" + url, slugToTitle(slug), thumb, url, [], desc || "Serie de anime");
        }
        var sources = jkaGetSources(url);
        return mkDetail("jk_" + url, title || slugToTitle(episodeMatch ? episodeMatch[1] : "Anime"), thumb, url, sources, desc);
    } catch (e) { return null; }
}

// ===================== Unified =====================
function doSearch(query) {
    var results = [];
    var i;
    try { var r = ppSearch(query); for (i = 0; i < r.length; i++) results.push(r[i]); } catch (e) {}
    try {
        var jkaResults = jkaSearch(query);
        for (i = 0; i < jkaResults.length; i++) {
            results.push(mkVideo("jk_" + jkaResults[i].url, "[Anime] " + jkaResults[i].title, jkaResults[i].thumb, jkaResults[i].url, "JkAnime"));
        }
    } catch (e) {}
    return results;
}

function doDetails(url) {
    if (!url) return mkDetail("", "Sin url", "", url, [], "");
    if (url.indexOf("jkanime.net") !== -1) return jkaDetails(url);
    if (url.indexOf("pp://movie/") !== -1) {
        var mm = url.match(/pp:\/\/movie\/(\d+)/);
        if (mm) return ppMovieDetails(mm[1]);
    }
    if (url.indexOf("pp://serie/") !== -1) {
        var sm = url.match(/pp:\/\/serie\/(\d+)\/links\/(\d+)\/(\d+)/);
        if (sm) return ppEpisodeLinks(sm[1], sm[2], sm[3]);
        var ss = url.match(/pp:\/\/serie\/(\d+)/);
        if (ss) return ppSerieDetails(ss[1]);
    }
    return mkDetail("", "Fuente no soportada", "", url, [], "");
}

function doHome() {
    var videos = [];
    try { var r = ppHome(); for (var i = 0; i < r.length; i++) videos.push(r[i]); } catch (e) {}
    try {
        var jkHtml = httpGet(JK + "/", {"Referer": JK + "/"});
        if (jkHtml) {
            var re = /<a[^>]*href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            var m;
            while ((m = re.exec(jkHtml)) && videos.length < 60) {
                videos.push(mkVideo("jk_home_" + m[1], "[Anime] " + stripTags(m[3]), m[2], m[1], "JkAnime"));
            }
        }
    } catch (e) {}
    return videos;
}

// ===================== GrayJay Bindings =====================
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() { return { types: [2], sorts: [], filters: [] }; };
    source.search = function(query, type, order, filters) {
        try { return new VideoPager(doSearch(query || ""), false, null); }
        catch (e) { return new VideoPager([], false, null); }
    };
    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        return url.indexOf("jkanime.net") !== -1 || url.indexOf("pp://") !== -1;
    };
    source.getContentDetails = function(url) {
        try { var r = doDetails(url); return r || mkDetail("", "Sin resultado", "", url, [], "No se pudo cargar"); }
        catch (e) { return mkDetail("", "Error", "", url, [], "Error: " + String(e)); }
    };
    source.isVideoDetailsUrl = function(url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function(url) { return source.getContentDetails(url); };
    source.getHome = function() {
        try { return new VideoPager(doHome(), false, null); }
        catch (e) { return new VideoPager([], false, null); }
    };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
