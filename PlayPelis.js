// PlayPelis GrayJay Source
var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_KEY = "26c168179ae6b5445f36aca260e00d48";
var TMDB_IMG = "https://image.tmdb.org/t/p/w220_and_h330_face";
var TMDB_BK = "https://image.tmdb.org/t/p/w500";
var ESPLAY_GQL = "https://api.esplay.one/graphql";
var ESPLAY_IMG = "https://static.esplay.one/";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36";
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var PPID = null;
var _settings = {};
var GQL_ITEMS = "items { id title slug coverPath year overview type quality { type language __typename } }";

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

function scrapeIframes(pageUrl) {
    var sources = [];
    try {
        var resp = http.GET(pageUrl, {"User-Agent": UA});
        var html = resp.body;
        var iframeRegex = /<iframe[^>]+(?:src|data-src)="([^"]+)"[^>]*>/gi;
        var match;
        var seen = {};
        while ((match = iframeRegex.exec(html)) !== null) {
            var u = match[1].trim();
            if (u && !seen[u]) {
                seen[u] = true;
                var name = "Servidor " + (sources.length + 1);
                sources.push(new VideoUrlSource({
                    width: 1280,
                    height: 720,
                    container: "video/mp4",
                    codec: "avc1.4d401f",
                    name: name,
                    bitrate: 2000000,
                    duration: 0,
                    url: u
                }));
            }
        }
        var m3u8Regex = /(?:https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
        while ((match = m3u8Regex.exec(html)) !== null) {
            var u = match[0];
            if (!seen[u]) {
                seen[u] = true;
                sources.push(new VideoUrlSource({
                    width: 1280,
                    height: 720,
                    container: "application/x-mpegURL",
                    codec: "avc1.4d401f",
                    name: "HLS " + (sources.length + 1),
                    bitrate: 2000000,
                    duration: 0,
                    url: u
                }));
            }
        }
    } catch (e) {}
    return sources;
}

function scrapePageDetails(pageUrl) {
    var info = {title: "", thumbnail: "", description: ""};
    try {
        var resp = http.GET(pageUrl, {"User-Agent": UA});
        var html = resp.body;
        var doc = DOMParser.parseFromString(html);
        var titleNode = doc.querySelector("h1");
        info.title = titleNode ? titleNode.textContent.trim() : "";
        var imgNode = doc.querySelector("img[src*='poster']") || doc.querySelector(".post img") || doc.querySelector("img[alt*='poster']");
        if (imgNode) {
            var src = imgNode.getAttribute("src") || "";
            if (src && src.indexOf("http") === -1) src = "https://pelisplus2.ai" + src;
            info.thumbnail = src;
        }
        var descNode = doc.querySelector(".description") || doc.querySelector("p粘Description");
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

function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", "");

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
                    var pageDetails = scrapePageDetails(pelisUrl);
                    var pageThumb = finalThumb || pageDetails.thumbnail;
                    var sources = scrapeIframes(pelisUrl);
                    return mkDetail(pelisUrl, name || pageDetails.title || esItem.title, pageThumb, pelisUrl, sources, overview || pageDetails.description);
                }

                return mkDetail(url, name || "PlayPelis", thumb, url, [], overview);
            } catch (e) {
                return mkDetail(url, "Error al cargar", "", url, [], "No se pudo obtener la información del video.");
            }
        }
    }

    if (url.indexOf("pelisplus2.ai") !== -1) {
        try {
            var pageDetails = scrapePageDetails(url);
            var sources = scrapeIframes(url);
            var name = pageDetails.title || "PlayPelis";
            var thumb = pageDetails.thumbnail || "";
            var desc = pageDetails.description || "Reproduciendo desde PlayPelis";
            return mkDetail(url, name, thumb, url, sources, desc);
        } catch (e) {
            return mkDetail(url, "Error al cargar", "", url, [], "No se pudo cargar la página.");
        }
    }

    return mkDetail(url, "PlayPelis", "", url, [], "Contenido de PlayPelis");
}

source.setSettings = function(s) { _settings = s || {}; };
source.enable = function(c, s) { _settings = s || {}; };
source.getSearchCapabilities = function() { return { types: [Type.Feed.Mixed], sorts: [Type.Order.Chronological], filters: [] }; };
source.search = function(query, type, order, filters, continuationToken) { return doSearch(query); };
source.isVideoDetailsUrl = function(url) {
    if (!url) return false;
    return url.indexOf("themoviedb.org/movie/") !== -1 || url.indexOf("themoviedb.org/tv/") !== -1 || url.indexOf("pelisplus2.ai/") !== -1;
};
source.getVideoDetails = function(url) { return doDetails(url); };
source.getHome = function(continuationToken) { return doHome(); };
source.isChannelUrl = function(url) { return false; };
source.searchSuggestions = function(query) { return []; };
