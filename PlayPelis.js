// PlayPelis GrayJoy Source Plugin v6 - Uses esplay GraphQL for video URLs
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
var _feedMixed = 2;
var _orderChrono = 1;
try { if (typeof Type !== "undefined") { _feedMixed = Type.Feed.Mixed; _orderChrono = Type.Order.Chronological; } } catch(e) {}

function initPlatformID() { if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID); }

function tmdbGet(path, params) {
    var qs = "api_key=" + TMDB_KEY;
    if (params) { var keys = Object.keys(params); for (var i = 0; i < keys.length; i++) { qs += "&" + keys[i] + "=" + encodeURIComponent(params[keys[i]]); } }
    var resp = http.GET(TMDB_API + path + "?" + qs, {"Accept": "application/json"});
    return JSON.parse(resp.body);
}

function gqlPost(query, variables) {
    var body = JSON.stringify({"query": query, "variables": variables || {}});
    var headers = {"Content-Type": "application/json", "User-Agent": UA, "Origin": "https://pelisplus2.ai", "Referer": "https://pelisplus2.ai/"};
    var resp = http.POST(ESPLAY_GQL, body, headers, false);
    return JSON.parse(resp.body);
}

function mkThumb(url) { if (!url) return new Thumbnails([]); return new Thumbnails([new Thumbnail(url, 100)]); }

function mkVideo(id, title, thumb, url, date) {
    initPlatformID();
    return new PlatformVideo({ id: new PlatformID("PlayPelis", String(id), PID), name: title || "Sin titulo", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: date || 0, url: url, duration: 0, viewCount: 0, isLive: false });
}

function mkVideoSource(url, name, isHls) {
    var container = isHls ? "application/x-mpegURL" : "video/mp4";
    try {
        if (typeof HLSSource !== "undefined" && isHls) return new HLSSource({ url: url, name: name, duration: 0 });
        if (typeof VideoUrlSource !== "undefined") return new VideoUrlSource({ width: 1920, height: 1080, container: container, codec: "avc1.640028", name: name, bitrate: 4000000, duration: 0, url: url });
    } catch(e) {}
    return { plugin_type: "VideoUrlSource", width: 1920, height: 1080, container: container, codec: "avc1.640028", name: name, bitrate: 4000000, duration: 0, url: url };
}

function mkVideoDescriptor(videoSources) {
    try { if (typeof VideoSourceDescriptor !== "undefined") return new VideoSourceDescriptor(videoSources); } catch(e) {}
    return { plugin_type: "MuxVideoSourceDescriptor", isUnMuxed: false, videoSources: videoSources };
}

function mkDetail(id, name, thumb, url, videoUrls, description) {
    initPlatformID();
    var sources = [];
    for (var i = 0; i < videoUrls.length; i++) { var isHls = videoUrls[i].indexOf(".m3u8") !== -1; sources.push(mkVideoSource(videoUrls[i], videoUrls[i].name || ("Servidor " + (i + 1)), isHls)); }
    var videoDesc = mkVideoDescriptor(sources);
    try {
        return new PlatformVideoDetails({ id: new PlatformID("PlayPelis", String(id), PID), name: name || "PlayPelis", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false, description: description || "Contenido de PlayPelis", video: videoDesc, rating: new IRating(0, 0) });
    } catch(e) {}
    try {
        return { id: new PlatformID("PlayPelis", String(id), PID), name: name || "PlayPelis", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false, description: description || "", video: videoDesc, plugin_type: "PlatformVideoDetails" };
    } catch(e2) {}
    return null;
}

// ========== ESPLAY SEARCH ==========
function esplaySearch(query) {
    var items = [];
    try {
        var data = gqlPost("query mySearchItems($query: String!) { movies: showSearch(query: $query, type: \"movie\", limit: 10) { items { id title slug coverPath year overview type } } tvshows: showSearch(query: $query, type: \"tvshow\", limit: 10) { items { id title slug coverPath year overview type } } }", {query: query});
        if (data && data.data) {
            if (data.data.movies && data.data.movies.items) items = items.concat(data.data.movies.items);
            if (data.data.tvshows && data.data.tvshows.items) items = items.concat(data.data.tvshows.items);
        }
    } catch (e) {
        try {
            var data2 = gqlPost("{ search(query: \"" + query.replace(/"/g, '\\"') + "\", page: 1, limit: 10) { items { id title slug coverPath year overview type } } }", {});
            if (data2 && data2.data && data2.data.search && data2.data.search.items) items = data2.data.search.items;
        } catch (e2) {}
    }
    return items;
}

function doSearch(query) {
    var results = [];
    try {
        var items = esplaySearch(query);
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var typeStr = item.type === "tvshow" ? "tvshow" : "movie";
            var cover = item.coverPath ? (ESPLAY_IMG + item.coverPath + "/cover/original") : "";
            var ppUrl = "esplay:" + typeStr + ":" + item.id + ":" + item.slug;
            results.push(mkVideo(item.id || String(i), item.title || "Sin titulo", cover, ppUrl, 0));
        }
    } catch (e) {}
    if (results.length === 0) {
        try {
            var tmdbData = tmdbGet("/search/movie", {"query": query, "language": "es"});
            if (tmdbData && tmdbData.results) {
                for (var i = 0; i < Math.min(tmdbData.results.length, 10); i++) {
                    var r = tmdbData.results[i]; var thumb = r.poster_path ? (TMDB_IMG + r.poster_path) : "";
                    results.push(mkVideo(r.id, r.title || r.name || "Sin titulo", thumb, "https://www.themoviedb.org/movie/" + r.id, 0));
                }
            }
        } catch (e) {}
    }
    return results;
}

// ========== ESPLAY VIDEO LINKS ==========
function esplayGetVideoLinks(itemId, isEpisode) {
    var videoUrls = [];
    try {
        var query = isEpisode
            ? "query queryVideos($itemId: String!) { videos(itemId: $itemId) { language url quality sandbox type server updatedAt status } }"
            : "query videoLinks($itemId: String!) { links(itemId: $itemId) { mirrors { language url quality sandbox type server updatedAt status } } }";
        var resp = gqlPost(query, {itemId: String(itemId)});
        var mirrors = isEpisode ? (resp.data && resp.data.videos) : (resp.data && resp.data.links && resp.data.links.mirrors);
        if (mirrors && mirrors.length > 0) {
            for (var i = 0; i < mirrors.length; i++) {
                var m = mirrors[i];
                if (m.url) {
                    var name = (m.server || "Server") + " " + (m.language || "") + " " + (m.quality || "");
                    videoUrls.push({url: m.url, name: name.trim()});
                }
            }
        }
    } catch (e) {}
    return videoUrls;
}

// ========== HOME ==========
function doHome() {
    var sections = [];
    try {
        var trending = tmdbGet("/trending/movie/week", {"language": "es"});
        if (trending && trending.results) {
            var items = [];
            for (var i = 0; i < trending.results.length; i++) { var r = trending.results[i]; var thumb = r.poster_path ? (TMDB_IMG + r.poster_path) : ""; items.push(mkVideo(r.id, r.title || "Sin titulo", thumb, "https://www.themoviedb.org/movie/" + r.id, 0)); }
            sections.push(new PlatformContent({ name: "Tendencias", items: items, contentType: Type.Feed.Mixed }));
        }
    } catch (e) {}
    try {
        var topRated = tmdbGet("/movie/top_rated", {"language": "es", "page": 1});
        if (topRated && topRated.results) {
            var items2 = [];
            for (var i = 0; i < topRated.results.length; i++) { var r = topRated.results[i]; var thumb = r.poster_path ? (TMDB_IMG + r.poster_path) : ""; items2.push(mkVideo(r.id, r.title || "Sin titulo", thumb, "https://www.themoviedb.org/movie/" + r.id, 0)); }
            sections.push(new PlatformContent({ name: "Mejor Valoradas", items: items2, contentType: Type.Feed.Mixed }));
        }
    } catch (e) {}
    return sections;
}

// ========== DETAILS ==========
function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", "", [], "Sin URL");

    // esplay:// URLs from search results
    if (url.indexOf("esplay:") === 0) {
        try {
            var parts = url.split(":");
            var type = parts[1] || "movie";
            var itemId = parts[2] || "";
            var slug = parts[3] || "";
            var isEpisode = false;

            // Get metadata from esplay
            var detail = null;
            try {
                var gqlResp = gqlPost("query showItem($type: String!, $slug: String!) { show(type: $type, slug: $slug) { id title overview coverPath year duration genres { name } } }", {type: type, slug: slug});
                if (gqlResp && gqlResp.data && gqlResp.data.show) detail = gqlResp.data.show;
            } catch (e) {}

            var name = detail ? (detail.title || slug) : slug;
            var thumb = detail && detail.coverPath ? (ESPLAY_IMG + detail.coverPath + "/cover/original") : "";
            var desc = detail ? (detail.overview || "") : "";

            // Get video URLs from esplay
            var videoList = esplayGetVideoLinks(itemId, isEpisode);

            // Fallback: try TMDB metadata
            if (!detail) {
                try {
                    var tmdbSearch = tmdbGet("/search/movie", {"query": name, "language": "es"});
                    if (tmdbSearch && tmdbSearch.results && tmdbSearch.results.length > 0) {
                        var t = tmdbSearch.results[0];
                        if (t.backdrop_path) thumb = TMDB_BK + t.backdrop_path;
                        else if (t.poster_path) thumb = TMDB_IMG + t.poster_path;
                        if (t.overview) desc = t.overview;
                    }
                } catch (e) {}
            }

            return mkDetail(itemId, name, thumb, url, videoList, desc);
        } catch (e) {
            return mkDetail(url, "Error", "", url, [], "Error: " + String(e));
        }
    }

    // TMDB URLs fallback
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
                // Try to find on esplay and get video links
                try {
                    var esItems = esplaySearch(name);
                    var wantedType = isTv ? "tvshow" : "movie";
                    var esItem = null;
                    for (var i = 0; i < esItems.length; i++) { if (esItems[i].type === wantedType) { esItem = esItems[i]; break; } }
                    if (!esItem && esItems.length > 0) esItem = esItems[0];
                    if (esItem) {
                        var videoList = esplayGetVideoLinks(esItem.id, false);
                        var esUrl = "esplay:" + (esItem.type || "movie") + ":" + esItem.id + ":" + esItem.slug;
                        return mkDetail(esItem.id, name, thumb, esUrl, videoList, overview);
                    }
                } catch (e) {}
                return mkDetail(tmdbId, name || "Sin titulo", thumb, url, [], overview);
            } catch (e) {
                return mkDetail(tmdbId, "Error", "", url, [], "Error: " + String(e));
            }
        }
    }

    return mkDetail(url, "PlayPelis", "", url, [], "Contenido de PlayPelis");
}

// ========== SOURCE BINDINGS ==========
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() { try { var ft = _feedMixed, ot = _orderChrono; if (typeof Type !== "undefined") { ft = Type.Feed.Mixed; ot = Type.Order.Chronological; } return { types: [ft], sorts: [ot], filters: [] }; } catch(e) { return { types: [2], sorts: [1], filters: [] }; } };
    source.search = function(query, type, order, filters, continuationToken) { return doSearch(query); };
    source.isVideoDetailsUrl = function(url) { if (!url) return false; return url.indexOf("esplay:") === 0 || url.indexOf("themoviedb.org/movie/") !== -1 || url.indexOf("themoviedb.org/tv/") !== -1; };
    source.getVideoDetails = function(url) { return doDetails(url); };
    source.getHome = function(continuationToken) { return doHome(); };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
