/*
 * ============================================================
 * GrayJay - OK.ru Source v6
 * ============================================================
 *
 * OK.ru -> HLS / MP4
 *
 * Mejoras:
 *  - Extracción robusta de metadata
 *  - data-options / flashvars / JSON embebido
 *  - HLS prioritario
 *  - MP4 fallback
 *  - videoembed
 *  - múltiples URLs HLS
 *  - mejor búsqueda
 *  - VideoPager / PlatformVideo
 *  - constructores GrayJay modernos
 *  - deduplicación
 *  - protección contra JSON recursivo
 *  - diagnóstico limitado
 *
 * Xuper:
 *  - reconoce play_params
 *  - reconoce verificationToken
 *  - reconoce playlistUrl
 *  - reconoce signdata
 *
 * NO se inventa ninguna firma ni algoritmo privado.
 * ============================================================
 */

const PLATFORM_NAME = "OK.ru";

const PLUGIN_ID =
    "62af0e2f-bfd9-489f-afe1-f66583d2f7d0";

const REGEX_VIDEO_URL =
    /(?:https?:\/\/)?(?:www\.|m\.)?ok\.ru\/(?:video|videoembed)\/(\d+)/i;

const SEARCH_URL_BASE =
    "https://ok.ru/dk?st.cmd=searchResult&st.mode=Movie&st.grmode=Groups&st.query=";

const MAX_HTML_SIZE = 5000000;
const MAX_JSON_DEPTH = 14;
const MAX_SOURCES = 40;
const MAX_DEBUG = 60;

const UA_DESKTOP =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/136.0.0.0 Safari/537.36";

const UA_MOBILE =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/136.0.0.0 Mobile Safari/537.36";

let DEBUG = [];


/* ============================================================
 * DEBUG
 * ============================================================ */

function resetDebug() {
    DEBUG = [];
}

function addDebug(value) {
    try {
        let s = safeStr(value);
        if (!s) return;

        if (DEBUG.length >= MAX_DEBUG)
            DEBUG.shift();

        if (s.length > 700)
            s = s.substring(0, 700) + "...";

        DEBUG.push(s);
    } catch (_) {}
}

function debugText() {
    return DEBUG.join("\n");
}


/* ============================================================
 * BASIC HELPERS
 * ============================================================ */

function safeStr(v) {
    try {
        if (v === null || v === undefined)
            return "";

        if (typeof v === "string")
            return v;

        return String(v);
    } catch (_) {
        return "";
    }
}

function safeObj(v) {
    return v !== null &&
        typeof v === "object";
}

function htmlDecode(s) {
    return safeStr(s)
        .replace(/&quot;/gi, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#x2f;/gi, "/")
        .replace(/&#47;/g, "/")
        .replace(/&#x3d;/gi, "=")
        .replace(/&#61;/g, "=");
}

function stripTags(s) {
    return safeStr(s)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ");
}

function cleanText(s) {
    return htmlDecode(stripTags(s))
        .replace(/\s+/g, " ")
        .trim();
}

function cleanUrl(s) {
    return htmlDecode(safeStr(s))
        .replace(/\\u002F/gi, "/")
        .replace(/\\u003A/gi, ":")
        .replace(/\\u003D/gi, "=")
        .replace(/\\\//g, "/")
        .replace(/&amp;/gi, "&")
        .replace(/^["']+|["']+$/g, "")
        .trim();
}

function normalizeUrl(s, base) {
    s = cleanUrl(s);

    if (!s)
        return "";

    if (s.indexOf("//") === 0)
        return "https:" + s;

    if (/^https?:\/\//i.test(s))
        return s;

    if (base && s.charAt(0) === "/") {
        try {
            let m = safeStr(base)
                .match(/^(https?:\/\/[^/]+)/i);

            if (m)
                return m[1] + s;
        } catch (_) {}
    }

    return s;
}

function isHttpUrl(s) {
    return /^https?:\/\//i.test(
        cleanUrl(s)
    );
}

function isM3u8Url(s) {
    return /\.m3u8(?:$|[?#])/i.test(
        cleanUrl(s)
    );
}

function isMp4Url(s) {
    return /\.(?:mp4|m4v|mov)(?:$|[?#])/i.test(
        cleanUrl(s)
    );
}

function getHost(url) {
    try {
        let m = safeStr(url)
            .match(/^https?:\/\/([^/]+)/i);

        return m ? m[1].toLowerCase() : "";
    } catch (_) {
        return "";
    }
}

function extractVideoId(url) {
    try {
        let m = safeStr(url)
            .match(REGEX_VIDEO_URL);

        return m ? m[1] : "";
    } catch (_) {
        return "";
    }
}

function firstValue(obj, keys) {
    if (!safeObj(obj))
        return "";

    for (let i = 0; i < keys.length; i++) {
        try {
            let v = obj[keys[i]];

            if (v !== undefined &&
                v !== null) {

                let s = safeStr(v);

                if (s)
                    return s;
            }
        } catch (_) {}
    }

    return "";
}


/* ============================================================
 * HTTP
 * ============================================================ */

function mergeHeaders(target, extra) {
    if (!target)
        target = {};

    if (!safeObj(extra))
        return target;

    try {
        for (let k in extra) {
            if (extra[k] !== null &&
                extra[k] !== undefined) {

                target[k] = safeStr(extra[k]);
            }
        }
    } catch (_) {}

    return target;
}

function readResponseBody(r) {
    if (!r)
        return "";

    let body = "";

    try {
        body = r.body;
    } catch (_) {}

    if (!body) {
        try {
            body = r.getBody();
        } catch (_) {}
    }

    body = safeStr(body);

    if (body.length > MAX_HTML_SIZE)
        body = body.substring(0, MAX_HTML_SIZE);

    return body;
}

function httpGet(url, headers) {
    try {
        let h = {
            "User-Agent": UA_DESKTOP,
            "Accept":
                "text/html,application/xhtml+xml," +
                "application/xml;q=0.9," +
                "image/avif,image/webp,*/*;q=0.8",
            "Accept-Language":
                "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        };

        mergeHeaders(h, headers);

        let r = http.GET(url, h);

        return readResponseBody(r);
    } catch (e) {
        addDebug("GET: " + e);
        return "";
    }
}

function httpGetAuth(url) {
    try {
        let r = http.GET(url);

        return readResponseBody(r);
    } catch (e) {
        addDebug("AUTH GET: " + e);
        return "";
    }
}

function loadOkPage(url) {
    let attempts = [
        function () {
            return httpGetAuth(url);
        },

        function () {
            return httpGet(url, {
                "User-Agent": UA_DESKTOP
            });
        },

        function () {
            return httpGet(url, {
                "User-Agent": UA_MOBILE,
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"
            });
        }
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            let body = attempts[i]();

            if (body &&
                body.length > 300) {

                addDebug(
                    "OK page attempt " + i
                );

                return body;
            }
        } catch (_) {}
    }

    return "";
}


/* ============================================================
 * JSON
 * ============================================================ */

function tryParseJson(value) {
    if (value === null ||
        value === undefined)
        return null;

    if (safeObj(value))
        return value;

    let s = safeStr(value).trim();

    if (!s)
        return null;

    for (let i = 0; i < 6; i++) {
        try {
            return JSON.parse(s);
        } catch (_) {}

        let decoded = htmlDecode(s);

        if (decoded !== s) {
            s = decoded;
            continue;
        }

        if (
            (s.charAt(0) === '"' &&
             s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" &&
             s.charAt(s.length - 1) === "'")
        ) {
            s = s.substring(
                1,
                s.length - 1
            );

            continue;
        }

        let unescaped = s
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\");

        if (unescaped !== s) {
            s = unescaped;
            continue;
        }

        break;
    }

    return null;
}


/* ============================================================
 * DATA-OPTIONS
 * ============================================================ */

function extractDataOptions(html) {
    let out = [];

    let re =
        /(?:data-options|data-options-json)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

    let m;

    while (
        (m = re.exec(html || "")) !== null &&
        out.length < 30
    ) {
        let raw =
            m[1] !== undefined
                ? m[1]
                : m[2];

        let obj = tryParseJson(raw);

        if (obj)
            out.push(obj);
    }

    return out;
}


/* ============================================================
 * METADATA DISCOVERY
 * ============================================================ */

function looksLikeVideoObject(obj) {
    if (!safeObj(obj))
        return false;

    try {
        let keys = [
            "playlistUrl",
            "hlsUrl",
            "hlsMasterPlaylistUrl",
            "hlsManifestUrl",
            "videoUrl",
            "metadataUrl",
            "flashvars",
            "play_params",
            "verificationToken",
            "signdata"
        ];

        for (let i = 0; i < keys.length; i++) {
            if (obj[keys[i]] !== undefined)
                return true;
        }
    } catch (_) {}

    return false;
}

function findMetadataInObject(root, depth) {
    if (!safeObj(root))
        return null;

    if (depth > MAX_JSON_DEPTH)
        return null;

    if (looksLikeVideoObject(root))
        return root;

    if (Array.isArray(root)) {
        for (let i = 0; i < root.length; i++) {
            let found =
                findMetadataInObject(
                    root[i],
                    depth + 1
                );

            if (found)
                return found;
        }

        return null;
    }

    let preferred = [
        "metadata",
        "flashvars",
        "video",
        "movie",
        "movieData",
        "media",
        "stream",
        "playlist",
        "data",
        "result"
    ];

    for (let i = 0; i < preferred.length; i++) {
        try {
            let key = preferred[i];

            if (root[key] !== undefined) {
                let found =
                    findMetadataInObject(
                        root[key],
                        depth + 1
                    );

                if (found)
                    return found;
            }
        } catch (_) {}
    }

    try {
        for (let key in root) {
            if (depth >= MAX_JSON_DEPTH)
                break;

            let value = root[key];

            if (
                /metadata|flashvar|video|movie|media|stream|playlist|player/i
                    .test(key)
            ) {
                let found =
                    findMetadataInObject(
                        value,
                        depth + 1
                    );

                if (found)
                    return found;
            }
        }
    } catch (_) {}

    return null;
}

function extractJsonObjectsFromHtml(html) {
    let objects = [];

    let patterns = [
        /(?:metadata|flashvars|video|movie|player|data)\s*[:=]\s*(\{[\s\S]{20,300000}\})/gi
    ];

    for (let p = 0; p < patterns.length; p++) {
        let re = patterns[p];
        let m;

        while (
            (m = re.exec(html || "")) !== null &&
            objects.length < 30
        ) {
            let obj = tryParseJson(m[1]);

            if (obj)
                objects.push(obj);
        }
    }

    return objects;
}

function extractMetadataFromHtml(html) {
    html = safeStr(html);

    if (!html)
        return null;

    let options =
        extractDataOptions(html);

    for (let i = 0; i < options.length; i++) {
        let found =
            findMetadataInObject(
                options[i],
                0
            );

        if (found)
            return found;
    }

    let objects =
        extractJsonObjectsFromHtml(html);

    for (let i = 0; i < objects.length; i++) {
        let found =
            findMetadataInObject(
                objects[i],
                0
            );

        if (found)
            return found;
    }

    return null;
}

function fetchMetadataUrl(meta, baseUrl) {
    if (!safeObj(meta))
        return null;

    let candidates = [
        meta.metadataUrl,
        meta.metadataURL,

        meta.flashvars &&
            meta.flashvars.metadataUrl,

        meta.flashvars &&
            meta.flashvars.metadataURL
    ];

    for (let i = 0; i < candidates.length; i++) {
        let url =
            normalizeUrl(
                candidates[i],
                baseUrl
            );

        if (!isHttpUrl(url))
            continue;

        addDebug(
            "metadataUrl: " + url
        );

        let body =
            httpGetAuth(url);

        if (!body)
            body = httpGet(url);

        let obj =
            tryParseJson(body);

        if (obj) {
            return (
                findMetadataInObject(
                    obj,
                    0
                ) || obj
            );
        }
    }

    return null;
}

function parseMetadata(html, pageUrl) {
    let meta =
        extractMetadataFromHtml(html);

    if (!meta)
        return null;

    let fetched =
        fetchMetadataUrl(
            meta,
            pageUrl
        );

    if (fetched)
        return fetched;

    return meta;
}


/* ============================================================
 * URL EXTRACTION
 * ============================================================ */

function pushUnique(arr, value) {
    value = normalizeUrl(value);

    if (!isHttpUrl(value))
        return;

    if (arr.indexOf(value) >= 0)
        return;

    if (arr.length >= MAX_SOURCES)
        return;

    arr.push(value);
}

function collectUrlsFromString(value, arr) {
    let s = safeStr(value);

    if (!s)
        return;

    s = htmlDecode(s)
        .replace(/\\\//g, "/");

    if (isM3u8Url(s)) {
        pushUnique(arr, s);
    }

    let re =
        /https?:\/\/[^\s"'<>\\]+/gi;

    let m;

    while ((m = re.exec(s)) !== null) {
        let url =
            cleanUrl(m[0]);

        if (isM3u8Url(url))
            pushUnique(arr, url);
    }

    let proto =
        /\/\/[^\s"'<>\\]+/g;

    while ((m = proto.exec(s)) !== null) {
        let url =
            "https:" + cleanUrl(m[0]);

        if (isM3u8Url(url))
            pushUnique(arr, url);
    }
}

function collectUrlsFromObject(
    obj,
    arr,
    depth
) {
    /*
     * IMPORTANTE:
     * primero comprobamos strings.
     * El v5 tenía aquí un bug.
     */

    if (typeof obj === "string") {
        collectUrlsFromString(
            obj,
            arr
        );

        return;
    }

    if (!safeObj(obj))
        return;

    if (depth > MAX_JSON_DEPTH)
        return;

    if (arr.length >= MAX_SOURCES)
        return;

    if (Array.isArray(obj)) {
        for (let i = 0;
             i < obj.length;
             i++) {

            collectUrlsFromObject(
                obj[i],
                arr,
                depth + 1
            );

            if (
                arr.length >= MAX_SOURCES
            )
                return;
        }

        return;
    }

    try {
        for (let key in obj) {
            let value = obj[key];

            if (
                /hls|m3u8|manifest|playlist|stream|video|media|file|url|source/i
                    .test(key)
            ) {
                collectUrlsFromObject(
                    value,
                    arr,
                    depth + 1
                );
            }

            if (safeObj(value)) {
                collectUrlsFromObject(
                    value,
                    arr,
                    depth + 1
                );
            } else if (
                typeof value === "string"
            ) {
                collectUrlsFromString(
                    value,
                    arr
                );
            }

            if (
                arr.length >= MAX_SOURCES
            )
                return;
        }
    } catch (_) {}
}

function collectHlsUrls(meta) {
    let urls = [];

    let preferred = [
        "playlistUrl",
        "hlsMasterPlaylistUrl",
        "hlsManifestUrl",
        "hlsUrl",
        "hls_playlist",
        "hls",
        "manifestUrl",
        "streamUrl",
        "videoUrl",
        "file"
    ];

    function walk(obj, depth) {
        if (!safeObj(obj))
            return;

        if (depth > MAX_JSON_DEPTH)
            return;

        if (urls.length >= MAX_SOURCES)
            return;

        if (Array.isArray(obj)) {
            for (let i = 0;
                 i < obj.length;
                 i++) {

                walk(
                    obj[i],
                    depth + 1
                );

                if (
                    urls.length >= MAX_SOURCES
                )
                    return;
            }

            return;
        }

        for (let i = 0;
             i < preferred.length;
             i++) {

            let key = preferred[i];

            try {
                if (
                    obj[key] !== undefined &&
                    obj[key] !== null
                ) {
                    collectUrlsFromObject(
                        obj[key],
                        urls,
                        depth + 1
                    );
                }
            } catch (_) {}
        }

        try {
            for (let key in obj) {
                let value = obj[key];

                if (
                    /hls|m3u8|playlist|manifest/i
                        .test(key)
                ) {
                    collectUrlsFromObject(
                        value,
                        urls,
                        depth + 1
                    );
                }

                if (
                    urls.length >= MAX_SOURCES
                )
                    return;
            }
        } catch (_) {}
    }

    walk(meta, 0);

    return urls;
}

function collectMp4Urls(meta) {
    let urls = [];

    function scan(value, depth) {
        /*
         * Igual que HLS:
         * strings deben procesarse antes
         * del chequeo de object.
         */

        if (typeof value === "string") {
            let s =
                htmlDecode(value)
                    .replace(/\\\//g, "/");

            let re =
                /https?:\/\/[^\s"'<>\\]+/gi;

            let m;

            while (
                (m = re.exec(s)) !== null
            ) {
                let url =
                    cleanUrl(m[0]);

                if (isMp4Url(url))
                    pushUnique(
                        urls,
                        url
                    );
            }

            return;
        }

        if (!safeObj(value))
            return;

        if (depth > MAX_JSON_DEPTH)
            return;

        if (
            urls.length >= MAX_SOURCES
        )
            return;

        if (Array.isArray(value)) {
            for (let i = 0;
                 i < value.length;
                 i++) {

                scan(
                    value[i],
                    depth + 1
                );

                if (
                    urls.length >= MAX_SOURCES
                )
                    return;
            }

            return;
        }

        try {
            for (let key in value) {
                scan(
                    value[key],
                    depth + 1
                );

                if (
                    urls.length >= MAX_SOURCES
                )
                    return;
            }
        } catch (_) {}
    }

    scan(meta, 0);

    return urls;
}


/* ============================================================
 * METADATA FIELDS
 * ============================================================ */

function getTitle(meta, fallback) {
    let title =
        firstValue(meta, [
            "title",
            "name",
            "movieTitle",
            "videoTitle",
            "caption"
        ]);

    return (
        cleanText(title) ||
        cleanText(fallback) ||
        "OK.ru video"
    );
}

function getPoster(meta) {
    return normalizeUrl(
        firstValue(meta, [
            "poster",
            "posterUrl",
            "thumbnail",
            "thumbnailUrl",
            "cover",
            "coverUrl",
            "image",
            "imageUrl",
            "preview"
        ])
    );
}

function getDuration(meta) {
    if (!safeObj(meta))
        return 0;

    let candidates = [
        {
            key: "durationMs",
            divide: 1000
        },
        {
            key: "durationSec",
            divide: 1
        },
        {
            key: "duration",
            divide: 1
        },
        {
            key: "length",
            divide: 1
        },
        {
            key: "videoDuration",
            divide: 1
        }
    ];

    for (let i = 0;
         i < candidates.length;
         i++) {

        try {
            let c = candidates[i];

            if (
                meta[c.key] === undefined ||
                meta[c.key] === null
            )
                continue;

            let n =
                parseFloat(
                    meta[c.key]
                );

            if (!isFinite(n) ||
                n <= 0)
                continue;

            if (c.divide !== 1)
                n = n / c.divide;

            /*
             * Protección para respuestas
             * donde duration viene accidentalmente
             * en milisegundos.
             */
            if (
                c.key === "duration" &&
                n > 100000
            ) {
                n = n / 1000;
            }

            return Math.round(n);
        } catch (_) {}
    }

    return 0;
}

function getAuthorName(meta) {
    return cleanText(
        firstValue(meta, [
            "authorName",
            "author",
            "ownerName",
            "uploader",
            "userName",
            "username"
        ])
    );
}


/* ============================================================
 * XUPER METADATA
 * ============================================================ */

function getNestedXuperContainers(meta) {
    let out = [];

    if (!safeObj(meta))
        return out;

    let candidates = [
        meta,
        meta.xuper,
        meta.data,
        meta.result,
        meta.auth,
        meta.player,
        meta.flashvars,
        meta.video,
        meta.metadata
    ];

    for (let i = 0;
         i < candidates.length;
         i++) {

        if (
            safeObj(candidates[i]) &&
            out.indexOf(candidates[i]) < 0
        ) {
            out.push(
                candidates[i]
            );
        }
    }

    return out;
}

function xuperGetPlayParams(meta) {
    let containers =
        getNestedXuperContainers(meta);

    for (let i = 0;
         i < containers.length;
         i++) {

        let v =
            firstValue(
                containers[i],
                [
                    "play_params",
                    "playParams"
                ]
            );

        if (v)
            return v;
    }

    return "";
}

function xuperGetVerificationToken(meta) {
    let containers =
        getNestedXuperContainers(meta);

    for (let i = 0;
         i < containers.length;
         i++) {

        let v =
            firstValue(
                containers[i],
                [
                    "verificationToken",
                    "verification_token"
                ]
            );

        if (v)
            return v;
    }

    return "";
}

function xuperGetPlaylistUrl(meta) {
    let containers =
        getNestedXuperContainers(meta);

    for (let i = 0;
         i < containers.length;
         i++) {

        let v =
            firstValue(
                containers[i],
                [
                    "playlistUrl",
                    "playlist_url"
                ]
            );

        if (isM3u8Url(v))
            return normalizeUrl(v);
    }

    return "";
}

function xuperGetSignature(meta) {
    let containers =
        getNestedXuperContainers(meta);

    for (let i = 0;
         i < containers.length;
         i++) {

        let v =
            firstValue(
                containers[i],
                [
                    "signdata",
                    "signature",
                    "sign"
                ]
            );

        if (v)
            return v;
    }

    return "";
}

function xuperResolve(meta) {
    /*
     * No generamos firma.
     *
     * Si OK.ru ya entrega playlistUrl,
     * se utiliza directamente.
     */

    let playlist =
        xuperGetPlaylistUrl(meta);

    if (isM3u8Url(playlist))
        return playlist;

    return "";
}


/* ============================================================
 * SOURCE CREATION
 * ============================================================ */

function makeHlsSource(
    url,
    duration,
    name
) {
    if (!isM3u8Url(url))
        return null;

    try {
        return new HLSSource({
            name:
                name ||
                "OK.ru HLS",

            duration:
                duration || 0,

            url: url
        });
    } catch (e) {
        addDebug(
            "HLSSource failed: " + e
        );
    }

    return null;
}

function makeMp4Source(
    url,
    duration,
    name
) {
    if (!isMp4Url(url))
        return null;

    try {
        return new VideoUrlSource({
            name:
                name ||
                "OK.ru MP4",

            width: 0,
            height: 0,
            container: "mp4",
            codec: "",
            bitrate: 0,
            duration:
                duration || 0,
            url: url
        });
    } catch (e) {
        addDebug(
            "VideoUrlSource failed: " + e
        );
    }

    return null;
}


/* ============================================================
 * PLATFORM DETAILS
 * ============================================================ */

function makeThumbnail(url) {
    if (!isHttpUrl(url))
        return null;

    try {
        return new Thumbnail(
            url,
            0
        );
    } catch (_) {
        return null;
    }
}

function makeAuthor(name) {
    if (!name)
        return null;

    try {
        return new PlatformAuthorLink(
            new PlatformID(
                PLATFORM_NAME,
                name,
                PLUGIN_ID
            ),
            name,
            "",
            ""
        );
    } catch (_) {}

    try {
        return new PlatformAuthorLink(
            name,
            "",
            ""
        );
    } catch (_) {}

    return null;
}

function makeVideoDetails(
    meta,
    videoId,
    canonicalUrl
) {
    let title =
        getTitle(
            meta,
            "OK.ru video " + videoId
        );

    let poster =
        getPoster(meta);

    let duration =
        getDuration(meta);

    let authorName =
        getAuthorName(meta);

    let hls = [];

    /*
     * Primero intentamos playlistUrl real.
     */
    let xuperPlaylist =
        xuperResolve(meta);

    if (isM3u8Url(xuperPlaylist))
        pushUnique(
            hls,
            xuperPlaylist
        );

    /*
     * Después las demás URLs HLS.
     */
    let normalHls =
        collectHlsUrls(meta);

    for (let i = 0;
         i < normalHls.length;
         i++) {

        pushUnique(
            hls,
            normalHls[i]
        );
    }

    /*
     * MP4 queda como fallback.
     */
    let mp4 =
        collectMp4Urls(meta);

    let sources = [];

    for (let i = 0;
         i < hls.length;
         i++) {

        let src =
            makeHlsSource(
                hls[i],
                duration,
                "OK.ru HLS " + (i + 1)
            );

        if (src)
            sources.push(src);
    }

    /*
     * Solo agregamos MP4 si no tenemos HLS.
     *
     * Esto evita que GrayJay/Cast seleccione
     * accidentalmente un MP4 inferior.
     */
    if (sources.length === 0) {
        for (let i = 0;
             i < mp4.length;
             i++) {

            let src =
                makeMp4Source(
                    mp4[i],
                    duration,
                    "OK.ru MP4 " + (i + 1)
                );

            if (src)
                sources.push(src);
        }
    }

    if (sources.length === 0) {
        throw new Error(
            "No playable HLS/MP4 source found"
        );
    }

    let thumbnails = [];

    let thumbnail =
        makeThumbnail(poster);

    if (thumbnail)
        thumbnails.push(thumbnail);

    let author =
        makeAuthor(authorName);

    let descriptor =
        new VideoSourceDescriptor(
            sources
        );

    /*
     * Constructor moderno GrayJay.
     */
    try {
        return new PlatformVideoDetails({
            id: new PlatformID(
                PLATFORM_NAME,
                videoId,
                PLUGIN_ID
            ),

            name: title,

            title: title,

            description: "",

            thumbnails: thumbnails,

            thumbnail: poster,

            author: author,

            uploadDate: 0,

            url: canonicalUrl,

            duration: duration,

            viewCount: 0,

            isLive: false,

            video: descriptor,

            videoSources: descriptor
        });
    } catch (e) {
        addDebug(
            "Modern details failed: " + e
        );
    }

    /*
     * Fallback para versiones antiguas.
     */
    try {
        return new PlatformVideoDetails(
            title,
            "",
            duration,
            poster,
            author,
            descriptor,
            thumbnails
        );
    } catch (e) {
        throw new Error(
            "PlatformVideoDetails failed: " +
            e +
            "\n" +
            debugText()
        );
    }
}


/* ============================================================
 * SEARCH
 * ============================================================ */

function parseDurationText(text) {
    text = cleanText(text);

    if (!text)
        return 0;

    let parts =
        text.split(":");

    let n = 0;

    if (parts.length === 2) {
        n =
            parseInt(parts[0], 10) * 60 +
            parseInt(parts[1], 10);
    } else if (parts.length === 3) {
        n =
            parseInt(parts[0], 10) * 3600 +
            parseInt(parts[1], 10) * 60 +
            parseInt(parts[2], 10);
    }

    return isFinite(n) ? n : 0;
}

function extractSearchResults(html) {
    let results = [];

    let re =
        /data-movie-id\s*=\s*["']?(\d+)["']?([\s\S]{0,6000}?)(?=data-movie-id|$)/gi;

    let m;

    while (
        (m = re.exec(html || "")) !== null &&
        results.length < 30
    ) {
        let id = m[1];
        let block = m[2] || "";

        let title = "";
        let poster = "";
        let duration = 0;

        try {
            let tm =
                block.match(
                    /(?:data-title|title)\s*=\s*["']([^"']+)["']/i
                );

            if (tm)
                title =
                    cleanText(tm[1]);
        } catch (_) {}

        if (!title) {
            try {
                let tm =
                    block.match(
                        /<(?:span|div|a)[^>]*class=["'][^"']*(?:title|name)[^"']*["'][^>]*>([\s\S]{1,700}?)<\/(?:span|div|a)>/i
                    );

                if (tm)
                    title =
                        cleanText(tm[1]);
            } catch (_) {}
        }

        try {
            let pm =
                block.match(
                    /(?:poster|thumbnail|data-poster|data-options)[^=]*=\s*["']([^"']+)["']/i
                );

            if (pm) {
                let candidate =
                    cleanUrl(pm[1]);

                if (
                    /\.jpg|\.jpeg|\.png|\.webp/i
                        .test(candidate)
                ) {
                    poster =
                        normalizeUrl(
                            candidate
                        );
                }
            }
        } catch (_) {}

        try {
            let dm =
                block.match(
                    /(?:duration|movie-duration)[^>]*>([^<]{1,30})</i
                );

            if (dm)
                duration =
                    parseDurationText(
                        dm[1]
                    );
        } catch (_) {}

        let url =
            "https://ok.ru/video/" +
            id;

        let video = null;

        try {
            video =
                new PlatformVideo({
                    id: new PlatformID(
                        PLATFORM_NAME,
                        id,
                        PLUGIN_ID
                    ),

                    name:
                        title ||
                        "OK.ru video " + id,

                    thumbnails:
                        poster
                            ? new Thumbnails([
                                new Thumbnail(
                                    poster,
                                    0
                                )
                            ])
                            : new Thumbnails([]),

                    author: null,

                    uploadDate: 0,

                    url: url,

                    duration: duration,

                    viewCount: 0,

                    isLive: false
                });
        } catch (_) {}

        if (video) {
            results.push(video);
        } else {
            /*
             * Fallback compatible con implementaciones
             * que todavía aceptan objetos simples.
             */
            results.push({
                id: id,
                url: url,
                name:
                    title ||
                    "OK.ru video " + id,

                title:
                    title ||
                    "OK.ru video " + id,

                thumbnail: poster,

                duration: duration
            });
        }
    }

    return results;
}

function searchOk(query) {
    let q =
        safeStr(query).trim();

    if (!q)
        return [];

    let url =
        SEARCH_URL_BASE +
        encodeURIComponent(q);

    let html =
        httpGetAuth(url);

    if (!html)
        html = httpGet(url);

    if (!html)
        throw new Error(
            "OK.ru search returned no data"
        );

    return extractSearchResults(
        html
    );
}

function makeVideoPager(results) {
    try {
        return new VideoPager(
            results,
            false,
            null
        );
    } catch (_) {}

    return results;
}


/* ============================================================
 * DETAILS
 * ============================================================ */

function doDetails(url) {
    resetDebug();

    let videoId =
        extractVideoId(url);

    if (!videoId) {
        throw new Error(
            "Invalid OK.ru video URL"
        );
    }

    let canonical =
        "https://ok.ru/video/" +
        videoId;

    addDebug(
        "Video ID: " + videoId
    );

    let html =
        loadOkPage(canonical);

    if (!html) {
        throw new Error(
            "Unable to load OK.ru video page"
        );
    }

    let meta =
        parseMetadata(
            html,
            canonical
        );

    if (!meta) {
        throw new Error(
            "OK.ru metadata not found.\n\n" +
            debugText()
        );
    }

    addDebug(
        "Xuper fields: " +
        "play_params=" +
        (xuperGetPlayParams(meta)
            ? "yes"
            : "no") +
        ", verificationToken=" +
        (xuperGetVerificationToken(meta)
            ? "yes"
            : "no") +
        ", playlistUrl=" +
        (xuperGetPlaylistUrl(meta)
            ? "yes"
            : "no") +
        ", signdata=" +
        (xuperGetSignature(meta)
            ? "yes"
            : "no")
    );

    return makeVideoDetails(
        meta,
        videoId,
        canonical
    );
}


/* ============================================================
 * SEARCH SUGGESTIONS
 * ============================================================ */

function searchSuggestions(query) {
    let out = [];

    try {
        let results =
            searchOk(query);

        for (
            let i = 0;
            i < results.length &&
            out.length < 10;
            i++
        ) {
            let r = results[i];

            let title = "";

            try {
                title =
                    r.name ||
                    r.title ||
                    "";
            } catch (_) {}

            if (title)
                out.push(
                    cleanText(title)
                );
        }
    } catch (e) {
        addDebug(
            "suggestions: " + e
        );
    }

    return out;
}


/* ============================================================
 * GRAYJAY API
 * ============================================================ */

source.setSettings =
    function (settings) {
        /*
         * Actualmente no necesitamos
         * configuración adicional.
         */
    };

source.enable =
    function () {
        return true;
    };

source.disable =
    function () {
        return true;
    };

source.getSearchCapabilities =
    function () {
        try {
            return new PlatformSearchCapabilities(
                true,
                true,
                false,
                false
            );
        } catch (_) {
            try {
                return new ResultCapabilities(
                    ["Video"],
                    [],
                    []
                );
            } catch (_) {}

            return {
                search: true,
                suggestions: true
            };
        }
    };

source.search =
    function (query) {
        return makeVideoPager(
            searchOk(query)
        );
    };

source.searchSuggestions =
    function (query) {
        return searchSuggestions(
            query
        );
    };

source.isContentDetailsUrl =
    function (url) {
        return REGEX_VIDEO_URL.test(
            safeStr(url)
        );
    };

source.isVideoDetailsUrl =
    function (url) {
        return REGEX_VIDEO_URL.test(
            safeStr(url)
        );
    };

source.getVideoDetails =
    function (url) {
        return doDetails(url);
    };

source.getContentDetails =
    function (url) {
        return doDetails(url);
    };

source.getHome =
    function () {
        return makeVideoPager([]);
    };

source.isChannelUrl =
    function () {
        return false;
    };


/* ============================================================
 * END
 * ============================================================ */
