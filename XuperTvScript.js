/*
 * GrayJay - XuperTv API Source (FUSIÓN FINAL)
 *
 * Reconstrucción basada en el APK XuperTv N0F4C3 v4.34.7.
 * Verificado contra smali_classes3/db/y1.smali y los beans de
 * mobile/com/requestframe/utils/bean y .../response.
 *
 * Esta es la versión definitiva: parte de la base "v2 DEX-CONFIRMED"
 * (endpoints y beans verificados directamente contra el smali, incluyendo
 * descubrimiento dinámico de servidores SLB y navegación por columnas/canales)
 * e incorpora el único elemento útil de la variante "FINAL" que faltaba aquí:
 * el campo macAddr en GetItemDataBean.
 *
 * ENDPOINTS CONFIRMADOS (db/y1.smali):
 *   POST api/portalCore/v10/startPlayVOD      -> StartPlayVODResult
 *   POST api/portalCore/v3/searchByName       -> SearchByNameResult   (NO existe blSearchByName)
 *   POST api/portalCore/blSearchByContent     -> SearchByContentData  (buscar por contentId, no por texto)
 *   POST api/portalCore/v3/searchByContent    -> SearchByContentData
 *   POST api/portalCore/v4/getItemData        -> GetItemDataResult
 *   POST api/portalCore/v3/getColumnContents  -> GetColumnContentsResult (subcolumnas)
 *   POST api/portalCore/v3/getShelveData      -> ShelveDataBean (assetList/channelList reales de una columna)
 *   POST api/portalCore/getHome               -> GetHomeResult
 *   POST api/portalCore/v9/getAuthInfo        -> GetAuthInfoResult
 *   POST api/portalCore/v15/getSlbInfo        -> GetSlbInfoBeanResult (NO existe v14)
 *   POST api/portalCore/config/get            -> ConfigResult
 *
 * BEANS DE PETICIÓN CONFIRMADOS:
 *   SearchByNameBean    : userToken, userId, portalCode, columnId(Integer),
 *                         value, type, pageSize(Integer), pageNum(Integer), filter
 *   GetSlbInfoBean      : appParams, appVer, encMediaSupported(int), hasPay, lang,
 *                         liveCodeList(List), pipFlag, portalCode, reserve1, type,
 *                         userId, userIdentity, userToken
 *   GetHomeBean         : freeVersion, freeVodCode, homePageCode, portalCode,
 *                         userId, userToken, version
 *   GetItemDataBean     : contentId, language, macAddr, portalCode, sortType, type,
 *                         userId, userToken
 *   StartPlayVODBean    : authType, columnId(Integer), contentId, episodeNumberList([I),
 *                         portalCode, seriesContentId, startTime(int), type, userId, userToken
 *   GetColumnContentsBean: columnId(Integer), numDisplay, pageNum, pageSize, portalCode,
 *                         specialFlag, userId, userToken
 *   ShelveDataRequestBean: columnId(int), columnType, encryptVersion, numDisplay,
 *                         pageNum, pageSize, portalCode, userId, userToken
 *
 * RESPUESTAS CONFIRMADAS:
 *   SearchByNameResult.data      -> SearchData { searchItemList: [ SearchItem { itemList: [ SearchShelveItem/AssetData ] } ], totalSize }
 *   GetHomeResult.data           -> GetHomeData { recommendList: [ HomeRecommend { assetList: [HomeAsset], channelList: [Channel], code, columnId } ] }
 *   StartPlayVODResult.data      -> StartPlayVODData { episodeList: [ EpisodeList { episodeNumber, programContentId, totalMovieList: [ Movie { licenseList: [LicenseData] } ] } ] }
 *   GetSlbInfoBeanResult.data    -> GetSlbInfoBeanResultData { cdn_list: [ CdnListBeanResult { main_addr, spared_addr, main_addr_mark, spared_addr_mark, url_list: [CdnUrl] } ] }
 *   ShelveListData               -> { assetList: [AssetData], channelList: [Channel], slbInfo: SlbInfo { main_slb_addr, spared_slb_addr, ... } }
 *
 * IMPORTANTE:
 * El APK obtiene PORTAL_MAIN/PORTAL_BACKUP en runtime (DomainCache + DoH dns.google.com)
 * y no deja un dominio público fijo en el DEX. Por eso portal_base_url es configurable
 * y NO se inventa un servidor. Si tienes una URL capturada (por ejemplo de getHome
 * o getSlbInfo de tu app funcionando), pégala en portal_base_url y el plugin
 * resolverá lo demás vía v15/getSlbInfo.
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

// Descubrimiento dinámico de servidores XuperTv (SLB).
// Se mantiene separado del portal configurado para conservar el fallback.
let _slbDiscoveryAttempted = false;
let _discoveredMain = "";
let _discoveredBackup = "";
let _discoveredMainToken = "";
let _discoveredBackupToken = "";


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
        _discoveredMain,
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
        _discoveredBackup,
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

function macAddr() {
    return firstNonEmpty(
        getSetting("mac_addr", ""),
        getSetting("macAddr", "")
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


/* ============================================================
 * XuperTv SLB / server discovery
 *
 * RECONSTRUIDO DESDE EL APK v4.34.7:
 * GetSlbInfoBean contiene estos campos en la petición:
 *   appParams, appVer, hasPay, userIdentity, portalCode, type,
 *   lang, pipFlag, encMediaSupported, liveCodeList, reserve1,
 *   userId, userToken.
 *
 * Confirmado en db/y1.smali: solo existe /v15/getSlbInfo (no hay v14).
 * La respuesta real es GetSlbInfoBeanResult.data.cdn_list[] con:
 *   main_addr, spared_addr, main_addr_mark, spared_addr_mark, url_list[].
 * El objeto SlbInfo (main_slb_addr/spared_slb_addr) aparece dentro de
 * ShelveListData (respuesta de v3/getShelveData) y también se parsea.
 *
 * No se inventa una firma ni se usa el token como query/header sin
 * evidencia. Los tokens se conservan solamente para diagnóstico/futuras
 * mejoras del flujo que los necesiten.
 * ============================================================ */

function resetSlbDiscovery() {
    _slbDiscoveryAttempted = false;
    _discoveredMain = "";
    _discoveredBackup = "";
    _discoveredMainToken = "";
    _discoveredBackupToken = "";
}

function normalizeServerAddress(value) {
    if (!nonEmpty(value)) return "";

    let s = String(value).trim();
    if (!s) return "";

    // Algunos backends pueden devolver JSON/string escapado.
    try {
        if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
            s = s.substring(1, s.length - 1);
        }
    } catch (_) {}

    s = s.replace(/\\\//g, "/").trim();

    if (!/^https?:\/\//i.test(s)) {
        s = "https://" + s.replace(/^\/\//, "");
    }

    // El SLB puede devolver host, host:puerto o una URL con path.
    // No eliminamos un path útil salvo cuando claramente es otro endpoint API.
    s = s.replace(/\/+$/, "");
    s = s.replace(/\/api\/portalCore\/.*$/i, "");

    try {
        // Validación básica de URL. No se usa URL() para maximizar
        // compatibilidad con el runtime JS de GrayJay.
        if (!/^https?:\/\/[^\s/]+(?::\d+)?(?:\/.*)?$/i.test(s)) {
            return "";
        }
    } catch (_) {}

    return s;
}

function slbAppParams() {
    // La APK construye appParams como JSON y al menos incluye deviceTag.
    // Permitimos además un valor explícito si el usuario/runtime lo conoce.
    const explicit = firstNonEmpty(
        getSetting("slb_app_params", ""),
        getSetting("app_params", ""),
        getSetting("appParams", "")
    );
    if (explicit) return explicit;

    const deviceTag = firstNonEmpty(
        getSetting("device_tag", ""),
        getSetting("deviceTag", "")
    );

    try {
        return JSON.stringify({
            deviceTag: deviceTag
        });
    } catch (_) {
        return '{"deviceTag":""}';
    }
}

function slbLiveCodeList() {
    const value = getSetting("live_code_list", getSetting("liveCodeList", null));

    if (Array.isArray(value)) return value;

    if (nonEmpty(value)) {
        const parsed = safeJson(value);
        if (Array.isArray(parsed)) return parsed;

        return String(value)
            .split(",")
            .map(function(v) { return String(v).trim(); })
            .filter(function(v) { return v !== ""; });
    }

    return [];
}

function buildGetSlbInfoBody() {
    return {
        appParams: slbAppParams(),
        appVer: firstNonEmpty(
            getSetting("app_ver", ""),
            getSetting("appVer", ""),
            getSetting("version", ""),
            DEFAULT_VERSION
        ),
        hasPay: firstNonEmpty(
            getSetting("has_pay", ""),
            getSetting("hasPay", "")
        ),
        userIdentity: firstNonEmpty(
            getSetting("user_identity", ""),
            getSetting("userIdentity", "")
        ),
        portalCode: portalCode(),
        type: firstNonEmpty(
            getSetting("slb_type", ""),
            getSetting("type", "")
        ),
        lang: firstNonEmpty(
            getSetting("lang", ""),
            getSetting("language", ""),
            ""
        ),
        pipFlag: firstNonEmpty(
            getSetting("pip_flag", ""),
            getSetting("pipFlag", "")
        ),
        encMediaSupported: numberOr(
            getSetting("enc_media_supported", getSetting("encMediaSupported", 0)),
            0
        ),
        liveCodeList: slbLiveCodeList(),
        reserve1: firstNonEmpty(
            getSetting("reserve1", ""),
            getSetting("slb_reserve1", "")
        ),
        userId: userId(),
        userToken: userToken()
    };
}

function collectSlbInfo(value, out, depth, seen) {
    if (value == null || depth > 12 || !out) return;

    if (typeof value === "string") {
        const parsed = safeJson(value);
        if (parsed) collectSlbInfo(parsed, out, depth + 1, seen);
        return;
    }

    if (typeof value !== "object") return;

    if (seen) {
        try {
            if (seen.indexOf(value) >= 0) return;
            seen.push(value);
        } catch (_) {}
    }

    // SlbInfo (viene en ShelveListData): main_slb_addr / spared_slb_addr
    const main = firstNonEmpty(
        value.main_slb_addr,
        value.mainSlbAddr,
        value.main_slb_address,
        value.mainSlbAddress
    );

    const mainToken = firstNonEmpty(
        value.main_slb_token,
        value.mainSlbToken
    );

    const backup = firstNonEmpty(
        value.spared_slb_addr,
        value.sparedSlbAddr,
        value.spare_slb_addr,
        value.spareSlbAddr,
        value.spared_addr,
        value.sparedAddr
    );

    const backupToken = firstNonEmpty(
        value.spared_slb_token,
        value.sparedSlbToken,
        value.spare_slb_token,
        value.spareSlbToken
    );

    if (main || backup) {
        if (!out.main && main) out.main = normalizeServerAddress(main);
        if (!out.backup && backup) out.backup = normalizeServerAddress(backup);
        if (!out.mainToken && mainToken) out.mainToken = String(mainToken);
        if (!out.backupToken && backupToken) out.backupToken = String(backupToken);
    }

    // GetSlbInfoBeanResultData.cdn_list[] (CdnListBeanResult):
    //   main_addr, spared_addr, main_addr_mark, spared_addr_mark, url_list[]
    if (!out.main && value.main_addr) {
        const m = normalizeServerAddress(value.main_addr);
        if (m) {
            out.main = m;
            const mark = firstNonEmpty(value.main_addr_mark, value.mainAddrMark);
            if (mark) out.mainToken = String(mark);
        }
    }
    if (!out.backup && value.spared_addr) {
        const b = normalizeServerAddress(value.spared_addr);
        if (b) {
            out.backup = b;
            const mark = firstNonEmpty(value.spared_addr_mark, value.sparedAddrMark);
            if (mark) out.backupToken = String(mark);
        }
    }

    // url_list[] (CdnUrl { url, tag }): primer url utilizable como main
    if (Array.isArray(value.url_list) && !out.main) {
        for (let i = 0; i < value.url_list.length && !out.main; i++) {
            const u = value.url_list[i];
            const cand = firstNonEmpty(
                u && (u.url || u.main_url || u.address || u.host),
                typeof u === "string" ? u : ""
            );
            const n = normalizeServerAddress(cand);
            if (n) out.main = n;
        }
    }

    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
        const v = value[keys[i]];
        if (v && typeof v === "object") {
            collectSlbInfo(v, out, depth + 1, seen);
        } else if (typeof v === "string" && /^(?:data|result|response|slb|slbInfo|cdn_list)$/i.test(keys[i])) {
            collectSlbInfo(v, out, depth + 1, seen);
        }
    }
}

function discoverSlbServers(force) {
    if (_slbDiscoveryAttempted && !force) {
        return {
            main: _discoveredMain,
            backup: _discoveredBackup,
            mainToken: _discoveredMainToken,
            backupToken: _discoveredBackupToken
        };
    }

    _slbDiscoveryAttempted = true;

    // Necesitamos al menos un bootstrap. La APK obtiene este primer dominio
    // desde DomainCache/DNS/configuración; el JS no inventa uno.
    const bootstrapMain = firstNonEmpty(
        getSetting("portal_base_url", ""),
        getSetting("portalBaseUrl", ""),
        DEFAULT_PORTAL_BASE_URL
    );
    const bootstrapBackup = firstNonEmpty(
        getSetting("portal_backup_url", ""),
        getSetting("portalBackupUrl", ""),
        DEFAULT_BACKUP_BASE_URL
    );

    const bases = [];
    [bootstrapMain, bootstrapBackup].forEach(function(v) {
        const n = normalizeServerAddress(v);
        if (n && bases.indexOf(n) < 0) bases.push(n);
    });

    if (!bases.length) {
        dbg("SLB: no hay bootstrap portal_base_url/portal_backup_url");
        return {
            main: "",
            backup: "",
            mainToken: "",
            backupToken: ""
        };
    }

    const body = buildGetSlbInfoBody();
    let lastError = null;
    let result = null;
    let usedVersion = "";

    for (let b = 0; b < bases.length && !result; b++) {
        const base = bases[b];

        // Confirmado en db/y1.smali: solo existe api/portalCore/v15/getSlbInfo
        const versions = ["v15"];

        for (let i = 0; i < versions.length; i++) {
            const path = "/api/portalCore/" + versions[i] + "/getSlbInfo";
            try {
                dbg("SLB " + versions[i] + " -> " + base);
                result = httpPostJson(apiUrl(base, path), body);
                usedVersion = versions[i];
                break;
            } catch (e) {
                lastError = e;
                dbg("SLB " + versions[i] + " falló: " + e);
            }
        }
    }

    if (!result) {
        dbg("SLB discovery falló: " + (lastError || "sin respuesta"));
        return {
            main: "",
            backup: "",
            mainToken: "",
            backupToken: ""
        };
    }

    const found = {
        main: "",
        backup: "",
        mainToken: "",
        backupToken: ""
    };

    collectSlbInfo(result, found, 0, []);

    _discoveredMain = found.main || "";
    _discoveredBackup = found.backup || "";
    _discoveredMainToken = found.mainToken || "";
    _discoveredBackupToken = found.backupToken || "";

    dbg("SLB " + usedVersion +
        " main=" + (_discoveredMain ? "yes" : "no") +
        " backup=" + (_discoveredBackup ? "yes" : "no") +
        " mainToken=" + (_discoveredMainToken ? "yes" : "no") +
        " backupToken=" + (_discoveredBackupToken ? "yes" : "no"));

    return found;
}

function ensureSlbServers() {
    try {
        discoverSlbServers(false);
    } catch (e) {
        dbg("ensureSlbServers: " + e);
    }
}

function postWithBackup(path, body) {
    // Descubre servidores una sola vez por ciclo de enable().
    // Si el descubrimiento falla, se conservan los portales configurados.
    ensureSlbServers();

    const configuredMain = firstNonEmpty(
        getSetting("portal_base_url", ""),
        getSetting("portalBaseUrl", ""),
        DEFAULT_PORTAL_BASE_URL
    );
    const configuredBackup = firstNonEmpty(
        getSetting("portal_backup_url", ""),
        getSetting("portalBackupUrl", ""),
        DEFAULT_BACKUP_BASE_URL
    );

    const candidates = [];
    [
        _discoveredMain,
        _discoveredBackup,
        configuredMain,
        configuredBackup
    ].forEach(function(v) {
        const n = normalizeServerAddress(v);
        if (n && candidates.indexOf(n) < 0) candidates.push(n);
    });

    let firstError = null;

    for (let i = 0; i < candidates.length; i++) {
        try {
            return httpPostJson(apiUrl(candidates[i], path), body);
        } catch (e) {
            firstError = firstError || e;
            dbg("Servidor " + (i + 1) + " falló: " + e);
        }
    }

    throw firstError || new ScriptException(
        "XuperTv",
        "No se encontró un servidor XuperTv. Configure un portal inicial para permitir el descubrimiento SLB."
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

    const direct = firstNonEmpty(
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
    if (direct) return direct;

    // posterList es List<PosterList/Poster> con fileUrl (confirmado en el DEX)
    const pl = value.posterList;
    if (pl != null) {
        if (typeof pl === "string") return pl;

        if (Array.isArray(pl)) {
            for (let i = 0; i < pl.length; i++) {
                const item = pl[i];

                if (typeof item === "string" && nonEmpty(item)) {
                    return item;
                }

                if (item && typeof item === "object") {
                    const u = firstNonEmpty(
                        item.fileUrl,
                        item.url,
                        item.posterUrl,
                        item.imageUrl,
                        item.src
                    );
                    if (u) return u;
                }
            }
        }
    }

    return "";
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
        columnId: null,
        value: text(query),
        type: firstNonEmpty(
            getSetting("search_type", ""),
            getSetting("searchType", "")
        ),
        pageSize: numberOr(SEARCH_PAGE_SIZE, 30),
        pageNum: numberOr(page, 1),
        filter: ""
    };

    // Confirmado en db/y1.smali: api/portalCore/v3/searchByName
    return postWithBackup(
        "/api/portalCore/v3/searchByName",
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
        // macAddr aparece en GetItemDataBean; se envía si está configurado.
        macAddr: macAddr()
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

function getShelveData(columnId, type, page) {
    const body = {
        columnId: numberOr(columnId, 0),
        columnType: firstNonEmpty(type, ""),
        encryptVersion: numberOr(
            getSetting("encrypt_version", getSetting("encryptVersion", null)),
            null
        ),
        numDisplay: numberOr(
            getSetting("num_display", getSetting("numDisplay", null)),
            null
        ),
        pageNum: numberOr(page, 1),
        pageSize: SEARCH_PAGE_SIZE,
        portalCode: portalCode(),
        userId: userId(),
        userToken: userToken()
    };

    // Confirmado en db/y1.smali: api/portalCore/v3/getShelveData
    // Respuesta ShelveDataBean.data = ShelveListData { assetList, channelList, slbInfo, version }
    return postWithBackup(
        "/api/portalCore/v3/getShelveData",
        body
    );
}

function getHome() {
    const body = {
        freeVersion: firstNonEmpty(
            getSetting("free_version", ""),
            getSetting("freeVersion", "")
        ),
        freeVodCode: firstNonEmpty(
            getSetting("free_vod_code", ""),
            getSetting("freeVodCode", "")
        ),
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
        video: muxDescriptor(videoSources),
        dash: null,
        hls: null,
        live: null
    });
}

function muxDescriptor(videoSources) {
    const value = {
        isUnMuxed: false,
        videoSources: videoSources
    };

    try {
        if (typeof MuxVideoSourceDescriptor !== "undefined") {
            return new MuxVideoSourceDescriptor(value);
        }
    } catch (_) {}

    return {
        plugin_type: "MuxVideoSourceDescriptor",
        isUnMuxed: false,
        videoSources: videoSources
    };
}

source.enable = function(config) {
    _config = config || {};
    _settings = (_config && _config.settings) || {};
    resetSlbDiscovery();

    dbg("enabled");
};

source.disable = function() {
    _settings = {};
    _config = {};
    resetSlbDiscovery();
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
    // xuper://column/<columnId> — navegación por columnas vía v3/getShelveData
    return /^xuper:\/\/column\//i.test(text(url));
};

function parseColumnId(url) {
    if (!nonEmpty(url)) return "";

    const s = String(url);

    let m = s.match(/^xuper:\/\/column\/([^?#]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]);

    m = s.match(/[?&]columnId=([^&#]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]);

    return "";
}

source.getChannel = function(url) {
    const columnId = parseColumnId(url);

    if (!columnId) {
        throw new ScriptException(
            "XuperTv",
            "No se pudo identificar columnId en la URL."
        );
    }

    let name = "Columna " + columnId;

    const q = /[?&]name=([^&#]+)/i.exec(String(url));
    if (q && q[1]) {
        try {
            name = decodeURIComponent(q[1]);
        } catch (_) {
            name = q[1];
        }
    }

    try {
        return new Channel({
            id: new PlatformID(
                PLATFORM_NAME,
                "column:" + columnId,
                PLUGIN_ID
            ),
            name: name,
            url: "xuper://column/" + encodeURIComponent(columnId),
            avatarUrl: ""
        });
    } catch (_) {
        return {
            id: new PlatformID(
                PLATFORM_NAME,
                "column:" + columnId,
                PLUGIN_ID
            ),
            name: name,
            url: "xuper://column/" + encodeURIComponent(columnId),
            avatarUrl: ""
        };
    }
};

source.getChannelVideos = function(
    url,
    type,
    order,
    filters
) {
    const columnId = parseColumnId(url);

    if (!columnId) {
        throw new ScriptException(
            "XuperTv",
            "URL de canal sin columnId."
        );
    }

    const columnType = /[?&]columnType=([^&#]+)/i.exec(String(url));
    const typeValue = columnType && columnType[1]
        ? decodeURIComponent(columnType[1])
        : "";

    const result = getShelveData(columnId, typeValue, 1);
    const videos = parseSearchResults(result);

    return new VideoPager(
        videos,
        videos.length >= SEARCH_PAGE_SIZE,
        {
            columnId: columnId,
            type: typeValue,
            page: 1
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
            searchByName: "/api/portalCore/v3/searchByName",
            searchByContent: "/api/portalCore/blSearchByContent",
            getItemData: "/api/portalCore/v4/getItemData",
            getColumnContents: "/api/portalCore/v3/getColumnContents",
            getShelveData: "/api/portalCore/v3/getShelveData",
            getHome: "/api/portalCore/getHome",
            getAuthInfo: "/api/portalCore/v9/getAuthInfo",
            getSlbInfoV15: "/api/portalCore/v15/getSlbInfo"
        },
        configured: {
            portalBase: !!portalBase(),
            backupBase: !!backupBase(),
            userId: !!userId(),
            userToken: !!userToken(),
            portalCode: !!portalCode(),
            macAddr: !!macAddr()
        },
        slb: {
            discoveryAttempted: _slbDiscoveryAttempted,
            discoveredMain: !!_discoveredMain,
            discoveredBackup: !!_discoveredBackup,
            mainToken: !!_discoveredMainToken,
            backupToken: !!_discoveredBackupToken
        }
    };
};
