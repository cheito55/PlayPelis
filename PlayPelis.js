// PlayPelis GrayJay Source v12 - Multi-sitio
// JkAnime (busca + reproduce con m3u8) + PeliSmart (busca + muestra episodios)
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = new Date().getTime();
var _feedMixed = 2;
var _searchLimit = 30;

try {
    if (typeof Type !== "undefined") {
        _feedMixed = Type.Feed.Mixed;
    }
} catch (e) {}

function initPlatformID() {
    if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
}

// ===================== HTTP =====================
function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var resp = http.GET(url, h);
        return resp.body || "";
    } catch (e) { return ""; }
}

function httpGetJson(url, headers) {
    var body = httpGet(url, headers);
    try { return JSON.parse(body); } catch (e) { return null; }
}

// ===================== Utilidades =====================
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
    if (u.indexOf("http://")===0 || u.indexOf("https://")===0) return u;
    if (u.indexOf("//")===0) return "https:" + u;
    return getRoot(base) + (u.indexOf("/")===0 ? u : "/" + u);
}

function slugify(s) {
    return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

function b64decode(s) {
    var b64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    s=String(s||"").replace(/[^A-Za-z0-9+/=]/g,"");
    var out="",buf=0,bits=0;
    for(var i=0;i<s.length;i++){if(s[i]==="=")break;var v=b64.indexOf(s[i]);if(v<0)continue;buf=(buf<<6)|v;bits+=6;if(bits>=8){bits-=8;out+=String.fromCharCode((buf>>bits)&255);}}
    return out;
}

function uniqueUrls(list) {
    var seen={},out=[];
    for(var i=0;i<list.length;i++){var u=(list[i]||"").trim();if(!u||seen[u])continue;seen[u]=1;out.push(u);}
    return out;
}

// ===================== Modelos GrayJay =====================
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
        uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false
    });
}

function mkVideoSource(url, name, isHls) {
    var container = isHls ? "application/x-mpegURL" : "video/mp4";
    try {
        if (typeof HLSSource !== "undefined" && isHls) return new HLSSource({url:url,name:name,duration:0});
        if (typeof VideoUrlSource !== "undefined") return new VideoUrlSource({width:1920,height:1080,container:container,codec:"avc1.640028",name:name,bitrate:4000000,duration:0,url:url});
    } catch(e) {}
    return {plugin_type:"VideoUrlSource",width:1920,height:1080,container:container,codec:"avc1.640028",name:name,bitrate:4000000,duration:0,url:url};
}

function mkVideoDescriptor(videoSources) {
    try { if (typeof VideoSourceDescriptor !== "undefined") return new VideoSourceDescriptor(videoSources); } catch(e) {}
    return {plugin_type:"MuxVideoSourceDescriptor",isUnMuxed:false,videoSources:videoSources};
}

function mkDetail(id, name, thumb, url, videoUrls, description) {
    initPlatformID();
    var sources = [];
    for (var i = 0; i < videoUrls.length; i++) {
        var v = videoUrls[i] || {};
        var vUrl = typeof v === "string" ? v : (v.url || "");
        if (!vUrl) continue;
        var vName = typeof v === "string" ? ("Servidor " + (i + 1)) : (v.name || "Servidor " + (i + 1));
        sources.push(mkVideoSource(vUrl, vName, vUrl.indexOf(".m3u8") !== -1));
    }
    var videoDesc = mkVideoDescriptor(sources);
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "PlayPelis",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false,
            description: description || "", video: videoDesc, rating: null
        });
    } catch(e) {}
    return {
        id: new PlatformID("PlayPelis", String(id), PID),
        name: name || "PlayPelis", thumbnails: mkThumb(thumb),
        author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
        uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false,
        description: description || "", plugin_type: "PlatformVideoDetails", contentType: 1,
        video: videoDesc, rating: null
    };
}

// ===================== JkAnime =====================
function jkaSearch(query, limit) {
    var out = [];
    try {
        var slug = slugify(query);
        if (!slug) return out;
        var url = "https://jkanime.net/" + slug + "/";
        var html = httpGet(url, {"Referer":"https://jkanime.net/"});
        if (!html || html.indexOf("no encontrada") !== -1 || html.indexOf("<title>404") !== -1) return out;
        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm) title = htmlDecode(tm[1]); }
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i,"").replace(/JkAnime/i,"").trim() || query;
        var thumb = "";
        var im = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/);
        if (!im) im = html.match(/<img[^>]*src=["']([^"']+(?:cover|portada))[^"']*["']/);
        if (im) thumb = fullUrl(url, im[1]);
        out.push({title:title, url:url, thumb:thumb, site:"JkAnime"});
    } catch(e) {}
    return out;
}

function jkaExtractM3u8FromJkplayer(jkplayerUrl) {
    var html = httpGet(jkplayerUrl, {"Referer":"https://jkanime.net/"});
    if (!html) return null;
    var m = html.match(/url\s*:\s*'([^']*\.m3u8[^']*)'/);
    if (m) return m[1];
    m = html.match(/atob\('([^']+)'\)/);
    if (m) { try { var decoded = b64decode(m[1]); if (decoded.indexOf(".m3u8") !== -1) return decoded; } catch(e) {} }
    return null;
}

function jkaGetEpisodes(seriesUrl) {
    var out = [];
    var html = httpGet(seriesUrl, {"Referer":"https://jkanime.net/"});
    if (!html) return out;
    var seriesMatch = seriesUrl.match(/jkanime\.net\/([a-z0-9-]+)\/?$/);
    var episodeMatch = seriesUrl.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/);
    if (episodeMatch) {
        out.push({number:parseInt(episodeMatch[2]), url:seriesUrl});
        for (var i = 1; i <= 3; i++) {
            var num = parseInt(episodeMatch[2]) + i;
            out.push({number:num, url:"https://jkanime.net/" + episodeMatch[1] + "/" + num + "/"});
        }
        return out;
    }
    if (seriesMatch) {
        var slug = seriesMatch[1];
        var idm = html.match(/ajax\/episodes\/(\d+)\//);
        if (idm) {
            var csrfM = html.match(/name="csrf-token"\s+content="([^"]+)"/);
            var csrf = csrfM ? csrfM[1] : "";
            if (csrf) {
                for (var p = 1; p <= 3; p++) {
                    var body = httpPost("https://jkanime.net/ajax/episodes/" + idm[1] + "/" + p,
                        "_token=" + encodeURIComponent(csrf),
                        {"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-CSRF-TOKEN":csrf,"X-Requested-With":"XMLHttpRequest","Accept":"application/json","Referer":seriesUrl});
                    try {
                        var json = JSON.parse(body);
                        if (json && json.data) {
                            for (var i = 0; i < json.data.length; i++) {
                                out.push({number:json.data[i].number, url:"https://jkanime.net/" + slug + "/" + json.data[i].number + "/"});
                            }
                        }
                    } catch(e) {}
                    if (out.length >= 50) break;
                }
            }
        }
        if (out.length === 0) {
            for (var n = 1; n <= 5; n++) out.push({number:n, url:"https://jkanime.net/" + slug + "/" + n + "/"});
        }
    }
    return out;
}

function httpPost(url, body, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var resp = http.POST(url, body, h);
        return resp.body || "";
    } catch(e) { return ""; }
}

function jkaGetSourcesFromPage(url) {
    var sources = [];
    var html = httpGet(url, {"Referer":"https://jkanime.net/"});
    if (!html) return sources;
    var re = /<iframe class="player_conte" src="([^"]*jkplayer\/[^"]*)"/g;
    var m;
    while ((m = re.exec(html))) {
        var jkUrl = m[1];
        if (jkUrl.indexOf("http") !== 0) jkUrl = "https://jkanime.net" + (jkUrl.indexOf("/")===0 ? "" : "/") + jkUrl;
        var m3u8 = jkaExtractM3u8FromJkplayer(jkUrl);
        if (m3u8) {
            var exists = false;
            for (var i = 0; i < sources.length; i++) { if (sources[i].url === m3u8) { exists = true; break; } }
            if (!exists) sources.push({url:m3u8, name:"Servidor " + (sources.length + 1), hls:true});
        }
    }
    var reRemote = /"remote"\s*:\s*"([A-Za-z0-9+\/=\-_]+)"/g;
    while ((m = reRemote.exec(html))) {
        var decoded = b64decode(m[1]);
        if (decoded.indexOf("http") === 0) {
            var h = getHost(decoded);
            if (h.indexOf("dood") !== -1 || h.indexOf("voe") !== -1 || h.indexOf("streamtape") !== -1 || h.indexOf("uqload") !== -1) {
                sources.push({url:decoded, name:hostNameSimple(decoded), hls:false});
            }
        }
    }
    return sources;
}

function hostNameSimple(u) {
    var h = getHost(u);
    if (h.indexOf("dood") !== -1) return "DoodStream";
    if (h.indexOf("voe") !== -1) return "Voe";
    if (h.indexOf("streamtape") !== -1) return "StreamTape";
    if (h.indexOf("uqload") !== -1) return "Uqload";
    return h.replace(/^www\./, "");
}

function jkaGetDescription(url) {
    var html = httpGet(url, {"Referer":"https://jkanime.net/"});
    if (!html) return "";
    var m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (m) return htmlDecode(m[1]);
    m = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (m) return htmlDecode(m[1]);
    return "";
}

// ===================== PeliSmart =====================
function smartSearch(query, limit) {
    var out = [];
    try {
        var html = httpGet("https://pelismart.mov/search?s=" + encodeURIComponent(query), {"Referer":"https://pelismart.mov/"});
        if (!html) return out;
        var re = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        var m;
        while ((m = re.exec(html)) && out.length < limit) {
            var href = m[1];
            if (href.indexOf("/pelicula/") === -1 && href.indexOf("/serie/") === -1 && href.indexOf("/anime/") === -1) continue;
            var full = fullUrl("https://pelismart.mov", href);
            var imgm = m[2].match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/);
            if (!imgm) continue;
            var title = htmlDecode(imgm[2]);
            if (!title) continue;
            var type = href.indexOf("/anime/") !== -1 ? "Anime" : (href.indexOf("/serie/") !== -1 ? "Serie" : "Pelicula");
            out.push({title:title + " [" + type + "]", url:full, thumb:imgm[1], site:"PeliSmart"});
        }
    } catch(e) {}
    return out;
}

function smartGetEpisodes(url) {
    var out = [];
    var html = httpGet(url, {"Referer":"https://pelismart.mov/"});
    if (!html) return out;
    var re = /href="(\/serie\/[^"]*\/temporada\/\d+\/capitulo\/\d+)"/g;
    var m;
    while ((m = re.exec(html))) {
        var full = fullUrl("https://pelismart.mov", m[1]);
        var capMatch = m[1].match(/temporada\/(\d+)\/capitulo\/(\d+)/);
        var label = capMatch ? ("T" + capMatch[1] + " E" + capMatch[2]) : m[1];
        if (out.indexOf(full) === -1) out.push({title:label, url:full});
    }
    if (out.length === 0) {
        re = /href="(\/pelicula\/[^"]*capitulo\/[^"]*|\/serie\/[^"]*capitulo\/[^"]*)"/g;
        while ((m = re.exec(html))) {
            var full2 = fullUrl("https://pelismart.mov", m[1]);
            if (out.indexOf(full2) === -1) out.push({title:"Capítulo", url:full2});
        }
    }
    return out;
}

function smartGetDescription(url) {
    var html = httpGet(url, {"Referer":"https://pelismart.mov/"});
    if (!html) return "";
    var m = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (m) return htmlDecode(m[1]);
    m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (m) return htmlDecode(m[1]);
    return "";
}

function smartGetThumb(url) {
    var html = httpGet(url, {"Referer":"https://pelismart.mov/"});
    if (!html) return "";
    var m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (m) return htmlDecode(m[1]);
    return "";
}

// ===================== Búsqueda y Home =====================
function doSearch(query) {
    var out = [];
    try { var jka = jkaSearch(query, 15); for (var i = 0; i < jka.length; i++) out.push(jka[i]); } catch(e) {}
    try { var ps = smartSearch(query, 15); for (var i = 0; i < ps.length; i++) out.push(ps[i]); } catch(e) {}
    var dedup = {}, final = [];
    for (var j = 0; j < out.length; j++) { var key = out[j].url; if (dedup[key]) continue; dedup[key] = 1; final.push(out[j]); }
    return final;
}

function doHome() {
    var videos = [];
    try {
        var html = httpGet("https://jkanime.net/", {"Referer":"https://jkanime.net/"});
        if (html) {
            var re = /<div class="hero__items set-bg"[^>]*data-setbg="([^"]+)"/gi;
            var m;
            while ((m = re.exec(html)) && videos.length < 10) {
                var img = m[1];
                var window = html.substring(m.index, m.index + 1800);
                var tm = window.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                var title = tm ? stripTags(tm[1]) : "";
                var am = window.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
                var link = am ? fullUrl("https://jkanime.net/", am[1]) : "";
                if (title && link) videos.push(mkVideo("jka_" + link, title, img, link, "JkAnime"));
            }
        }
    } catch(e) {}
    try {
        var html2 = httpGet("https://pelismart.mov/", {"Referer":"https://pelismart.mov/"});
        if (html2) {
            var re2 = /<a[^>]*href="([^"]*(?:pelicula|serie)[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/gi;
            var m2;
            while ((m2 = re2.exec(html2)) && videos.length < 20) {
                var link2 = fullUrl("https://pelismart.mov", m2[1]);
                videos.push(mkVideo("ps_" + link2, htmlDecode(m2[3]), m2[2], link2, "PeliSmart"));
            }
        }
    } catch(e) {}
    try { if (typeof ContentPager !== "undefined") return new ContentPager(videos, false, null); } catch(e) {}
    return videos;
}

function doDetails(url) {
    if (!url) return mkDetail("", "PlayPelis", "", url, [], "Sin URL");
    var host = getHost(url);
    if (host.indexOf("jkanime.net") !== -1) {
        var desc = jkaGetDescription(url);
        var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/);
        var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/);
        if (seriesMatch && !episodeMatch) {
            var eps = jkaGetEpisodes(url);
            if (eps.length > 0) return doDetails(eps[0].url);
            return mkDetail("jk_" + url, slugToTitle(seriesMatch[1]), "", url, [], desc || "Serie - no se pudieron cargar los episodios");
        }
        var sources = jkaGetSourcesFromPage(url);
        var title = "";
        var html = httpGet(url, {"Referer":"https://jkanime.net/"});
        if (html) {
            var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (tm) title = stripTags(tm[1]);
            if (!title) { tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm) title = htmlDecode(tm[1]); }
        }
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i,"").replace(/JkAnime/i,"").trim();
        var thumb = "";
        if (html) { var im = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/); if (im) thumb = fullUrl(url, im[1]); }
        return mkDetail("jk_" + url, title || slugToTitle(episodeMatch ? episodeMatch[1] : "JkAnime"), thumb, url, sources, desc);
    }
    if (host.indexOf("pelismart") !== -1 || host.indexOf("smartpeli") !== -1) {
        var desc2 = smartGetDescription(url);
        var thumb2 = smartGetThumb(url);
        var title2 = "";
        var html3 = httpGet(url, {"Referer":"https://pelismart.mov/"});
        if (html3) {
            var tm3 = html3.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (tm3) title2 = stripTags(tm3[1]);
            if (!title2) { tm3 = html3.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm3) title2 = htmlDecode(tm3[1]); }
        }
        var episodes = smartGetEpisodes(url);
        var epDesc = desc2 || "";
        if (episodes.length > 0) {
            epDesc = (epDesc ? epDesc + "\n\n" : "") + episodes.length + " episodios disponibles:\n";
            for (var ei = 0; ei < episodes.length && ei < 20; ei++) epDesc += episodes[ei].title + " ";
        }
        var videoUrls = [];
        if (episodes.length === 0) {
            var iframeM = html3 ? html3.match(/<iframe[^>]*src="([^"]*vidurl[^"]*)"/) : null;
            if (iframeM) videoUrls.push({url:fullUrl("https://pelismart.mov", iframeM[1]), name:"PeliSmart Player"});
        }
        return mkDetail("ps_" + url, title2 || "PeliSmart", thumb2, url, videoUrls, epDesc);
    }
    return mkDetail("", "PlayPelis", "", url, [], "No se puede reproducir este sitio");
}

function slugToTitle(slug) {
    return String(slug || "").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

// ===================== Bindings GrayJay =====================
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() {
        try { return {types:[_feedMixed], sorts:[], filters:[]}; }
        catch(e) { return {types:[2], sorts:[], filters:[]}; }
    };
    source.search = function(query, type, order, filters) {
        var items = doSearch(query || "");
        var videos = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            videos.push(mkVideo("pp_" + it.url, it.title, it.thumb, it.url, it.site || "PlayPelis"));
        }
        try { if (typeof VideoPager !== "undefined") return new VideoPager(videos, false, null); } catch(e) {}
        return videos;
    };
    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        return getHost(url).indexOf("jkanime.net") !== -1 || getHost(url).indexOf("pelismart") !== -1 || getHost(url).indexOf("smartpeli") !== -1;
    };
    source.getContentDetails = function(url) { return doDetails(url); };
    source.isVideoDetailsUrl = function(url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function(url) { return doDetails(url); };
    source.getHome = function() { return doHome(); };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
