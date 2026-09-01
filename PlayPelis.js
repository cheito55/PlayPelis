// PlayPelis GrayJay Source Plugin v2
var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_KEY = "26c168179ae6b5445f36aca260e00d48";
var TMDB_IMG = "https://image.tmdb.org/t/p/w220_and_h330_face";
var TMDB_BK = "https://image.tmdb.org/t/p/w500";
var ESPLAY_GQL = "https://api.esplay.one/graphql";
var ESPLAY_IMG = "https://static.esplay.one/";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var PPID = null;
var _settings = {};
var GQL_ITEMS = "items { id title slug coverPath year overview type quality { type language } }";

// Cache Type constants with fallbacks
var _feedMixed = 2;
var _orderChrono = 1;
try { if (typeof Type !== "undefined") { _feedMixed = Type.Feed.Mixed; _orderChrono = Type.Order.Chronological; } } catch(e) {}

function initPlatformID() {
    if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
}

function tmdbGet(path, params) {
    var qs = "api_key=" + TMDB_KEY;
    if (params) {
        var keys = Object.keys(params);
        for (var i = 0; i < keys.length; i++) {
            qs += "&" + keys[i] + "=" + encodeURIComponent(params[keys[i]]);
        }
    }
    var resp = http.GET(TMDB_API + path + "?" + qs, {"Accept": "application/json"});
    return JSON.parse(resp.body);
}

function gqlPost(query, variables) {
    var body = JSON.stringify({"query": query, "variables": variables});
    var headers = {"Content-Type": "application/json", "User-Agent": UA, "Origin": "https://pelisplus2.ai", "Referer": "https://pelisplus2.ai/"};
    var resp = http.POST(ESPLAY_GQL, body, headers, false);
    return JSON.parse(resp.body);
}

function mkThumb(url) {
    if (!url) return new Thumbnails([]);
    return new Thumbnails([new Thumbnail(url, 100)]);
}

function mkVideo(id, title, thumb, url, date) {
    initPlatformID();
    return new PlatformVideo({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: title || "Sin titulo",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
        uploadDate: date || 0,
        url: url,
        duration: 0,
        viewCount: 0,
        isLive: false
    });
}

function mkDetail(id, name, thumb, url, sources, description) {
    initPlatformID();
    var videoSources = sources || [];
    return new PlatformVideoDetails({
        id: new PlatformID("PlayPelis", String(id), PID),
        name: name || "PlayPelis",
        thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
        uploadDate: 0,
        url: url,
        duration: 0,
        viewCount: 0,
        isLive: false,
        description: description || "Contenido de PlayPelis",
        video: new MuxVideoSourceDescriptor({isUnMuxed: false, videoSources: videoSources})
    });
}

// ========== SEARCH ==========
function searchEsplay(query) {
    var q = "query mySearchItems($query: String!) { movies: showSearch(query: $query, type: \"movie\", limit: 20) { totalCount " + GQL_ITEMS + " } tvshows: showSearch(query: $query, type: \"tvshow\", limit: 20) { totalCount " + GQL_ITEMS + " } }";
    var data = gqlPost(q, {"query": query});
    if (!data || !data.data) return [];
    var movies = (data.data.movies && data.data.movies.items) || [];
    var tvshows = (data.data.tvshows && data.data.tvshows.items) || [];
    return movies.concat(tvshows);
}

function esplayToVideos(items) {
    var results = [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var isTv = it.type === "tvshow";
        var cover = it.coverPath ? (ESPLAY_IMG + it.coverPath + "/cover/original") : "";
        var url = "https://pelisplus2.ai/" + (isTv ? "serie" : "pelicula") + "/" + it.slug;
        results.push(mkVideo(it.id, it.title, cover, url, it.year || 0));
    }
    return results;
}

function searchTmdb(query) {
    var results = [];
    try {
        var tv = tmdbGet("/search/tv", {"query": query, "language": "es", "include_adult": "false", "page": "1"});
        if (tv && tv.results) {
            for (var i = 0; i < tv.results.length; i++) {
                var r = tv.results[i];
                results.push(mkVideo("tmdb:" + r.id, r.name || r.original_name || "Sin titulo", r.poster_path ? TMDB_IMG + r.poster_path : "", "https://www.themoviedb.org/tv/" + r.id, r.first_air_date ? new Date(r.first_air_date).getTime() : 0));
            }
        }
    } catch (e) {}
    try {
        var mv = tmdbGet("/search/movie", {"query": query, "language": "es", "include_adult": "false", "page": "1"});
        if (mv && mv.results) {
            for (var i = 0; i < mv.results.length; i++) {
                var r = mv.results[i];
                results.push(mkVideo("tmdb:" + r.id, r.title || r.original_title || "Sin titulo", r.poster_path ? TMDB_IMG + r.poster_path : "", "https://www.themoviedb.org/movie/" + r.id, r.release_date ? new Date(r.release_date).getTime() : 0));
            }
        }
    } catch (e) {}
    return results;
}

function doSearch(query) {
    var mode = (_settings.searchSource || "2").toString();
    var results = [];
    if (mode === "1" || mode === "3") {
        try {
            var vids = esplayToVideos(searchEsplay(query));
            for (var i = 0; i < vids.length; i++) results.push(vids[i]);
        } catch (e) {}
    }
    if (mode === "1" || mode === "2" || mode === "3") {
        try {
            var tmdbs = searchTmdb(query);
            for (var i = 0; i < tmdbs.length; i++) results.push(tmdbs[i]);
        } catch (e) {}
    }
    return new VideoPager(results, false, null);
}

// ========== HOME ==========
function doHome() {
    var results = [];
    try {
        var trending = tmdbGet("/trending/movie/week", {"language": "es"});
        if (trending && trending.results) {
            for (var i = 0; i < trending.results.length && i < 20; i++) {
                var r = trending.results[i];
                results.push(mkVideo("tmdb:" + r.id, r.title || r.original_title || "Sin titulo", r.poster_path ? TMDB_IMG + r.poster_path : "", "https://www.themoviedb.org/movie/" + r.id, r.release_date ? new Date(r.release_date).getTime() : 0));
            }
        }
    } catch (e) {}
    try {
        var tvTrend = tmdbGet("/trending/tv/week", {"language": "es"});
        if (tvTrend && tvTrend.results) {
            for (var i = 0; i < tvTrend.results.length && i < 20; i++) {
                var r = tvTrend.results[i];
                results.push(mkVideo("tmdb:" + r.id, r.name || r.original_name || "Sin titulo", r.poster_path ? TMDB_IMG + r.poster_path : "", "https://www.themoviedb.org/tv/" + r.id, r.first_air_date ? new Date(r.first_air_date).getTime() : 0));
            }
        }
    } catch (e) {}
    return new VideoPager(results, false, null);
}

// ========== VIDEO EXTRACTION ==========
function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"]) h["User-Agent"] = UA;
        var resp = http.GET(url, h);
        return resp.body || "";
    } catch (e) {
        return "";
    }
}

function findIframeUrls(html) {
    var urls = [];
    var regex = /<iframe[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
        var u = match[1].trim();
        if (u && u.indexOf("http") === 0) urls.push(u);
    }
    return urls;
}

function findM3u8Urls(html) {
    var urls = [];
    var regex = /(?:https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
        urls.push(match[0].replace(/['"]/g, ""));
    }
    return urls;
}

function findMp4Urls(html) {
    var urls = [];
    var regex = /(?:https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
        var u = match[0].replace(/['"]/g, "");
        if (u.indexOf(".mp4") !== -1) urls.push(u);
    }
    return urls;
}

function extractDood(embedUrl) {
    try {
        var html = httpGet(embedUrl);
        if (!html) return null;
        var passMatch = html.match(/\$\.get\(['"]\/pass_md5\/([^'"]+)['"]/);
        if (passMatch) {
            var baseUrl = embedUrl.replace(/\/embed\/.*/, "").replace(/\/d\//, "/");
            var passUrl = baseUrl + "/pass_md5/" + passMatch[1];
            var resp = httpGet(passUrl, {"Referer": embedUrl});
            if (resp && resp.indexOf("http") === 0) {
                var token = "?token=" + (new Date().getTime()) + "&expiry=" + (new Date().getTime() + 86400000);
                return resp.trim() + token;
            }
        }
        var m3u8 = findM3u8Urls(html);
        if (m3u8.length > 0) return m3u8[0];
        var mp4 = findMp4Urls(html);
        if (mp4.length > 0) return mp4[0];
        var vidMatch = html.match(/(?:src|file)['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:mp4|m3u8)[^'"]*)/);
        if (vidMatch) return vidMatch[1];
    } catch (e) {}
    return null;
}

function extractStreamTape(embedUrl) {
    try {
        var html = httpGet(embedUrl);
        if (!html) return null;
        var part1 = html.match(/document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)/);
        if (part1) {
            var full = part1[1].replace(/&#039;/g, "'").replace(/&amp;/g, "&");
            var part2 = html.match(/tok(?:en)?['"]\s*\+\s*['"]([^'"]+)/);
            if (part2) {
                var url = full + part2[1];
                if (url.indexOf("http") !== -1) return url;
            }
            if (full.indexOf("http") !== -1) return full;
        }
        var m3u8 = findM3u8Urls(html);
        if (m3u8.length > 0) return m3u8[0];
        var mp4 = findMp4Urls(html);
        if (mp4.length > 0) return mp4[0];
        var vidMatch = html.match(/['"]file['"]\s*:\s*['"](https?:\/\/[^'"]+)/);
        if (vidMatch) return vidMatch[1];
    } catch (e) {}
    return null;
}

function extractVoe(embedUrl) {
    try {
        var html = httpGet(embedUrl);
        if (!html) return null;
        var m3u8 = findM3u8Urls(html);
        if (m3u8.length > 0) return m3u8[0];
        var mp4 = findMp4Urls(html);
        if (mp4.length > 0) return mp4[0];
        var vidMatch = html.match(/['"](?:direct_url|video_url|source)['"]\s*:\s*['"](https?:\/\/[^'"]+)/);
        if (vidMatch) return vidMatch[1];
    } catch (e) {}
    return null;
}

function extractStreamSB(embedUrl) {
    try {
        var html = httpGet(embedUrl);
        if (!html) return null;
        var m3u8 = findM3u8Urls(html);
        if (m3u8.length > 0) return m3u8[0];
        var mp4 = findMp4Urls(html);
        if (mp4.length > 0) return mp4[0];
        var vidMatch = html.match(/['"](?:source|file|video)['"]\s*:\s*['"](https?:\/\/[^'"]+)/);
        if (vidMatch) return vidMatch[1];
    } catch (e) {}
    return null;
}

function extractGeneric(embedUrl) {
    try {
        var html = httpGet(embedUrl);
        if (!html) return null;
        var m3u8 = findM3u8Urls(html);
        if (m3u8.length > 0) return m3u8[0];
        var mp4 = findMp4Urls(html);
        if (mp4.length > 0) return mp4[0];
        var iframes = findIframeUrls(html);
        for (var i = 0; i < iframes.length; i++) {
            var nested = httpGet(iframes[i], {"Referer": embedUrl});
            if (nested) {
                var nm = findM3u8Urls(nested);
                if (nm.length > 0) return nm[0];
                var np = findMp4Urls(nested);
                if (np.length > 0) return np[0];
            }
        }
        var srcMatch = html.match(/['"]source['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)/);
        if (srcMatch) return srcMatch[1];
        var fileMatch = html.match(/['"]file['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)/);
        if (fileMatch) return fileMatch[1];
    } catch (e) {}
    return null;
}

function extractVideoFromEmbed(embedUrl) {
    var url = embedUrl.toLowerCase();
    if (url.indexOf("dood.") !== -1 || url.indexOf("doodstream.") !== -1 || url.indexOf("dood.wf") !== -1 || url.indexOf("dood.ws") !== -1 || url.indexOf("dood.yt") !== -1 || url.indexOf("dood.to") !== -1 || url.indexOf("dood.so") !== -1 || url.indexOf("dood.la") !== -1 || url.indexOf("dood.pm") !== -1 || url.indexOf("dood.sh") !== -1) {
        return extractDood(embedUrl);
    }
    if (url.indexOf("streamtape.") !== -1) {
        return extractStreamTape(embedUrl);
    }
    if (url.indexOf("voe.") !== -1) {
        return extractVoe(embedUrl);
    }
    if (url.indexOf("sbembed") !== -1 || url.indexOf("sbplay") !== -1 || url.indexOf("sbbrisk") !== -1 || url.indexOf("sblongvu") !== -1 || url.indexOf("sbfull") !== -1 || url.indexOf("sbfast") !== -1 || url.indexOf("streamsb.") !== -1 || url.indexOf("viewsb.") !== -1 || url.indexOf("watchsb.") !== -1 || url.indexOf("ssbstream.") !== -1 || url.indexOf("streamsss.") !== -1) {
        return extractStreamSB(embedUrl);
    }
    return extractGeneric(embedUrl);
}

function scrapeVideoSources(pageUrl) {
    var sources = [];
    var seen = {};
    try {
        var html = httpGet(pageUrl);
        if (!html) return sources;

        var directM3u8 = findM3u8Urls(html);
        for (var i = 0; i < directM3u8.length; i++) {
            var u = directM3u8[i];
            if (!seen[u]) {
                seen[u] = true;
                sources.push(new VideoUrlSource({
                    width: 1920, height: 1080,
                    container: "application/x-mpegURL",
                    codec: "avc1.640028",
                    name: "HLS " + (sources.length + 1),
                    bitrate: 4000000, duration: 0, url: u
                }));
            }
        }

        var directMp4 = findMp4Urls(html);
        for (var i = 0; i < directMp4.length; i++) {
            var u = directMp4[i];
            if (!seen[u]) {
                seen[u] = true;
                sources.push(new VideoUrlSource({
                    width: 1920, height: 1080,
                    container: "video/mp4",
                    codec: "avc1.640028",
                    name: "MP4 " + (sources.length + 1),
                    bitrate: 4000000, duration: 0, url: u
                }));
            }
        }

        if (sources.length > 0) return sources;

        var iframes = findIframeUrls(html);
        for (var i = 0; i < iframes.length; i++) {
            var embedUrl = iframes[i];
            if (seen[embedUrl]) continue;
            seen[embedUrl] = true;
            var videoUrl = extractVideoFromEmbed(embedUrl);
            if (videoUrl && !seen[videoUrl]) {
                seen[videoUrl] = true;
                var isHls = videoUrl.indexOf(".m3u8") !== -1;
                sources.push(new VideoUrlSource({
                    width: 1920, height: 1080,
                    container: isHls ? "application/x-mpegURL" : "video/mp4",
                    codec: "avc1.640028",
                    name: "Servidor " + (sources.length + 1),
                    bitrate: 4000000, duration: 0, url: videoUrl
                }));
            }
        }
    } catch (e) {}
    return sources;
}

// ========== PAGE DETAILS ==========
function scrapePageDetails(pageUrl) {
    var info = {title: "", thumbnail: "", description: ""};
    try {
        var html = httpGet(pageUrl);
        if (!html) return info;
        var doc = DOMParser.parseFromString(html);
        var titleNode = doc.querySelector("h1");
        info.title = titleNode ? titleNode.textContent.trim() : "";
        var imgNode = doc.querySelector("img[src*='poster']") || doc.querySelector(".post img") || doc.querySelector("img[alt*='poster']") || doc.querySelector(".poster img");
        if (imgNode) {
            var src = imgNode.getAttribute("src") || "";
            if (src && src.indexOf("http") === -1) src = "https://pelisplus2.ai" + src;
            info.thumbnail = src;
        }
        var descNode = doc.querySelector(".description") || doc.querySelector(".extract") || doc.querySelector("p");
        info.description = descNode ? descNode.textContent.trim().substring(0, 500) : "";
    } catch (e) {}
    return info;
}

function findEsplayForTmdb(title, isTv) {
    try {
        var items = searchEsplay(title);
        var wantedType = isTv ? "tvshow" : "movie";
        for (var i = 0; i < items.length; i++) {
            if (items[i].type === wantedType) return items[i];
        }
        if (items.length > 0) return items[0];
    } catch (e) {}
    return null;
}

// ========== DETAILS ==========
function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", "", [], "Sin URL");

    if (url.indexOf("themoviedb.org") !== -1) {
        var mMovie = url.match(/\/movie\/(-?\d+)/);
        var mTv = url.match(/\/tv\/(-?\d+)/);
        var tmdbId = -1;
        if (mMovie) tmdbId = parseInt(mMovie[1]);
        if (mTv) tmdbId = parseInt(mTv[1]);

        if (tmdbId > 0) {
            var isTv = !!mTv;
            var ep = isTv ? "/tv/" : "/movie/";
            try {
                var detail = tmdbGet(ep + tmdbId, {"language": "es"});
                var name = detail.name || detail.title || "";
                var thumb = detail.backdrop_path ? TMDB_BK + detail.backdrop_path : (detail.poster_path ? TMDB_IMG + detail.poster_path : "");
                var overview = detail.overview || "";

                var esItem = findEsplayForTmdb(name, isTv);
                if (esItem) {
                    var pelisUrl = "https://pelisplus2.ai/" + (isTv ? "serie" : "pelicula") + "/" + esItem.slug;
                    var esplayCover = esItem.coverPath ? (ESPLAY_IMG + esItem.coverPath + "/cover/original") : "";
                    var finalThumb = thumb || esplayCover;
                    var sources = scrapeVideoSources(pelisUrl);
                    if (sources.length === 0) {
                        var altDomains = ["pelisplushd.nu", "pelisplushd.nz", "cuevana3.ai"];
                        for (var d = 0; d < altDomains.length && sources.length === 0; d++) {
                            var altUrl = "https://" + altDomains[d] + "/" + (isTv ? "serie" : "pelicula") + "/" + esItem.slug;
                            sources = scrapeVideoSources(altUrl);
                        }
                    }
                    return mkDetail(pelisUrl, name, finalThumb, pelisUrl, sources, overview);
                }

                return mkDetail(url, name || "Sin titulo", thumb, url, [], overview);
            } catch (e) {
                return mkDetail(url, "Error", "", url, [], "Error al cargar: " + String(e));
            }
        }
    }

    if (url.indexOf("pelisplus") !== -1 || url.indexOf("cuevana") !== -1 || url.indexOf("pelisplushd") !== -1) {
        try {
            var pageDetails = scrapePageDetails(url);
            var sources = scrapeVideoSources(url);
            return mkDetail(url, pageDetails.title || "Contenido", pageDetails.thumbnail || "", url, sources, pageDetails.description || "");
        } catch (e) {
            return mkDetail(url, "Error", "", url, [], "Error: " + String(e));
        }
    }

    return mkDetail(url, "PlayPelis", "", url, [], "Contenido de PlayPelis");
}

// ========== SOURCE BINDINGS ==========
// Guard: only bind if source object exists (injected by GrayJay)
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() {
        try {
            var ft = _feedMixed;
            var ot = _orderChrono;
            if (typeof Type !== "undefined") { ft = Type.Feed.Mixed; ot = Type.Order.Chronological; }
            return { types: [ft], sorts: [ot], filters: [] };
        } catch(e) {
            return { types: [2], sorts: [1], filters: [] };
        }
    };
    source.search = function(query, type, order, filters, continuationToken) { return doSearch(query); };
    source.isVideoDetailsUrl = function(url) {
        if (!url) return false;
        return url.indexOf("themoviedb.org/movie/") !== -1 || url.indexOf("themoviedb.org/tv/") !== -1 || url.indexOf("pelisplus") !== -1 || url.indexOf("cuevana") !== -1 || url.indexOf("pelisplushd") !== -1;
    };
    source.getVideoDetails = function(url) { return doDetails(url); };
    source.getHome = function(continuationToken) { return doHome(); };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
