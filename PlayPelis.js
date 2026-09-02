// PlayPelis GrayJay Source v21 - Simplified & Robust
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = Math.floor(Date.now() / 1000);

function initPlatformID() { if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID); }

function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"]) h["User-Agent"] = UA;
        var resp = http.GET(url, h);
        return resp.body || "";
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
    if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    return getRoot(base) + (u.indexOf("/") === 0 ? u : "/" + u);
}

function extractNextData(html) {
    if (!html) return null;
    var m = html.match(/__NEXT_DATA__[^>]*type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
}

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
        uploadDate: _now,
        url: url,
        duration: -1,
        viewCount: -1,
        isLive: false
    });
}

function mkHls(url, name) {
    if (!url) return null;
    return new HLSSource({ name: name || "HLS", url: url, duration: 0 });
}

function mkVidSrc(url, name) {
    if (!url) return null;
    return new VideoUrlSource({
        width: 1920, height: 1080,
        container: "video/mp4", codec: "avc1.640028",
        name: name || "Server", bitrate: 4000000,
        duration: 0, url: url
    });
}

function mkSrc(valid) {
    try { return new VideoSourceDescriptor(valid); } catch (e) {}
    return { plugin_type: "MuxVideoSourceDescriptor", isUnMuxed: false, videoSources: valid };
}

function mkDetail(id, name, thumb, url, videoSources, description) {
    initPlatformID();
    var sources = videoSources || [];
    var valid = [];
    var i;
    for (i = 0; i < sources.length; i++) { if (sources[i]) valid.push(sources[i]); }
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "Sin titulo",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now,
            url: url,
            duration: -1,
            viewCount: -1,
            isLive: false,
            video: mkSrc(valid),
            description: description || ""
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

// ===================== poseidonhd2.co =====================
var PHD = "https://www.poseidonhd2.co";

function phdSlugToUrl(slug) {
    if (!slug) return "";
    var parts = slug.split("/");
    if (parts.length >= 2) {
        var prefix = (parts[0] === "movies") ? "pelicula" : "serie";
        return PHD + "/" + prefix + "/" + parts.slice(1).join("/");
    }
    return PHD + "/" + slug;
}

function phdResolveCyberlocker(playerPhpUrl) {
    var sources = [];
    try {
        var html = httpGet(playerPhpUrl, {"Referer": PHD + "/"});
        if (!html) return sources;
        var urlMatch = html.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
        if (!urlMatch) return sources;
        var cyberUrl = urlMatch[1];
        var host = getHost(cyberUrl);

        // waaw.to / voe.sx: follow redirect chain to find m3u8
        if (host.indexOf("waaw") !== -1 || host.indexOf("voe") !== -1) {
            var page = httpGet(cyberUrl, {"Referer": PHD + "/"});
            if (page) {
                var root = getRoot(cyberUrl);
                var j;
                for (j = 0; j < 3; j++) {
                    var loc = page.match(/self\.location\.replace\(['"]([^'"]+)['"]/);
                    if (!loc) break;
                    page = httpGet(root + loc[1], {"Referer": cyberUrl});
                    if (!page) break;
                }
                var m3u8 = page.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
                if (m3u8) {
                    var m3u8Url = m3u8[0].replace(/['"`,;]/g, "");
                    sources.push(mkHls(m3u8Url, "Waaw/Voe"));
                    return sources;
                }
            }
        }

        // streamtape: try to extract video URL
        if (host.indexOf("streamtape") !== -1) {
            var stPage = httpGet(cyberUrl, {"Referer": PHD + "/"});
            if (stPage) {
                var vu = stPage.match(/(?:video_url|get_video)\s*[:=]\s*['"]([^'"]+)['"]/);
                if (vu) sources.push(mkVidSrc("https://streamtape.com" + vu[1], "StreamTape"));
            }
            if (sources.length > 0) return sources;
        }

        // Fallback: pass the embed URL directly
        var name = "Server";
        if (host.indexOf("streamwish") !== -1) name = "StreamWish";
        else if (host.indexOf("filelions") !== -1) name = "FileLions";
        else if (host.indexOf("streamtape") !== -1) name = "StreamTape";
        else if (host.indexOf("waaw") !== -1) name = "Waaw";
        else if (host.indexOf("dood") !== -1) name = "DoodStream";
        else if (host.indexOf("voe") !== -1) name = "Voe";
        sources.push(mkVidSrc(cyberUrl, name));
    } catch (e) {}
    return sources;
}

function phdHome() {
    var videos = [];
    try {
        var html = httpGet(PHD + "/");
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return videos;
        var pp = nd.props.pageProps;
        var latest = pp.tabLastReleasedMovies || pp.tabLastMovies || [];
        var i, m;
        for (i = 0; i < latest.length && i < 15; i++) {
            m = latest[i];
            var title = (m.titles && m.titles.name) || "";
            var poster = (m.images && m.images.poster) || "";
            var slug = (m.url && m.url.slug) || "";
            if (title && slug) videos.push(mkVideo("phd_" + slug, title, poster, phdSlugToUrl(slug), "PoseidonHD"));
        }
        var topWeek = pp.topMoviesWeek || [];
        for (i = 0; i < topWeek.length && i < 5; i++) {
            m = topWeek[i];
            var t2 = (m.titles && m.titles.name) || "";
            var p2 = (m.images && m.images.poster) || "";
            var s2 = (m.url && m.url.slug) || "";
            if (t2 && s2) videos.push(mkVideo("phd_top_" + s2, "Tendencia: " + t2, p2, phdSlugToUrl(s2), "PoseidonHD"));
        }
    } catch (e) {}
    return videos;
}

function phdSearch(query) {
    var videos = [];
    try {
        var html = httpGet(PHD + "/search?q=" + encodeURIComponent(query));
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return videos;
        var movies = nd.props.pageProps.movies || [];
        var i, m;
        for (i = 0; i < movies.length && i < 30; i++) {
            m = movies[i];
            var title = (m.titles && m.titles.name) || "";
            var poster = (m.images && m.images.poster) || "";
            var slug = (m.url && m.url.slug) || "";
            if (title && slug) videos.push(mkVideo("phd_" + slug, title, poster, phdSlugToUrl(slug), "PoseidonHD"));
        }
    } catch (e) {}
    return videos;
}

function phdMovieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return mkDetail("phd_m_" + url, "Sin resultado", "", url, [], "No se encontro informacion");
        var movie = nd.props.pageProps.thisMovie;
        if (!movie) return mkDetail("phd_m_" + url, "Sin resultado", "", url, [], "No se encontro la pelicula");
        var title = (movie.titles && movie.titles.name) || "Sin titulo";
        var poster = (movie.images && movie.images.poster) || "";
        var backdrop = (movie.images && movie.images.backdrop) || poster;
        var overview = movie.overview || "";
        var runtime = movie.runtime || 0;
        var genres = [];
        if (movie.genres) { var gi; for (gi = 0; gi < movie.genres.length; gi++) genres.push(movie.genres[gi].name); }
        var year = movie.releaseDate ? String(new Date(movie.releaseDate).getFullYear()) : "";
        var desc = overview;
        if (genres.length > 0) desc += "\n\nGenero: " + genres.join(", ");
        if (year) desc += "\nAno: " + year;
        if (runtime) desc += "\nDuracion: " + runtime + " min";
        var videoSources = [];
        var vids = movie.videos || {};
        var langs = ["latino", "spanish", "english"];
        var li, si;
        for (li = 0; li < langs.length; li++) {
            var langSources = vids[langs[li]] || [];
            for (si = 0; si < langSources.length; si++) {
                var vs = langSources[si];
                if (vs && vs.result) {
                    var resolved = phdResolveCyberlocker(vs.result);
                    var ri;
                    for (ri = 0; ri < resolved.length; ri++) videoSources.push(resolved[ri]);
                }
            }
        }
        return mkDetail("phd_m_" + url, title, backdrop, url, videoSources, desc);
    } catch (e) {
        return mkDetail("phd_err", "Error", "", url, [], "Error: " + String(e));
    }
}

function phdSerieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return mkDetail("phd_s_" + url, "Sin resultado", "", url, [], "No se encontro informacion");
        var serie = nd.props.pageProps.thisSerie;
        if (!serie) return mkDetail("phd_s_" + url, "Sin resultado", "", url, [], "No se encontro la serie");
        var title = (serie.titles && serie.titles.name) || "Sin titulo";
        var poster = (serie.images && serie.images.poster) || "";
        var overview = serie.overview || "";
        var desc = overview;
        var seasons = serie.seasons || [];
        var si, season, episodes, ei, ep;
        for (si = 0; si < seasons.length; si++) {
            season = seasons[si];
            var seasonNum = season.number || (si + 1);
            episodes = season.episodes || [];
            if (episodes.length > 0) {
                desc += "\n\nTemporada " + seasonNum + ":";
                for (ei = 0; ei < episodes.length; ei++) {
                    ep = episodes[ei];
                    desc += "\n  " + (ep.number || (ei + 1)) + ". " + (ep.title || "Ep");
                }
            }
        }
        var videoSources = [];
        if (seasons.length > 0 && seasons[0].episodes && seasons[0].episodes.length > 0) {
            var firstEp = seasons[0].episodes[0];
            var epSlug = (firstEp.url && firstEp.url.slug) || "";
            if (epSlug) {
                var epHtml = httpGet(phdSlugToUrl(epSlug));
                var epNd = extractNextData(epHtml);
                if (epNd && epNd.props && epNd.props.pageProps) {
                    var epVids = epNd.props.pageProps.videos || {};
                    var langs2 = ["latino", "spanish", "english"];
                    for (var li2 = 0; li2 < langs2.length; li2++) {
                        var ls2 = epVids[langs2[li2]] || [];
                        for (var si3 = 0; si3 < ls2.length; si3++) {
                            var vs2 = ls2[si3];
                            if (vs2 && vs2.result) {
                                var resolved2 = phdResolveCyberlocker(vs2.result);
                                for (var ri2 = 0; ri2 < resolved2.length; ri2++) videoSources.push(resolved2[ri2]);
                            }
                        }
                    }
                }
            }
        }
        return mkDetail("phd_s_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("phd_ser_err", "Error", "", url, [], "Error: " + String(e));
    }
}

// ===================== pelispop.mov =====================
var POP = "https://pelispop.mov";

function popSearch(query) {
    var videos = [];
    try {
        var html = httpGet(POP + "/search?s=" + encodeURIComponent(query));
        if (!html) return videos;
        var re = /<a[^>]*href="(https:\/\/pelispop\.mov\/(?:pelicula|serie|anime)\/[^"]+)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
        var m;
        while ((m = re.exec(html)) && videos.length < 30) {
            var title = stripTags(m[3]);
            var prefix = m[1].indexOf("/anime/") !== -1 ? "[Anime] " : (m[1].indexOf("/serie/") !== -1 ? "[Serie] " : "");
            if (title) videos.push(mkVideo("pop_" + m[1], prefix + title, m[2], m[1], "PelisPop"));
        }
    } catch (e) {}
    return videos;
}

function popDetails(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("pop_" + url, "Sin resultado", "", url, [], "No se pudo cargar");
        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").trim(); }
        var poster = ""; tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i); if (tm) poster = tm[1];
        var desc = ""; tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i); if (tm) desc = htmlDecode(tm[1]);
        var videoSources = [];
        var vidurl = html.match(/src=["']([^"']*\/vidurl\/[^"']+)["']/i);
        if (vidurl) {
            var playerUrl = fullUrl(url, vidurl[1]);
            var playerHtml = httpGet(playerUrl, {"Referer": POP + "/"});
            if (playerHtml) {
                var contentUrl = playerHtml.match(/"contentUrl"\s*:\s*"([^"]+)"/);
                if (contentUrl) videoSources.push(mkVidSrc(fullUrl(playerUrl, contentUrl[1]), "Embed69"));
            }
        }
        return mkDetail("pop_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("pop_err", "Error", "", url, [], "Error: " + String(e));
    }
}

// ===================== pelisplusnuevo.com =====================
var PPN = "https://pelisplusnuevo.com";

function ppnSearch(query) {
    var videos = [];
    try {
        var html = httpGet(PPN + "/?s=" + encodeURIComponent(query));
        if (!html) return videos;
        var re = /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*class="Title"[^>]*>([\s\S]*?)<\/h2>/gi;
        var m;
        while ((m = re.exec(html)) && videos.length < 30) {
            var title = stripTags(m[2]);
            var link = m[1];
            if (!link || link === "/" || link === "#") continue;
            link = fullUrl(PPN, link);
            if (title && link.indexOf("pelisplusnuevo.com/") !== -1) {
                videos.push(mkVideo("ppn_" + link, title, "", link, "PelisPlusNuevo"));
            }
        }
    } catch (e) {}
    return videos;
}

function ppnDetails(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("ppn_" + url, "Sin resultado", "", url, [], "No se pudo cargar");
        var title = ""; var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").trim(); }
        var poster = ""; tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i); if (tm) poster = tm[1];
        var desc = ""; tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i); if (tm) desc = htmlDecode(tm[1]);
        return mkDetail("ppn_" + url, title, poster, url, [], desc);
    } catch (e) {
        return mkDetail("ppn_err", "Error", "", url, [], "Error: " + String(e));
    }
}

// ===================== pelisflix1.fans =====================
var PF = "https://pelisflix1.fans";

function pfSearch(query) {
    var videos = [];
    try {
        var html = httpGet(PF + "/?s=" + encodeURIComponent(query));
        if (!html) return videos;
        var re = /<article[^>]*>[\s\S]*?href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
        var m;
        while ((m = re.exec(html)) && videos.length < 30) {
            var title = stripTags(m[3]);
            if (title) videos.push(mkVideo("pf_" + m[1], title, m[2], m[1], "PelisFlix"));
        }
    } catch (e) {}
    return videos;
}

function pfDetails(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("pf_" + url, "Sin resultado", "", url, [], "No se pudo cargar");
        var title = ""; var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").trim(); }
        var poster = ""; tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i); if (tm) poster = tm[1];
        var desc = ""; tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i); if (tm) desc = htmlDecode(tm[1]);
        var videoSources = [];
        var iframeRe = /<iframe[^>]*src=["']([^"']+)["']/gi;
        var im;
        while ((im = iframeRe.exec(html)) && videoSources.length < 10) {
            videoSources.push(mkVidSrc(fullUrl(url, im[1]), "Servidor " + (videoSources.length + 1)));
        }
        return mkDetail("pf_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("pf_err", "Error", "", url, [], "Error: " + String(e));
    }
}

// ===================== Unified =====================
function doSearch(query) {
    var results = [];
    var i;
    try { var r = phdSearch(query); for (i = 0; i < r.length; i++) results.push(r[i]); } catch (e) {}
    try { var r = popSearch(query); for (i = 0; i < r.length; i++) results.push(r[i]); } catch (e) {}
    try { var r = ppnSearch(query); for (i = 0; i < r.length; i++) results.push(r[i]); } catch (e) {}
    try { var r = pfSearch(query); for (i = 0; i < r.length; i++) results.push(r[i]); } catch (e) {}
    return results;
}

function doDetails(url) {
    if (!url) return mkDetail("", "Sin url", "", url, [], "");
    var host = getHost(url);
    if (host.indexOf("poseidonhd2.co") !== -1) {
        if (url.indexOf("/pelicula/") !== -1 || url.indexOf("/movies/") !== -1) return phdMovieDetails(url);
        if (url.indexOf("/serie/") !== -1 || url.indexOf("/series/") !== -1) return phdSerieDetails(url);
        return phdMovieDetails(url);
    }
    if (host.indexOf("pelispop.mov") !== -1) return popDetails(url);
    if (host.indexOf("pelisplusnuevo.com") !== -1) return ppnDetails(url);
    if (host.indexOf("pelisflix1.fans") !== -1) return pfDetails(url);
    return mkDetail("", "Fuente no soportada", "", url, [], "Esta URL no es compatible");
}

function doHome() {
    var videos = [];
    try { var r = phdHome(); for (var i = 0; i < r.length; i++) videos.push(r[i]); } catch (e) {}
    return videos;
}

// ===================== GrayJay Bindings =====================
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() {
        return { types: [2], sorts: [], filters: [] };
    };
    source.search = function(query, type, order, filters) {
        try {
            var items = doSearch(query || "");
            return new VideoPager(items, false, null);
        } catch (e) {
            return new VideoPager([], false, null);
        }
    };
    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        var host = getHost(url);
        return host.indexOf("poseidonhd2.co") !== -1 || host.indexOf("pelispop.mov") !== -1 ||
               host.indexOf("pelisplusnuevo.com") !== -1 || host.indexOf("pelisflix1.fans") !== -1;
    };
    source.getContentDetails = function(url) {
        try {
            var result = doDetails(url);
            if (result) return result;
            return mkDetail("", "Sin resultado", "", url, [], "No se pudo cargar");
        } catch (e) {
            return mkDetail("", "Error", "", url, [], "Error: " + String(e));
        }
    };
    source.isVideoDetailsUrl = function(url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function(url) { return source.getContentDetails(url); };
    source.getHome = function() {
        try {
            var items = doHome();
            return new VideoPager(items, false, null);
        } catch (e) {
            return new VideoPager([], false, null);
        }
    };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
