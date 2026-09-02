// PlayPelis GrayJay Source v13
// poseidonhd2.co (peliculas/series) + JkAnime (anime)
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = new Date().getTime();

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

function mkDetail(id, name, thumb, url, videoSources, description, contentType) {
    initPlatformID();
    var ct = contentType || 1;
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "Sin titulo",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false,
            video: mkVideoDescriptor(videoSources),
            description: description || ""
        });
    } catch(e) {}
    return {
        plugin_type: "PlatformVideoDetails",
        id: {plugin_type:"PlatformID",value:String(id),name:"PlayPelis",uuid:PID},
        name: name || "Sin titulo",
        thumbnails: thumb ? {plugin_type:"Thumbnails",thumbnails:[{url:thumb,width:100}]} : {plugin_type:"Thumbnails",thumbnails:[]},
        author: {plugin_type:"PlatformAuthorLink",name:"PlayPelis",url:"https://playpelis.app",uuid:PID,thumbnail:{plugin_type:"Thumbnails",thumbnails:[]}},
        uploadDate: _now, url: url, duration: 0, viewCount: 0, isLive: false,
        video: {plugin_type:"MuxVideoSourceDescriptor",isUnMuxed:false,videoSources:videoSources},
        description: description || "",
        contentType: ct
    };
}

// ===================== poseidonhd2.co =====================
var PHD = "https://www.poseidonhd2.co";
var PHD_PLAYER = "https://player.poseidonhd2.co";

function phdHome() {
    var videos = [];
    try {
        var html = httpGet(PHD + "/");
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return videos;
        var pp = nd.props.pageProps;

        var latest = pp.tabLastReleasedMovies || pp.tabLastMovies || [];
        for (var i = 0; i < latest.length && i < 15; i++) {
            var m = latest[i];
            var title = (m.titles && m.titles.name) || "Sin titulo";
            var poster = (m.images && m.images.poster) || "";
            var slug = (m.url && m.url.slug) || "";
            var pUrl = PHD + "/pelicula/" + slug;
            var year = m.releaseDate ? new Date(m.releaseDate).getFullYear() : "";
            var rating = (m.rate && m.rate.average) ? " (" + m.rate.average + "/10)" : "";
            var genre = (m.genres && m.genres[0]) ? m.genres[0].name : "";
            var extra = [genre, year ? year + "" : "", rating ? rating : ""].filter(Boolean).join(" | ");
            videos.push(mkVideo("phd_" + slug, title + (extra ? " [" + extra + "]" : ""), poster, pUrl, "PoseidonHD"));
        }

        var topWeek = pp.topMoviesWeek || [];
        for (var i = 0; i < topWeek.length && i < 5; i++) {
            var m = topWeek[i];
            var title = (m.titles && m.titles.name) || "Sin titulo";
            var poster = (m.images && m.images.poster) || "";
            var slug = (m.url && m.url.slug) || "";
            var pUrl = PHD + "/pelicula/" + slug;
            videos.push(mkVideo("phd_top_" + slug, "Tendencia: " + title, poster, pUrl, "PoseidonHD"));
        }

        var episodes = pp.episodes || [];
        for (var i = 0; i < episodes.length && i < 5; i++) {
            var ep = episodes[i];
            var title = ep.title || "Episodio";
            var image = ep.image || "";
            var slug = (ep.url && ep.url.slug) || "";
            var pUrl = PHD + "/" + slug;
            videos.push(mkVideo("phd_ep_" + slug, title, image, pUrl, "PoseidonHD"));
        }

        var series = pp.series || [];
        for (var i = 0; i < series.length && i < 5; i++) {
            var s = series[i];
            var title = (s.titles && s.titles.name) || "Sin titulo";
            var poster = (s.images && s.images.poster) || "";
            var slug = (s.url && s.url.slug) || "";
            var pUrl = PHD + "/serie/" + slug;
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
        for (var i = 0; i < movies.length && i < 30; i++) {
            var m = movies[i];
            var title = (m.titles && m.titles.name) || "Sin titulo";
            var poster = (m.images && m.images.poster) || "";
            var slug = (m.url && m.url.slug) || "";
            var isMovie = slug.indexOf("movies/") === 0;
            var prefix = isMovie ? "Pelicula" : "Serie";
            var detailUrl = PHD + "/" + slug;
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
        var genres = (movie.genres || []).map(function(g) { return g.name; }).join(", ");
        var year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "";

        var desc = overview;
        if (genres) desc += "\n\nGenero: " + genres;
        if (year) desc += "\nAno: " + year;
        if (runtime) desc += "\nDuracion: " + runtime + " min";

        var videoSources = [];
        var videos = movie.videos || {};
        var langs = ["latino", "spanish", "english"];
        for (var li = 0; li < langs.length; li++) {
            var langSources = videos[langs[li]] || [];
            for (var si = 0; si < langSources.length; si++) {
                var vs = langSources[si];
                var cyberlocker = vs.cyberlocker || "Server";
                var resultUrl = vs.result || "";
                var quality = vs.quality || "SD";
                var langLabel = langs[li].charAt(0).toUpperCase() + langs[li].slice(1);
                if (resultUrl) {
                    videoSources.push(mkVideoSource(resultUrl, cyberlocker + " [" + langLabel + "] " + quality, false));
                }
            }
        }

        return mkDetail("phd_movie_" + url, title, backdrop, url, videoSources, desc, 1);
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
        var genres = (serie.genres || []).map(function(g) { return g.name; }).join(", ");

        var desc = overview;
        if (genres) desc += "\n\nGenero: " + genres;

        var seasons = serie.seasons || [];
        var epLinks = [];
        for (var si = 0; si < seasons.length; si++) {
            var season = seasons[si];
            var seasonNum = season.number || (si + 1);
            var episodes = season.episodes || [];
            if (episodes.length > 0) {
                desc += "\n\nTemporada " + seasonNum + ":";
                for (var ei = 0; ei < episodes.length; ei++) {
                    var ep = episodes[ei];
                    var epTitle = ep.title || ("Ep " + (ep.number || (ei + 1)));
                    var epSlug = (ep.url && ep.url.slug) || "";
                    var epUrl = PHD + "/" + epSlug;
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
                var epVideos = epData.videos || (epData.thisEpisode && epData.thisEpisode.videos) || {};
                var langs = ["latino", "spanish", "english"];
                for (var li = 0; li < langs.length; li++) {
                    var langSources = epVideos[langs[li]] || [];
                    for (var si2 = 0; si2 < langSources.length; si2++) {
                        var vs = langSources[si2];
                        if (vs.result) {
                            videoSources.push(mkVideoSource(vs.result, vs.cyberlocker + " [" + langs[li] + "] " + (vs.quality || ""), false));
                        }
                    }
                }
            }
        }

        if (epLinks.length > 0) {
            desc += "\n\n--- Episodios disponibles ---";
            for (var i = 0; i < epLinks.length; i++) {
                desc += "\n" + (i + 1) + ". " + epLinks[i].title + " → " + epLinks[i].url;
            }
        }

        return mkDetail("phd_serie_" + url, title, poster, url, videoSources, desc, 1);
    } catch (e) { return null; }
}

function phdEpisodeDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return null;
        var epData = nd.props.pageProps;
        var episode = epData.thisEpisode || epData.episode;
        var serie = epData.thisData || epData.serie || epData.series;

        var title = "";
        if (episode) title = episode.title || "";
        if (!title && serie) title = (serie.titles && serie.titles.name) || "Episodio";

        var image = (episode && episode.image) || (serie && serie.images && serie.images.poster) || "";
        var overview = (serie && serie.overview) || "";

        var videoSources = [];
        var videos = epData.videos || (episode && episode.videos) || {};
        var langs = ["latino", "spanish", "english"];
        for (var li = 0; li < langs.length; li++) {
            var langSources = videos[langs[li]] || [];
            for (var si = 0; si < langSources.length; si++) {
                var vs = langSources[si];
                if (vs.result) {
                    videoSources.push(mkVideoSource(vs.result, vs.cyberlocker + " [" + langs[li] + "] " + (vs.quality || ""), false));
                }
            }
        }

        var desc = title;
        if (episode) {
            if (episode.number) desc += "\nEpisodio " + episode.number;
            if (episode.releaseDate) desc += "\nFecha: " + new Date(episode.releaseDate).toLocaleDateString();
        }
        desc += "\n\n" + overview;

        if (episode && episode.previousEpisode) {
            desc += "\n\n← Anterior: " + (episode.previousEpisode.title || "") + "\n  " + (PHD + "/" + (episode.previousEpisode.slug || ""));
        }
        if (episode && episode.nextEpisode) {
            desc += "\n\nSiguiente → " + (episode.nextEpisode.title || "") + "\n  " + (PHD + "/" + (episode.nextEpisode.slug || ""));
        }

        var slug = url.replace(PHD + "/", "");
        return mkDetail("phd_ep_" + slug, title, image, url, videoSources, desc, 1);
    } catch (e) { return null; }
}

// ===================== JkAnime =====================
var JK = "https://jkanime.net";

function jkaGetDescription(url) {
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return "";
        var m = html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (m) return stripTags(m[1]);
        m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (m) return htmlDecode(m[1]);
        m = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (m) return htmlDecode(m[1]);
        return "";
    } catch (e) { return ""; }
}

function jkaGetEpisodes(url) {
    var episodes = [];
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return episodes;
        var re = /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;
        var m;
        var baseSlug = url.match(/jkanime\.net\/([a-z0-9-]+)/);
        var slug = baseSlug ? baseSlug[1] : "";
        while ((m = re.exec(html)) && episodes.length < 200) {
            if (slug && m[1] === slug) {
                episodes.push({
                    number: parseInt(m[2]),
                    url: JK + "/" + m[1] + "/" + m[2] + "/"
                });
            }
        }
        episodes.sort(function(a, b) { return a.number - b.number; });
    } catch (e) {}
    return episodes;
}

function jkaGetSourcesFromPage(url) {
    var sources = [];
    try {
        var html = httpGet(url, {"Referer": JK + "/"});
        if (!html) return sources;
        var re = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/g;
        var m;
        while ((m = re.exec(html)) && sources.length < 10) {
            sources.push(mkVideoSource(m[1], "HLS", true));
        }
        var b64re = /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g;
        while ((m = b64re.exec(html)) && sources.length < 15) {
            try {
                var decoded = atob(m[1]);
                if (decoded && (decoded.indexOf("http") === 0 || decoded.indexOf("//") === 0)) {
                    var full = decoded.indexOf("//") === 0 ? "https:" + decoded : decoded;
                    var isHls = full.indexOf(".m3u8") !== -1;
                    sources.push(mkVideoSource(full, isHls ? "HLS" : "Server", isHls));
                }
            } catch (e2) {}
        }
        var urlRe = /url\s*[:=]\s*["'](https?:\/\/[^"']+)["']/g;
        while ((m = urlRe.exec(html)) && sources.length < 20) {
            if (m[1].indexOf(".m3u8") !== -1 || m[1].indexOf("mp4") !== -1 || m[1].indexOf("video") !== -1) {
                var isHls2 = m[1].indexOf(".m3u8") !== -1;
                sources.push(mkVideoSource(m[1], isHls2 ? "HLS" : "Server", isHls2));
            }
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
            var episodes = jkaGetEpisodes(url);
            if (episodes.length > 0) {
                var firstDetail = jkaDetails(episodes[0].url);
                if (firstDetail) {
                    var epList = "\n\n--- Episodios (" + episodes.length + ") ---";
                    for (var i = 0; i < episodes.length; i++) {
                        epList += "\n" + episodes[i].number + ". " + JK + "/" + seriesMatch[1] + "/" + episodes[i].number + "/";
                    }
                    firstDetail.description = (firstDetail.description || "") + epList;
                    return firstDetail;
                }
            }
            return mkDetail("jk_" + url, slugToTitle(seriesMatch[1]), "", url, [], desc || "Serie - no se pudieron cargar episodios", 1);
        }

        return mkDetail("jk_" + url, title || slugToTitle(episodeMatch ? episodeMatch[1] : "JkAnime"), thumb, url, sources, desc);
    } catch (e) { return null; }
}

// ===================== Búsqueda unificada =====================
function doSearch(query) {
    var results = [];
    try {
        var phdResults = phdSearch(query);
        for (var i = 0; i < phdResults.length; i++) results.push(phdResults[i]);
    } catch (e) {}
    try {
        var slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        var jkUrl = JK + "/" + slug;
        var jkHtml = httpGet(jkUrl, {"Referer": JK + "/"});
        if (jkHtml && jkHtml.indexOf("404") === -1 && jkHtml.indexOf("No se encontr") === -1) {
            results.push(mkVideo("jk_search_" + slug, "[Anime] " + slugToTitle(slug), "", jkUrl, "JkAnime"));
        }
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
    if (!url) return mkDetail("", "PlayPelis", "", url, [], "Sin URL");
    var host = getHost(url);

    if (host.indexOf("poseidonhd2.co") !== -1) {
        if (url.indexOf("/pelicula/") !== -1) return phdMovieDetails(url);
        if (url.indexOf("/serie/") !== -1) {
            if (url.indexOf("/temporada/") !== -1 || url.indexOf("/seasons/") !== -1) {
                return phdEpisodeDetails(url);
            }
            return phdSerieDetails(url);
        }
        if (url.indexOf("/movies/") !== -1) return phdMovieDetails(url);
        if (url.indexOf("/series/") !== -1) {
            if (url.indexOf("/episodes/") !== -1) return phdEpisodeDetails(url);
            return phdSerieDetails(url);
        }
        return phdMovieDetails(url);
    }

    if (host.indexOf("jkanime.net") !== -1) {
        return jkaDetails(url);
    }

    return mkDetail("", "PlayPelis", "", url, [], "Sitio no soportado: " + host);
}

// ===================== Home =====================
function doHome() {
    var videos = [];
    try {
        var phdVideos = phdHome();
        for (var i = 0; i < phdVideos.length; i++) videos.push(phdVideos[i]);
    } catch (e) {}
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
        var items = doSearch(query || "");
        try { if (typeof VideoPager !== "undefined") return new VideoPager(items, false, null); } catch(e) {}
        return items;
    };
    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        var host = getHost(url);
        return host.indexOf("poseidonhd2.co") !== -1 || host.indexOf("jkanime.net") !== -1;
    };
    source.getContentDetails = function(url) { return doDetails(url); };
    source.isVideoDetailsUrl = function(url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function(url) { return doDetails(url); };
    source.getHome = function() { return doHome(); };
    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
