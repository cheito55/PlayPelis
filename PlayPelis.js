// PlayPelis GrayJay Source v17
// poseidonhd2.co + pelispop.mov + cuevana3l.biz + pelisplusnuevo.com + pelisflix1.fans
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
var PPID = null;
var _settings = {};
var _now = Math.floor(Date.now() / 1000);

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

function phdHome() {
    var videos = [];
    try {
        var html = httpGet(PHD + "/");
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) return videos;
        var pp = nd.props.pageProps;
        var latest = pp.tabLastReleasedMovies || pp.tabLastMovies || [];
        var i, m, title, poster, slug, pUrl;
        for (i = 0; i < latest.length && i < 15; i++) {
            m = latest[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            pUrl = phdSlugToUrl(slug);
            videos.push(mkVideo("phd_" + slug, title, poster, pUrl, "PoseidonHD"));
        }
        var topWeek = pp.topMoviesWeek || [];
        for (i = 0; i < topWeek.length && i < 5; i++) {
            m = topWeek[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            pUrl = phdSlugToUrl(slug);
            videos.push(mkVideo("phd_top_" + slug, "Tendencia: " + title, poster, pUrl, "PoseidonHD"));
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
        var i, m, title, poster, slug, detailUrl;
        for (i = 0; i < movies.length && i < 30; i++) {
            m = movies[i];
            title = (m.titles && m.titles.name) || "Sin titulo";
            poster = (m.images && m.images.poster) || "";
            slug = (m.url && m.url.slug) || "";
            detailUrl = phdSlugToUrl(slug);
            videos.push(mkVideo("phd_" + slug, title, poster, detailUrl, "PoseidonHD"));
        }
    } catch (e) {}
    return videos;
}

function phdMovieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) {
            return mkDetail("phd_m_" + url, "Sin resultado", "", url, [], "No se encontro informacion");
        }
        var movie = nd.props.pageProps.thisMovie;
        if (!movie) {
            return mkDetail("phd_m_" + url, "Sin resultado", "", url, [], "No se encontro la pelicula");
        }
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
        var li, si, langSources, vs;
        for (li = 0; li < langs.length; li++) {
            langSources = vids[langs[li]] || [];
            for (si = 0; si < langSources.length; si++) {
                vs = langSources[si];
                if (vs && vs.result) {
                    var lbl = vs.cyberlocker || "Server";
                    var ql = vs.quality || "SD";
                    var la = langs[li].charAt(0).toUpperCase() + langs[li].slice(1);
                    videoSources.push(mkVideoSource(vs.result, lbl + " [" + la + "] " + ql, false));
                }
            }
        }
        return mkDetail("phd_m_" + url, title, backdrop, url, videoSources, desc);
    } catch (e) {
        return mkDetail("phd_err", "Error", "", url, [], "Error al cargar pelicula");
    }
}

function phdSerieDetails(url) {
    try {
        var html = httpGet(url);
        var nd = extractNextData(html);
        if (!nd || !nd.props || !nd.props.pageProps) {
            return mkDetail("phd_s_" + url, "Sin resultado", "", url, [], "No se encontro informacion");
        }
        var serie = nd.props.pageProps.thisSerie;
        if (!serie) {
            return mkDetail("phd_s_" + url, "Sin resultado", "", url, [], "No se encontro la serie");
        }
        var title = (serie.titles && serie.titles.name) || "Sin titulo";
        var poster = (serie.images && serie.images.poster) || "";
        var overview = serie.overview || "";
        var genres = [];
        if (serie.genres) { var gi; for (gi = 0; gi < serie.genres.length; gi++) genres.push(serie.genres[gi].name); }
        var desc = overview;
        if (genres.length > 0) desc += "\n\nGenero: " + genres.join(", ");
        var seasons = serie.seasons || [];
        var si, season, seasonNum, episodes, ei, ep;
        for (si = 0; si < seasons.length; si++) {
            season = seasons[si];
            seasonNum = season.number || (si + 1);
            episodes = season.episodes || [];
            if (episodes.length > 0) {
                desc += "\n\nTemporada " + seasonNum + ":";
                for (ei = 0; ei < episodes.length; ei++) {
                    ep = episodes[ei];
                    var epTitle = ep.title || ("Ep " + (ep.number || (ei + 1)));
                    desc += "\n  " + (ep.number || (ei + 1)) + ". " + epTitle;
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
                    var li2, ls2, vs2;
                    for (li2 = 0; li2 < langs2.length; li2++) {
                        ls2 = epVids[langs2[li2]] || [];
                        for (var si3 = 0; si3 < ls2.length; si3++) {
                            vs2 = ls2[si3];
                            if (vs2 && vs2.result) {
                                videoSources.push(mkVideoSource(vs2.result, (vs2.cyberlocker || "Server") + " [" + langs2[li2] + "]", false));
                            }
                        }
                    }
                }
            }
        }
        return mkDetail("phd_s_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("phd_ser_err", "Error", "", url, [], "Error al cargar serie");
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
            var thumb = m[2];
            var link = m[1];
            var prefix = link.indexOf("/anime/") !== -1 ? "[Anime] " : (link.indexOf("/serie/") !== -1 ? "[Serie] " : "[Pelicula] ");
            videos.push(mkVideo("pop_" + link, prefix + title, thumb, link, "PelisPop"));
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

        var poster = "";
        tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (tm) poster = tm[1];

        var desc = "";
        tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var videoSources = [];

        // pelispop uses /vidurl/tt{tmdb_id}/ which loads EMBED69 player
        var vidurl = html.match(/src=["']([^"']*\/vidurl\/[^"']+)["']/i);
        if (vidurl) {
            var playerUrl = fullUrl(url, vidurl[1]);
            var playerHtml = httpGet(playerUrl, {"Referer": POP + "/"});
            if (playerHtml) {
                // EMBED69 stores servers in JS config
                var serverRe = /servers\s*[:=]\s*\[([\s\S]*?)\]/;
                var serverMatch = serverRe.exec(playerHtml);
                if (serverMatch) {
                    var serverEntries = serverMatch[1];
                    var entryRe = /\{[^}]*name\s*[:=]\s*["']([^"']+)["'][^}]*url\s*[:=]\s*["']([^"']+)["'][^}]*\}/g;
                    var sm;
                    while ((sm = entryRe.exec(serverEntries)) && videoSources.length < 10) {
                        videoSources.push(mkVideoSource(sm[2], sm[1], false));
                    }
                }
                // Fallback: find any video URL
                if (videoSources.length === 0) {
                    var urlRe = /["'](https?:\/\/[^"']*(?:\.m3u8|\.mp4|embed|player|stream)[^"']*)["']/g;
                    var um;
                    while ((um = urlRe.exec(playerHtml)) && videoSources.length < 5) {
                        var isHls = um[1].indexOf(".m3u8") !== -1;
                        videoSources.push(mkVideoSource(um[1], "Server", isHls));
                    }
                }
            }
        }

        return mkDetail("pop_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("pop_err", "Error", "", url, [], "Error al cargar");
    }
}

// ===================== cuevana3l.biz =====================
var C3 = "https://cuevana3l.biz";

function c3Search(query) {
    var videos = [];
    try {
        var html = httpGet(C3 + "/explorar?buscar=" + encodeURIComponent(query));
        if (!html) return videos;
        // Find movie/show cards
        var re = /<a[^>]*href="(https?:\/\/cuevana3l\.biz\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?(?:<h[23][^>]*>([\s\S]*?)<\/h[23]>|alt="([^"]*)")/gi;
        var m;
        while ((m = re.exec(html)) && videos.length < 30) {
            var title = stripTags(m[3] || m[4] || "");
            if (!title) continue;
            var thumb = m[2];
            var link = m[1];
            videos.push(mkVideo("c3_" + link, title, thumb, link, "Cuevana3"));
        }
        // Fallback: find articles with titles
        if (videos.length === 0) {
            var re2 = /<article[^>]*>[\s\S]*?href="([^"]+)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>[\s\S]*?<img[^>]*src="([^"]*)"/gi;
            while ((m = re2.exec(html)) && videos.length < 30) {
                var t2 = stripTags(m[2]);
                if (t2) videos.push(mkVideo("c3_" + m[1], t2, m[3], m[1], "Cuevana3"));
            }
        }
    } catch (e) {}
    return videos;
}

function c3Details(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("c3_" + url, "Sin resultado", "", url, [], "No se pudo cargar");

        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").replace(/\|.*$/, "").trim(); }

        var poster = "";
        tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (tm) poster = tm[1];

        var desc = "";
        tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var videoSources = [];
        // Find iframes/embeds
        var iframeRe = /<iframe[^>]*src=["']([^"']+)["']/gi;
        var im;
        while ((im = iframeRe.exec(html)) && videoSources.length < 10) {
            var embedUrl = fullUrl(url, im[1]);
            videoSources.push(mkVideoSource(embedUrl, "Servidor " + (videoSources.length + 1), false));
        }

        return mkDetail("c3_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("c3_err", "Error", "", url, [], "Error al cargar");
    }
}

// ===================== pelisplusnuevo.com =====================
var PPN = "https://pelisplusnuevo.com";

function ppnSearch(query) {
    var videos = [];
    try {
        var html = httpGet(PPN + "/?s=" + encodeURIComponent(query));
        if (!html) return videos;
        // Find article/post links with images
        var re = /<article[^>]*>[\s\S]*?href="([^"]+)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
        var m;
        while ((m = re.exec(html)) && videos.length < 30) {
            var title = stripTags(m[3]);
            if (title) videos.push(mkVideo("ppn_" + m[1], title, m[2], m[1], "PelisPlusNuevo"));
        }
        // Fallback: find links with titles
        if (videos.length === 0) {
            var re2 = /<a[^>]*href="(https?:\/\/pelisplusnuevo\.com\/[^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/gi;
            while ((m = re2.exec(html)) && videos.length < 30) {
                if (m[2]) videos.push(mkVideo("ppn_" + m[1], m[2], m[3], m[1], "PelisPlusNuevo"));
            }
        }
        // Another fallback: just titles
        if (videos.length === 0) {
            var re3 = /<h2[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            while ((m = re3.exec(html)) && videos.length < 30) {
                var t = stripTags(m[2]);
                if (t) videos.push(mkVideo("ppn_" + m[1], t, "", m[1], "PelisPlusNuevo"));
            }
        }
    } catch (e) {}
    return videos;
}

function ppnDetails(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("ppn_" + url, "Sin resultado", "", url, [], "No se pudo cargar");

        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").replace(/\|.*$/, "").trim(); }

        var poster = "";
        tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (tm) poster = tm[1];

        var desc = "";
        tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var videoSources = [];
        // Find iframes
        var iframeRe = /<iframe[^>]*src=["']([^"']+)["']/gi;
        var im;
        while ((im = iframeRe.exec(html)) && videoSources.length < 10) {
            var embedUrl = fullUrl(url, im[1]);
            videoSources.push(mkVideoSource(embedUrl, "Servidor " + (videoSources.length + 1), false));
        }
        // Find data-src iframes
        if (videoSources.length === 0) {
            var dsRe = /data-src=["']([^"']+)["']/gi;
            while ((im = dsRe.exec(html)) && videoSources.length < 10) {
                videoSources.push(mkVideoSource(fullUrl(url, im[1]), "Servidor " + (videoSources.length + 1), false));
            }
        }

        return mkDetail("ppn_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("ppn_err", "Error", "", url, [], "Error al cargar");
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
        if (videos.length === 0) {
            var re2 = /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?alt="([^"]*)"/gi;
            while ((m = re2.exec(html)) && videos.length < 30) {
                if (m[3] && m[3].length > 2) videos.push(mkVideo("pf_" + m[1], m[3], m[2], m[1], "PelisFlix"));
            }
        }
    } catch (e) {}
    return videos;
}

function pfDetails(url) {
    try {
        var html = httpGet(url);
        if (!html) return mkDetail("pf_" + url, "Sin resultado", "", url, [], "No se pudo cargar");

        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) { tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) title = htmlDecode(tm[1]).replace(/ - .*/, "").replace(/\|.*$/, "").trim(); }

        var poster = "";
        tm = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (tm) poster = tm[1];

        var desc = "";
        tm = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var videoSources = [];
        var iframeRe = /<iframe[^>]*src=["']([^"']+)["']/gi;
        var im;
        while ((im = iframeRe.exec(html)) && videoSources.length < 10) {
            videoSources.push(mkVideoSource(fullUrl(url, im[1]), "Servidor " + (videoSources.length + 1), false));
        }

        return mkDetail("pf_" + url, title, poster, url, videoSources, desc);
    } catch (e) {
        return mkDetail("pf_err", "Error", "", url, [], "Error al cargar");
    }
}

// ===================== Busqueda unificada =====================
function doSearch(query) {
    var results = [];
    var i;

    try {
        var popResults = popSearch(query);
        for (i = 0; i < popResults.length; i++) results.push(popResults[i]);
    } catch (e) {}

    try {
        var phdResults = phdSearch(query);
        for (i = 0; i < phdResults.length; i++) results.push(phdResults[i]);
    } catch (e) {}

    try {
        var c3Results = c3Search(query);
        for (i = 0; i < c3Results.length; i++) results.push(c3Results[i]);
    } catch (e) {}

    try {
        var ppnResults = ppnSearch(query);
        for (i = 0; i < ppnResults.length; i++) results.push(ppnResults[i]);
    } catch (e) {}

    try {
        var pfResults = pfSearch(query);
        for (i = 0; i < pfResults.length; i++) results.push(pfResults[i]);
    } catch (e) {}

    return results;
}

// ===================== Detalles unificados =====================
function doDetails(url) {
    if (!url) return mkDetail("", "Sin url", "", url, [], "");
    var host = getHost(url);

    if (host.indexOf("poseidonhd2.co") !== -1) {
        if (url.indexOf("/pelicula/") !== -1 || url.indexOf("/movies/") !== -1) return phdMovieDetails(url);
        if (url.indexOf("/serie/") !== -1 || url.indexOf("/series/") !== -1) return phdSerieDetails(url);
        return phdMovieDetails(url);
    }

    if (host.indexOf("pelispop.mov") !== -1) return popDetails(url);
    if (host.indexOf("cuevana3l.biz") !== -1) return c3Details(url);
    if (host.indexOf("pelisplusnuevo.com") !== -1) return ppnDetails(url);
    if (host.indexOf("pelisflix1.fans") !== -1) return pfDetails(url);

    return mkDetail("", "Fuente no soportada", "", url, [], "Esta URL no es compatible");
}

// ===================== Home =====================
function doHome() {
    var videos = [];
    var i;
    try {
        var phdVideos = phdHome();
        for (i = 0; i < phdVideos.length; i++) videos.push(phdVideos[i]);
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
        return host.indexOf("poseidonhd2.co") !== -1 || host.indexOf("pelispop.mov") !== -1 ||
               host.indexOf("cuevana3l.biz") !== -1 || host.indexOf("pelisplusnuevo.com") !== -1 ||
               host.indexOf("pelisflix1.fans") !== -1;
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
