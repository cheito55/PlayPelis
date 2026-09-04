// ============================================================
// GrayJay - OK.ru Source v3
// Multi-source HLS + MP4
// Cast compatible
// Search + details + diagnostics
// Basado en la arquitectura de PlayPelis v41
// ============================================================

var PLATFORM_NAME = "OK.ru";

var REGEX_VIDEO_URL = /ok\.ru\/(?:video|videoembed)\/(\d+)/i;

var SEARCH_URL_BASE =
    "https://ok.ru/dk?st.cmd=searchResult&st.mode=Movie&st.grmode=Groups&st.query=";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

var PLUGIN_ID = "";

var _settings = {};
var _debugLog = [];

var MAX_HTML_SIZE = 5000000;
var MAX_JSON_DEPTH = 12;
var MAX_SOURCES = 30;


// ============================================================
// DEBUG
// ============================================================

function addDebug(msg) {
    try {
        if (msg == null) return;

        var s = String(msg);

        if (s.length > 500) {
            s = s.substring(0, 500) + "...";
        }

        _debugLog.push(s);

        if (_debugLog.length > 40) {
            _debugLog.shift();
        }
    } catch (e) {
    }
}


function debugText() {
    try {
        if (_debugLog.length === 0) {
            return "";
        }

        return "\n\n[OK.ru diagnóstico]\n" + _debugLog.join("\n");
    } catch (e) {
        return "";
    }
}


function resetDebug() {
    _debugLog = [];
}


// ============================================================
// STRING / HTML UTILITIES
// ============================================================

function safeStr(v) {
    try {
        if (v == null) return "";
        return String(v);
    } catch (e) {
        return "";
    }
}


function safeObj(v) {
    try {
        return v && typeof v === "object" ? v : null;
    } catch (e) {
        return null;
    }
}


function htmlDecode(s) {
    s = safeStr(s);

    return s
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#34;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#x2F;/gi, "/")
        .replace(/&#47;/gi, "/")
        .replace(/\\u0026/g, "&")
        .replace(/\\u003D/gi, "=")
        .replace(/\\u002F/gi, "/")
        .replace(/\\\//g, "/");
}


function stripTags(s) {
    return htmlDecode(safeStr(s))
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function cleanText(s) {
    return stripTags(s)
        .replace(/\s+/g, " ")
        .trim();
}


function cleanUrl(url) {
    url = safeStr(url).trim();

    if (!url) return "";

    url = htmlDecode(url);

    url = url
        .replace(/^['"]+/, "")
        .replace(/['"]+$/, "")
        .replace(/\\u0026/g, "&")
        .replace(/\\u003D/g, "=")
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .trim();

    if (url.indexOf("//") === 0) {
        url = "https:" + url;
    }

    return url;
}


function normalizeUrl(url) {
    return cleanUrl(url)
        .replace(/[),.;]+$/, "");
}


function isHttpUrl(url) {
    url = normalizeUrl(url);
    return /^https?:\/\//i.test(url);
}


function isExternalProvider(url) {
    url = safeStr(url).toLowerCase();

    return (
        url.indexOf("youtube.com") >= 0 ||
        url.indexOf("youtu.be") >= 0 ||
        url.indexOf("vimeo.com") >= 0 ||
        url.indexOf("dailymotion.com") >= 0
    );
}


function isM3u8Url(url) {
    return /\.m3u8(?:$|[?#&])/i.test(safeStr(url));
}


// ============================================================
// URL / HOST
// ============================================================

function getHost(url) {
    try {
        var m = safeStr(url).match(/^https?:\/\/([^\/?#]+)/i);

        if (!m) return "";

        return m[1].toLowerCase();
    } catch (e) {
        return "";
    }
}


function extractVideoId(url) {
    try {
        var m = safeStr(url).match(REGEX_VIDEO_URL);

        return m ? m[1] : "";
    } catch (e) {
        return "";
    }
}


// ============================================================
// HTTP
// ============================================================

function httpGet(url, headers) {
    try {
        if (!url) return "";

        var h = {};

        h["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/136.0.0.0 Safari/537.36";

        if (headers) {
            for (var k in headers) {
                try {
                    h[k] = headers[k];
                } catch (ignore) {
                }
            }
        }

        addDebug("GET " + url);

        var response = http.GET(url, h);

        if (response == null) {
            addDebug("Respuesta HTTP nula");
            return "";
        }

        var body = "";

        try {
            body = response.body;
        } catch (e1) {
            try {
                body = response.getBody();
            } catch (e2) {
            }
        }

        body = safeStr(body);

        addDebug("HTTP OK: " + body.length + " bytes");

        if (body.length > MAX_HTML_SIZE) {
            addDebug("Respuesta demasiado grande");
            return body.substring(0, MAX_HTML_SIZE);
        }

        return body;

    } catch (e) {
        addDebug("HTTP error: " + e);
        return "";
    }
}


function httpGetAuthenticated(url) {
    try {
        addDebug("Intentando petición autenticada GrayJay");

        var response = http.GET(url);

        if (response == null) {
            return "";
        }

        var body = "";

        try {
            body = response.body;
        } catch (e1) {
            try {
                body = response.getBody();
            } catch (e2) {
            }
        }

        return safeStr(body);

    } catch (e) {
        addDebug("Auth HTTP error: " + e);
        return "";
    }
}


// ============================================================
// PAGE LOADER
// ============================================================

function buildVideoPageUrl(id) {
    return "https://ok.ru/video/" + id;
}


function buildMobileVideoPageUrl(id) {
    return "https://m.ok.ru/video/" + id;
}


function loadOkVideoPage(id) {
    resetDebug();

    var desktop = buildVideoPageUrl(id);
    var mobile = buildMobileVideoPageUrl(id);

    var html = "";

    // --------------------------------------------------------
    // 1. GrayJay authenticated
    // --------------------------------------------------------

    html = httpGetAuthenticated(desktop);

    if (html && html.length > 500) {
        addDebug("Página desktop obtenida mediante GrayJay");
        return html;
    }

    // --------------------------------------------------------
    // 2. Desktop normal
    // --------------------------------------------------------

    html = httpGet(desktop, {
        "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://ok.ru/"
    });

    if (html && html.length > 500) {
        addDebug("Página desktop obtenida");
        return html;
    }

    // --------------------------------------------------------
    // 3. Mobile authenticated
    // --------------------------------------------------------

    html = httpGetAuthenticated(mobile);

    if (html && html.length > 500) {
        addDebug("Página móvil obtenida mediante GrayJay");
        return html;
    }

    // --------------------------------------------------------
    // 4. Mobile normal
    // --------------------------------------------------------

    html = httpGet(mobile, {
        "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://m.ok.ru/"
    });

    if (html && html.length > 500) {
        addDebug("Página móvil obtenida");
        return html;
    }

    addDebug("No se pudo obtener la página de OK.ru");

    return "";
}


// ============================================================
// DATA-OPTIONS EXTRACTION
// ============================================================

function extractDataOptions(html) {
    if (!html) return "";

    var patterns = [
        /data-options\s*=\s*"([^"]+)"/i,
        /data-options\s*=\s*'([^']+)'/i,
        /data-options\s*=\s*([^ >]+)/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        try {
            var m = html.match(patterns[i]);

            if (m && m[1]) {
                return htmlDecode(m[1]);
            }
        } catch (e) {
        }
    }

    return "";
}


// ============================================================
// JSON PARSING
// ============================================================

function tryParseJson(value) {
    try {
        if (value == null) return null;

        if (typeof value === "object") {
            return value;
        }

        var s = safeStr(value).trim();

        if (!s) return null;

        s = htmlDecode(s);

        // JSON puede estar escapado
        if (
            (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")
        ) {
            s = s.substring(1, s.length - 1);
        }

        try {
            return JSON.parse(s);
        } catch (e1) {
        }

        // Intentar desescapar
        try {
            s = s
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\")
                .replace(/\\u0026/g, "&")
                .replace(/\\u003D/g, "=")
                .replace(/\\\//g, "/");

            return JSON.parse(s);
        } catch (e2) {
        }

    } catch (e) {
        addDebug("JSON parse error: " + e);
    }

    return null;
}


// ============================================================
// METADATA
// ============================================================

function findMetadataInObject(obj, depth) {
    if (!obj || depth > MAX_JSON_DEPTH) {
        return null;
    }

    if (typeof obj !== "object") {
        return null;
    }

    try {
        if (obj.flashvars) {
            if (obj.flashvars.metadata) {
                return obj.flashvars.metadata;
            }

            if (obj.flashvars.metadataUrl) {
                return {
                    metadataUrl: obj.flashvars.metadataUrl
                };
            }
        }

        if (obj.metadata) {
            return obj.metadata;
        }

        for (var key in obj) {
            try {
                var value = obj[key];

                if (
                    typeof value === "string" &&
                    (
                        key.toLowerCase().indexOf("metadata") >= 0 ||
                        key.toLowerCase().indexOf("flashvars") >= 0
                    )
                ) {
                    var parsed = tryParseJson(value);

                    if (parsed) {
                        var found = findMetadataInObject(parsed, depth + 1);

                        if (found) return found;

                        return parsed;
                    }
                }

                if (typeof value === "object") {
                    var result = findMetadataInObject(
                        value,
                        depth + 1
                    );

                    if (result) {
                        return result;
                    }
                }

            } catch (ignore) {
            }
        }

    } catch (e) {
    }

    return null;
}


function extractMetadataFromHtml(html) {
    if (!html) return null;

    // --------------------------------------------------------
    // Primero data-options
    // --------------------------------------------------------

    var optionsText = extractDataOptions(html);

    if (optionsText) {
        var options = tryParseJson(optionsText);

        if (options) {
            var metadata = findMetadataInObject(options, 0);

            if (metadata) {
                addDebug("Metadata encontrada en data-options");
                return metadata;
            }
        }
    }

    // --------------------------------------------------------
    // Buscar flashvars.metadata directamente
    // --------------------------------------------------------

    var patterns = [
        /"metadata"\s*:\s*"((?:\\.|[^"])*)"/i,
        /'metadata'\s*:\s*'((?:\\.|[^'])*)'/i,
        /flashvars[^]{0,5000}metadata[^]{0,5000}/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        try {
            var m = html.match(patterns[i]);

            if (!m) continue;

            if (m[1]) {
                var parsed = tryParseJson(m[1]);

                if (parsed) {
                    addDebug("Metadata encontrada directamente");
                    return parsed;
                }
            }

        } catch (e) {
        }
    }

    // --------------------------------------------------------
    // Buscar cualquier bloque JSON grande
    // --------------------------------------------------------

    var jsonCandidates = [];

    var regexJson =
        /(?:flashvars|metadata|player|video)\s*[:=]\s*(\{[\s\S]{20,200000}\})/gi;

    var jm;

    while ((jm = regexJson.exec(html)) !== null) {
        if (jm[1]) {
            jsonCandidates.push(jm[1]);
        }

        if (jsonCandidates.length >= 10) {
            break;
        }
    }

    for (var j = 0; j < jsonCandidates.length; j++) {
        var candidate = tryParseJson(jsonCandidates[j]);

        if (candidate) {
            var md = findMetadataInObject(candidate, 0);

            if (md) {
                addDebug("Metadata encontrada en bloque JSON");
                return md;
            }
        }
    }

    return null;
}


// ============================================================
// METADATA URL
// ============================================================

function fetchMetadataUrl(url) {
    url = cleanUrl(url);

    if (!url || !isHttpUrl(url)) {
        return null;
    }

    addDebug("Metadata URL detectada");

    var body = httpGet(url, {
        "Referer": "https://ok.ru/",
        "Accept": "application/json,text/plain,*/*"
    });

    if (!body) {
        return null;
    }

    var parsed = tryParseJson(body);

    if (parsed) {
        return parsed;
    }

    return null;
}


function parseMetadata(html) {
    var metadata = extractMetadataFromHtml(html);

    if (!metadata) {
        addDebug("No se encontró metadata");
        return null;
    }

    // metadata puede ser string
    if (typeof metadata === "string") {
        var parsed = tryParseJson(metadata);

        if (parsed) {
            metadata = parsed;
        }
    }

    // metadataUrl
    if (
        metadata &&
        metadata.metadataUrl
    ) {
        var remote = fetchMetadataUrl(metadata.metadataUrl);

        if (remote) {
            metadata = remote;
        }
    }

    return metadata;
}


// ============================================================
// URL COLLECTION
// ============================================================

function pushUnique(arr, url) {
    url = normalizeUrl(url);

    if (!url || !isHttpUrl(url)) {
        return;
    }

    if (isExternalProvider(url)) {
        return;
    }

    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === url) {
            return;
        }
    }

    arr.push(url);
}


function collectUrlsFromString(text, hls, mp4) {
    text = safeStr(text);

    if (!text) return;

    var regex =
        /https?:\/\/[^"'\\<>\s]+/gi;

    var m;

    while ((m = regex.exec(text)) !== null) {
        var url = cleanUrl(m[0]);

        if (!url) continue;

        if (isM3u8Url(url)) {
            pushUnique(hls, url);
        } else if (
            /\.(?:mp4|m4v|webm)(?:$|[?#&])/i.test(url)
        ) {
            pushUnique(mp4, url);
        }
    }

    // URLs protocol-relative
    var regex2 =
        /\/\/[^"'\\<>\s]+\.m3u8[^"'\\<>\s]*/gi;

    while ((m = regex2.exec(text)) !== null) {
        var u2 = cleanUrl(m[0]);

        if (u2) {
            pushUnique(hls, u2);
        }
    }
}


function collectUrlsFromObject(obj, hls, mp4, depth) {
    if (!obj || depth > MAX_JSON_DEPTH) {
        return;
    }

    try {
        if (typeof obj === "string") {
            collectUrlsFromString(obj, hls, mp4);
            return;
        }

        if (typeof obj !== "object") {
            return;
        }

        for (var key in obj) {
            try {
                var value = obj[key];

                var lower = safeStr(key).toLowerCase();

                if (typeof value === "string") {

                    var url = cleanUrl(value);

                    if (isM3u8Url(url)) {
                        pushUnique(hls, url);
                    } else if (
                        /\.(?:mp4|m4v|webm)(?:$|[?#&])/i.test(url)
                    ) {
                        pushUnique(mp4, url);
                    }

                    // Campos relacionados con video
                    if (
                        lower.indexOf("hls") >= 0 ||
                        lower.indexOf("playlist") >= 0 ||
                        lower.indexOf("manifest") >= 0 ||
                        lower.indexOf("stream") >= 0 ||
                        lower.indexOf("url") >= 0 ||
                        lower.indexOf("file") >= 0
                    ) {
                        collectUrlsFromString(
                            value,
                            hls,
                            mp4
                        );
                    }

                } else if (typeof value === "object") {

                    collectUrlsFromObject(
                        value,
                        hls,
                        mp4,
                        depth + 1
                    );
                }

            } catch (ignore) {
            }
        }

    } catch (e) {
        addDebug("Error recorriendo metadata: " + e);
    }
}


// ============================================================
// HLS FIELD EXTRACTION
// ============================================================

function collectHlsUrls(metadata) {
    var hls = [];
    var mp4 = [];

    if (!metadata) {
        return {
            hls: hls,
            mp4: mp4
        };
    }

    // Campos prioritarios conocidos
    var fields = [
        "hlsMasterPlaylistUrl",
        "hlsManifestUrl",
        "hlsUrl",
        "hls_playlist",
        "hls",
        "hlsUrlMobile",
        "playlistUrl",
        "manifestUrl",
        "streamUrl",
        "videoUrl",
        "url",
        "file"
    ];

    for (var i = 0; i < fields.length; i++) {
        try {
            var value = metadata[fields[i]];

            if (typeof value === "string") {
                var url = cleanUrl(value);

                if (isM3u8Url(url)) {
                    pushUnique(hls, url);
                } else if (
                    /\.(?:mp4|m4v|webm)(?:$|[?#&])/i.test(url)
                ) {
                    pushUnique(mp4, url);
                }

                collectUrlsFromString(
                    value,
                    hls,
                    mp4
                );
            }
        } catch (ignore) {
        }
    }

    // Recorrido completo
    collectUrlsFromObject(
        metadata,
        hls,
        mp4,
        0
    );

    // Limitar
    if (hls.length > MAX_SOURCES) {
        hls = hls.slice(0, MAX_SOURCES);
    }

    if (mp4.length > MAX_SOURCES) {
        mp4 = mp4.slice(0, MAX_SOURCES);
    }

    addDebug(
        "Fuentes encontradas: HLS=" +
        hls.length +
        " MP4=" +
        mp4.length
    );

    return {
        hls: hls,
        mp4: mp4
    };
}


// ============================================================
// METADATA HELPERS
// ============================================================

function firstValue(obj, keys) {
    if (!obj) return "";

    for (var i = 0; i < keys.length; i++) {
        try {
            var v = obj[keys[i]];

            if (v != null && safeStr(v).trim()) {
                return v;
            }
        } catch (ignore) {
        }
    }

    return "";
}


function getTitle(metadata, html) {
    var title = firstValue(metadata, [
        "movieTitle",
        "title",
        "name",
        "videoTitle",
        "contentTitle"
    ]);

    if (title) {
        return cleanText(title);
    }

    var patterns = [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
        /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = safeStr(html).match(patterns[i]);

        if (m && m[1]) {
            return cleanText(m[1])
                .replace(/\s*-\s*OK\.ru.*$/i, "");
        }
    }

    return "Video OK.ru";
}


function getPoster(metadata, html) {
    var poster = firstValue(metadata, [
        "poster",
        "posterUrl",
        "thumbnail",
        "thumbnailUrl",
        "cover",
        "coverUrl",
        "image",
        "imageUrl"
    ]);

    if (poster) {
        poster = cleanUrl(poster);

        if (isHttpUrl(poster)) {
            return poster;
        }
    }

    var patterns = [
        /property=["']og:image["'][^>]+content=["']([^"']+)/i,
        /name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
        /["'](?:poster|thumbnail|image)["']\s*:\s*["']([^"']+)/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = safeStr(html).match(patterns[i]);

        if (m && m[1]) {
            var p = cleanUrl(m[1]);

            if (isHttpUrl(p)) {
                return p;
            }
        }
    }

    return "";
}


function getDuration(metadata) {
    var d = firstValue(metadata, [
        "duration",
        "durationMs",
        "durationSec",
        "durationSeconds",
        "length"
    ]);

    if (d == null || d === "") {
        return 0;
    }

    var n = Number(d);

    if (isNaN(n) || n < 0) {
        return 0;
    }

    // Algunos servidores entregan milisegundos
    if (n > 100000) {
        n = Math.floor(n / 1000);
    }

    return Math.floor(n);
}


function getAuthorName(metadata) {
    var author = firstValue(metadata, [
        "author",
        "authorName",
        "uploader",
        "ownerName",
        "userName"
    ]);

    if (author && typeof author === "object") {
        author = firstValue(author, [
            "name",
            "title",
            "username"
        ]);
    }

    return cleanText(author);
}


// ============================================================
// REQUEST MODIFIER
// ============================================================

function buildImportOptions() {
    try {
        if (typeof httpimp === "undefined") {
            return null;
        }

        var opts = {};

        opts.applyAuthClient = "";
        opts.applyCookieClient = "";
        opts.applyOtherHeaders = false;

        try {
            opts.impersonateTarget = "chrome136";
        } catch (ignore) {
        }

        return opts;

    } catch (e) {
        return null;
    }
}


function buildRequestModifier() {
    var impOpts = buildImportOptions();

    if (!impOpts) {
        return null;
    }

    try {
        return new RequestModifier(
            impOpts
        );
    } catch (e) {
        return null;
    }
}


// ============================================================
// VIDEO SOURCE CREATION
// ============================================================

function makeHlsSource(url, title) {
    try {
        url = normalizeUrl(url);

        if (!url) return null;

        var modifier = buildRequestModifier();

        if (modifier) {
            try {
                return new HLSSource(
                    title || "OK.ru HLS",
                    url,
                    modifier
                );
            } catch (e1) {
            }
        }

        return new HLSSource(
            title || "OK.ru HLS",
            url
        );

    } catch (e) {
        addDebug("Error creando HLS: " + e);
        return null;
    }
}


function makeMp4Source(url, title) {
    try {
        url = normalizeUrl(url);

        if (!url) return null;

        var modifier = buildRequestModifier();

        if (modifier) {
            try {
                return new VideoUrlSource(
                    title || "OK.ru MP4",
                    url,
                    modifier
                );
            } catch (e1) {
            }
        }

        return new VideoUrlSource(
            title || "OK.ru MP4",
            url
        );

    } catch (e) {
        addDebug("Error creando MP4: " + e);
        return null;
    }
}


// ============================================================
// BUILD VIDEO DETAILS
// ============================================================

function buildVideoDetails(
    id,
    metadata,
    html,
    originalUrl
) {
    var title = getTitle(metadata, html);
    var poster = getPoster(metadata, html);
    var duration = getDuration(metadata);
    var authorName = getAuthorName(metadata);

    var urls = collectHlsUrls(metadata);

    var sources = [];

    // --------------------------------------------------------
    // HLS primero
    // --------------------------------------------------------

    for (var i = 0; i < urls.hls.length; i++) {

        if (sources.length >= MAX_SOURCES) {
            break;
        }

        var hls = makeHlsSource(
            urls.hls[i],
            "OK.ru HLS " + (i + 1)
        );

        if (hls) {
            sources.push(hls);
        }
    }

    // --------------------------------------------------------
    // MP4 fallback
    // --------------------------------------------------------

    for (var j = 0; j < urls.mp4.length; j++) {

        if (sources.length >= MAX_SOURCES) {
            break;
        }

        var mp4 = makeMp4Source(
            urls.mp4[j],
            "OK.ru MP4 " + (j + 1)
        );

        if (mp4) {
            sources.push(mp4);
        }
    }

    if (sources.length === 0) {
        throw new Error(
            "OK.ru no proporcionó ninguna fuente reproducible"
        );
    }

    addDebug(
        "Fuentes GrayJay creadas: " +
        sources.length
    );

    var description =
        "Fuente: OK.ru" +
        "\nID: " + id +
        "\nFuentes: " + sources.length;

    if (authorName) {
        description += "\nAutor: " + authorName;
    }

    description += debugText();

    var thumbnails = [];

    if (poster) {
        try {
            thumbnails.push(
                new Thumbnail(
                    poster,
                    0
                )
            );
        } catch (e) {
            try {
                thumbnails.push(
                    new Thumbnail(poster)
                );
            } catch (ignore) {
            }
        }
    }

    var author = null;

    if (authorName) {
        try {
            author = new PlatformAuthorLink(
                authorName,
                ""
            );
        } catch (ignore2) {
        }
    }

    var descriptor;

    try {
        descriptor = new VideoSourceDescriptor(
            sources
        );
    } catch (e1) {
        descriptor = new VideoSourceDescriptor(
            sources,
            null
        );
    }

    return new PlatformVideoDetails(
        title,
        description,
        originalUrl,
        thumbnails,
        duration,
        author,
        descriptor
    );
}


// ============================================================
// SEARCH HTML PARSER
// ============================================================

function extractSearchTitle(block) {
    var patterns = [
        /portal_search_name[^>]*title=["']([^"']+)/i,
        /portal_search_name[^>]*>([\s\S]*?)<\/[^>]+>/i,
        /data-l=["']([^"']+)["']/i,
        /title=["']([^"']+)["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = block.match(patterns[i]);

        if (m && m[1]) {
            var t = cleanText(m[1]);

            if (
                t &&
                t.length > 1 &&
                t.length < 500
            ) {
                return t;
            }
        }
    }

    return "Video OK.ru";
}


function extractSearchDuration(block) {
    var patterns = [
        /video-card_duration[^>]*>([^<]+)/i,
        /duration[^>]*>([^<]+)/i,
        /video-card_duration[^>]*content=["']([^"']+)/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = block.match(patterns[i]);

        if (m && m[1]) {
            return cleanText(m[1]);
        }
    }

    return "";
}


function extractSearchPoster(block) {
    var patterns = [
        /<img[^>]+src=["']([^"']+)["']/i,
        /poster=["']([^"']+)["']/i,
        /data-src=["']([^"']+)["']/i,
        /data-original=["']([^"']+)["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = block.match(patterns[i]);

        if (m && m[1]) {
            var p = cleanUrl(m[1]);

            if (
                isHttpUrl(p) &&
                !/avatar|icon|logo/i.test(p)
            ) {
                return p;
            }
        }
    }

    return "";
}


function parseSearchResults(html) {
    var results = [];

    if (!html) {
        return results;
    }

    var ids = [];
    var idRegex =
        /data-movie-id=["'](\d+)["']/gi;

    var m;

    while ((m = idRegex.exec(html)) !== null) {

        var id = m[1];

        var duplicate = false;

        for (var x = 0; x < ids.length; x++) {
            if (ids[x] === id) {
                duplicate = true;
                break;
            }
        }

        if (!duplicate) {
            ids.push(id);
        }

        if (ids.length >= 100) {
            break;
        }
    }

    addDebug(
        "Resultados encontrados en HTML: " +
        ids.length
    );

    for (var i = 0; i < ids.length; i++) {

        var videoId = ids[i];

        var pos = html.indexOf(
            'data-movie-id="' + videoId + '"'
        );

        if (pos < 0) {
            pos = html.indexOf(
                "data-movie-id='" + videoId + "'"
            );
        }

        if (pos < 0) {
            continue;
        }

        var start = Math.max(
            0,
            pos - 5000
        );

        var end = Math.min(
            html.length,
            pos + 10000
        );

        var block = html.substring(
            start,
            end
        );

        var title = extractSearchTitle(block);
        var duration = extractSearchDuration(block);
        var poster = extractSearchPoster(block);

        var url =
            "https://ok.ru/video/" +
            videoId;

        try {
            var thumbs = [];

            if (poster) {
                try {
                    thumbs.push(
                        new Thumbnail(
                            poster,
                            0
                        )
                    );
                } catch (e1) {
                    try {
                        thumbs.push(
                            new Thumbnail(poster)
                        );
                    } catch (e2) {
                    }
                }
            }

            var details = new PlatformVideoDetails(
                title,
                duration
                    ? "Duración: " + duration
                    : "Video de OK.ru",
                url,
                thumbs,
                0,
                null,
                null
            );

            results.push(details);

        } catch (e) {
            addDebug(
                "Error creando resultado " +
                videoId +
                ": " +
                e
            );
        }
    }

    return results;
}


// ============================================================
// SEARCH
// ============================================================

function doSearch(query) {
    resetDebug();

    query = safeStr(query).trim();

    if (!query) {
        return new VideoPager(
            [],
            false,
            {}
        );
    }

    addDebug(
        "Buscando: " + query
    );

    var url =
        SEARCH_URL_BASE +
        encodeURIComponent(query);

    var html = httpGetAuthenticated(url);

    if (!html || html.length < 500) {
        addDebug(
            "Auth search no devolvió contenido útil"
        );

        html = httpGet(url, {
            "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language":
                "es-ES,es;q=0.9,en;q=0.8",
            "Referer":
                "https://ok.ru/"
        });
    }

    var results = parseSearchResults(html);

    addDebug(
        "Resultados finales: " +
        results.length
    );

    return new VideoPager(
        results,
        false,
        {}
    );
}


// ============================================================
// CONTENT DETAILS
// ============================================================

function doDetails(url) {
    resetDebug();

    var id = extractVideoId(url);

    if (!id) {
        throw new Error(
            "No se pudo obtener el ID del video OK.ru"
        );
    }

    addDebug(
        "Video ID: " + id
    );

    var html = loadOkVideoPage(id);

    if (!html) {
        throw new Error(
            "No se pudo cargar el video"
        );
    }

    // --------------------------------------------------------
    // Detectar embeds externos
    // --------------------------------------------------------

    var hasYoutube =
        /youtube(?:-nocookie)?\.com|youtu\.be/i.test(html);

    var hasVimeo =
        /vimeo\.com/i.test(html);

    if (hasYoutube) {
        addDebug(
            "La página contiene referencia a YouTube"
        );
    }

    if (hasVimeo) {
        addDebug(
            "La página contiene referencia a Vimeo"
        );
    }

    // IMPORTANTE:
    // No rechazamos aquí.
    // Primero intentamos extraer fuentes reales OK.ru.
    // --------------------------------------------------------

    var metadata =
        parseMetadata(html);

    if (!metadata) {
        throw new Error(
            "No se pudo extraer la metadata del video"
        );
    }

    return buildVideoDetails(
        id,
        metadata,
        html,
        url
    );
}


// ============================================================
// HOME
// ============================================================

function doHome() {
    return new VideoPager(
        [],
        false,
        {}
    );
}


// ============================================================
// SUGGESTIONS
// ============================================================

function doSuggestions(query) {
    query = safeStr(query).trim();

    if (!query) {
        return [];
    }

    // OK.ru no necesita una segunda petición.
    // GrayJay puede utilizar el texto directamente.
    return [query];
}


// ============================================================
// CHANNEL
// ============================================================

function isChannelUrl(url) {
    url = safeStr(url).toLowerCase();

    if (!url) return false;

    if (url.indexOf("ok.ru/group/") >= 0) {
        return true;
    }

    if (url.indexOf("ok.ru/profile/") >= 0) {
        return true;
    }

    return false;
}


// ============================================================
// SETTINGS
// ============================================================

function setSettings(settings) {
    try {
        _settings = settings || {};
    } catch (e) {
        _settings = {};
    }
}


// ============================================================
// GRAYJAY BINDINGS
// ============================================================

source.setSettings = function(settings) {
    setSettings(settings);
};


source.enable = function(pluginId) {
    try {
        PLUGIN_ID = pluginId || "";
    } catch (e) {
        PLUGIN_ID = "";
    }
};


source.getSearchCapabilities = function() {
    try {
        return {
            supportsSearch: true,
            supportsSuggestions: true
        };
    } catch (e) {
        return {};
    }
};


source.search = function(query) {
    try {
        return doSearch(query);
    } catch (e) {

        resetDebug();

        addDebug(
            "Search exception: " + e
        );

        return new VideoPager(
            [],
            false,
            {}
        );
    }
};


source.searchSuggestions = function(query) {
    try {
        return doSuggestions(query);
    } catch (e) {
        return [];
    }
};


source.isContentDetailsUrl = function(url) {
    return REGEX_VIDEO_URL.test(
        safeStr(url)
    );
};


source.isVideoDetailsUrl = function(url) {
    return REGEX_VIDEO_URL.test(
        safeStr(url)
    );
};


source.getVideoDetails = function(url) {
    try {
        return doDetails(url);
    } catch (e) {

        var message =
            "No se pudo reproducir el video de OK.ru.\n\n" +
            "Error: " +
            safeStr(e);

        try {
            message += debugText();
        } catch (ignore) {
        }

        addDebug(
            "getVideoDetails error: " +
            e
        );

        return new PlatformVideoDetails(
            "OK.ru - Error",
            message,
            url,
            [],
            0,
            null,
            null
        );
    }
};


source.getContentDetails = function(url) {
    try {
        return doDetails(url);
    } catch (e) {

        var message =
            "OK.ru no pudo obtener el contenido.\n\n" +
            "Error: " +
            safeStr(e);

        try {
            message += debugText();
        } catch (ignore) {
        }

        return new PlatformVideoDetails(
            "OK.ru - Error",
            message,
            url,
            [],
            0,
            null,
            null
        );
    }
};


source.getHome = function() {
    try {
        return doHome();
    } catch (e) {
        return new VideoPager(
            [],
            false,
            {}
        );
    }
};


source.isChannelUrl = function(url) {
    return isChannelUrl(url);
};


// ============================================================
// FIN
// ============================================================
