// PlayPelis GrayJoy Source Plugin v8
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

function gqlPost(query, variables) {
    var body = JSON.stringify({"query": query, "variables": variables || {}});
    var headers = {"Content-Type": "application/json", "User-Agent": UA};
    var resp = http.POST(ESPLAY_GQL, body, headers, false);
    return JSON.parse(resp.body);
}

function httpGet(url, headers) {
    try { var h = headers || {}; if (!h["User-Agent"]) h["User-Agent"] = UA; var resp = http.GET(url, h); return resp.body || ""; } catch (e) { return ""; }
}

function mkThumb(url) { if (!url) return new Thumbnails([]); return new Thumbnails([new Thumbnail(url, 100)]); }

function mkVideo(id, title, thumb, url) {
    initPlatformID();
    return new PlatformVideo({ id: new PlatformID("PlayPelis", String(id), PID), name: title || "Sin titulo", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false });
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
    for (var i = 0; i < videoUrls.length; i++) {
        var vUrl = videoUrls[i].url || videoUrls[i];
        var vName = videoUrls[i].name || ("Servidor " + (i + 1));
        var isHls = vUrl.indexOf(".m3u8") !== -1;
        sources.push(mkVideoSource(vUrl, vName, isHls));
    }
    var videoDesc = mkVideoDescriptor(sources);
    try {
        return new PlatformVideoDetails({ id: new PlatformID("PlayPelis", String(id), PID), name: name || "PlayPelis", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false, description: description || "", video: videoDesc, rating: new IRating(0, 0) });
    } catch(e) {}
    try {
        return { id: new PlatformID("PlayPelis", String(id), PID), name: name || "PlayPelis", thumbnails: mkThumb(thumb), author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"), uploadDate: 0, url: url, duration: 0, viewCount: 0, isLive: false, description: description || "", video: videoDesc, plugin_type: "PlatformVideoDetails" };
    } catch(e2) {}
    return null;
}

// ========== PAGERS ==========
class PlayPelisHomePager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }
    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class PlayPelisSearchPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }
    nextPage() {
        return source.search(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
    }
}
// ========== ESPLAY SEARCH (usa showSearch como la APK) ==========
function esplaySearch(query) {
    var items = [];
    try {
        var data = gqlPost(
            'query mySearchItems($query: String!) { movies: showSearch(query: $query, type: "movie", limit: 15) { items { id title slug coverPath year overview type } } tvshows: showSearch(query: $query, type: "tvshow", limit: 15) { items { id title slug coverPath year overview type } } }',
            {query: query}
        );
        if (data && data.data) {
            if (data.data.movies && data.data.movies.items) items = items.concat(data.data.movies.items);
            if (data.data.tvshows && data.data.tvshows.items) items = items.concat(data.data.tvshows.items);
        }
    } catch (e) {}
    return items;
}

function doSearch(query, type, order, filters, continuationToken) {
    var results = [];
    var items = esplaySearch(query);
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var typeStr = item.type === "tvshow" ? "tvshow" : "movie";
        var cover = item.coverPath ? (ESPLAY_IMG + item.coverPath + "/cover/original") : "";
        var ppUrl = "esplay|" + typeStr + "|" + String(item.id) + "|" + item.slug;
        var yearMs = item.year ? new Date(String(item.year) + "-01-01").getTime() : _now;
        results.push(mkVideo(item.id || String(i), item.title || "Sin titulo", cover, ppUrl, yearMs));
    }
    return new PlayPelisSearchPager(results, false, { query: query, type: type, order: order, filters: filters, continuationToken: null });
}
// ========== ESPLAY VIDEO LINKS ==========
function esplayGetVideoLinks(itemId) {
    var videoUrls = [];
    // Links (peliculas)
    try {
        var resp = gqlPost("query videoLinks($itemId: String!) { links(itemId: $itemId) { mirrors { language url quality server type status } } }", {itemId: String(itemId)});
        if (resp && resp.data && resp.data.links && resp.data.links.mirrors) {
            var mirrors = resp.data.links.mirrors;
            for (var i = 0; i < mirrors.length; i++) {
                var m = mirrors[i];
                if (m.url) videoUrls.push({url: m.url, name: ((m.server || "") + " " + (m.language || "") + " " + (m.quality || "")).trim()});
            }
        }
    } catch (e) {}
    // Videos (episodios)
    if (videoUrls.length === 0) {
        try {
            var resp2 = gqlPost("query queryVideos($itemId: String!) { videos(itemId: $itemId) { language url quality server type status } }", {itemId: String(itemId)});
            if (resp2 && resp2.data && resp2.data.videos) {
                var vids = resp2.data.videos;
                for (var i = 0; i < vids.length; i++) {
                    var v = vids[i];
                    if (v.url) videoUrls.push({url: v.url, name: ((v.server || "") + " " + (v.language || "") + " " + (v.quality || "")).trim()});
                }
            }
        } catch (e) {}
    }
    return videoUrls;
}

// ========== HOME ==========
function doHome(continuationToken) {
    var allVideos = [];
    try {
        var resp = gqlPost("query { showList(type: \"movie\", list: \"recently_added\", page: 1, limit: 20) { items { id title slug coverPath year overview type } } }", {});
        if (resp && resp.data && resp.data.showList && resp.data.showList.items) {
            var items = resp.data.showList.items;
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var cover = item.coverPath ? (ESPLAY_IMG + item.coverPath + "/cover/original") : "";
                var ym = item.year ? new Date(String(item.year) + "-01-01").getTime() : _now;
                allVideos.push(mkVideo(item.id, item.title || "Sin titulo", cover, "esplay|" + (item.type || "movie") + "|" + String(item.id) + "|" + item.slug, ym));
            }
        }
    } catch (e) {}
    try {
        var resp2 = gqlPost("query { showList(type: \"movie\", list: \"premiere\", page: 1, limit: 20) { items { id title slug coverPath year overview type } } }", {});
        if (resp2 && resp2.data && resp2.data.showList && resp2.data.showList.items) {
            var items2 = resp2.data.showList.items;
            for (var i = 0; i < items2.length; i++) {
                var item = items2[i];
                var cover = item.coverPath ? (ESPLAY_IMG + item.coverPath + "/cover/original") : "";
                var ym = item.year ? new Date(String(item.year) + "-01-01").getTime() : _now;
                allVideos.push(mkVideo(item.id, item.title || "Sin titulo", cover, "esplay|" + (item.type || "movie") + "|" + String(item.id) + "|" + item.slug, ym));
            }
        }
    } catch (e) {}
    return new PlayPelisHomePager(allVideos, false, { continuationToken: null });
}

// ========== DETAILS ==========
function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", "", [], "Sin URL");
    if (url.indexOf("esplay|") !== 0) return mkDetail(url, "PlayPelis", "", url, [], "Contenido de PlayPelis");
    try {
        var parts = url.split("|");
        var type = parts[1] || "movie";
        var itemId = parts[2] || "";
        var slug = parts[3] || "";
        var name = slug;
        var thumb = "";
        var desc = "";
        // Metadata desde esplay
        try {
            var gqlResp = gqlPost("query showItem($type: String!, $slug: String!) { show(type: $type, slug: $slug) { id title overview coverPath year duration } }", {type: type, slug: slug});
            if (gqlResp && gqlResp.data && gqlResp.data.show) {
                var d = gqlResp.data.show;
                name = d.title || slug;
                thumb = d.coverPath ? (ESPLAY_IMG + d.coverPath + "/cover/original") : "";
                desc = d.overview || "";
            }
        } catch (e) {}
        // URLs de video desde esplay
        var videoList = esplayGetVideoLinks(itemId);
        return mkDetail(itemId, name, thumb, url, videoList, desc);
    } catch (e) {
        return mkDetail(url, "Error", "", url, [], "Error: " + String(e));
    }
}

// ========== SOURCE BINDINGS ==========
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() { try { var ft = _feedMixed, ot = _orderChrono; if (typeof Type !== "undefined") { ft = Type.Feed.Mixed; ot = Type.Order.Chronological; } return { types: [ft], sorts: [ot], filters: [] }; } catch(e) { return { types: [2], sorts: [1], filters: [] }; } };
    source.search = function(query, type, order, filters, continuationToken) { return doSearch(query, type, order, filters, continuationToken); };
    source.isVideoDetailsUrl = function(url) { if (!url) return false; return url.indexOf("esplay|") === 0; };
    source.getVideoDetails = function(url) { return doDetails(url); };
    source.getHome = function(continuationToken) { return doHome(continuationToken); };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
