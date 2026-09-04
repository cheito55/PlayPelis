/*
 * GrayJay - XuperTv API Source FINAL
 *
 * Reconstrucción basada en el APK XuperTv N0F4C3 v4.34.7.
 *
 * CONFIRMADO EN EL DEX:
 *   POST /api/portalCore/v10/startPlayVOD
 *   POST /api/portalCore/blSearchByName
 *   POST /api/portalCore/blSearchByContent
 *   POST /api/portalCore/v4/getItemData
 *   POST /api/portalCore/v3/getColumnContents
 *   POST /api/portalCore/getHome
 *   POST /api/portalCore/v9/getAuthInfo
 *   POST /api/portalCore/v14/getSlbInfo
 *   POST /api/portalCore/v15/getSlbInfo
 *
 * StartPlayVODBean confirmado:
 *   userToken
 *   userId
 *   portalCode
 *   columnId
 *   contentId
 *   seriesContentId
 *   type
 *   startTime
 *   authType
 *   episodeNumberList
 *
 * StartPlayVODResult confirmado:
 *   returnCode
 *   errorMessage
 *   data.episodeList[]
 *
 * episodeList item confirmado:
 *   episodeNumber
 *   programContentId
 *   totalMovieList[]
 *
 * totalMovieList item confirmado:
 *   quality
 *   movieList[]
 *
 * MovieList confirmado:
 *   audioInfo
 *   audioType
 *   bitRateType
 *   contentId
 *   encodeFormat
 *   licenseList
 *   quality
 *   screenFormat
 *   terminalType
 *   type
 *   videoFormat
 *   videoType
 *
 * LicenseData confirmado:
 *   license
 *   tag
 *
 * IMPORTANTE:
 * El APK obtiene PORTAL_MAIN/PORTAL_BACKUP desde DomainCache/DNS/configuración
 * y no deja un dominio público fijo en el DEX. Por eso XUPER_PORTAL_BASE_URL
 * se deja configurable y NO se inventa un servidor.
 */

const PLATFORM_NAME = "XuperTv";
const PLUGIN_ID = "xuper-tv-api-final-4347";

const DEFAULT_PORTAL_BASE_URL = "";
const DEFAULT_BACKUP_BASE_URL = "";

const DEFAULT_USER_ID = "";
const DEFAULT_USER_TOKEN = "";
const DEFAULT_PORTAL_CODE = "";
const DEFAULT_AUTH_TYPE = "";
const DEFAULT_HOME_PAGE_CODE = "";
const DEFAULT_VERSION = "";

const SEARCH_PAGE_SIZE = 30;
const MAX_RESULTS = 40;
const MAX_SOURCES = 30;
const REQUEST_TIMEOUT_MS = 15000;

let _config = {};
let _settings = {};

function dbg(msg) {
    try {
        if (_settings && _settings.debug === true) {
            console.log("[XuperTv] " + String(msg));
        }
    } catch (_) {}
}

function sleep(ms) {
    try {
        if (typeof Utilities !== "undefined" && Utilities.sleep) {
            Utilities.sleep(ms);
        }
    } catch (_) {}
}

function text(v) {
    return v == null ? "" : String(v);
}

function nonEmpty(v) {
    return v != null && String(v).trim() !== "";
}

function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
        if (nonEmpty(arguments[i])) return String(arguments[i]).trim();
    }
    return "";
}

function numberOr(v, fallback) {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
}

function safeJson(value) {
    if (value == null) return null;
    if (typeof value === "object") return value;

    try {
        return JSON.parse(String(value));
    } catch (_) {}

    try {
        const s = String(value)
            .replace(/^\uFEFF/, "")
            .trim();
        return JSON.parse(s);
    } catch (_) {}

    return null;
}

function getSetting(name, fallback) {
    try {
        if (_settings && nonEmpty(_settings[name])) {
            return _settings[name];
        }
    } catch (_) {}

    try {
        if (_config && _config.settings && nonEmpty(_config.settings[name])) {
            return _config.settings[name];
        }
    } catch (_) {}

    return fallback;
}

function portalBase() {
    const v = firstNonEmpty(
        getSetting("portal_base_url", ""),
        getSetting("portalBaseUrl", ""),
        DEFAULT_PORTAL_BASE_URL
    );

    if (!v) return "";

    return v
        .replace(/\/+$/, "")
        .replace(/\/api\/.*$/i, "");
}

function backupBase() {
    const v = firstNonEmpty(
        getSetting("portal_backup_url", ""),
        getSetting("portalBackupUrl", ""),
        DEFAULT_BACKUP_BASE_URL
    );

    if (!v) return "";

    return v
        .replace(/\/+$/, "")
        .replace(/\/api\/.*$/i, "");
}

function userId() {
    return firstNonEmpty(
        getSetting("user_id", ""),
        getSetting("userId", ""),
        DEFAULT_USER_ID
    );
}

function userToken() {
    return firstNonEmpty(
        getSetting("user_token", ""),
        getSetting("userToken", ""),
        DEFAULT_USER_TOKEN
    );
}

function portalCode() {
    return firstNonEmpty(
        getSetting("portal_code", ""),
        getSetting("portalCode", ""),
        DEFAULT_PORTAL_CODE
    );
}

function authType() {
    return firstNonEmpty(
        getSetting("auth_type", ""),
        getSetting("authType", ""),
        DEFAULT_AUTH_TYPE
    );
}

function apiUrl(base, path) {
    if (!base) return "";
    return base.replace(/\/+$/, "") + path;
}

function httpPostJson(url, body, extraHeaders) {
    if (!url) {
        throw new ScriptException(
            "XuperTv",
            "No se configuró portal_base_url. El APK obtiene PORTAL_MAIN dinámicamente."
        );
    }

    const headers = Object.assign({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent":
            "Xuper/4.34.7 (Android)"
    }, extraHeaders || {});

    dbg("POST " + url);

    let response = null;

    try {
        if (typeof http !== "undefined" && http.post) {
            response = http.post(url, JSON.stringify(body), headers);
        } else if (typeof Http !== "undefined" && Http.post) {
            response = Http.post(url, JSON.stringify(body), headers);
        } else if (typeof Http !== "undefined" && Http.request) {
            response = Http.request({
                method: "POST",
                url: url,
                headers: headers,
                body: JSON.stringify(body)
            });
        }
    } catch (e) {
        dbg("POST error: " + e);
        response = null;
    }

    if (response == null) {
        throw new ScriptException(
            "XuperTv",
            "La API Http de GrayJay no permitió la petición POST."
        );
    }

    let raw = response;

    try {
        if (typeof response.body === "string") raw = response.body;
        else if (typeof response.data === "string") raw = response.data;
        else if (typeof response.text === "string") raw = response.text;
    } catch (_) {}

    const parsed = safeJson(raw);
    if (parsed != null) return parsed;

    if (typeof raw === "object") return raw;

    throw new ScriptException(
        "XuperTv",
        "La API devolvió una respuesta que no es JSON."
    );
}

function postWithBackup(path, body) {
    const main = portalBase();
    const backup = backupBase();

    let firstError = null;

    if (main) {
        try {
            return httpPostJson(apiUrl(main, path), body);
        } catch (e) {
            firstError = e;
            dbg("Main falló: " + e);
        }
    }

    if (backup && backup !== main) {
        try {
            return httpPostJson(apiUrl(backup, path), body);
        } catch (e) {
            firstError = firstError || e;
            dbg("Backup falló: " + e);
        }
    }

    throw firstError || new ScriptException(
        "XuperTv",
        "No hay servidor PORTAL_MAIN/PORTAL_BACKUP configurado."
    );
}

/*
 * Los tres valores siguientes corresponden a los accesores que el APK
 * usa al construir StartPlayVODBean:
 *
 * P() -> userToken
 * O() -> userId
 * N() -> portalCode
 *
 * El resto procede de los parámetros del flujo VOD.
 */
function buildStartPlayVODBody(contentId, options) {
    options = options || {};

    return {
        userToken: userToken(),
        userId: userId(),
        portalCode: portalCode(),

        columnId:
            options.columnId === null ||
            options.columnId === undefined ||
            options.columnId === ""
                ? null
                : numberOr(options.columnId, null),

        contentId: text(contentId),

        seriesContentId: firstNonEmpty(
            options.seriesContentId,
            contentId
        ),

        type: firstNonEmpty(
            options.type,
            getSetting("vod_type", "")
        ),

        startTime: numberOr(
            options.startTime,
            0
        ),

        authType: firstNonEmpty(
            options.authType,
            authType()
        ),

        episodeNumberList:
            Array.isArray(options.episodeNumberList)
                ? options.episodeNumberList
                : []
    };
}

function startPlayVOD(contentId, options) {
    const body = buildStartPlayVODBody(contentId, options);

    const result = postWithBackup(
        "/api/portalCore/v10/startPlayVOD",
        body
    );

    return result;
}

function getResultData(result) {
    if (!result) return null;

    if (result.data != null) return result.data;

    if (result.result != null) {
        if (result.result.data != null) return result.result.data;
        return result.result;
    }

    return result;
}

function resultError(result) {
    if (!result) return "";

    return firstNonEmpty(
        result.errorMessage,
        result.error_msg,
        result.message,
        result.msg,
        result.error,
        getResultData(result) && getResultData(result).errorMessage
    );
}

/*
 * Extrae license/URL del árbol StartPlayVOD.
 *
 * El APK llama a:
 *   StartPlayVODResultData.getEpisodeList()
 *   item.getTotalMovieList()
 *   movie.getLicenseList()
 *   LicenseData.getLicense()
 *
 * La cadena license es el dato que interesa al reproductor.
 */
function collectLicenseObjects(value, out, depth, seen) {
    if (depth > 12 || value == null || out.length >= MAX_SOURCES) {
        return;
    }

    if (typeof value === "string") {
        if (isPlayableUrl(value)) {
            out.push({
                license: value,
                tag: ""
            });
        }
        return;
    }

    if (typeof value !== "object") return;

    if (seen) {
        try {
            if (seen.indexOf(value) >= 0) return;
            seen.push(value);
        } catch (_) {}
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length && out.length < MAX_SOURCES; i++) {
            collectLicenseObjects(value[i], out, depth + 1, seen);
        }
        return;
    }

    const directLicense = firstNonEmpty(
        value.license,
        value.playlistUrl,
        value.play_url,
        value.playUrl,
        value.media_url,
        value.mediaUrl,
        value.source_url,
        value.sourceUrl,
        value.url
    );

    if (directLicense && isPlayableUrl(directLicense)) {
        out.push({
            license: directLicense,
            tag: firstNonEmpty(
                value.tag,
                value.quality,
                value.type
            )
        });
    }

    const keys = [
        "episodeList",
        "totalMovieList",
        "movieList",
        "licenseList",
        "data",
        "result",
        "items",
        "list"
    ];

    for (let i = 0; i < keys.length && out.length < MAX_SOURCES; i++) {
        const k = keys[i];
        if (value[k] != null) {
            collectLicenseObjects(
                value[k],
                out,
                depth + 1,
                seen
            );
        }
    }
}

function isPlayableUrl(url) {
    if (!nonEmpty(url)) return false;

    const s = String(url).trim();

    if (!/^https?:\/\//i.test(s)) return false;

    return (
        /\.m3u8(?:$|[?#])/i.test(s) ||
        /\.mp4(?:$|[?#])/i.test(s) ||
        /\.mkv(?:$|[?#])/i.test(s) ||
        /[?&](?:url|play_url|playlist|stream)=/i.test(s) ||
        /\/(?:playlist|play|stream|media)\b/i.test(s)
    );
}

function classifyUrl(url) {
    if (/\.m3u8(?:$|[?#])/i.test(url)) return "hls";
    if (/\.mp4(?:$|[?#])/i.test(url)) return "mp4";
    return "other";
}

function cleanDuplicateSources(items) {
    const result = [];
    const seen = {};

    for (let i = 0; i < items.length && result.length < MAX_SOURCES; i++) {
        const item = items[i];
        if (!item || !nonEmpty(item.license)) continue;

        const url = String(item.license).trim();
        if (seen[url]) continue;

        seen[url] = true;
        result.push({
            license: url,
            tag: text(item.tag)
        });
    }

    result.sort(function(a, b) {
        const aa = classifyUrl(a.license);
        const bb = classifyUrl(b.license);

        if (aa === "hls" && bb !== "hls") return -1;
        if (aa !== "hls" && bb === "hls") return 1;

        return 0;
    });

    return result;
}

function buildVideoSources(licenses, duration) {
    const sources = [];
    const seen = {};

    for (let i = 0; i < licenses.length; i++) {
        const item = licenses[i];
        const url = item.license;

        if (!isPlayableUrl(url) || seen[url]) continue;

        seen[url] = true;

        const kind = classifyUrl(url);
        const tag = item.tag || (kind === "hls" ? "HLS" : "Xuper");

        if (kind === "hls") {
            try {
                sources.push(
                    new HLSSource({
                        name: tag,
                        duration: numberOr(duration, 0),
                        url: url,
                        priority: true
                    })
                );
            } catch (_) {
                sources.push(
                    new HLSSource({
                        name: tag,
                        duration: numberOr(duration, 0),
                        url: url
                    })
                );
            }
        } else {
            sources.push(
                new VideoUrlSource({
                    width: 0,
                    height: 0,
                    container: "video/mp4",
                    codec: "",
                    name: tag,
                    bitrate: 0,
                    duration: numberOr(duration, 0),
                    url: url
                })
            );
        }

        if (sources.length >= MAX_SOURCES) break;
    }

    return sources;
}

function extractName(value) {
    if (!value || typeof value !== "object") return "";

    return firstNonEmpty(
        value.name,
        value.title,
        value.programName,
        value.videoName,
        value.contentName,
        value.seriesName,
        value.movieName
    );
}

function extractId(value) {
    if (!value || typeof value !== "object") return "";

    return firstNonEmpty(
        value.contentId,
        value.programContentId,
        value.id,
        value.videoId,
        value.seriesContentId
    );
}

function extractThumbnail(value) {
    if (!value || typeof value !== "object") return "";

    return firstNonEmpty(
        value.thumbnail,
        value.thumbnailUrl,
        value.image,
        value.imageUrl,
        value.poster,
        value.posterUrl,
        value.cover,
        value.coverUrl,
        value.pic,
        value.picUrl
    );
}

function extractDescription(value) {
    if (!value || typeof value !== "object") return "";

    return firstNonEmpty(
        value.description,
        value.desc,
        value.introduction,
        value.summary,
        value.content
    );
}

function findVideoObjects(value, out, depth, seen) {
    if (
        value == null ||
        depth > 10 ||
        out.length >= MAX_RESULTS
    ) {
        return;
    }

    if (typeof value !== "object") return;

    if (seen) {
        try {
            if (seen.indexOf(value) >= 0) return;
            seen.push(value);
        } catch (_) {}
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length && out.length < MAX_RESULTS; i++) {
            findVideoObjects(value[i], out, depth + 1, seen);
        }
        return;
    }

    const id = extractId(value);
    const name = extractName(value);

    if (id && name) {
        out.push(value);
    }

    const keys = Object.keys(value);

    for (let i = 0; i < keys.length && out.length < MAX_RESULTS; i++) {
        const k = keys[i];

        if (
            k === "userToken" ||
            k === "verificationToken" ||
            k === "signdata"
        ) {
            continue;
        }

        const v = value[k];

        if (v && typeof v === "object") {
            findVideoObjects(v, out, depth + 1, seen);
        }
    }
}

function makePlatformVideo(item) {
    const id = extractId(item);
    const name = extractName(item) || ("XuperTv " + id);
    const thumbnail = extractThumbnail(item);

    let thumbs = [];

    if (thumbnail) {
        thumbs.push(new Thumbnail(thumbnail, 720));
    }

    let pid = new PlatformID(
        PLATFORM_NAME,
        text(id),
        PLUGIN_ID
    );

    let author = new PlatformAuthorLink(
        new PlatformID(
            PLATFORM_NAME,
            "",
            PLUGIN_ID
        ),
        "XuperTv",
        "",
        ""
    );

    return new PlatformVideo({
        id: pid,
        name: name,
        thumbnails: new Thumbnails(thumbs),
        author: author,
        uploadDate: numberOr(
            item && (
                item.uploadDate ||
                item.publishTime ||
                item.createTime
            ),
            0
        ),
        url: "xuper://" + encodeURIComponent(id),
        duration: numberOr(
            item && (
                item.duration ||
                item.durationSecond ||
                item.playDuration
            ),
            0
        ),
        viewCount: numberOr(
            item && (
                item.viewCount ||
                item.views
            ),
            -1
        ),
        isLive: false
    });
}

function parseSearchResults(result) {
    const objects = [];
    findVideoObjects(result, objects, 0, []);

    const videos = [];
    const seen = {};

    for (let i = 0; i < objects.length && videos.length < MAX_RESULTS; i++) {
        const id = extractId(objects[i]);
        if (!id || seen[id]) continue;

        seen[id] = true;
        videos.push(makePlatformVideo(objects[i]));
    }

    return videos;
}

function searchByName(query, page) {
    const body = {
        userToken: userToken(),
        userId: userId(),
        portalCode: portalCode(),
        columnId: "",
        value: text(query),
        type: firstNonEmpty(
            getSetting("search_type", ""),
            getSetting("searchType", "")
        ),
        pageSize: SEARCH_PAGE_SIZE,
        pageNum: numberOr(page, 1),
        filter: ""
    };

    return postWithBackup(
        "/api/portalCore/blSearchByName",
        body
    );
}

function getItemData(contentId, type) {
    const body = {
        userToken: userToken(),
        userId: userId(),
        portalCode: portalCode(),
        contentId: text(contentId),
        type: firstNonEmpty(type, ""),
        sortType: "",
        language: "",
        macAddr: ""
    };

    return postWithBackup(
        "/api/portalCore/v4/getItemData",
        body
    );
}

function getColumnContents(columnId, page) {
    const body = {
        userToken: userToken(),
        userId: userId(),
        portalCode: portalCode(),
        columnId: text(columnId),
        pageSize: SEARCH_PAGE_SIZE,
        pageNum: numberOr(page, 1)
    };

    return postWithBackup(
        "/api/portalCore/v3/getColumnContents",
        body
    );
}

function getHome() {
    const body = {
        userId: userId(),
        userToken: userToken(),
        portalCode: portalCode(),
        homePageCode: firstNonEmpty(
            getSetting("home_page_code", ""),
            getSetting("homePageCode", ""),
            DEFAULT_HOME_PAGE_CODE
        ),
        version: firstNonEmpty(
            getSetting("version", ""),
            DEFAULT_VERSION
        )
    };

    return postWithBackup(
        "/api/portalCore/getHome",
        body
    );
}

function parseXuperId(url) {
    if (!nonEmpty(url)) return "";

    const s = String(url);

    if (/^xuper:\/\//i.test(s)) {
        return decodeURIComponent(
            s.replace(/^xuper:\/\//i, "")
        );
    }

    const patterns = [
        /[?&](?:contentId|id|videoId)=([^&#]+)/i,
        /\/(?:vod|video|content)\/([^/?#]+)/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const m = s.match(patterns[i]);
        if (m && m[1]) {
            try {
                return decodeURIComponent(m[1]);
            } catch (_) {
                return m[1];
            }
        }
    }

    return "";
}

function parseOptionsFromUrl(url) {
    const options = {};

    if (!nonEmpty(url)) return options;

    const s = String(url);

    function param(name) {
        const re = new RegExp(
            "[?&]" + name + "=([^&#]*)",
            "i"
        );
        const m = s.match(re);
        if (!m) return "";
        try {
            return decodeURIComponent(m[1]);
        } catch (_) {
            return m[1];
        }
    }

    options.type = param("type");
    options.seriesContentId = param("seriesContentId");
    options.columnId = param("columnId");
    options.authType = param("authType");
    options.startTime = param("startTime");

    const ep = param("episode");
    if (ep !== "") {
        const n = Number(ep);
        if (isFinite(n)) options.episodeNumberList = [n];
    }

    return options;
}

function getDurationFromResult(result) {
    const data = getResultData(result);

    if (!data) return 0;

    return numberOr(
        data.duration ||
        data.durationSecond ||
        data.playDuration ||
        0,
        0
    );
}

function resolveVOD(contentId, options) {
    const result = startPlayVOD(contentId, options);

    const error = resultError(result);
    if (error) {
        dbg("startPlayVOD error: " + error);
    }

    const licenses = [];
    collectLicenseObjects(
        result,
        licenses,
        0,
        []
    );

    const unique = cleanDuplicateSources(licenses);

    if (!unique.length) {
        throw new ScriptException(
            "XuperTv",
            error ||
            "startPlayVOD respondió sin una playlist/license reproducible."
        );
    }

    return {
        result: result,
        sources: unique
    };
}

function detailsFromResolved(contentId, result, sources) {
    const data = getResultData(result) || {};

    let title = firstNonEmpty(
        data.name,
        data.title,
        data.videoName,
        data.contentName,
        "XuperTv " + contentId
    );

    let description = extractDescription(data);

    const thumbs = [];
    const thumb = extractThumbnail(data);

    if (thumb) {
        thumbs.push(new Thumbnail(thumb, 720));
    }

    const videoSources = buildVideoSources(
        sources,
        getDurationFromResult(result)
    );

    if (!videoSources.length) {
        throw new ScriptException(
            "XuperTv",
            "No se encontró una fuente de vídeo compatible."
        );
    }

    return new PlatformVideoDetails({
        id: new PlatformID(
            PLATFORM_NAME,
            text(contentId),
            PLUGIN_ID
        ),
        name: title,
        thumbnails: new Thumbnails(thumbs),
        author: new PlatformAuthorLink(
            new PlatformID(
                PLATFORM_NAME,
                "",
                PLUGIN_ID
            ),
            "XuperTv",
            "",
            ""
        ),
        uploadDate: 0,
        url: "xuper://" + encodeURIComponent(contentId),
        duration: getDurationFromResult(result),
        viewCount: -1,
        isLive: false,
        description: description,
        video: new MuxVideoSourceDescriptor({
            isUnMuxed: false,
            videoSources: videoSources
        }),
        dash: null,
        hls: null,
        live: null
    });
}

source.enable = function(config) {
    _config = config || {};
    _settings = (_config && _config.settings) || {};

    dbg("enabled");
};

source.disable = function() {
    _settings = {};
    _config = {};
};

source.searchSuggestions = function(query) {
    return nonEmpty(query) ? [String(query)] : [];
};

source.getSearchCapabilities = function() {
    try {
        return new ResultCapabilities(
            ["video"],
            [],
            []
        );
    } catch (_) {
        return new ResultCapabilities([], [], []);
    }
};

source.search = function(query, type, order, filters) {
    const q = text(query).trim();

    if (!q) {
        return new VideoPager([], false, {
            query: q,
            page: 1
        });
    }

    const result = searchByName(q, 1);
    const videos = parseSearchResults(result);

    return new VideoPager(
        videos,
        videos.length >= SEARCH_PAGE_SIZE,
        {
            query: q,
            page: 1
        }
    );
};

source.isVideoDetailsUrl = function(url) {
    return /^xuper:\/\//i.test(text(url)) ||
        /(?:contentId|videoId|\/vod\/|\/video\/|\/content\/)/i.test(
            text(url)
        );
};

source.getVideoDetails = function(url) {
    const contentId = parseXuperId(url);

    if (!contentId) {
        throw new ScriptException(
            "XuperTv",
            "No se pudo identificar contentId en la URL Xuper."
        );
    }

    const options = parseOptionsFromUrl(url);

    /*
     * La reproducción real del APK pasa por startPlayVOD.
     * No usamos playlistUrl inventada ni una URL externa.
     */
    const resolved = resolveVOD(
        contentId,
        options
    );

    return detailsFromResolved(
        contentId,
        resolved.result,
        resolved.sources
    );
};

source.getHome = function() {
    try {
        const result = getHome();
        const videos = parseSearchResults(result);

        return new VideoPager(
            videos,
            videos.length >= SEARCH_PAGE_SIZE,
            {
                type: "home",
                page: 1
            }
        );
    } catch (e) {
        dbg("getHome falló: " + e);

        return new VideoPager(
            [],
            false,
            {
                type: "home",
                page: 1
            }
        );
    }
};

source.getComments = function(url, continuationToken) {
    return new CommentPager(
        [],
        false,
        {
            url: url,
            continuationToken: continuationToken
        }
    );
};

source.getSubComments = function(comment) {
    return new CommentPager(
        [],
        false,
        {
            comment: comment
        }
    );
};

source.isChannelUrl = function(url) {
    return false;
};

source.getChannel = function(url) {
    return null;
};

source.getChannelVideos = function(
    url,
    type,
    order,
    filters
) {
    return new VideoPager(
        [],
        false,
        {
            url: url
        }
    );
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

/*
 * Diagnóstico interno opcional.
 * No imprime tokens ni contraseñas.
 */
source.getDiagnostics = function() {
    return {
        platform: PLATFORM_NAME,
        api: {
            startPlayVOD: "/api/portalCore/v10/startPlayVOD",
            searchByName: "/api/portalCore/blSearchByName",
            searchByContent: "/api/portalCore/blSearchByContent",
            getItemData: "/api/portalCore/v4/getItemData",
            getColumnContents: "/api/portalCore/v3/getColumnContents",
            getHome: "/api/portalCore/getHome",
            getAuthInfo: "/api/portalCore/v9/getAuthInfo",
            getSlbInfoV14: "/api/portalCore/v14/getSlbInfo",
            getSlbInfoV15: "/api/portalCore/v15/getSlbInfo"
        },
        configured: {
            portalBase: !!portalBase(),
            backupBase: !!backupBase(),
            userId: !!userId(),
            userToken: !!userToken(),
            portalCode: !!portalCode()
        }
    };
};
