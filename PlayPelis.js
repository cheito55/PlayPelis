// PlayPelis GrayJay Source v14
// poseidonhd2.co + JkAnime + SoloLatino.net
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = new Date().getTime();

function initPlatformID() {
    if (!PPID) PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
}

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

function slugToTitle(slug) {
    return String(slug || "").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function extractNextData(html) {
    if (!html) return null;
    var m = html.match(/__NEXT_DATA__[^>]*type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
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
    if (!url) return null;
    var container = isHls ? "application/x-mpegURL" : "video/mp4";
    try {
        if (isHls && typeof HLSSource !== "undefined") return new HLSSource({url: url, name: name, duration: 0});
        if (typeof VideoUrlSource !== "undefined") return new VideoUrlSource({width:1920,height:1080,container:container,codec:"avc1.640028",name:name,bitrate:4000000,duration:0,url:url});
    } catch (e) {}
    return null;
}

function mkVideoDescriptor(videoSources) {
    var valid = [];
    var i;
    for (i = 0; i < videoSources.length; i++) {
        if (videoSources[i]) valid.push(videoSources[i]);
    }
    try {
        if (typeof VideoSourceDescriptor !== "undefined") return new VideoSourceDescriptor(valid);
    } catch (e) {}
    return {plugin_type: "MuxVideoSourceDescriptor", isUnMuxed: false, videoSources: valid};
}

function mkDetail(id, name, thumb, url, videoSources, description) {
    initPlatformID();
    var desc = description || "";
    var sources = videoSources || [];
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "Sin titulo",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false,
            video: mkVideoDescriptor(sources),
            description: desc
        });
    } catch (e) {
        try {
            return new PlatformVideo({
                id: new PlatformID("PlayPelis", String(id), PID),
                name: name || "Sin titulo",
                thumbnails: mkThumb(thumb),
                author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
                uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false
            });
        } catch (e2) {
            return null;
        }
    }
}
// ===================== poseidonhd2.co =====================
var PHD = "https://www.poseidonhd2.co";

function phdHome() {
    var videos = [];
    try {
        var html = httpGet(PHD + "/");
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return videos;
        var pp = nd.props.pageProps;

        var latest = pp.tabLastReleasedMovies || pp.tabLastMovies || [];
        var i, m, title, poster, slug, pUrl, year, rating, genre, extra;
        for (i = 0; i < latest.length && i < 15; i++) {
            m = latest[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            pUrl = PHD + "/pelicula/" + slug;
            year = m.releaseDate ? String(new Date(m.releaseDate).getFullYear()) : "";
            rating = (m.rate && m.rate.average) ? String(m.rate.average) : "";
            genre = (m.genres && m.genres.length > 0) ? m.genres[0].name : "";
            extra = "";
            if (genre) extra = extra + genre;
            if (year) extra = extra + (extra ? " | " : "") + year;
            if (rating) extra = extra + (extra ? " | " : "") + rating + "/10";
            videos.push(mkVideo("phd_" + slug, title + (extra ? " [" + extra + "]" : ""), poster, pUrl, "PoseidonHD"));
        }

        var topWeek = pp.topMoviesWeek || [];
        for (i = 0; i < topWeek.length && i < 5; i++) {
            m = topWeek[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            pUrl = PHD + "/pelicula/" + slug;
            videos.push(mkVideo("phd_top_" + slug, "Tendencia: " + title, poster, pUrl, "PoseidonHD"));
        }

        var episodes = pp.episodes || [];
        for (i = 0; i < episodes.length && i < 5; i++) {
            var ep = episodes[i];
            title = ep.title || "Episodio";
            var image = ep.image || "";
            slug = (ep.url && ep.url.slug) || "";
            pUrl = PHD + "/" + slug;
            videos.push(mkVideo("phd_ep_" + slug, title, image, pUrl, "PoseidonHD"));
        }

        var series = pp.series || [];
        for (i = 0; i < series.length && i < 5; i++) {
            var s = series[i];
            title = (s.titles && s.titles.name) || "Sin titulo";
            poster = (s.images && s.images.poster) || "";
            slug = (s.url && s.url.slug) || "";
            pUrl = PHD + "/serie/" + slug;
            videos.push(mkVideo("phd_ser_" + slug, title, poster, pUrl, "PoseidonHD"));
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
        var i, m, title, poster, slug, isMovie, prefix, detailUrl;
        for (i = 0; i < movies.length && i < 30; i++) {
            m = movies[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            isMovie = slug.indexOf("movies/") === 0;
            prefix = isMovie ? "Pelicula" : "Serie";
            detailUrl = PHD + "/" + slug;
            videos.push(mkVideo("phd_" + slug, "[" + prefix + "] " + title, poster, detailUrl, "PoseidonHD"));
        }
    } catch (e) {}
    return videos;
}

function phdMovieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return null;
        var movie = nd.props.pageProps.thisMovie;
        if (!movie) return null;

        var title = (movie.titles && movie.titles.name) || "Sin titulo";
        var poster = (movie.images && movie.images.poster) || "";
        var backdrop = (movie.images && movie.images.backdrop) || poster;
        var overview = movie.overview || "";
        var runtime = movie.runtime || 0;
        var genres = [];
        var gi;
        if (movie.genres) { for (gi = 0; gi < movie.genres.length; gi++) genres.push(movie.genres[gi].name); }
        var year = movie.releaseDate ? String(new Date(movie.releaseDate).getFullYear()) : "";

        var desc = overview;
        if (genres.length > 0) desc += "\n\nGenero: " + genres.join(", ");
        if (year) desc += "\nAno: " + year;
        if (runtime) desc += "\nDuracion: " + runtime + " min";

        var videoSources = [];
        var videos = movie.videos || {};
        var langs = ["latino", "spanish", "english"];
        var li, si, langSources, vs, cyberlocker, resultUrl, quality, langLabel;
        for (li = 0; li < langs.length; li++) {
            langSources = videos[langs[li]] || [];
            for (si = 0; si < langSources.length; si++) {
                vs = langSources[si];
                cyberlocker = vs.cyberlocker || "Server";
                resultUrl = vs.result || "";
                quality = vs.quality || "SD";
                langLabel = langs[li].charAt(0).toUpperCase() + langs[li].slice(1);
                if (resultUrl) {
                    videoSources.push(mkVideoSource(resultUrl, cyberlocker + " [" + langLabel + "] " + quality, false));
                }
            }
        }

        return mkDetail("phd_movie_" + url, title, backdrop, url, videoSources, desc);
    } catch (e) { return null; }
}

function phdSerieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return null;
        var serie = nd.props.pageProps.thisSerie;
        if (!serie) return null;

        var title = (serie.titles && serie.titles.name) || "Sin titulo";
        var poster = (serie.images && serie.images.poster) || "";
        var overview = serie.overview || "";
        var genres = [];
        var gi;
        if (serie.genres) { for (gi = 0; gi < serie.genres.length; gi++) genres.push(serie.genres[gi].name); }

        var desc = overview;
        if (genres.length > 0) desc += "\n\nGenero: " + genres.join(", ");

        var seasons = serie.seasons || [];
        var epLinks = [];
        var si, season, seasonNum, episodes, ei, ep, epTitle, epSlug, epUrl;
        for (si = 0; si < seasons.length; si++) {
            season = seasons[si];
            seasonNum = season.number || (si + 1);
            episodes = season.episodes || [];
            if (episodes.length > 0) {
                desc += "\n\nTemporada " + seasonNum + ":";
                for (ei = 0; ei < episodes.length; ei++) {
                    ep = episodes[ei];
                    epTitle = ep.title || ("Ep " + (ep.number || (ei + 1)));
                    epSlug = (ep.url && ep.url.slug) || "";
                    epUrl = PHD + "/" + epSlug;
                    desc += "\n  " + (ep.number || (ei + 1)) + ". " + epTitle;
                    epLinks.push({title: epTitle, url: epUrl, image: ep.image || poster});
                }
            }
        }

        var videoSources = [];
        if (epLinks.length > 0) {
            var firstEpHtml = httpGet(epLinks[0].url);
            var firstEpNd = extractNextData(firstEpHtml);
            if (firstEpNd && firstEpNd.props && firstEpNd.props.pageProps) {
                var epData = firstEpNd.props.pageProps;
                var epVideos = epData.videos || {};
                var langs = ["latino", "spanish", "english"];
                var li, langSources, vs;
                for (li = 0; li < langs.length; li++) {
                    langSources = epVideos[langs[li]] || [];
                    for (var si2 = 0; si2 < langSources.length; si2++) {
                        vs = langSources[si2];
                        if (vs && vs.result) {
                            videoSources.push(mkVideoSource(vs.result, vs.cyberlocker + " [" + langs[li] + "] " + (vs.quality || ""), false));
                        }
                    }
                }
            }
        }

        return mkDetail("phd_serie_" + url, title, poster, url, videoSources, desc);
    } catch (e) { return null; }
}
// ===================== JkAnime =====================
var JK = "https://jkanime.net";

function jkaGetDescription(url) {
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return "";
        var m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (m) return htmlDecode(m[1]);
        m = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (m) return htmlDecode(m[1]);
        return "";
    } catch (e) { return ""; }
}

function jkaGetSourcesFromPage(url) {
    var sources = [];
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return sources;
        var re = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/g;
        var m;
        while ((m = re.exec(html)) && sources.length < 10) {
            var src = mkVideoSource(m[1], "HLS", true);
            if (src) sources.push(src);
        }
        var b64re = /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g;
        while ((m = b64re.exec(html)) && sources.length < 15) {
            try {
                var decoded = atob(m[1]);
                if (decoded && (decoded.indexOf("http") === 0 || decoded.indexOf("//") === 0)) {
                    var full = decoded.indexOf("//") === 0 ? "https:" + decoded : decoded;
                    var isHls = full.indexOf(".m3u8") !== -1;
                    var src2 = mkVideoSource(full, isHls ? "HLS" : "Server", isHls);
                    if (src2) sources.push(src2);
                }
            } catch (e2) {}
        }
    } catch (e) {}
    return sources;
}

function jkaDetails(url) {
    try {
        var desc = jkaGetDescription(url);
        var sources = jkaGetSourcesFromPage(url);
        var title = "";
        var thumb = "";
        var html = httpGet(url, {"Referer": JK + "/"});
        if (html) {
            var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (tm) title = stripTags(tm[1]);
            if (!title) { tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i); if (tm) title = htmlDecode(tm[1]); }
            var im = html.match(/<img[^>]*src=["']([^"']+animes\/(?:image|video)\/[^"']+)["']/);
            if (im) thumb = fullUrl(url, im[1]);
        }
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i, "").replace(/JkAnime/i, "").trim();

        var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/);
        var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/);

        if (seriesMatch && !episodeMatch) {
            var episodes = [];
            if (html) {
                var re = /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;
                var m;
                var slug = seriesMatch[1];
                while ((m = re.exec(html)) && episodes.length < 200) {
                    if (m[1] === slug) {
                        episodes.push({ number: parseInt(m[2]), url: JK + "/" + m[1] + "/" + m[2] + "/" });
                    }
                }
                episodes.sort(function(a, b) { return a.number - b.number; });
            }

            if (episodes.length > 0) {
                var firstDetail = jkaDetails(episodes[0].url);
                if (firstDetail) {
                    var epList = "\n\n--- Episodios (" + episodes.length + ") ---";
                    var ei;
                    for (ei = 0; ei < episodes.length; ei++) {
                        epList += "\n" + episodes[ei].number + ". " + JK + "/" + seriesMatch[1] + "/" + episodes[ei].number + "/";
                    }
                    firstDetail.description = (firstDetail.description || "") + epList;
                    return firstDetail;
                }
            }
            return mkDetail("jk_" + url, slugToTitle(seriesMatch[1]), "", url, [], desc || "Serie");
        }

        return mkDetail("jk_" + url, title || slugToTitle(episodeMatch ? episodeMatch[1] : "Anime"), thumb, url, sources, desc);
    } catch (e) { return null; }
}
// ===================== SoloLatino.net =====================
var SL = "https://sololatino.net";

function slSuggest(query) {
    var videos = [];
    try {
        var resp = httpGet(SL + "/api/search/suggest?q=" + encodeURIComponent(query), {
            "User-Agent": UA,
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": SL + "/"
        });
        if (!resp) return videos;
        var arr = JSON.parse(resp);
        var i, item, typeLabel, detailUrl;
        for (i = 0; i < arr.length && i < 20; i++) {
            item = arr[i];
            if (item.type === "person") continue;
            typeLabel = item.type === "movie" ? "Pelicula" : "Serie";
            detailUrl = item.url || "";
            if (detailUrl) {
                videos.push(mkVideo("sl_" + detailUrl, "[" + typeLabel + "] " + item.title + " (" + (item.year || "") + ")", item.poster || "", detailUrl, "SoloLatino"));
            }
        }
    } catch (e) {}
    return videos;
}

function slDetails(url) {
    try {
        var html = httpGet(url, {"Referer": SL + "/"});
        if (!html) return null;

        var title = "";
        var tm = html.match(/<title>([^<]+)<\/title>/i);
        if (tm) title = htmlDecode(tm[1]).replace(" — SoloLatino.Net", "").replace(" | SoloLatino.Net", "").trim();

        var poster = "";
        tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (tm) poster = tm[1];

        var desc = "";
        tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var videoSources = [];
        var tokens = [];
        var tokenRe = /data-player-token="([^"]+)"/g;
        var m;
        while ((m = tokenRe.exec(html)) && tokens.length < 5) {
            tokens.push(m[1]);
        }

        var i;
        for (i = 0; i < tokens.length; i++) {
            videoSources.push(mkVideoSource(url, "Servidor " + (i + 1), false));
        }

        return mkDetail("sl_" + url, title, poster, url, videoSources, desc);
    } catch (e) { return null; }
}

// ===================== Búsqueda unificada =====================
function doSearch(query) {
    var results = [];
    var i;

    // SoloLatino
    try {
        var slResults = slSuggest(query);
        for (i = 0; i < slResults.length; i++) results.push(slResults[i]);
    } catch (e) {}

    // poseidonhd2.co
    try {
        var phdResults = phdSearch(query);
        for (i = 0; i < phdResults.length; i++) results.push(phdResults[i]);
    } catch (e) {}

    // JkAnime
    try {
        var jkSearch = httpGet(JK + "/?s=" + encodeURIComponent(query), {"Referer": JK + "/"});
        if (jkSearch) {
            var re = /<a[^>]*href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            var m;
            while ((m = re.exec(jkSearch)) && results.length < 40) {
                var jkTitle = stripTags(m[3]);
                var jkThumb = m[2];
                var jkLink = m[1];
                results.push(mkVideo("jk_" + jkLink, "[Anime] " + jkTitle, jkThumb, jkLink, "JkAnime"));
            }
        }
    } catch (e) {}

    return results;
}

// ===================== Detalles unificados =====================
function doDetails(url) {
    if (!url) return null;
    var host = getHost(url);

    if (host.indexOf("poseidonhd2.co") !== -1) {
        if (url.indexOf("/pelicula/") !== -1 || url.indexOf("/movies/") !== -1) return phdMovieDetails(url);
        if (url.indexOf("/serie/") !== -1 || url.indexOf("/series/") !== -1) {
            if (url.indexOf("/temporada/") !== -1 || url.indexOf("/seasons/") !== -1 || url.indexOf("/episodes/") !== -1) return phdMovieDetails(url);
            return phdSerieDetails(url);
        }
        return phdMovieDetails(url);
    }

    if (host.indexOf("jkanime.net") !== -1) {
        return jkaDetails(url);
    }

    if (host.indexOf("sololatino.net") !== -1) {
        return slDetails(url);
    }

    return null;
}

// ===================== Home =====================
function doHome() {
    var videos = [];
    var i;

    // poseidonhd2.co movies
    try {
        var phdVideos = phdHome();
        for (i = 0; i < phdVideos.length; i++) videos.push(phdVideos[i]);
    } catch (e) {}

    // JkAnime featured
    try {
        var jkHtml = httpGet(JK + "/", {"Referer": JK + "/"});
        if (jkHtml) {
            var re = /<a[^>]*href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            var m;
            while ((m = re.exec(jkHtml)) && videos.length < 60) {
                var title = stripTags(m[3]);
                var thumb = m[2];
                var link = m[1];
                videos.push(mkVideo("jk_home_" + link, "[Anime] " + title, thumb, link, "JkAnime"));
            }
        }
    } catch (e) {}

    return videos;
}

// ===================== Bindings GrayJay =====================
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() {
        try { return {types:[2], sorts:[], filters:[]}; }
        catch(e) { return {types:[2], sorts:[], filters:[]}; }
    };
    source.search = function(query, type, order, filters) {
        try {
            var items = doSearch(query || "");
            if (items && items.length > 0) {
                return new VideoPager(items, false, null);
            }
            return new VideoPager([], false, null);
        } catch (e) {
            return new VideoPager([], false, null);
        }
    };
    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        var host = getHost(url);
        return host.indexOf("poseidonhd2.co") !== -1 || host.indexOf("jkanime.net") !== -1 || host.indexOf("sololatino.net") !== -1;
    };
    source.getContentDetails = function(url) {
        try {
            var result = doDetails(url);
            if (result) return result;
            return mkDetail("", "Sin resultado", "", url, [], "No se pudo cargar el contenido");
        } catch (e) {
            return mkDetail("", "Error", "", url, [], "Error al cargar: " + String(e));
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
