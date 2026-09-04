// PlayPelis GrayJay Source v6
// Multi-servidor + HLS + diagnóstico
var PID = "8a2f4b7e-3c1d-4f6a-9b8e-5d2c1a9f6e40";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

var PPID = new PlatformID("PlayPelis", "PlayPelis", PID);
var _settings = {};
var _debugLog = "";

// Lista de dominios a probar en orden. Si el primero falla
// (sin respuesta, JSON inválido, o "no disponible"), se
// prueba automáticamente el siguiente.
var IPTV_DOMAINS = [
    "https://plpro.org"
    // Agrega aquí dominios espejo si los tienes, ej:
    // "https://plpro2.org",
    // "https://plpro-backup.org"
];
var IPTV_URL = IPTV_DOMAINS[0];
var IPTV_USER = "p";
var IPTV_PASS = "p";
// Dominio que respondió con éxito la última vez, para
// empezar por él en la siguiente llamada.
var _lastGoodDomainIdx = 0;
var JK = "https://jkanime.net";
var TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// =========================================================
// CONFIGURACIÓN
// =========================================================

// Ahora prueba hasta 10 servidores.
// Si hay menos, prueba los que existan.
var MAX_TRY = 10;

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
        addDebug("HTTP Exception en " + url + ": " + String(e));
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

    var s = String(u).trim();

    if (!s) return "";

    // Arregla protocolos truncados tipo "ttps://" o "ttp://"
    if (s.indexOf("ttps://") === 0) {
        s = "https" + s.substring(4);
    } else if (s.indexOf("ttp://") === 0) {
        s = "http" + s.substring(3);
    }

    // Protocol-relative: "//image.tmdb.org/..."
    if (s.indexOf("//") === 0) {
        s = "https:" + s;
    }

    if (s.indexOf("http") === 0) {
        return s;
    }

    // A partir de aquí "s" es una ruta relativa de TMDB,
    // con o sin slash inicial: "/abc123.jpg" o "abc123.jpg".
    // Nos quedamos solo con el nombre de archivo final,
    // por si viniera con subcarpetas tipo "t/p/w500/abc.jpg".
    var lastSlash = s.lastIndexOf("/");
    var fileName = lastSlash !== -1 ? s.substring(lastSlash + 1) : s;

    if (!fileName || fileName.indexOf(".") === -1) {
        return "";
    }

    if (
        fileName.indexOf(".jpg") === -1 &&
        fileName.indexOf(".jpeg") === -1 &&
        fileName.indexOf(".png") === -1 &&
        fileName.indexOf(".webp") === -1
    ) {
        fileName += ".jpg";
    }

    return TMDB_IMG + "/" + fileName;
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

function mkHls(url, name, duration) {
    if (!url) return null;

    return new HLSSource({
        name: name || "HLS",
        url: url,
        duration: duration || 0
    });
}

// =========================================================
// URL / HLS
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

function cleanUrl(url) {
    if (!url) return "";

    var s = String(url).trim();

    s = htmlDecode(s);

    s = s.replace(/\\u0026/g, "&");
    s = s.replace(/\\\//g, "/");

    return s;
}

// =========================================================
// JS PACKER (Dean Edwards) - desempaquetador genérico
// =========================================================
// Muchos cyberlockers (streamtape, sbembed/sbplay, vidoza,
// algunas variantes de dood, etc.) esconden el enlace real
// dentro de un bloque tipo:
//   eval(function(p,a,c,k,e,d){...}('PAYLOAD',RADIX,COUNT,'KEYWORDS'.split('|'),0,{}))
// Esta función revierte ese empaquetado (sin usar eval) y
// devuelve el código JS original en texto plano.

function toBaseChars(num, base) {
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    if (num === 0) return "0";

    var s = "";

    while (num > 0) {
        s = chars[num % base] + s;
        num = Math.floor(num / base);
    }

    return s;
}

function findPackedBlocks(html) {
    var blocks = [];

    try {
        var re = /eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\}\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/g;

        var m;

        while ((m = re.exec(html))) {
            blocks.push({
                payload: m[1],
                radix: parseInt(m[2], 10) || 10,
                count: parseInt(m[3], 10) || 0,
                keywords: m[4].split("|")
            });
        }
    } catch (e) {
        addDebug("[packer] EXCEPTION buscando bloques: " + String(e));
    }

    return blocks;
}

function unpackBlock(block) {
    try {
        var lookup = {};

        for (var i = block.count - 1; i >= 0; i--) {
            var key = toBaseChars(i, block.radix);
            lookup[key] = block.keywords[i] || key;
        }

        return block.payload.replace(/\b\w+\b/g, function(word) {
            return lookup.hasOwnProperty(word) ? lookup[word] : word;
        });
    } catch (e) {
        addDebug("[packer] EXCEPTION desempaquetando: " + String(e));
        return "";
    }
}

// Busca todos los bloques "packer" en el HTML, los desempaqueta,
// y devuelve la primera URL .m3u8 o .mp4 que encuentre dentro.
function tryPackerExtract(html) {
    if (!html) return null;

    var blocks = findPackedBlocks(html);

    addDebug("[packer] bloques encontrados=" + blocks.length);

    for (var i = 0; i < blocks.length; i++) {
        var code = unpackBlock(blocks[i]);

        if (!code) continue;

        var m3u8 = code.match(/https?:\/\/[^"'\s\\<>]+\.m3u8[^"'\s\\<>]*/i);

        if (m3u8) {
            addDebug("[packer] m3u8 encontrada en bloque " + i);
            return cleanUrl(m3u8[0]);
        }

        var mp4 = code.match(/https?:\/\/[^"'\s\\<>]+\.mp4[^"'\s\\<>]*/i);

        if (mp4) {
            addDebug("[packer] mp4 encontrado en bloque " + i);
            return cleanUrl(mp4[0]);
        }

        // Algunos hosts arman la URL en variables separadas dentro
        // del código desempaquetado, ej: file:"..." o src:"..."
        var fileVar = code.match(/(?:file|src|source)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);

        if (fileVar && fileVar[1]) {
            addDebug("[packer] file/src encontrado en bloque " + i);
            return cleanUrl(fileVar[1]);
        }
    }

    return null;
}

function directHls(url) {
    try {
        url = cleanUrl(url);

        if (!isM3u8Url(url)) {
            return null;
        }

        addDebug("[hls] m3u8 directa detectada");

        return url;
    } catch (e) {
        addDebug("[hls] EXCEPTION: " + String(e));
        return null;
    }
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

        if (
            !html ||
            html.length < 500
        ) {
            addDebug(
                "[vidhide] HTML insuficiente"
            );

            return null;
        }

        var splitIdx =
            html.lastIndexOf(".split('|')");

        addDebug(
            "[vidhide] splitIdx=" +
            splitIdx
        );

        if (splitIdx === -1) {
            addDebug(
                "[vidhide] No se encontró .split('|')"
            );

            return null;
        }

        var keyEnd =
            html.lastIndexOf(
                "'",
                splitIdx
            );

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

        addDebug(
            "[vidhide] keyArrLen=" +
            keyArr.length
        );

        if (keyArr.length < 50) {
            addDebug(
                "[vidhide] Array demasiado corto"
            );

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

        addDebug(
            "[vidhide] candidateUrls=" +
            urls.length
        );

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
                dec.indexOf(".m3u8") !== -1
            ) {
                best = dec;
                break;
            }

            if (
                !best &&
                dec.indexOf("master.") !== -1 &&
                dec.indexOf(".txt") !== -1
            ) {
                best = dec;
            }
        }

        addDebug(
            "[vidhide] best=" +
            (best || "none")
        );

        if (!best) {
            return null;
        }

        // Si ya es M3U8, devolver directamente.
        if (isM3u8Url(best)) {
            return best;
        }

        // Algunos servidores entregan master.txt.
        if (/\.txt(?:[?#]|$)/i.test(best)) {
            addDebug(
                "[vidhide] master.txt detectado"
            );

            var txt = httpGet(
                best,
                {
                    "User-Agent": UA,
                    "Referer": refererBase
                }
            );

            addDebug(
                "[vidhide] txtLen=" +
                (txt ? txt.length : 0)
            );

            if (txt) {
                var m3u =
                    txt.match(
                        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
                    );

                if (m3u && m3u[0]) {
                    var finalUrl =
                        cleanUrl(m3u[0]);

                    addDebug(
                        "[vidhide] m3u8 encontrada dentro de master.txt"
                    );

                    return finalUrl;
                }
            }
        }

        addDebug(
            "[vidhide] No se pudo convertir la fuente"
        );

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
        addDebug(
            "[voe] fetch=" + pageUrl
        );

        var html = httpGet(
            pageUrl,
            {
                "User-Agent": UA,
                "Referer": pageUrl
            }
        );

        addDebug(
            "[voe] htmlLen=" +
            (html ? html.length : 0)
        );

        if (!html) {
            return null;
        }

        var m =
            html.match(
                /hls\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (m && m[1]) {
            addDebug(
                "[voe] match directo hls"
            );

            return cleanUrl(m[1]);
        }

        var am =
            html.match(
                /atob\(['"]([^'"]+)['"]\)/
            );

        addDebug(
            "[voe] atobMatch=" +
            (am ? "si" : "no")
        );

        if (am) {
            try {
                var d =
                    b64decode(am[1]);

                var u =
                    d.match(
                        /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i
                    );

                addDebug(
                    "[voe] atob m3u8=" +
                    (u ? "si" : "no")
                );

                if (u) {
                    return cleanUrl(u[0]);
                }
            } catch (e) {
                addDebug(
                    "[voe] atob exception=" +
                    String(e)
                );
            }
        }

        var fm =
            html.match(
                /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (fm && fm[1]) {
            addDebug(
                "[voe] match file"
            );

            return cleanUrl(fm[1]);
        }

        addDebug(
            "[voe] ningun patron encontro nada"
        );

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
        addDebug(
            "[dood] fetch=" + pageUrl
        );

        var html = httpGet(
            pageUrl,
            {
                "User-Agent": UA,
                "Referer": pageUrl
            }
        );

        addDebug(
            "[dood] htmlLen=" +
            (html ? html.length : 0)
        );

        if (!html) {
            return null;
        }

        var m =
            html.match(
                /(?:file|link|source)\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (m && m[1]) {
            addDebug(
                "[dood] match m3u8"
            );

            return cleanUrl(m[1]);
        }

        var mp4 =
            html.match(
                /(?:file|link|source)\s*[:=]\s*['"]([^'"]+\.mp4[^'"]*)['"]/i
            );

        if (mp4 && mp4[1]) {
            addDebug(
                "[dood] match mp4"
            );

            return cleanUrl(mp4[1]);
        }

        var packedDood = tryPackerExtract(html);

        if (packedDood) {
            addDebug(
                "[dood] extraído via JS Packer"
            );

            return packedDood;
        }

        addDebug(
            "[dood] ningun patron encontro nada"
        );

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
        addDebug(
            "[generic] fetch=" + pageUrl
        );

        var html = httpGet(
            pageUrl,
            {
                "User-Agent": UA,
                "Referer": pageUrl
            }
        );

        addDebug(
            "[generic] htmlLen=" +
            (html ? html.length : 0)
        );

        if (!html) {
            return null;
        }

        var m =
            html.match(
                /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (m && m[1]) {
            addDebug(
                "[generic] match file"
            );

            return cleanUrl(m[1]);
        }

        m =
            html.match(
                /source\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
            );

        if (m && m[1]) {
            addDebug(
                "[generic] match source"
            );

            return cleanUrl(m[1]);
        }

        m =
            html.match(
                /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i
            );

        if (m) {
            addDebug(
                "[generic] match suelto m3u8"
            );

            return cleanUrl(m[0]);
        }

        // Último recurso: muchos hosts (streamtape, sbembed/sbplay,
        // vidoza, etc.) ocultan el enlace con JS Packer.
        var packed = tryPackerExtract(html);

        if (packed) {
            addDebug(
                "[generic] extraído via JS Packer"
            );

            return packed;
        }

        addDebug(
            "[generic] ningun patron encontro nada"
        );

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
        addDebug(
            "[extract] URL vacia"
        );

        return null;
    }

    pageUrl = cleanUrl(pageUrl);

    // Si ya es un manifest HLS.
    if (isM3u8Url(pageUrl)) {
        return directHls(pageUrl);
    }

    var host = getHost(pageUrl);

    addDebug(
        "[extract] host=" + host
    );

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

    // IMPORTANTE:
    // Ya no se agrega el vídeo de prueba.
    if (valid.length === 0) {
        desc +=
            "\n\n⚠️ No se encontró una fuente de vídeo reproducible.";
    } else {
        desc +=
            "\n\n✅ Fuentes reproducibles encontradas: " +
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

// Heurística simple para detectar respuestas que técnicamente
// llegan (código 200) pero indican que el contenido/servidor
// no está disponible, para forzar el salto al siguiente dominio.
function looksUnavailable(body) {
    if (!body) return true;

    var low = String(body).toLowerCase();

    return (
        low.indexOf("no disponible") !== -1 ||
        low.indexOf("not available") !== -1 ||
        low.indexOf("unavailable") !== -1 ||
        low.indexOf("<html") !== -1 && low.indexOf("{") === -1
    );
}

// Hace la petición contra UN dominio concreto. Devuelve el
// JSON parseado, o null si falla / no está disponible.
function ppGetFromDomain(domain, path) {
    try {
        var sep =
            path.indexOf("?") !== -1
                ? "&"
                : "?";

        var url =
            domain +
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
            addDebug("[ppGet] " + domain + " -> sin respuesta");
            return null;
        }

        if (looksUnavailable(response.body)) {
            addDebug("[ppGet] " + domain + " -> contenido no disponible");
            return null;
        }

        return JSON.parse(response.body);

    } catch (e) {
        addDebug("[ppGet] " + domain + " -> EXCEPTION: " + String(e));
        return null;
    }
}

// Prueba todos los dominios configurados, empezando por el
// último que funcionó, y recuerda cuál sirvió para la próxima vez.
function ppGet(path) {
    var n = IPTV_DOMAINS.length;

    for (var i = 0; i < n; i++) {
        var idx = (_lastGoodDomainIdx + i) % n;
        var domain = IPTV_DOMAINS[idx];

        var data = ppGetFromDomain(domain, path);

        if (data) {
            _lastGoodDomainIdx = idx;
            IPTV_URL = domain;
            return data;
        }
    }

    addDebug("[ppGet] Todos los dominios fallaron para: " + path);
    return null;
}

function ppHome() {
    var videos = [];

    try {
        var data =
            ppGet("/movies/resume");

        if (
            !data ||
            !data.movies
        ) {
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

        if (
            data &&
            data.movies
        ) {
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

        if (
            sdata &&
            sdata.series
        ) {
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

    var sources = [];

    if (
        linksData &&
        linksData.length
    ) {
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
                "[movie] probando " +
                tried +
                "/" +
                MAX_TRY +
                ": " +
                linkUrl
            );

            var extracted =
                extractVideo(
                    linkUrl
                );

            if (extracted) {
                var source =
                    mkHls(
                        extracted,
                        serverName
                    );

                if (source) {
                    sources.push(
                        source
                    );

                    addDebug(
                        "[movie] FUENTE OK: " +
                        serverName
                    );
                }
            } else {
                addDebug(
                    "[movie] FALLÓ: " +
                    serverName
                );
            }
        }

        if (
            linksData.length >
            tried
        ) {
            desc +=
                "\n\n(" +
                (
                    linksData.length -
                    tried
                ) +
                " servidores más sin probar)";
        }
    }

    return mkDetail(
        "pp_m_" + id,
        title,
        thumb,
        "pp://movie/" + id,
        sources,
        desc
    );
}

// =========================================================
// SERIES
// =========================================================

// Busca, dentro de un objeto, el primer array no vacío entre
// una lista de posibles nombres de campo (probamos varias
// convenciones porque no todos los backends usan las mismas
// letras para series que para películas).
function firstArrayField(obj, names) {
    if (!obj) return null;

    for (var i = 0; i < names.length; i++) {
        var v = obj[names[i]];

        if (Array.isArray(v) && v.length > 0) {
            return v;
        }
    }

    return null;
}

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
            "\n\n⚠️ El endpoint /series/" + id + " no devolvió datos (todos los dominios fallaron o la respuesta no era JSON válido)."
        );
    }

    var title =
        data.b || data.title || data.name || "";

    var thumb =
        fixImg(data.d) ||
        fixImg(data.c) ||
        fixImg(data.poster) ||
        fixImg(data.cover) ||
        "";

    var desc =
        (data.e || data.description || data.sinopsis || "") +
        "\n\n--- Temporadas y Episodios ---";

    // Probamos varios nombres de campo posibles para "temporadas".
    var seasons =
        firstArrayField(data, [
            "seasons", "f", "temporadas", "g", "season_list"
        ]) || [];

    if (seasons.length === 0) {
        // Diagnóstico: mostramos qué claves sí trajo la respuesta,
        // para poder identificar el nombre correcto del campo.
        var keys = [];
        for (var k in data) {
            if (data.hasOwnProperty(k)) keys.push(k);
        }

        desc +=
            "\n\n⚠️ No se encontraron temporadas en la respuesta." +
            "\nClaves recibidas del servidor: [" + keys.join(", ") + "]" +
            "\nSi reconoces cuál de esas claves contiene las temporadas, avísame para ajustar el parseo.";

        return mkDetail(
            "pp_s_" + id,
            title,
            thumb,
            "pp://serie/" + id,
            [],
            desc
        );
    }

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
            season.number ||
            season.temporada ||
            (si + 1);

        var episodes =
            firstArrayField(season, [
                "episodes", "b", "episodios", "episode_list"
            ]) || [];

        desc +=
            "\n\nTemporada " +
            seasonNum +
            " (" + episodes.length + " episodios):";

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
                ep.number ||
                ep.episodio ||
                (ei + 1);

            desc +=
                "\n  Ep " +
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
        (data.b || data.title || data.name || "") +
        " S" +
        season +
        "E" +
        episode;

    var thumb =
        fixImg(data.d) ||
        fixImg(data.c) ||
        fixImg(data.poster) ||
        fixImg(data.cover) ||
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

    var desc =
        title +
        "\n\n--- Servidores ---";

    var sources = [];

    if (linksData && !linksData.length) {
        // La respuesta llegó pero no es un array con la forma
        // esperada: mostramos su forma para poder diagnosticar.
        var keys2 = [];
        for (var k2 in linksData) {
            if (linksData.hasOwnProperty(k2)) keys2.push(k2);
        }
        desc +=
            "\n⚠️ La respuesta de enlaces no tiene el formato esperado (array). Claves: [" +
            keys2.join(", ") + "]";
    }

    if (!linksData) {
        desc +=
            "\n⚠️ El endpoint de enlaces no devolvió datos (todos los dominios fallaron).";
    }

    if (
        linksData &&
        linksData.length
    ) {
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
                "[episode] probando " +
                tried +
                "/" +
                MAX_TRY +
                ": " +
                linkUrl
            );

            var extracted =
                extractVideo(
                    linkUrl
                );

            if (extracted) {
                var source =
                    mkHls(
                        extracted,
                        serverName
                    );

                if (source) {
                    sources.push(
                        source
                    );

                    addDebug(
                        "[episode] FUENTE OK: " +
                        serverName
                    );
                }
            } else {
                addDebug(
                    "[episode] FALLÓ: " +
                    serverName
                );
            }
        }
    }

    var epNum =
        parseInt(
            episode,
            10
        );

    if (epNum > 1) {
        desc +=
            "\n\n← Ep Anterior: pp://serie/" +
            id +
            "/" +
            season +
            "/" +
            (epNum - 1);
    }

    desc +=
        "\n→ Ep Siguiente: pp://serie/" +
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

        sources,

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
                    m[2]
            });
        }

    } catch (e) {}

    return out;
}

function jkaExtractVideo(
    episodeUrl
) {
    addDebug(
        "JKA: Extrayendo episodio " +
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
        addDebug(
            "JKA: HTML nulo"
        );

        return null;
    }

    var re =
        /video\[\d+\]\s*=\s*'[^']*src="(https?:\/\/jkanime\.net\/jkplayer\/um[^"]*)"/i;

    var m =
        html.match(re);

    if (
        !m ||
        !m[1]
    ) {
        addDebug(
            "JKA: No se encontró iframe"
        );

        return null;
    }

    var playerUrl =
        m[1].replace(
            /&amp;/g,
            "&"
        );

    addDebug(
        "JKA: Cargando reproductor: " +
        playerUrl
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
        addDebug(
            "JKA: Player HTML nulo"
        );

        return null;
    }

    addDebug(
        "JKA Player HTML length: " +
        playerHtml.length
    );

    var m3u8 =
        playerHtml.match(
            /url\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
        );

    if (
        m3u8 &&
        m3u8[1]
    ) {
        return mkHls(
            cleanUrl(m3u8[1]),
            "JkAnime"
        );
    }

    addDebug(
        "JKA: No se encontró m3u8"
    );

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
            im[1].indexOf("http") === 0
                ? im[1]
                : JK +
                  "/" +
                  im[1].replace(
                      /^\/+/,
                      ""
                  );
    }

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
                "\nEp " +
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
                sources.push(
                    firstSrc
                );
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

    var episodeSources =
        jkaExtractVideo(url);

    var srcArray =
        episodeSources
            ? [episodeSources]
            : [];

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
            results.push(
                r[i]
            );
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
            videos.push(
                r[i]
            );
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
                    jkHtml.indexOf(
                        m[0]
                    );

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
                    anchor.match(
                        linkRe
                    );

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

                        m[1],

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
                        new Thumbnails([
                            new Thumbnail(
                                TMDB_IMG +
                                "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png",
                                100
                            )
                        ]),

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

                    // Sin vídeo falso.
                    video:
                        new VideoSourceDescriptor([])
                });
            }
        };
}
