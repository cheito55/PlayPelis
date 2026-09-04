/*
 * GrayJay - OK.ru Source v8
 * Optimizado para:
 * - OK.ru desktop/mobile/embed
 * - HLS + MP4/M4V/WebM reales
 * - extracción tolerante de JSON/data-options/flashvars
 * - escaneo directo de URLs dentro del HTML
 * - HLS prioritario
 * - MP4 como fallback
 * - Cast/FCast: fuentes directas, sin RequestModifier
 * - búsqueda y sugerencias
 *
 * XuperTv:
 * Se reconocen play_params, playlistUrl, verificationToken y signdata
 * únicamente si aparecen realmente en los datos obtenidos.
 *
 * NO se inventa ninguna firma/token de XuperTv.
 */

const PLATFORM_NAME = "OK.ru";
const PLUGIN_ID = "62af0e2f-bfd9-489f-afe1-f66583d2f7d0";

const VIDEO_RE = /(?:https?:\/\/)?(?:www\.|m\.)?ok\.ru\/(?:video|videoembed)\/(\d+)/i;

const SEARCH_URL =
    "https://ok.ru/dk?st.cmd=searchResult&st.mode=Movie&st.grmode=Groups&st.query=";

const MAX_HTML = 5000000;
const MAX_DEPTH = 14;
const MAX_SOURCES = 24;
const MAX_SEARCH = 20;
const MAX_DEBUG = 50;

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
 * UTILIDADES
 * ========================================================== */

function str(v) {
    try {
        if (v === null || v === undefined) return "";
        return typeof v === "string" ? v : String(v);
    } catch (_) {
        return "";
    }
}

function obj(v) {
    return v !== null && typeof v === "object";
}

function debug(v) {
    try {
        let s = str(v);
        if (!s) return;
        if (s.length > 600) s = s.substring(0, 600) + "...";
        if (DEBUG.length >= MAX_DEBUG) DEBUG.shift();
        DEBUG.push(s);
    } catch (_) {}
}

function resetDebug() {
    DEBUG = [];
}

function debugDump() {
    return DEBUG.join("\n");
}

function decodeHtml(s) {
    return str(s)
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
        .replace(/&#61;/g, "=")
        .replace(/&#x3a;/gi, ":")
        .replace(/&#58;/g, ":");
}

function cleanText(s) {
    return decodeHtml(str(s))
        .replace(/<[^>]*>/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanUrl(s) {
    return decodeHtml(str(s))
        .replace(/\\u002F/gi, "/")
        .replace(/\\u002f/gi, "/")
        .replace(/\\u003A/gi, ":")
        .replace(/\\u003a/gi, ":")
        .replace(/\\u003D/gi, "=")
        .replace(/\\u003d/gi, "=")
        .replace(/\\\//g, "/")
        .replace(/^\s*["']+|["']+\s*$/g, "")
        .trim();
}

function httpUrl(s) {
    return /^https?:\/\//i.test(cleanUrl(s));
}

function hlsUrl(s) {
    return /\.m3u8(?:$|[?#])/i.test(cleanUrl(s));
}

function mediaUrl(s) {
    return /\.(?:mp4|m4v|mov|webm)(?:$|[?#])/i.test(cleanUrl(s));
}

function normalizeUrl(s, base) {
    s = cleanUrl(s);
    if (!s) return "";

    if (s.indexOf("//") === 0)
        return "https:" + s;

    if (/^https?:\/\//i.test(s))
        return s;

    if (base && s.charAt(0) === "/") {
        let m = str(base).match(/^(https?:\/\/[^/]+)/i);
        if (m) return m[1] + s;
    }

    return s;
}

function host(url) {
    let m = str(url).match(/^https?:\/\/([^/]+)/i);
    return m ? m[1].toLowerCase() : "";
}

function videoId(url) {
    let m = str(url).match(VIDEO_RE);
    return m ? m[1] : "";
}

function externalProvider(url) {
    let h = host(url);
    return /(?:youtube\.com|youtu\.be|vimeo\.com)$/i.test(h);
}


/* ============================================================
 * HTTP
 * ========================================================== */

function headers(extra) {
    let h = {
        "User-Agent": UA_DESKTOP,
        "Accept":
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
    };

    if (obj(extra)) {
        for (let k in extra) {
            if (extra[k] !== null && extra[k] !== undefined) {
                let v = str(extra[k]);
                if (v) h[k] = v;
            }
        }
    }

    return h;
}

function GET(url, extra) {
    try {
        if (!url) return "";

        let r = http.GET(url, headers(extra));
        if (!r) return "";

        let body = "";

        try {
            body = r.body;
        } catch (_) {}

        if (!body) {
            try {
                body = r.getBody();
            } catch (_) {}
        }

        body = str(body);

        if (body.length > MAX_HTML)
            body = body.substring(0, MAX_HTML);

        return body;
    } catch (e) {
        debug("GET " + e);
        return "";
    }
}

function loadPage(url) {
    let id = videoId(url);

    let pages = [
        url,
        id ? "https://m.ok.ru/video/" + id : "",
        id ? "https://ok.ru/videoembed/" + id : ""
    ];

    let uas = [UA_DESKTOP, UA_MOBILE];

    for (let i = 0; i < pages.length; i++) {
        if (!pages[i]) continue;

        for (let j = 0; j < uas.length; j++) {
            let body = GET(pages[i], {
                "User-Agent": uas[j],
                "Referer": "https://ok.ru/"
            });

            if (body && body.length > 250) {
                debug("page=" + i + " ua=" + j + " len=" + body.length);
                return body;
            }
        }
    }

    return "";
}


/* ============================================================
 * JSON
 * ========================================================== */

function parseJson(value) {
    if (obj(value)) return value;

    let s = cleanUrl(value);
    if (!s) return null;

    for (let i = 0; i < 7; i++) {
        try {
            return JSON.parse(s);
        } catch (_) {}

        let d = decodeHtml(s);

        if (d !== s) {
            s = d;
            continue;
        }

        if (
            (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")
        ) {
            s = s.substring(1, s.length - 1);
            continue;
        }

        let u = s
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\");

        if (u !== s) {
            s = u;
            continue;
        }

        break;
    }

    return null;
}

function dataOptions(html) {
    let out = [];
    let re = /data-options\s*=\s*["']([\s\S]*?)["']/gi;
    let m;

    while ((m = re.exec(html)) !== null && out.length < 25) {
        let o = parseJson(m[1]);
        if (o) out.push(o);
    }

    return out;
}

function scriptJson(html) {
    let out = [];

    let patterns = [
        /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
        /<script[^>]*>([\s\S]*?\{[\s\S]*?\}[\s\S]*?)<\/script>/gi
    ];

    for (let p = 0; p < patterns.length; p++) {
        let re = patterns[p];
        let m;

        while ((m = re.exec(html)) !== null && out.length < 40) {
            let o = parseJson(m[1]);
            if (o) out.push(o);
        }
    }

    return out;
}

function looksVideo(o) {
    if (!obj(o)) return false;

    let keys = [
        "hls",
        "hlsUrl",
        "hlsManifestUrl",
        "hlsMasterPlaylistUrl",
        "playlistUrl",
        "manifestUrl",
        "videoUrl",
        "video_url",
        "play_url",
        "playUrl",
        "media_url",
        "mediaUrl",
        "source_url",
        "sourceUrl",
        "file",
        "url",
        "play_params",
        "playParams",
        "verificationToken",
        "signdata"
    ];

    for (let i = 0; i < keys.length; i++) {
        try {
            if (o[keys[i]] !== undefined && o[keys[i]] !== null)
                return true;
        } catch (_) {}
    }

    return false;
}

function findVideoObject(root, depth) {
    if (!obj(root) || depth > MAX_DEPTH)
        return null;

    if (looksVideo(root))
        return root;

    if (Array.isArray(root)) {
        for (let i = 0; i < root.length; i++) {
            let r = findVideoObject(root[i], depth + 1);
            if (r) return r;
        }

        return null;
    }

    let preferred = [
        "video",
        "movie",
        "player",
        "flashvars",
        "data",
        "result",
        "response",
        "media",
        "content"
    ];

    try {
        for (let i = 0; i < preferred.length; i++) {
            if (root[preferred[i]] !== undefined) {
                let r = findVideoObject(
                    root[preferred[i]],
                    depth + 1
                );

                if (r) return r;
            }
        }

        for (let k in root) {
            let v = root[k];

            if (obj(v)) {
                let r2 = findVideoObject(v, depth + 1);
                if (r2) return r2;
            } else if (typeof v === "string") {
                let parsed = parseJson(v);

                if (parsed) {
                    let r3 = findVideoObject(parsed, depth + 1);
                    if (r3) return r3;
                }
            }
        }
    } catch (_) {}

    return null;
}

function metadata(html) {
    let d = dataOptions(html);

    for (let i = 0; i < d.length; i++) {
        let r = findVideoObject(d[i], 0);
        if (r) return r;
    }

    let s = scriptJson(html);

    for (let i = 0; i < s.length; i++) {
        let r2 = findVideoObject(s[i], 0);
        if (r2) return r2;
    }

    let attrs = [
        "flashvars",
        "data-player",
        "data-options",
        "data-video",
        "data-json"
    ];

    for (let i = 0; i < attrs.length; i++) {
        let re = new RegExp(
            attrs[i] +
            "\\s*=\\s*(?:\"([\\s\\S]*?)\"|'([\\s\\S]*?)')",
            "i"
        );

        let m = html.match(re);

        if (m) {
            let o = parseJson(m[1] || m[2]);

            if (o)
                return findVideoObject(o, 0) || o;
        }
    }

    return {};
}


/* ============================================================
 * MEDIA EXTRACTION
 * ========================================================== */

function unique(arr, url, base) {
    url = normalizeUrl(url, base);

    if (!httpUrl(url)) return;
    if (arr.indexOf(url) >= 0) return;

    if (arr.length < MAX_SOURCES)
        arr.push(url);
}

function scanUrls(text, hls, mp4, base) {
    text = str(text);
    if (!text) return;

    let normalized = cleanUrl(text);

    let absolute =
        /https?:\/\/[^\s"'<>\\]+/gi;

    let m;

    while ((m = absolute.exec(normalized)) !== null) {
        let u = cleanUrl(m[0]);

        if (hlsUrl(u))
            unique(hls, u, base);
        else if (mediaUrl(u))
            unique(mp4, u, base);
    }

    let protocolRelative =
        /\/\/[^\s"'<>\\]+/g;

    while ((m = protocolRelative.exec(normalized)) !== null) {
        let u2 = "https:" + cleanUrl(m[0]);

        if (hlsUrl(u2))
            unique(hls, u2, base);
        else if (mediaUrl(u2))
            unique(mp4, u2, base);
    }

    if (hlsUrl(normalized))
        unique(hls, normalized, base);

    if (mediaUrl(normalized))
        unique(mp4, normalized, base);
}

function collectHtmlMedia(html, base) {
    let r = {
        hls: [],
        mp4: []
    };

    scanUrls(html, r.hls, r.mp4, base);

    let normalized = decodeHtml(html)
        .replace(/\\\//g, "/")
        .replace(/\\u002f/gi, "/")
        .replace(/\\u003a/gi, ":")
        .replace(/\\u003d/gi, "=");

    scanUrls(normalized, r.hls, r.mp4, base);

    return r;
}

function collectObjectMedia(root, base) {
    let r = {
        hls: [],
        mp4: []
    };

    function walk(v, depth) {
        if (depth > MAX_DEPTH)
            return;

        if (
            r.hls.length + r.mp4.length >=
            MAX_SOURCES
        )
            return;

        if (typeof v === "string") {
            scanUrls(v, r.hls, r.mp4, base);

            let p = parseJson(v);
            if (p)
                walk(p, depth + 1);

            return;
        }

        if (!obj(v))
            return;

        if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++)
                walk(v[i], depth + 1);

            return;
        }

        try {
            for (let k in v) {
                let value = v[k];
                let key = str(k).toLowerCase();

                if (typeof value === "string") {
                    if (
                        /hls|m3u8|playlist|manifest|stream|source|video|media|file|url|play_url|media_url/.test(key) ||
                        hlsUrl(value) ||
                        mediaUrl(value)
                    ) {
                        scanUrls(
                            value,
                            r.hls,
                            r.mp4,
                            base
                        );
                    }
                } else if (obj(value)) {
                    walk(value, depth + 1);
                }

                if (
                    r.hls.length + r.mp4.length >=
                    MAX_SOURCES
                )
                    break;
            }
        } catch (_) {}
    }

    walk(root, 0);

    return r;
}


/* ============================================================
 * METADATA HELPERS
 * ========================================================== */

function first(root, keys) {
    if (!obj(root)) return "";

    for (let i = 0; i < keys.length; i++) {
        try {
            let v = root[keys[i]];

            if (v !== undefined && v !== null) {
                let s = str(v);
                if (s) return s;
            }
        } catch (_) {}
    }

    return "";
}

function recursive(root, keys, depth) {
    if (!obj(root) || depth > MAX_DEPTH)
        return "";

    let direct = first(root, keys);
    if (direct) return direct;

    if (Array.isArray(root)) {
        for (let i = 0; i < root.length; i++) {
            let r = recursive(
                root[i],
                keys,
                depth + 1
            );

            if (r) return r;
        }

        return "";
    }

    try {
        for (let k in root) {
            if (obj(root[k])) {
                let r2 = recursive(
                    root[k],
                    keys,
                    depth + 1
                );

                if (r2) return r2;
            }
        }
    } catch (_) {}

    return "";
}

function title(meta, fallback) {
    return cleanText(
        first(meta, [
            "title",
            "name",
            "movieTitle",
            "videoTitle",
            "caption",
            "contentTitle"
        ])
    ) || fallback;
}

function description(meta) {
    return cleanText(
        recursive(
            meta,
            ["description", "desc", "summary", "text"],
            0
        )
    );
}

function poster(meta, base) {
    return normalizeUrl(
        recursive(
            meta,
            [
                "poster",
                "posterUrl",
                "thumbnail",
                "thumbnailUrl",
                "cover",
                "coverUrl",
                "image",
                "imageUrl",
                "preview",
                "previewUrl"
            ],
            0
        ),
        base
    );
}

function duration(meta) {
    let v = recursive(
        meta,
        [
            "duration",
            "durationMs",
            "durationSec",
            "length",
            "videoDuration",
            "mediaDuration"
        ],
        0
    );

    let n = parseFloat(v);

    if (!isFinite(n) || n <= 0)
        return 0;

    if (n > 1000)
        n /= 1000;

    return Math.round(n);
}

function authorName(meta) {
    return cleanText(
        recursive(
            meta,
            [
                "authorName",
                "ownerName",
                "uploader",
                "userName",
                "username",
                "owner",
                "author"
            ],
            0
        )
    );
}


/* ============================================================
 * CAMPOS ENCONTRADOS EN XUPERTV
 * ========================================================== */

function playParams(meta) {
    return recursive(
        meta,
        ["play_params", "playParams"],
        0
    );
}

function verificationToken(meta) {
    return recursive(
        meta,
        ["verificationToken", "verification_token"],
        0
    );
}

function playlist(meta) {
    return recursive(
        meta,
        ["playlistUrl", "playlist_url"],
        0
    );
}

function signdata(meta) {
    return recursive(
        meta,
        ["signdata", "signature", "sign"],
        0
    );
}

function directPlaylist(meta, base) {
    let candidates = [
        playlist(meta),
        recursive(
            meta,
            [
                "play_url",
                "playUrl",
                "media_url",
                "mediaUrl",
                "source_url",
                "sourceUrl"
            ],
            0
        )
    ];

    for (let i = 0; i < candidates.length; i++) {
        let u = normalizeUrl(candidates[i], base);

        if (hlsUrl(u))
            return u;
    }

    return "";
}


/* ============================================================
 * GRAYJAY SOURCES
 * ========================================================== */

function makeHls(url, dur) {
    try {
        return new HLSSource({
            name: "OK.ru HLS",
            duration: dur || 0,
            url: url
        });
    } catch (_) {
        return null;
    }
}

function makeMp4(url, dur, index) {
    try {
        let container =
            /\.m4v(?:$|[?#])/i.test(url)
                ? "m4v"
                : /\.webm(?:$|[?#])/i.test(url)
                    ? "webm"
                    : "mp4";

        return new VideoUrlSource({
            width: 0,
            height: 0,
            container: container,
            codec: "",
            name: "OK.ru " + container.toUpperCase() +
                " " + (index + 1),
            bitrate: 0,
            duration: dur || 0,
            url: url
        });
    } catch (_) {
        return null;
    }
}

function descriptor(sources) {
    try {
        return new MuxVideoSourceDescriptor({
            isUnMuxed: false,
            videoSources: sources
        });
    } catch (_) {}

    try {
        return new VideoSourceDescriptor(sources);
    } catch (_) {}

    return null;
}

function thumbnails(url) {
    let out = [];

    if (!httpUrl(url))
        return out;

    try {
        out.push(new Thumbnail(url, 0));
    } catch (_) {}

    return out;
}

function makeAuthor(name, id) {
    if (!name) return null;

    try {
        return new PlatformAuthorLink(
            new PlatformID(
                PLATFORM_NAME,
                id || "0",
                PLUGIN_ID
            ),
            name,
            "https://ok.ru/",
            "",
            0
        );
    } catch (_) {}

    return null;
}


/* ============================================================
 * MEDIA SCORING
 * ========================================================== */

function mediaScore(url) {
    let s = str(url).toLowerCase();
    let score = 0;

    if (s.indexOf("master") >= 0)
        score += 10000;

    if (s.indexOf("playlist") >= 0)
        score += 3000;

    if (s.indexOf("m3u8") >= 0)
        score += 2000;

    let m = s.match(
        /(?:^|[^0-9])(2160|1440|1080|900|720|576|540|480|360|240)(?:p)?(?:[^0-9]|$)/
    );

    if (m)
        score += parseInt(m[1], 10);

    return score;
}


/* ============================================================
 * DETAILS
 * ========================================================== */

function buildDetails(meta, pageUrl, id, pageMedia) {
    let t = title(
        meta,
        "OK.ru video " + id
    );

    let d = description(meta);
    let p = poster(meta, pageUrl);
    let dur = duration(meta);
    let author = authorName(meta);

    let objectMedia =
        collectObjectMedia(meta, pageUrl);

    let media = {
        hls: [],
        mp4: []
    };

    for (let i = 0; i < objectMedia.hls.length; i++)
        unique(media.hls, objectMedia.hls[i], pageUrl);

    for (let i = 0; i < pageMedia.hls.length; i++)
        unique(media.hls, pageMedia.hls[i], pageUrl);

    for (let i = 0; i < objectMedia.mp4.length; i++)
        unique(media.mp4, objectMedia.mp4[i], pageUrl);

    for (let i = 0; i < pageMedia.mp4.length; i++)
        unique(media.mp4, pageMedia.mp4[i], pageUrl);

    let xp = directPlaylist(meta, pageUrl);

    if (xp)
        unique(media.hls, xp, pageUrl);

    media.hls.sort(function(a, b) {
        return mediaScore(b) - mediaScore(a);
    });

    media.mp4.sort(function(a, b) {
        return mediaScore(b) - mediaScore(a);
    });

    debug(
        "HLS=" + media.hls.length +
        " MP4=" + media.mp4.length
    );

    debug(
        "Xuper fields: play_params=" +
        (playParams(meta) ? "yes" : "no") +
        " verificationToken=" +
        (verificationToken(meta) ? "yes" : "no") +
        " playlistUrl=" +
        (playlist(meta) ? "yes" : "no") +
        " signdata=" +
        (signdata(meta) ? "yes" : "no")
    );

    let sources = [];

    /*
     * HLS PRIMERO.
     *
     * No usamos RequestModifier aquí.
     * La fuente entregada a GrayJay/Cast es la URL directa.
     */
    for (
        let i = 0;
        i < media.hls.length &&
        sources.length < MAX_SOURCES;
        i++
    ) {
        let s = makeHls(
            media.hls[i],
            dur
        );

        if (s)
            sources.push(s);
    }

    /*
     * MP4 REAL COMO FALLBACK.
     *
     * Se mantiene aunque exista HLS.
     */
    for (
        let j = 0;
        j < media.mp4.length &&
        sources.length < MAX_SOURCES;
        j++
    ) {
        let s2 = makeMp4(
            media.mp4[j],
            dur,
            j
        );

        if (s2)
            sources.push(s2);
    }

    if (sources.length === 0) {
        throw new Error(
            "No playable direct HLS/MP4 source found\n" +
            debugDump()
        );
    }

    let desc = descriptor(sources);

    if (!desc)
        throw new Error(
            "GrayJay VideoSourceDescriptor unavailable"
        );

    let firstHls =
        media.hls.length
            ? makeHls(media.hls[0], dur)
            : null;

    let data = {
        id: new PlatformID(
            PLATFORM_NAME,
            id,
            PLUGIN_ID
        ),

        name: t,

        thumbnails: new Thumbnails(
            thumbnails(p)
        ),

        author: makeAuthor(
            author,
            id
        ),

        uploadDate: 0,

        url: pageUrl,

        duration: dur,

        viewCount: 0,

        isLive: false,

        description: d,

        video: desc,

        dash: null,

        hls: firstHls,

        live: []
    };

    try {
        return new PlatformVideoDetails(data);
    } catch (_) {
        delete data.dash;
        delete data.hls;

        return new PlatformVideoDetails(data);
    }
}


/* ============================================================
 * SEARCH
 * ========================================================== */

function durationText(s) {
    s = cleanText(s);

    let p = s.split(":");

    if (p.length === 2) {
        return (
            (parseInt(p[0], 10) || 0) * 60 +
            (parseInt(p[1], 10) || 0)
        );
    }

    if (p.length === 3) {
        return (
            (parseInt(p[0], 10) || 0) * 3600 +
            (parseInt(p[1], 10) || 0) * 60 +
            (parseInt(p[2], 10) || 0)
        );
    }

    return 0;
}

function searchResults(html) {
    let out = [];

    let re =
        /data-movie-id\s*=\s*["']?(\d+)["']?([\s\S]{0,5000}?)(?=data-movie-id|$)/gi;

    let m;

    while (
        (m = re.exec(html)) !== null &&
        out.length < MAX_SEARCH
    ) {
        let id = m[1];
        let block = m[2] || "";

        let t = "";
        let p = "";
        let d = 0;

        let tm = block.match(
            /(?:data-title|title)\s*=\s*["']([^"']+)["']/i
        );

        if (tm)
            t = cleanText(tm[1]);

        if (!t) {
            tm = block.match(
                /<(?:span|div|a)[^>]*class=["'][^"']*(?:title|name)[^"']*["'][^>]*>([\s\S]{1,500}?)<\/(?:span|div|a)>/i
            );

            if (tm)
                t = cleanText(tm[1]);
        }

        let pm = block.match(
            /(?:poster|thumbnail|data-poster)\s*=\s*["']([^"']+)["']/i
        );

        if (pm)
            p = normalizeUrl(pm[1]);

        let dm = block.match(
            /(?:duration|movie-duration)[^>]*>([^<]{1,30})</i
        );

        if (dm)
            d = durationText(dm[1]);

        out.push({
            id: id,
            title: t || "OK.ru video " + id,
            url: "https://ok.ru/video/" + id,
            thumbnail: p,
            duration: d
        });
    }

    return out;
}

function searchVideo(r) {
    try {
        return new PlatformVideo({
            id: new PlatformID(
                PLATFORM_NAME,
                r.id,
                PLUGIN_ID
            ),

            name: r.title,

            thumbnails: new Thumbnails(
                thumbnails(r.thumbnail)
            ),

            author: null,

            uploadDate: 0,

            url: r.url,

            duration: r.duration || 0,

            viewCount: 0,

            isLive: false
        });
    } catch (_) {
        return null;
    }
}

function searchOk(query) {
    let url =
        SEARCH_URL +
        encodeURIComponent(str(query));

    let html = GET(url);

    if (!html)
        throw new Error(
            "OK.ru search returned no data"
        );

    let raw = searchResults(html);
    let out = [];

    for (let i = 0; i < raw.length; i++) {
        let v = searchVideo(raw[i]);

        if (v)
            out.push(v);
    }

    return new VideoPager(
        out,
        false,
        null
    );
}

function suggestions(query) {
    try {
        let url =
            SEARCH_URL +
            encodeURIComponent(str(query));

        let html = GET(url);

        if (!html)
            return [];

        let raw = searchResults(html);
        let out = [];

        for (
            let i = 0;
            i < raw.length && out.length < 10;
            i++
        ) {
            if (raw[i].title)
                out.push(raw[i].title);
        }

        return out;
    } catch (e) {
        debug("suggestions=" + e);
        return [];
    }
}


/* ============================================================
 * VIDEO DETAILS
 * ========================================================== */

function getDetails(url) {
    resetDebug();

    let id = videoId(url);

    if (!id)
        throw new Error(
            "Invalid OK.ru video URL"
        );

    let canonical =
        "https://ok.ru/video/" + id;

    debug("Video ID=" + id);

    let html = loadPage(canonical);

    if (!html)
        throw new Error(
            "Unable to load OK.ru video page"
        );

    if (externalProvider(html))
        debug("External provider detected");

    let meta = metadata(html);

    let pageMedia =
        collectHtmlMedia(
            html,
            canonical
        );

    /*
     * Incluso si metadata() falla, el escaneo directo
     * del HTML puede encontrar el HLS/MP4.
     */
    return buildDetails(
        meta || {},
        canonical,
        id,
        pageMedia
    );
}


/* ============================================================
 * GRAYJAY BINDINGS
 * ========================================================== */

source.setSettings = function(settings) {
    // No requiere credenciales ni configuración privada.
};

source.enable = function(config) {
    return true;
};

source.disable = function() {};

source.getHome = function() {
    return new VideoPager(
        [],
        false,
        null
    );
};

source.getSearchCapabilities = function() {
    try {
        return new ResultCapabilities(
            ["video"],
            [],
            []
        );
    } catch (_) {
        return {
            supportsSearch: true,
            supportsSuggestions: true
        };
    }
};

source.search = function(
    query,
    type,
    order,
    filters
) {
    return searchOk(query);
};

source.searchSuggestions = function(query) {
    return suggestions(query);
};

source.isVideoDetailsUrl = function(url) {
    return VIDEO_RE.test(str(url));
};

source.isContentDetailsUrl = function(url) {
    return VIDEO_RE.test(str(url));
};

source.getVideoDetails = function(url) {
    return getDetails(url);
};

source.getContentDetails = function(url) {
    return getDetails(url);
};

source.isChannelUrl = function(url) {
    return false;
};

source.getChannelCapabilities = function() {
    try {
        return new ResultCapabilities(
            [],
            [],
            []
        );
    } catch (_) {
        return null;
    }
};
