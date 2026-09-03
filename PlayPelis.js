// PlayPelis GrayJay Source v31
// JkAnime (m3u8 directo) + PlayerPro (catalogo/posters/metadatos)
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

var PPID = null;
var _settings = {};

var IPTV_URL = "https://plpro.org";
var IPTV_USER = "p";
var IPTV_PASS = "p";
var JK = "https://jkanime.net";
var TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// =========================================================
// PLATFORM ID
// =========================================================
function initPlatformID() {
    if (!PPID)
        PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
}

// =========================================================
// HTTP GET
// =========================================================
function httpGet(url, headers) {
    try {
        var h = headers || {};
        if (!h["User-Agent"] && !h["user-agent"])
            h["User-Agent"] = UA;
        var r = http.GET(url, h);
        return (r && r.body) ? r.body : "";
    } catch (e) {
        return "";
    }
}

// =========================================================
// HELPERS
// =========================================================
function getHost(url) {
    try {
        var m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
        return m ? m[1].toLowerCase() : "";
    } catch (e) { return ""; }
}

function slugify(s) {
    return String(s || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function slugToTitle(s) {
    return String(s || "").replace(/-/g, " ")
        .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function b64decode(s) {
    try {
        return decodeURIComponent(
            atob(s).split("").map(function(c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            }).join("")
        );
    } catch (e) {
        try { return atob(s); } catch (e2) { return ""; }
    }
}

function htmlDecode(s) {
    if (!s) return "";
    return String(s)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, function(m, d) { return String.fromCharCode(parseInt(d, 10)); })
        .replace(/&#x([0-9a-fA-F]+);/g, function(m, x) { return String.fromCharCode(parseInt(x, 16)); });
}

function stripTags(s) {
    if (!s) return "";
    return htmlDecode(
        String(s)
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
    ).trim();
}

function fixImg(u) {
    if (!u) return "";
    var s = String(u).trim();
    if (s.indexOf("ttps://") === 0) s = "https" + s.substring(4);
    if (s.indexOf("http") === 0) return s;
    if (s.indexOf("/") === -1 && s.indexOf(".") !== -1) {
        if (s.indexOf(".jpg") === -1 && s.indexOf(".png") === -1 && s.indexOf(".webp") === -1)
            s += ".jpg";
        return TMDB_IMG + "/" + s;
    }
    return "";
}

// =========================================================
// GRAYJAY MODELS
// =========================================================
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
        uploadDate: 0,
        url: url,
        duration: -1,
        viewCount: -1,
        isLive: false
    });
}

function mkHls(url, name, duration) {
    if (!url) return null;
    return new HLSSource({ name: name || "HLS", url: url, duration: duration || 0 });
}

function mkSrc(valid) {
    var v = [];
    for (var i = 0; i < valid.length; i++) {
        if (valid[i]) v.push(valid[i]);
    }
    try {
        return new VideoSourceDescriptor(v);
    } catch (e) {}
    return v;
}

function mkDetail(id, name, thumb, url, videoSources, description) {
    initPlatformID();
    var valid = [];
    var src = videoSources || [];
    for (var i = 0; i < src.length; i++) {
        if (src[i]) valid.push(src[i]);
    }
    try {
        return new PlatformVideoDetails({
            id: new PlatformID("PlayPelis", String(id), PID),
            name: name || "Sin titulo",
            thumbnails: mkThumb(thumb),
            author: new PlatformAuthorLink(PPID, "PlayPelis", "https://playpelis.app"),
            uploadDate: 0,
            url: url,
            duration: -1,
            viewCount: -1,
            isLive: false,
            video: mkSrc(valid),
            description: description || ""
        });
    } catch (e) {
        return null;
    }
}

// =========================================================
// EXTRACTOR DE VIDEO (intenta encontrar m3u8 en pagina)
// =========================================================
function tryExtractM3u8(pageUrl) {
    var html = httpGet(pageUrl, { "User-Agent": UA, "Referer": pageUrl });
    if (!html) return null;
    var host = getHost(pageUrl);

    // Voe patterns
    if (host.indexOf("voe") !== -1) {
        var m = html.match(/hls\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
        if (m && m[1]) return m[1];
        m = html.match(/['"](https?:\/\/[^'"]+\/hls\/[^'"]+\.m3u8[^'"]*)['"]/);
        if (m && m[1]) return m[1];
        m = html.match(/atob\('([^']+)'\)/);
        if (m) {
            try {
                var d = b64decode(m[1]);
                var u = d.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i);
                if (u) return u[0];
            } catch (e) {}
        }
    }

    // Generic patterns
    var pats = [
        /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/,
        /sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/,
        /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i,
        /https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/i
    ];
    for (var i = 0; i < pats.length; i++) {
        var m2 = html.match(pats[i]);
        if (m2) return m2[1] || m2[0];
    }

    // atob decode
    var m3 = html.match(/atob\('([^']+)'\)/);
    if (m3) {
        try {
            var d2 = b64decode(m3[1]);
            var u2 = d2.match(/https?:\/\/[^"'\s<>]+\.(m3u8|mp4)[^"'\s<>]*/i);
            if (u2) return u2[0];
        } catch (e) {}
    }

    return null;
}

// =========================================================
// PLAYERPRO
// =========================================================
function ppGet(path) {
    try {
        var sep = path.indexOf("?") !== -1 ? "&" : "?";
        var url = IPTV_URL + path + sep +
            "username=" + encodeURIComponent(IPTV_USER) +
            "&password=" + encodeURIComponent(IPTV_PASS);
        var response = http.GET(url, { "User-Agent": "PLPro/8" });
        if (!response || !response.body) return null;
        return JSON.parse(response.body);
    } catch (e) {
        return null;
    }
}

function ppHome() {
    var videos = [];
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) return videos;
        for (var i = 0; i < data.movies.length && i < 40; i++) {
            var m = data.movies[i];
            var thumb = fixImg(m.d) || fixImg(m.c) || "";
            if (m.b) {
                videos.push(mkVideo(
                    "pp_m_" + m.a,
                    (m.l ? "[" + m.l + "] " : "") + m.b + (m.f ? " (" + m.f + ")" : ""),
                    thumb,
                    "pp://movie/" + m.a,
                    "PlayPelis"
                ));
            }
        }
    } catch (e) {}
    return videos;
}

function ppSearch(query) {
    var videos = [];
    var q = String(query || "").toLowerCase();
    try {
        var data = ppGet("/movies/resume");
        if (!data || !data.movies) return videos;
        for (var i = 0; i < data.movies.length && videos.length < 30; i++) {
            var m = data.movies[i];
            var name = String(m.b || "").toLowerCase();
            var alt = String(m.i || "").toLowerCase();
            if (name.indexOf(q) !== -1 || alt.indexOf(q) !== -1) {
                videos.push(mkVideo(
                    "pp_m_" + m.a,
                    (m.l ? "[" + m.l + "] " : "") + m.b + (m.f ? " (" + m.f + ")" : ""),
                    fixImg(m.d) || fixImg(m.c) || "",
                    "pp://movie/" + m.a,
                    "PlayPelis"
                ));
            }
        }
        // Buscar tambien en series
        var sdata = ppGet("/series");
        if (sdata && sdata.series) {
            for (var j = 0; j < sdata.series.length && videos.length < 60; j++) {
                var s = sdata.series[j];
                var sname = String(s.b || "").toLowerCase();
                var salt = String(s.i || "").toLowerCase();
                if (sname.indexOf(q) !== -1 || salt.indexOf(q) !== -1) {
                    videos.push(mkVideo(
                        "pp_s_" + s.a,
                        "[Serie] " + s.b,
                        fixImg(s.d) || fixImg(s.c) || "",
                        "pp://serie/" + s.a,
                        "PlayPelis"
                    ));
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
        var thumb = fixImg(data.d) || fixImg(data.c) || "";
        var overview = data.e || "";
        var linksData = ppGet("/movies/" + id + "/links");
        var desc = overview;
        var sources = [];

        if (linksData && linksData.length) {
            desc += "\n\n--- Servidores ---";
            for (var i = 0; i < linksData.length; i++) {
                var link = linksData[i];
                var linkUrl = link.a || "";
                desc += "\n" + (link.b || "srv") + " [" + (link.c || "") + "] → " + linkUrl;

                // Intentar extraer video del cyberlocker
                var extracted = tryExtractM3u8(linkUrl);
                if (extracted) {
                    var src = mkHls(extracted, (link.b || "") + " " + (link.c || ""));
                    if (src) sources.push(src);
                }
            }
        }

        return mkDetail("pp_m_" + id, title, thumb, "pp://movie/" + id, sources, desc);
    } catch (e) {
        return mkDetail("pp_m_" + id, "Error", "", "pp://movie/" + id, [], String(e));
    }
}

function ppSerieDetails(id) {
    try {
        var data = ppGet("/series/" + id);
        if (!data) return mkDetail("pp_s_" + id, "Sin resultado", "", "pp://serie/" + id, [], "");

        var title = data.name || "";
        var thumb = TMDB_IMG + "/" + (data.backdrop || "").replace(/^\//, "");
        if (!data.backdrop) thumb = TMDB_IMG + "/" + (data.poster || "").replace(/^\//, "");
        var overview = data.overview || "";
        var seasons = data.seasonList || [];
        var desc = overview + "\n\n--- Temporadas y Episodios ---";

        // Listar todos los episodios de todas las temporadas
        var firstEpisodeSrc = null;
        for (var si = 0; si < seasons.length; si++) {
            var season = seasons[si];
            desc += "\n\nTemporada " + season.num + " (" + (season.episodes ? season.episodes.length : 0) + " episodios)";
            var episodes = season.episodes || [];
            for (var ei = 0; ei < episodes.length; ei++) {
                var ep = episodes[ei];
                desc += "\n  Ep " + ep.episode + ": " + (ep.name || "");
                desc += " → pp://serie/" + id + "/" + season.num + "/" + ep.episode;
            }
            // Intentar obtener links del primer episodio como preview
            if (!firstEpisodeSrc && episodes.length > 0) {
                var linksData = ppGet("/series/" + id + "/links/" + season.num + "/1");
                if (linksData && linksData.length) {
                    for (var li = 0; li < linksData.length; li++) {
                        var extracted = tryExtractM3u8(linksData[li].a);
                        if (extracted) {
                            firstEpisodeSrc = mkHls(extracted, "Ep 1 " + (linksData[li].b || ""));
                            break;
                        }
                    }
                }
            }
        }

        var sources = firstEpisodeSrc ? [firstEpisodeSrc] : [];
        return mkDetail("pp_s_" + id, title, thumb, "pp://serie/" + id, sources, desc);
    } catch (e) {
        return mkDetail("pp_s_" + id, "Error", "", "pp://serie/" + id, [], String(e));
    }
}

function ppEpisodeLinks(id, season, episode) {
    try {
        var data = ppGet("/series/" + id);
        if (!data) return mkDetail("pp_se_" + id + "_" + season + "_" + episode, "Sin resultado", "", "", [], "");

        var title = (data.name || "") + " S" + season + "E" + episode;
        var thumb = TMDB_IMG + "/" + (data.poster || "").replace(/^\//, "");

        var linksData = ppGet("/series/" + id + "/links/" + season + "/" + episode);
        var desc = title + "\n\n--- Servidores ---";
        var sources = [];

        if (linksData && linksData.length) {
            for (var i = 0; i < linksData.length; i++) {
                var link = linksData[i];
                var linkUrl = link.a || "";
                desc += "\n" + (link.b || "srv") + " [" + (link.c || "") + "] → " + linkUrl;

                var extracted = tryExtractM3u8(linkUrl);
                if (extracted) {
                    var src = mkHls(extracted, (link.b || "") + " " + (link.c || ""));
                    if (src) sources.push(src);
                }
            }
        }

        // Botones para anterior/siguiente episodio
        var epNum = parseInt(episode, 10);
        if (epNum > 1) {
            desc += "\n\n← Ep Anterior: pp://serie/" + id + "/" + season + "/" + (epNum - 1);
        }
        desc += "\n→ Ep Siguiente: pp://serie/" + id + "/" + season + "/" + (epNum + 1);

        return mkDetail("pp_se_" + id + "_" + season + "_" + episode, title, thumb, "pp://serie/" + id + "/" + season + "/" + episode, sources, desc);
    } catch (e) {
        return mkDetail("pp_err", "Error", "", "", [], String(e));
    }
}

// =========================================================
// JKANIME SEARCH
// =========================================================
function jkaSearch(query) {
    var out = [];
    try {
        var slug = slugify(query);
        if (!slug) return out;

        // Usar endpoint de busqueda
        var html = httpGet(JK + "/buscar/" + slug + "/", { "Referer": JK + "/" });
        if (!html) return out;

        // Extraer resultados del grid
        var re = /<div class="anime__item">\s*<a\s+href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/)"[^>]*>[\s\S]*?<div[^>]*data-setbg="([^"]*)"[\s\S]*?<h5><a[^>]*>([^<]+)<\/a><\/h5>/gi;
        var m;
        while ((m = re.exec(html)) && out.length < 30) {
            out.push({
                title: htmlDecode(m[3]),
                url: m[1],
                thumb: m[2]
            });
        }

        // Si no se encontraron con el regex anterior, buscar enlaces simples
        if (out.length === 0) {
            var re2 = /href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/)"/gi;
            var seen = {};
            while ((m = re2.exec(html)) && out.length < 30) {
                if (!seen[m[1]] && m[1].indexOf("/buscar/") === -1) {
                    seen[m[1]] = true;
                    out.push({
                        title: slugToTitle(m[1].match(/jkanime\.net\/([a-z0-9-]+)\/?$/)[1]),
                        url: m[1],
                        thumb: ""
                    });
                }
            }
        }

        // Tambien buscar directamente por slug (si existe el anime)
        var directUrl = JK + "/" + slug + "/";
        var directHtml = httpGet(directUrl, { "Referer": JK + "/" });
        if (directHtml && directHtml.indexOf("404") === -1 && directHtml.indexOf("no encontrada") === -1) {
            var hasAnime = directHtml.indexOf("anime__") !== -1 || directHtml.indexOf("player_conte") !== -1;
            if (hasAnime || directHtml.indexOf("<title>") !== -1) {
                var exists = false;
                for (var i = 0; i < out.length; i++) {
                    if (out[i].url === directUrl) { exists = true; break; }
                }
                if (!exists) {
                    var im = directHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
                    out.unshift({
                        title: slugToTitle(slug),
                        url: directUrl,
                        thumb: im ? im[1] : ""
                    });
                }
            }
        }
    } catch (e) {}
    return out;
}

// =========================================================
// JKANIME DETAILS + VIDEO EXTRACTION
// =========================================================
function jkaDetails(url) {
    try {
        var html = httpGet(url, { "Referer": JK + "/" });
        if (!html) return mkDetail("jk_" + url, "Sin resultado", "", url, [], "No se pudo cargar");

        var title = "";
        var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (tm) title = stripTags(tm[1]);
        if (!title) {
            tm = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
            if (tm) title = htmlDecode(tm[1]);
        }
        title = (title || "").replace(/\s*-\s*anime.*JkAnime/i, "").replace(/JkAnime/i, "").trim();

        var thumb = "";
        var im = html.match(/<img[^>]*src=["']([^"']*animes\/(?:image|video)\/[^"']+)["']/i);
        if (im) {
            thumb = im[1].indexOf("http") === 0 ? im[1] : JK + "/" + im[1].replace(/^\/+/, "");
        }
        if (!thumb) {
            im = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
            if (im) thumb = im[1];
        }

        var desc = "";
        tm = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (tm) desc = htmlDecode(tm[1]);

        var episodeMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/i);
        var seriesMatch = url.match(/jkanime\.net\/([a-z0-9-]+)\/?$/i);

        // ES SERIE - listar episodios
        if (seriesMatch && !episodeMatch) {
            var episodes = [];
            var re = /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;
            var slug = seriesMatch[1];
            var m;
            while ((m = re.exec(html)) && episodes.length < 200) {
                if (m[1] === slug) {
                    episodes.push({
                        number: parseInt(m[2], 10),
                        url: JK + "/" + m[1] + "/" + m[2] + "/"
                    });
                }
            }
            episodes.sort(function(a, b) { return a.number - b.number; });

            desc += "\n\n--- Episodios (" + episodes.length + ") ---";
            for (var ei = 0; ei < episodes.length; ei++) {
                desc += "\nEp " + episodes[ei].number + " → " + episodes[ei].url;
            }

            // Intentar extraer video del primer episodio
            var sources = [];
            if (episodes.length > 0) {
                var firstSrc = jkaExtractVideo(episodes[0].url);
                if (firstSrc) sources.push(firstSrc);
                // Actualizar thumb con el del primer episodio si no tenemos
                if (!thumb && episodes[0].url) {
                    var firstHtml = httpGet(episodes[0].url, { "Referer": JK + "/" });
                    if (firstHtml) {
                        var fi = firstHtml.match(/<img[^>]*src=["']([^"']*animes\/(?:image|video)\/[^"']+)["']/i);
                        if (fi) thumb = fi[1].indexOf("http") === 0 ? fi[1] : JK + "/" + fi[1].replace(/^\/+/, "");
                    }
                }
            }

            return mkDetail("jk_" + url, title || slugToTitle(slug), thumb, url, sources, desc);
        }

        // ES EPISODIO - extraer video directamente
        var episodeSources = jkaExtractVideo(url);
        return mkDetail("jk_" + url, title || slugToTitle(episodeMatch ? episodeMatch[1] : "Anime"), thumb, url, episodeSources, desc);
    } catch (e) {
        return mkDetail("jk_err", "Error", "", "", [], String(e));
    }
}

// =========================================================
// JKANIME VIDEO EXTRACTION (iframe → jkplayer → m3u8)
// =========================================================
function jkaExtractVideo(episodeUrl) {
    try {
        var html = httpGet(episodeUrl, { "Referer": JK + "/" });
        if (!html) return null;

        // Buscar iframe del servidor um (el que da m3u8 directo)
        var re = /video\[\d+\]\s*=\s*'[^']*src="(https?:\/\/jkanime\.net\/jkplayer\/um[^"]*)"/i;
        var m = html.match(re);

        if (!m || !m[1]) {
            // Intentar patron mas flexible
            re = /src="(https?:\/\/jkanime\.net\/jkplayer\/um\?[^"]+)"/i;
            m = html.match(re);
        }

        if (!m || !m[1]) return null;

        var playerUrl = m[1].replace(/&amp;/g, "&");

        // Cargar la pagina del jkplayer
        var playerHtml = httpGet(playerUrl, { "Referer": episodeUrl });
        if (!playerHtml) return null;

        // Buscar la URL del m3u8
        var m3u8 = playerHtml.match(/url\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
        if (m3u8 && m3u8[1]) {
            return mkHls(m3u8[1], "JkAnime");
        }

        return null;
    } catch (e) {
        return null;
    }
}

// =========================================================
// UNIFIED
// =========================================================
function doSearch(query) {
    var results = [];
    try {
        var r = ppSearch(query);
        for (var i = 0; i < r.length; i++) results.push(r[i]);
    } catch (e) {}
    try {
        var jka = jkaSearch(query);
        for (var j = 0; j < jka.length; j++) {
            results.push(mkVideo(
                "jk_" + jka[j].url,
                "[Anime] " + jka[j].title,
                jka[j].thumb,
                jka[j].url,
                "JkAnime"
            ));
        }
    } catch (e) {}
    return results;
}

function doDetails(url) {
    if (!url) return mkDetail("", "", "", "", [], "");
    if (url.indexOf("jkanime.net") !== -1) return jkaDetails(url);
    if (url.indexOf("pp://movie/") === 0) {
        var mm = url.match(/pp:\/\/movie\/(\d+)/);
        if (mm) return ppMovieDetails(mm[1]);
    }
    if (url.indexOf("pp://serie/") === 0) {
        var se = url.match(/pp:\/\/serie\/(\d+)\/(\d+)\/(\d+)/);
        if (se) return ppEpisodeLinks(se[1], se[2], se[3]);
        var ss = url.match(/pp:\/\/serie\/(\d+)/);
        if (ss) return ppSerieDetails(ss[1]);
    }
    return mkDetail("", "", "", url, [], "");
}

function doHome() {
    var videos = [];
    try {
        var r = ppHome();
        for (var i = 0; i < r.length; i++) videos.push(r[i]);
    } catch (e) {}
    try {
        var jkHtml = httpGet(JK + "/", { "Referer": JK + "/" });
        if (jkHtml) {
            var re = /data-setbg="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            var m;
            while ((m = re.exec(jkHtml)) && videos.length < 60) {
                var linkRe = /href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"/i;
                var anchor = jkHtml.substring(Math.max(0, jkHtml.indexOf(m[0]) - 500), jkHtml.indexOf(m[0]) + m[0].length);
                var lm = anchor.match(linkRe);
                var linkUrl = lm ? lm[1] : JK + "/";
                videos.push(mkVideo(
                    "jk_home_" + linkUrl,
                    "[Anime] " + stripTags(m[2]),
                    m[1],
                    linkUrl,
                    "JkAnime"
                ));
            }
        }
    } catch (e) {}
    return videos;
}

// =========================================================
// GRAYJAY BINDINGS
// =========================================================
if (typeof source !== "undefined") {
    source.setSettings = function(s) { _settings = s || {}; };
    source.enable = function(c, s) { _settings = s || {}; };
    source.getSearchCapabilities = function() { return { types: [2], sorts: [], filters: [] }; };

    source.search = function(query, type, order, filters) {
        try {
            return new VideoPager(doSearch(query || ""), false, null);
        } catch (e) {
            return new VideoPager([], false, null);
        }
    };

    source.isContentDetailsUrl = function(url) {
        if (!url) return false;
        return url.indexOf("jkanime.net") !== -1 || url.indexOf("pp://") !== -1;
    };

    source.getContentDetails = function(url) {
        try {
            var r = doDetails(url);
            return r || mkDetail("", "", "", url, [], "No se pudo cargar");
        } catch (e) {
            return mkDetail("", "", "", url, [], "Error: " + String(e));
        }
    };

    source.isVideoDetailsUrl = function(url) { return source.isContentDetailsUrl(url); };
    source.getVideoDetails = function(url) { return source.getContentDetails(url); };

    source.getHome = function() {
        try {
            return new VideoPager(doHome(), false, null);
        } catch (e) {
            return new VideoPager([], false, null);
        }
    };

    source.isChannelUrl = function(url) { return false; };
    source.searchSuggestions = function(query) { return []; };
}
