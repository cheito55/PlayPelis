// PlayPelis GrayJay Source v3
// Multi-servidor + HLS + MP4 + portadas mejoradas + episodios
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

var PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
var _settings = {};
var _debugLog = "";

var IPTV_URL = "https://plpro.org";
var IPTV_USER = "p";
var IPTV_PASS = "p";
var JK = "https://jkanime.net";
var TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// =========================================================
// CONFIGURACIÓN
// =========================================================

var MAX_TRY = 20;

// =========================================================
// DEBUG
// =========================================================

function addDebug(msg) {
    _debugLog += String(msg) + "\n";
}

// =========================================================
// HTTP
// =========================================================

function httpGet(url, headers) {
    try {
        var h = headers || {};

        if (!h["User-Agent"] && !h["user-agent"]) {
            h["User-Agent"] = UA;
        }

        var r = http.GET(url, h);

        return (r && r.body) ? r.body : "";
    } catch (e) {
        addDebug("HTTP Exception: " + String(e));
        return "";
    }
}

// =========================================================
// UTILIDADES
// =========================================================

function getHost(url) {
    try {
        var m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
        return m ? m[1].toLowerCase() : "";
    } catch (e) {
        return "";
    }
}

function slugify(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function slugToTitle(s) {
    return String(s || "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, function(c) {
            return c.toUpperCase();
        });
}

function b64decode(s) {
    try {
        return decodeURIComponent(
            atob(s).split("").map(function(c) {
                return "%" +
                    ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            }).join("")
        );
    } catch (e) {
        try {
            return atob(s);
        } catch (e2) {
            return "";
        }
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
        .replace(/&#(\d+);/g, function(m, d) {
            return String.fromCharCode(parseInt(d, 10));
        })
        .replace(/&#x([0-9a-fA-F]+);/g, function(m, x) {
            return String.fromCharCode(parseInt(x, 16));
        });
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

    var s = htmlDecode(String(u).trim());

    if (s.indexOf("ttps://") === 0) {
        s = "https" + s.substring(4);
    }

    if (s.indexOf("//") === 0) {
        return "https:" + s;
    }

    if (s.indexOf("http") === 0) {
        return s;
    }

    if (s.indexOf("/") === 0) {
        return JK + s;
    }

    if (s.indexOf("/") === -1 && s.indexOf(".") !== -1) {
        if (
            s.indexOf(".jpg") === -1 &&
            s.indexOf(".jpeg") === -1 &&
            s.indexOf(".png") === -1 &&
            s.indexOf(".webp") === -1
        ) {
            s += ".jpg";
        }

        return TMDB_IMG + "/" + s;
    }

    return "";
}

// =========================================================
// PORTADAS
// =========================================================

function extractPoster(html, fallback) {
    if (!html) return fallback || "";

    var patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,

        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,

        /<img[^>]+data-src=["']([^"']+)["']/i,
        /<img[^>]+data-lazy-src=["']([^"']+)["']/i,
        /<img[^>]+data-original=["']([^"']+)["']/i,
        /<img[^>]+src=["']([^"']+)["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = html.match(patterns[i]);

        if (m && m[1]) {
            var u = htmlDecode(m[1].trim());

            if (u.indexOf("http") === 0) {
                return u;
            }

            if (u.indexOf("//") === 0) {
                return "https:" + u;
            }

            if (u.indexOf("/") === 0) {
                return JK + u;
            }
        }
    }

    return fallback || "";
}

// =========================================================
// VIDEO OBJECTS
// =========================================================

function mkThumb(url) {
    if (!url) {
        return new Thumbnails([]);
    }

    return new Thumbnails([
        new Thumbnail(url, 100)
    ]);
}

function mkVideo(id, title, thumb, url, authorName) {
    return new PlatformVideo({
        id: new PlatformID(
            "PlayPelis",
            String(id),
            PID
        ),

        name: title || "Sin titulo",

        thumbnails: mkThumb(thumb),

        author: new PlatformAuthorLink(
            PPID,
            authorName || "PlayPelis",
            "https://playpelis.app",
            "",
            0
        ),

        uploadDate: 0,
        url: url,
        duration: 0,
        viewCount: 0,
        isLive: false
    });
}

// =========================================================
// URL / HLS / MP4
// =========================================================

function isM3u8Url(url) {
    try {
        if (!url) return false;

        return /\.m3u8(?:[?#]|$)/i.test(
            String(url)
        );
    } catch (e) {
        return false;
    }
}

function isMp4Url(url) {
    try {
        if (!url) return false;

        return /\.mp4(?:[?#]|$)/i.test(
            String(url)
        );
    } catch (e) {
        return false;
    }
}

function isPlayableUrl(url) {
    return isM3u8Url(url) || isMp4Url(url);
}

function cleanUrl(url) {
    if (!url) return "";

    var s = htmlDecode(
        String(url).trim()
    );

    s = s.replace(/\\u0026/g, "&");
    s = s.replace(/\\\//g, "/");

    return s;
}

// =========================================================
// FUENTE UNIFICADA
// =========================================================

function mkSource(url, name, duration) {
    if (!url) return null;

    url = cleanUrl(url);

    if (!url) return null;

    // HLS
    if (isM3u8Url(url)) {
        addDebug(
            "[source] HLS: " + name
        );

        return new HLSSource({
            name: name || "HLS",
            url: url,
            duration: duration || 0
        });
    }

    // MP4 / vídeo directo
    if (isMp4Url(url)) {
        addDebug(
            "[source] MP4: " + name
        );

        return new VideoUrlSource({
            width: 0,
            height: 0,
            container: "mp4",
            codec: "",
            name: name || "MP4",
            bitrate: 0,
            duration: duration || 0,
            url: url
        });
    }

    // Otros vídeos directos
    addDebug(
        "[source] DIRECTO: " + name
    );

    return new VideoUrlSource({
        width: 0,
        height: 0,
        container: "",
        codec: "",
        name: name || "Video",
        bitrate: 0,
        duration: duration || 0,
        url: url
    });
}

// =========================================================
// Vidhide
// =========================================================

function vidhideExtract(pageUrl) {
    try {
        var fetchUrl = pageUrl;

        if (
            fetchUrl.indexOf("vidhidefast.com") !== -1
        ) {
            fetchUrl = fetchUrl.replace(
                "vidhidefast.com",
                "callistanise.com"
            );
        }

        if (
            fetchUrl.indexOf("vidhide.com") !== -1 &&
            fetchUrl.indexOf("callistanise") === -1
        ) {
            fetchUrl = fetchUrl.replace(
                "vidhide.com",
                "callistanise.com"
            );
        }

        var embedHost = getHost(fetchUrl);

        var refererBase =
            "https://" + embedHost + "/";

        addDebug(
            "[vidhide] fetch=" + fetchUrl
        );

        var html = httpGet(
            fetchUrl,
            {
                "User-Agent": UA,
                "Referer": refererBase
            }
        );

        addDebug(
            "[vidhide] htmlLen=" +
            (html ? html.length : 0)
        );

        if (!html || html.length < 500) {
            return null;
        }

        var splitIdx =
            html.lastIndexOf(".split('|')");

        if (splitIdx === -1) {
            return null;
        }

        var keyEnd =
            html.lastIndexOf("'", splitIdx);

        var keyStart =
            html.lastIndexOf(
                "'",
                keyEnd - 1
            ) + 1;

        var key =
            html.substring(
                keyStart,
                keyEnd
            );

        var keyArr =
            key.split("|");

        if (keyArr.length < 50) {
            return null;
        }

        function decode(str) {
            return str.replace(
                /[a-z0-9]+/g,
                function(token) {
                    var val =
                        parseInt(token, 36);

                    if (
                        !isNaN(val) &&
                        val > 0 &&
                        val < keyArr.length &&
                        keyArr[val] &&
                        keyArr[val].length > 1
                    ) {
                        return keyArr[val];
                    }

                    return token;
                }
            );
        }

        var urls =
            html.match(
                /["'][a-z0-9]+:\/\/[^"']+["']/gi
            ) || [];

        var best = null;

        for (
            var i = 0;
            i < urls.length;
            i++
        ) {
            var raw =
                urls[i].substring(
                    1,
                    urls[i].length - 1
                );

            var dec =
                cleanUrl(
                    decode(raw)
                );

            if (
                dec.indexOf("master.") !== -1 &&
                (
                    dec.indexOf(".m3u8") !== -1 ||
                    dec.indexOf(".txt") !== -1
                )
            ) {
                best = dec;
                break;
            }
        }

        if (!best) {
            return null;
        }

        if (isM3u8Url(best)) {
            return best;
        }

        if (/\.txt(?:[?#]|$)/i.test(best)) {
            var txt =
                httpGet(
                    best,
                    {
                        "User-Agent": UA,
                        "Referer": refererBase
                    }
                );

            if (txt) {
                var m3u =
                    txt.match(
                        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
                    );

                if (m3u && m3u[0]) {
                    return cleanUrl(
                        m3u[0]
                    );
                }
            }
        }

        return null;

    } catch (e) {
        addDebug(
            "[vidhide] EXCEPTION: " +
            String(e)
        );

        return null;
    }
}

// =========================================================
// VOE
// =========================================================

function voeExtract(pageUrl) {
    try {
        var html =
            httpGet(
                pageUrl,
                {
                    "User-Agent": UA,
                    "Referer": pageUrl
                }
            );

        if (!html) {
            return null;
        }

        var m =
            html.match(
                /hls\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (m && m[1]) {
            return cleanUrl(m[1]);
        }

        var am =
            html.match(
                /atob\(['"]([^'"]+)['"]\)/
            );

        if (am) {
            try {
                var d =
                    b64decode(am[1]);

                var u =
                    d.match(
                        /https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)[^"'\s<>]*/i
                    );

                if (u) {
                    return cleanUrl(u[0]);
                }
            } catch (e) {}
        }

        var fm =
            html.match(
                /file\s*:\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i
            );

        if (fm && fm[1]) {
            return cleanUrl(fm[1]);
        }

        return null;

    } catch (e) {
        addDebug(
            "[voe] EXCEPTION: " +
            String(e)
        );

        return null;
    }
}

// =========================================================
// DOOD / DO7GO
// =========================================================

function doodExtract(pageUrl) {
    try {
        var html =
            httpGet(
                pageUrl,
                {
                    "User-Agent": UA,
                    "Referer": pageUrl
                }
            );

        if (!html) {
            return null;
        }

        var m =
            html.match(
                /(?:file|link|source)\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i
            );

        if (m && m[1]) {
            return cleanUrl(m[1]);
        }

        // URL directa encontrada en el HTML
        m =
            html.match(
                /https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)(?:\?[^"'\s<>]*)?/i
            );

        if (m && m[0]) {
            return cleanUrl(m[0]);
        }

        return null;

    } catch (e) {
        addDebug(
            "[dood] EXCEPTION: " +
            String(e)
        );

        return null;
    }
}

// =========================================================
// GENERIC
// =========================================================

function genericExtract(pageUrl) {
    try {
        var html =
            httpGet(
                pageUrl,
                {
                    "User-Agent": UA,
                    "Referer": pageUrl
                }
            );

        if (!html) {
            return null;
        }

        var patterns = [
            /file\s*:\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i,
            /source\s*:\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i,
            /src\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i,
            /https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)(?:\?[^"'\s<>]*)?/i
        ];

        for (
            var i = 0;
            i < patterns.length;
            i++
        ) {
            var m =
                html.match(patterns[i]);

            if (m) {
                return cleanUrl(
                    m[1] || m[0]
                );
            }
        }

        return null;

    } catch (e) {
        addDebug(
            "[generic] EXCEPTION: " +
            String(e)
        );

        return null;
    }
}

// =========================================================
// EXTRACTOR UNIFICADO
// =========================================================

function extractVideo(pageUrl) {
    if (!pageUrl) {
        return null;
    }

    pageUrl =
        cleanUrl(pageUrl);

    if (isPlayableUrl(pageUrl)) {
        return pageUrl;
    }

    var host =
        getHost(pageUrl);

    if (
        host.indexOf("vidhide") !== -1 ||
        host.indexOf("callistanise") !== -1
    ) {
        return vidhideExtract(pageUrl);
    }

    if (
        host.indexOf("voe") !== -1
    ) {
        return voeExtract(pageUrl);
    }

    if (
        host.indexOf("dood") !== -1 ||
        host.indexOf("do7go") !== -1
    ) {
        return doodExtract(pageUrl);
    }

    return genericExtract(pageUrl);
}

// =========================================================
// DETAIL
// =========================================================

function mkDetail(
    id,
    name,
    thumb,
    url,
    videoSources,
    description
) {
    var valid = [];
    var src = videoSources || [];

    for (
        var i = 0;
        i < src.length;
        i++
    ) {
        if (src[i]) {
            valid.push(src[i]);
        }
    }

    var desc =
        description || "";

    if (valid.length === 0) {
        desc +=
            "\n\n⚠️ No se encontró una fuente reproducible.";
    } else {
        desc +=
            "\n\n✅ Fuentes disponibles: " +
            valid.length;
    }

    if (_debugLog.length > 0) {
        desc +=
            "\n\n=== REPORTE TÉCNICO ===\n" +
            _debugLog;
    }

    return new PlatformVideoDetails({
        id: new PlatformID(
            "PlayPelis",
            String(id),
            PID
        ),

        name: name || "Sin titulo",

        thumbnails: mkThumb(thumb),

        author: new PlatformAuthorLink(
            PPID,
            "PlayPelis",
            "https://playpelis.app",
            "",
            0
        ),

        uploadDate: 0,
        url: url,
        duration: 0,
        viewCount: 0,
        isLive: false,

        video:
            new VideoSourceDescriptor(valid),

        description: desc
    });
}

// =========================================================
// PLAYERPRO
// =========================================================

function ppGet(path) {
    try {
        var sep =
            path.indexOf("?") !== -1
                ? "&"
                : "?";

        var url =
            IPTV_URL +
            path +
            sep +
            "username=" +
            encodeURIComponent(IPTV_USER) +
            "&password=" +
            encodeURIComponent(IPTV_PASS);

        var response =
            http.GET(
                url,
                {
                    "User-Agent": "PLPro/8"
                }
            );

        if (
            !response ||
            !response.body
        ) {
            return null;
        }

        return JSON.parse(
            response.body
        );

    } catch (e) {
        return null;
    }
}

function ppHome() {
    var videos = [];

    try {
        var data =
            ppGet("/movies/resume");

        if (!data || !data.movies) {
            return videos;
        }

        for (
            var i = 0;
            i < data.movies.length &&
            i < 40;
            i++
        ) {
            var m =
                data.movies[i];

            if (m.b) {
                videos.push(
                    mkVideo(
                        "pp_m_" + m.a,

                        (m.l
                            ? "[" + m.l + "] "
                            : "") +
                        m.b +
                        (m.f
                            ? " (" + m.f + ")"
                            : ""),

                        fixImg(m.d) ||
                        fixImg(m.c) ||
                        "",

                        "pp://movie/" +
                        m.a,

                        "PlayPelis"
                    )
                );
            }
        }

    } catch (e) {}

    return videos;
}

function ppSearch(query) {
    var videos = [];

    var q =
        String(query || "")
            .toLowerCase();

    try {
        var data =
            ppGet("/movies/resume");

        if (data && data.movies) {
            for (
                var i = 0;
                i < data.movies.length &&
                videos.length < 30;
                i++
            ) {
                var m =
                    data.movies[i];

                if (
                    String(m.b || "")
                        .toLowerCase()
                        .indexOf(q) !== -1 ||
                    String(m.i || "")
                        .toLowerCase()
                        .indexOf(q) !== -1
                ) {
                    videos.push(
                        mkVideo(
                            "pp_m_" + m.a,

                            (m.l
                                ? "[" + m.l + "] "
                                : "") +
                            m.b +
                            (m.f
                                ? " (" + m.f + ")"
                                : ""),

                            fixImg(m.d) ||
                            fixImg(m.c) ||
                            "",

                            "pp://movie/" +
                            m.a,

                            "PlayPelis"
                        )
                    );
                }
            }
        }

        var sdata =
            ppGet("/series");

        if (sdata && sdata.series) {
            for (
                var j = 0;
                j < sdata.series.length &&
                videos.length < 60;
                j++
            ) {
                var s =
                    sdata.series[j];

                if (
                    String(s.b || "")
                        .toLowerCase()
                        .indexOf(q) !== -1 ||
                    String(s.i || "")
                        .toLowerCase()
                        .indexOf(q) !== -1
                ) {
                    videos.push(
                        mkVideo(
                            "pp_s_" + s.a,
                            "[Serie] " + s.b,
                            fixImg(s.d) ||
                            fixImg(s.c) ||
                            "",
                            "pp://serie/" +
                            s.a,
                            "PlayPelis"
                        )
                    );
                }
            }
        }

    } catch (e) {}

    return videos;
}

// =========================================================
// PROCESAR SERVIDORES
// =========================================================

function processServers(
    linksData,
    type
) {
    var sources = [];
    var desc = "";

    if (
        !linksData ||
        !linksData.length
    ) {
        return {
            sources: sources,
            description: desc
        };
    }

    desc +=
        "\n\n--- Servidores ---";

    var tried = 0;

    for (
        var i = 0;
        i < linksData.length &&
        tried < MAX_TRY;
        i++
    ) {
        var link =
            linksData[i];

        var linkUrl =
            link.a || "";

        if (!linkUrl) {
            continue;
        }

        tried++;

        var serverName =
            (link.b || "Servidor") +
            " [" +
            (link.c || "") +
            "]";

        desc +=
            "\n" +
            serverName +
            " → " +
            linkUrl;

        addDebug(
            "[" +
            type +
            "] probando " +
            tried +
            "/" +
            MAX_TRY +
            ": " +
            linkUrl
        );

        var extracted =
            extractVideo(linkUrl);

        if (
            extracted &&
            isPlayableUrl(extracted)
        ) {
            var source =
                mkSource(
                    extracted,
                    serverName
                );

            if (source) {
                sources.push(source);

                addDebug(
                    "[" +
                    type +
                    "] FUENTE OK: " +
                    serverName
                );

                continue;
            }
        }

        addDebug(
            "[" +
            type +
            "] FALLÓ: " +
            serverName
        );
    }

    if (
        linksData.length > tried
    ) {
        desc +=
            "\n\n(" +
            (
                linksData.length -
                tried
            ) +
            " servidores restantes no probados)";
    }

    return {
        sources: sources,
        description: desc
    };
}

// =========================================================
// PELÍCULA
// =========================================================

function ppMovieDetails(id) {
    _debugLog = "";

    var data =
        ppGet("/movies/" + id);

    if (!data) {
        return mkDetail(
            "pp_m_" + id,
            "Sin resultado",
            "",
            "pp://movie/" + id,
            [],
            ""
        );
    }

    var title =
        data.b || "";

    var thumb =
        fixImg(data.d) ||
        fixImg(data.c) ||
        "";

    var desc =
        data.e || "";

    var linksData =
        ppGet(
            "/movies/" +
            id +
            "/links"
        );

    var result =
        processServers(
            linksData,
            "movie"
        );

    desc +=
        result.description;

    return mkDetail(
        "pp_m_" + id,
        title,
        thumb,
        "pp://movie/" + id,
        result.sources,
        desc
    );
}

// =========================================================
// SERIES
// =========================================================

function ppSerieDetails(id) {
    _debugLog = "";

    var data =
        ppGet("/series/" + id);

    if (!data) {
        return mkDetail(
            "pp_s_" + id,
            "Sin resultado",
            "",
            "pp://serie/" + id,
            [],
            ""
        );
    }

    var title =
        data.b || "";

    var thumb =
        fixImg(data.d) ||
        fixImg(data.c) ||
        "";

    var desc =
        data.e || "";

    var seasons =
        data.seasons ||
        data.f ||
        [];

    if (
        typeof seasons === "number"
    ) {
        seasons = [];
    }

    desc +=
        "\n\n--- Temporadas y Episodios ---";

    for (
        var si = 0;
        si < seasons.length;
        si++
    ) {
        var season =
            seasons[si];

        var seasonNum =
            season.num ||
            season.a ||
            (si + 1);

        var episodes =
            season.episodes ||
            season.b ||
            [];

        desc +=
            "\n\nTemporada " +
            seasonNum +
            ":";

        for (
            var ei = 0;
            ei < episodes.length;
            ei++
        ) {
            var ep =
                episodes[ei];

            var epNum =
                ep.num ||
                ep.a ||
                (ei + 1);

            desc +=
                "\n▶ Episodio " +
                epNum +
                " → pp://serie/" +
                id +
                "/" +
                seasonNum +
                "/" +
                epNum;
        }
    }

    return mkDetail(
        "pp_s_" + id,
        title,
        thumb,
        "pp://serie/" + id,
        [],
        desc
    );
}

// =========================================================
// EPISODIO
// =========================================================

function ppEpisodeLinks(
    id,
    season,
    episode
) {
    _debugLog = "";

    var data =
        ppGet("/series/" + id);

    if (!data) {
        return mkDetail(
            "pp_se_" + id,
            "Sin resultado",
            "",
            "",
            [],
            ""
        );
    }

    var title =
        (data.b || "") +
        " S" +
        season +
        "E" +
        episode;

    var thumb =
        fixImg(data.d) ||
        fixImg(data.c) ||
        "";

    var linksData =
        ppGet(
            "/series/" +
            id +
            "/links/" +
            season +
            "/" +
            episode
        );

    var result =
        processServers(
            linksData,
            "episode"
        );

    var desc =
        title +
        result.description;

    var epNum =
        parseInt(
            episode,
            10
        );

    desc +=
        "\n\n--- Navegación ---";

    if (epNum > 1) {
        desc +=
            "\n◀ Episodio anterior → pp://serie/" +
            id +
            "/" +
            season +
            "/" +
            (epNum - 1);
    }

    desc +=
        "\n▶ Episodio siguiente → pp://serie/" +
        id +
        "/" +
        season +
        "/" +
        (epNum + 1);

    return mkDetail(
        "pp_se_" +
        id +
        "_" +
        season +
        "_" +
        episode,

        title,

        thumb,

        "pp://serie/" +
        id +
        "/" +
        season +
        "/" +
        episode,

        result.sources,

        desc
    );
}

// =========================================================
// JKANIME
// =========================================================

function jkaSearch(query) {
    var out = [];

    try {
        var slug =
            slugify(query);

        if (!slug) {
            return out;
        }

        var html =
            httpGet(
                JK +
                "/buscar/" +
                slug +
                "/",
                {
                    "Referer":
                        JK + "/"
                }
            );

        if (!html) {
            return out;
        }

        var re =
            /<div class="anime__item">\s*<a\s+href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/)"[^>]*>[\s\S]*?<div[^>]*data-setbg="([^"]*)"[\s\S]*?<h5><a[^>]*>([^<]+)<\/a><\/h5>/gi;

        var m;

        while (
            (m = re.exec(html)) &&
            out.length < 30
        ) {
            out.push({
                title:
                    htmlDecode(m[3]),

                url:
                    m[1],

                thumb:
                    fixImg(m[2])
            });
        }

    } catch (e) {}

    return out;
}

function jkaExtractVideo(
    episodeUrl
) {
    addDebug(
        "JKA: Extrayendo " +
        episodeUrl
    );

    var html =
        httpGet(
            episodeUrl,
            {
                "Referer":
                    JK + "/"
            }
        );

    if (!html) {
        return null;
    }

    var re =
        /video\[\d+\]\s*=\s*'[^']*src="(https?:\/\/jkanime\.net\/jkplayer\/um[^"]*)"/i;

    var m =
        html.match(re);

    if (!m || !m[1]) {
        return null;
    }

    var playerUrl =
        m[1].replace(
            /&amp;/g,
            "&"
        );

    var playerHtml =
        httpGet(
            playerUrl,
            {
                "Referer":
                    episodeUrl
            }
        );

    if (!playerHtml) {
        return null;
    }

    var patterns = [
        /url\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i,
        /file\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i,
        /source\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i
    ];

    for (
        var i = 0;
        i < patterns.length;
        i++
    ) {
        var mm =
            playerHtml.match(
                patterns[i]
            );

        if (mm && mm[1]) {
            return cleanUrl(mm[1]);
        }
    }

    var loose =
        playerHtml.match(
            /https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)(?:\?[^"'\s<>]*)?/i
        );

    if (loose) {
        return cleanUrl(
            loose[0]
        );
    }

    return null;
}

function jkaDetails(url) {
    _debugLog = "";

    var html =
        httpGet(
            url,
            {
                "Referer":
                    JK + "/"
            }
        );

    if (!html) {
        return mkDetail(
            "jk_" + url,
            "Sin resultado",
            "",
            url,
            [],
            "No se pudo cargar"
        );
    }

    var title = "";

    var tm =
        html.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
        );

    if (tm) {
        title =
            stripTags(tm[1]);
    }

    title =
        (title || "")
            .replace(
                /\s*-\s*anime.*JkAnime/i,
                ""
            )
            .replace(
                /JkAnime/i,
                ""
            )
            .trim();

    var thumb = "";

    var im =
        html.match(
            /<img[^>]*src=["']([^"']*animes\/(?:image|video)\/[^"']+)["']/i
        );

    if (im) {
        thumb =
            fixImg(im[1]);
    }

    // Portada mejorada
    thumb =
        extractPoster(
            html,
            thumb
        );

    var desc = "";

    var seriesMatch =
        url.match(
            /jkanime\.net\/([a-z0-9-]+)\/?$/i
        );

    var episodeMatch =
        url.match(
            /jkanime\.net\/([a-z0-9-]+)\/(\d+)\/?$/i
        );

    if (
        seriesMatch &&
        !episodeMatch
    ) {
        var episodes = [];

        var re =
            /<a[^>]*href="\/([a-z0-9-]+)\/(\d+)\/?"[^>]*>/gi;

        var slug =
            seriesMatch[1];

        var m;

        while (
            (m = re.exec(html)) &&
            episodes.length < 200
        ) {
            if (
                m[1] === slug
            ) {
                episodes.push({
                    number:
                        parseInt(
                            m[2],
                            10
                        ),

                    url:
                        JK +
                        "/" +
                        m[1] +
                        "/" +
                        m[2] +
                        "/"
                });
            }
        }

        episodes.sort(
            function(a, b) {
                return (
                    a.number -
                    b.number
                );
            }
        );

        desc +=
            "\n\n--- Episodios (" +
            episodes.length +
            ") ---";

        for (
            var ei = 0;
            ei < episodes.length;
            ei++
        ) {
            desc +=
                "\n▶ Episodio " +
                episodes[ei].number +
                " → " +
                episodes[ei].url;
        }

        var sources = [];

        if (
            episodes.length > 0
        ) {
            var firstSrc =
                jkaExtractVideo(
                    episodes[0].url
                );

            if (firstSrc) {
                var src =
                    mkSource(
                        firstSrc,
                        "JkAnime"
                    );

                if (src) {
                    sources.push(src);
                }
            }
        }

        return mkDetail(
            "jk_" + url,
            title ||
                slugToTitle(slug),
            thumb,
            url,
            sources,
            desc
        );
    }

    var episodeSource =
        jkaExtractVideo(url);

    var srcArray = [];

    if (episodeSource) {
        var src =
            mkSource(
                episodeSource,
                "JkAnime"
            );

        if (src) {
            srcArray.push(src);
        }
    }

    return mkDetail(
        "jk_" + url,
        title || "Anime",
        thumb,
        url,
        srcArray,
        desc
    );
}

// =========================================================
// UNIFIED
// =========================================================

function doSearch(query) {
    var results = [];

    try {
        var r =
            ppSearch(query);

        for (
            var i = 0;
            i < r.length;
            i++
        ) {
            results.push(r[i]);
        }
    } catch (e) {}

    try {
        var jka =
            jkaSearch(query);

        for (
            var j = 0;
            j < jka.length;
            j++
        ) {
            results.push(
                mkVideo(
                    "jk_" +
                    jka[j].url,

                    "[Anime] " +
                    jka[j].title,

                    jka[j].thumb,

                    jka[j].url,

                    "JkAnime"
                )
            );
        }

    } catch (e) {}

    return results;
}

function doDetails(url) {
    if (!url) {
        return mkDetail(
            "",
            "",
            "",
            "",
            [],
            "URL vacía"
        );
    }

    if (
        url.indexOf(
            "jkanime.net"
        ) !== -1
    ) {
        return jkaDetails(url);
    }

    if (
        url.indexOf(
            "pp://movie/"
        ) === 0
    ) {
        var mm =
            url.match(
                /pp:\/\/movie\/(\d+)/
            );

        if (mm) {
            return ppMovieDetails(
                mm[1]
            );
        }
    }

    if (
        url.indexOf(
            "pp://serie/"
        ) === 0
    ) {
        var se =
            url.match(
                /pp:\/\/serie\/(\d+)\/(\d+)\/(\d+)/
            );

        if (se) {
            return ppEpisodeLinks(
                se[1],
                se[2],
                se[3]
            );
        }

        var ss =
            url.match(
                /pp:\/\/serie\/(\d+)/
            );

        if (ss) {
            return ppSerieDetails(
                ss[1]
            );
        }
    }

    return mkDetail(
        "",
        "",
        "",
        url,
        [],
        ""
    );
}

// =========================================================
// HOME
// =========================================================

function doHome() {
    var videos = [];

    try {
        var r =
            ppHome();

        for (
            var i = 0;
            i < r.length;
            i++
        ) {
            videos.push(r[i]);
        }

    } catch (e) {}

    try {
        var jkHtml =
            httpGet(
                JK + "/",
                {
                    "Referer":
                        JK + "/"
                }
            );

        if (jkHtml) {
            var re =
                /data-setbg="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;

            var m;

            while (
                (m = re.exec(jkHtml)) &&
                videos.length < 60
            ) {
                var linkRe =
                    /href="(https?:\/\/jkanime\.net\/[a-z0-9-]+\/?)"/i;

                var pos =
                    jkHtml.indexOf(m[0]);

                var anchor =
                    jkHtml.substring(
                        Math.max(
                            0,
                            pos - 500
                        ),
                        pos +
                        m[0].length
                    );

                var lm =
                    anchor.match(linkRe);

                var homeThumb =
                    fixImg(m[1]);

                videos.push(
                    mkVideo(
                        "jk_home_" +
                        (
                            lm
                                ? lm[1]
                                : JK + "/"
                        ),

                        "[Anime] " +
                        stripTags(m[2]),

                        homeThumb,

                        lm
                            ? lm[1]
                            : JK + "/",

                        "JkAnime"
                    )
                );
            }
        }

    } catch (e) {}

    return videos;
}

// =========================================================
// BINDINGS
// =========================================================

if (
    typeof source !== "undefined"
) {
    source.setSettings =
        function(s) {
            _settings =
                s || {};
        };

    source.enable =
        function(c, s) {
            _settings =
                s || {};
        };

    source.getSearchCapabilities =
        function() {
            return {
                types: [2],
                sorts: [],
                filters: []
            };
        };

    source.search =
        function(query) {
            try {
                return new VideoPager(
                    doSearch(
                        query || ""
                    ),
                    false,
                    null
                );
            } catch (e) {
                return new VideoPager(
                    [],
                    false,
                    null
                );
            }
        };

    source.isContentDetailsUrl =
        function(url) {
            return (
                url &&
                (
                    url.indexOf(
                        "jkanime.net"
                    ) !== -1 ||

                    url.indexOf(
                        "pp://"
                    ) !== -1
                )
            );
        };

    source.isVideoDetailsUrl =
        function(url) {
            return source
                .isContentDetailsUrl(
                    url
                );
        };

    source.getVideoDetails =
        function(url) {
            return source
                .getContentDetails(
                    url
                );
        };

    source.getHome =
        function() {
            try {
                return new VideoPager(
                    doHome(),
                    false,
                    null
                );
            } catch (e) {
                return new VideoPager(
                    [],
                    false,
                    null
                );
            }
        };

    source.isChannelUrl =
        function(url) {
            return false;
        };

    source.searchSuggestions =
        function(query) {
            return [];
        };

    source.getContentDetails =
        function(url) {
            try {
                var r =
                    doDetails(url);

                if (r) {
                    return r;
                }

                throw new Error(
                    "doDetails retornó null"
                );

            } catch (e) {
                return new PlatformVideoDetails({
                    id: new PlatformID(
                        "PlayPelis",
                        "error_fallo",
                        PID
                    ),

                    name:
                        "Error de Extractor",

                    thumbnails:
                        new Thumbnails([]),

                    author:
                        new PlatformAuthorLink(
                            PPID,
                            "PlayPelis",
                            "https://playpelis.app",
                            "",
                            0
                        ),

                    uploadDate: 0,
                    url:
                        url ||
                        "https://playpelis.app",
                    duration: 0,
                    viewCount: 0,
                    isLive: false,

                    description:
                        "CRASH CRÍTICO: " +
                        String(e) +
                        "\n\nLOG TÉCNICO:\n" +
                        _debugLog,

                    video:
                        new VideoSourceDescriptor([])
                });
            }
        };
}
