/* ================================================================
   Screensaver Core — Standalone signal data library
   No dependency on quick_overview.js or quick_overview_core.js.
   Fetches signal data from /jtools_general_api/state and falls back
   to a stock/RDB-only public snapshot before login.
   Screensaver settings remain behind /screensaver_api/settings auth.
   ================================================================ */
(function (window) {
    "use strict";

    // ── Helpers ──

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function asText(value, fallback) {
        var text = value == null ? "" : String(value);
        text = text.replace(/^\s+|\s+$/g, "");
        return text === "" ? (fallback || "N/A") : text;
    }

    function hasValue(value) {
        var text = value == null ? "" : String(value);
        text = text.replace(/^\s+|\s+$/g, "");
        return text !== "" && text !== "N/A";
    }

    function asInt(value) {
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function asFloat(value) {
        var parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    function formatDb(value, units) {
        var parsed = asInt(value);
        if (parsed == null || parsed <= -32768) {
            return "N/A";
        }
        return String(parsed) + (units || "");
    }

    function chooseFirst() {
        var i;
        for (i = 0; i < arguments.length; i += 1) {
            if (hasValue(arguments[i])) {
                return asText(arguments[i], "N/A");
            }
        }
        return "N/A";
    }

    function choosePrimarySignal(stockSignal, field, fallback) {
        var lte = stockSignal && stockSignal.lte ? stockSignal.lte[field] : null;
        var nr5g = stockSignal && stockSignal.nr5g ? stockSignal.nr5g[field] : null;
        return chooseFirst(lte, nr5g, fallback);
    }

    function clamp(val, min, max) {
        return val < min ? min : (val > max ? max : val);
    }

    // ── AT Response Parsers ──

    function parseQnwinfo(summary) {
        var line = "";
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QNWINFO:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) { return {}; }
        var match = line.match(/^\+QNWINFO:\s*"([^"]*)","([^"]*)","([^"]*)",\s*([0-9-]+)/);
        if (!match) { return {}; }
        return {
            access: asText(match[1], ""),
            operatorCode: asText(match[2], ""),
            bandLabel: asText(match[3], ""),
            arfcn: asText(match[4], "")
        };
    }

    function parseQspn(summary) {
        var line = "";
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QSPN:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) { return {}; }
        var match = line.match(/^\+QSPN:\s*"([^"]*)","([^"]*)","([^"]*)",\s*([0-9-]+),\s*"([^"]*)"/);
        if (!match) { return {}; }
        return {
            longName: asText(match[1], ""),
            shortName: asText(match[2], ""),
            displayName: chooseFirst(match[1], match[2]),
            mccmnc: asText(match[5], "")
        };
    }

    function parseCops(summary) {
        var line = "";
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+COPS:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) { return {}; }
        var match = line.match(/^\+COPS:\s*\d+,\d+,"([^"]+)"(?:,\d+)?/);
        if (!match) { return {}; }
        return { operatorName: asText(match[1], "") };
    }

    function parseServingcell(summary) {
        var line = "";
        var item = {};
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QENG:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) { return {}; }
        var parts = line.replace(/^\+QENG:\s*/, "").split(",");
        parts = parts.map(function (part) {
            return String(part || "").replace(/^\s+|\s+$/g, "").replace(/^"|"$/g, "");
        });
        if (parts.length >= 15 && parts[0] === "servingcell") {
            item.state = asText(parts[1], "");
            item.radio = asText(parts[2], "");
            item.duplex = asText(parts[3], "");
            item.mcc = asText(parts[4], "");
            item.mnc = asText(parts[5], "");
            item.cellId = asText(parts[6], "");
            item.pci = asText(parts[7], "");

            var radio = String(item.radio).toUpperCase();
            if (radio.indexOf("LTE") !== -1) {
                item.arfcn = asText(parts[8], "");
                item.band = hasValue(parts[9]) ? "LTE BAND " + parts[9] : "";
                item.tac = asText(parts[12], "");
                item.rsrp = asText(parts[13], "");
                item.rsrq = asText(parts[14], "");
                item.sinr = parts.length > 16 ? asText(parts[16], "") : "";
            } else {
                item.tac = asText(parts[8], "");
                item.arfcn = asText(parts[9], "");
                item.band = hasValue(parts[10]) ? "NR5G BAND " + parts[10] : "";
                item.nrDlBw = asText(parts[11], "");
                item.rsrp = asText(parts[12], "");
                item.rsrq = asText(parts[13], "");
                item.sinr = asText(parts[14], "");
            }
        }
        return item;
    }

    // ── Signal Grade ──

    var DEFAULTS = {
        rsrpMin: -120, rsrpMax: -70,
        rsrqMin: -20,  rsrqMax: -5,
        sinrMin: -5,   sinrMax: 30,
        timeout: 45000,
        weightRsrp: 50,
        weightSinr: 30,
        weightRsrq: 20
    };

    function normalizeSettings(input) {
        var s = input || {};
        var weightRsrp = asInt(s.weightRsrp);
        var weightSinr = asInt(s.weightSinr);
        var weightRsrq = asInt(s.weightRsrq);
        var weightsAreValid = weightRsrp != null && weightSinr != null && weightRsrq != null &&
            weightRsrp >= 0 && weightSinr >= 0 && weightRsrq >= 0 &&
            weightRsrp <= 100 && weightSinr <= 100 && weightRsrq <= 100 &&
            (weightRsrp + weightSinr + weightRsrq) === 100;

        return {
            enabled:       s.enabled !== false,
            timeout:       asInt(s.timeout) > 0 ? asInt(s.timeout) : DEFAULTS.timeout,
            dismissMode:   s.dismissMode || "movement",
            weightRsrp:    weightsAreValid ? weightRsrp : DEFAULTS.weightRsrp,
            weightSinr:    weightsAreValid ? weightSinr : DEFAULTS.weightSinr,
            weightRsrq:    weightsAreValid ? weightRsrq : DEFAULTS.weightRsrq
        };
    }

    function readSettingsFromStorage() {
        try {
            var raw = window.localStorage.getItem("jtoolsScreensaverSettings");
            if (raw) { return normalizeSettings(JSON.parse(raw)); }
            // Migration: try reading from old QO key on first use
            var oldRaw = window.localStorage.getItem("jtoolsQoSettings");
            if (oldRaw) {
                var migrated = normalizeSettings(JSON.parse(oldRaw));
                writeSettingsToStorage(migrated);
                return migrated;
            }
        } catch (e) { /* ignore */ }
        return normalizeSettings({});
    }

    function writeSettingsToStorage(settings) {
        try {
            window.localStorage.setItem("jtoolsScreensaverSettings", JSON.stringify(settings));
        } catch (e) { /* ignore */ }
    }

    var cachedSettings = readSettingsFromStorage();

    function getSettings() {
        return normalizeSettings(cachedSettings);
    }

    function loadSettings(callback) {
        if (!window.XMLHttpRequest) {
            if (callback) { callback(getSettings()); }
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/screensaver_api/settings", true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) { return; }
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response && response.ok && response.settings) {
                        cachedSettings = normalizeSettings(response.settings);
                        writeSettingsToStorage(cachedSettings);
                    }
                } catch (e) { /* ignore */ }
            }
            if (callback) { callback(getSettings()); }
        };
        xhr.send();
    }

    function normalizeMetric(value, min, max) {
        var v = asFloat(value);
        if (v == null) { return null; }
        return clamp((v - min) / (max - min) * 100, 0, 100);
    }

    function calcSignalGrade(rsrp, rsrq, sinr) {
        var settings = getSettings();
        var rsrpScore = normalizeMetric(rsrp, DEFAULTS.rsrpMin, DEFAULTS.rsrpMax);
        var rsrqScore = normalizeMetric(rsrq, DEFAULTS.rsrqMin, DEFAULTS.rsrqMax);
        var sinrScore = normalizeMetric(sinr, DEFAULTS.sinrMin, DEFAULTS.sinrMax);

        var totalWeight = 0;
        var weightedSum = 0;

        if (rsrpScore != null) {
            weightedSum += rsrpScore * settings.weightRsrp;
            totalWeight += settings.weightRsrp;
        }
        if (sinrScore != null) {
            weightedSum += sinrScore * settings.weightSinr;
            totalWeight += settings.weightSinr;
        }
        if (rsrqScore != null) {
            weightedSum += rsrqScore * settings.weightRsrq;
            totalWeight += settings.weightRsrq;
        }

        if (totalWeight === 0) { return null; }
        return Math.round(weightedSum / totalWeight);
    }

    // ── Signal Quality Classification ──

    function getSignalClass(rsrp) {
        var v = asInt(rsrp);
        if (v == null) { return "ss-sig-na"; }
        if (v > -80)  { return "ss-sig-excellent"; }
        if (v > -90)  { return "ss-sig-good"; }
        if (v > -100) { return "ss-sig-fair"; }
        if (v > -110) { return "ss-sig-poor"; }
        return "ss-sig-vpoor";
    }

    function getGradeClass(grade) {
        if (grade == null) { return "ss-sig-na"; }
        if (grade >= 80) { return "ss-sig-excellent"; }
        if (grade >= 60) { return "ss-sig-good"; }
        if (grade >= 40) { return "ss-sig-fair"; }
        if (grade >= 20) { return "ss-sig-poor"; }
        return "ss-sig-vpoor";
    }

    function getRsrqClass(rsrq) {
        var v = asInt(rsrq);
        if (v == null) { return "ss-sig-na"; }
        if (v > -8)  { return "ss-sig-excellent"; }
        if (v > -11) { return "ss-sig-good"; }
        if (v > -15) { return "ss-sig-fair"; }
        if (v > -18) { return "ss-sig-poor"; }
        return "ss-sig-vpoor";
    }

    function getSinrClass(sinr) {
        var v = asInt(sinr);
        if (v == null) { return "ss-sig-na"; }
        if (v > 20)  { return "ss-sig-excellent"; }
        if (v > 13)  { return "ss-sig-good"; }
        if (v > 5)   { return "ss-sig-fair"; }
        if (v > 0)   { return "ss-sig-poor"; }
        return "ss-sig-vpoor";
    }

    function getCarrierClass(provider) {
        var p = String(provider || "").toLowerCase();
        if (p.indexOf("t-mobile") !== -1 || p.indexOf("tmobile") !== -1) { return "ss-carrier-tmobile"; }
        if (p.indexOf("at&t") !== -1 || p.indexOf("att") !== -1) { return "ss-carrier-att"; }
        if (p.indexOf("verizon") !== -1) { return "ss-carrier-verizon"; }
        return "";
    }

    function getRatClass(rat) {
        var r = String(rat || "").toUpperCase();
        if (r.indexOf("NSA") !== -1 || r === "5GNSA") { return "ss-rat-nsa"; }
        if (r.indexOf("SA") !== -1 || r === "5GSA") { return "ss-rat-sa"; }
        if (r.indexOf("NR") !== -1 || r.indexOf("5G") !== -1) { return "ss-rat-nr"; }
        return "ss-rat-lte";
    }

    function getBandToneClass(carrier) {
        var c = carrier || {};
        var rat = String(c.rat || "").toUpperCase();
        var band = String(c.band || c.band_label || "").toLowerCase().replace(/[^0-9]/g, "");
        if (!band) { return ""; }
        if (rat === "NR5G") { return "ss-band-n" + band; }
        if (rat === "LTE") { return "ss-band-b" + band; }
        return "";
    }

    function getRatLabel(qnwinfo, servingcell) {
        var access = String(qnwinfo.access || "").toUpperCase();
        if (access.indexOf("NR5G") !== -1) {
            if (servingcell.radio && servingcell.radio.toUpperCase() === "NR5G-NSA") {
                return "5G NSA";
            }
            return "NR5G";
        }
        if (access.indexOf("LTE") !== -1) { return "LTE"; }
        if (access.indexOf("WCDMA") !== -1) { return "WCDMA"; }
        if (access) { return access; }
        if (servingcell.radio) { return servingcell.radio; }
        return "N/A";
    }

    function getTempClass(tempText) {
        var match = String(tempText || "").match(/(\d+)/);
        if (!match) { return ""; }
        var val = parseInt(match[1], 10);
        if (val >= 55) { return "ss-temp-red"; }
        if (val >= 48) { return "ss-temp-orange"; }
        if (val >= 40) { return "ss-temp-yellow"; }
        return "ss-temp-green";
    }

    // ── Phone-style Signal Bars ──

    function buildPhoneBars(grade) {
        var v = (typeof grade === "number") ? grade : null;
        var level = 0;
        if (v != null) {
            if (v >= 80) { level = 5; }
            else if (v >= 60) { level = 4; }
            else if (v >= 40) { level = 3; }
            else if (v >= 20) { level = 2; }
            else if (v > 0) { level = 1; }
        }
        var bars = [];
        for (var i = 1; i <= 5; i++) {
            bars.push("<span class='ss-bar" + (i <= level ? " is-on" : "") + "' style='height:" + (i * 20) + "%'></span>");
        }
        return bars.join("");
    }

    // ── Gradient Bar ──

    function buildGradientBar(grade) {
        var pct = grade != null ? clamp(grade, 0, 100) : 0;
        var show = grade != null;
        return [
            "<div class='ss-gradient-bar'>",
            "<div class='ss-gradient-track'></div>",
            show ? "<div class='ss-gradient-marker' style='left:" + pct + "%'></div>" : "",
            "</div>"
        ].join("");
    }

    // ── Band Formatting ──

    function formatBandwidthMhzSuffix(raw) {
        if (raw == null || raw === "") { return ""; }
        var s = String(raw).trim();
        if (!s) { return ""; }
        s = s.replace(/\s*(?:MHz|MHZ|mhz)\s*$/i, "").trim();
        if (!s) { return ""; }
        return " " + s + "MHz";
    }

    function formatBandShort(carriers) {
        if (!carriers || !carriers.length) { return ""; }
        return carriers.map(function (c) {
            var rat = String(c.rat || "").toUpperCase();
            var band = c.band || "";
            if (rat === "NR5G") { return "n" + band; }
            if (rat === "LTE") { return "B" + band; }
            return band;
        }).join("+");
    }

    // ── Band Change Tracking ──

    var bandChangeHistory = [];
    var lastBandKey = null;

    function loadBandHistory() {
        try {
            var raw = window.localStorage.getItem("jtoolsSsBandHistory");
            if (raw) {
                bandChangeHistory = JSON.parse(raw);
                if (!Array.isArray(bandChangeHistory)) { bandChangeHistory = []; }
            }
        } catch (e) { bandChangeHistory = []; }
    }

    function saveBandHistory() {
        try {
            window.localStorage.setItem("jtoolsSsBandHistory", JSON.stringify(bandChangeHistory));
        } catch (e) { /* ignore */ }
    }

    function trackBandChange(carriers, qnwinfo) {
        var currentKey = formatBandShort(carriers);
        if (!currentKey && qnwinfo && qnwinfo.bandLabel) {
            currentKey = qnwinfo.bandLabel;
        }
        if (!currentKey) { currentKey = "No service"; }

        if (lastBandKey === null) {
            lastBandKey = currentKey;
            if (bandChangeHistory.length === 0) {
                var now = new Date();
                var timeStr = String(now.getHours()).replace(/^(\d)$/, "0$1") + ":" +
                              String(now.getMinutes()).replace(/^(\d)$/, "0$1");
                bandChangeHistory.unshift({
                    time: timeStr,
                    from: "",
                    to: currentKey,
                    type: "initial"
                });
                saveBandHistory();
            }
            return null;
        }

        if (currentKey === lastBandKey) { return null; }

        var now2 = new Date();
        var timeStr2 = String(now2.getHours()).replace(/^(\d)$/, "0$1") + ":" +
                       String(now2.getMinutes()).replace(/^(\d)$/, "0$1");
        var entry = {
            time: timeStr2,
            from: lastBandKey,
            to: currentKey,
            type: currentKey === "No service" ? "lost" : (lastBandKey === "No service" ? "restored" : "changed")
        };
        lastBandKey = currentKey;
        bandChangeHistory.unshift(entry);
        if (bandChangeHistory.length > 5) { bandChangeHistory.length = 5; }
        saveBandHistory();
        return entry;
    }

    function formatBandChangeText(entry) {
        if (!entry) { return ""; }
        if (entry.type === "initial") {
            return entry.time + " \u2014 Initial connection: " + entry.to;
        }
        if (entry.type === "lost") {
            return entry.time + " \u2014 Lost service";
        }
        if (entry.type === "restored") {
            return entry.time + " \u2014 Service restored: " + entry.to;
        }
        return entry.time + " \u2014 Switched from " + entry.from + " \u2192 " + entry.to;
    }

    // ── Data Fetch ──

    var _pollCount = 0;
    var CROSSCHECK_EVERY = 5;
    var _lastCrosscheck = null;

    function fetchData(callback) {
        _pollCount++;
        var url = "/jtools_general_api/state";
        if (_pollCount % CROSSCHECK_EVERY === 1) {
            url += "?crosscheck=1";
        }
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 25000;
        xhr.ontimeout = function () {
            callback(null, "timeout");
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) { return; }
            if (xhr.status === 401 || xhr.status === 403) {
                fetchPublicData(callback);
                return;
            }
            if (xhr.status !== 200) {
                callback(null, "HTTP " + xhr.status);
                return;
            }
            try {
                var resp = JSON.parse(xhr.responseText);
                if (!resp || !resp.ok) {
                    callback(null, (resp && resp.error) || "API error");
                    return;
                }
                callback(processResponse(resp), null);
            } catch (e) {
                callback(null, e.message);
            }
        };
        xhr.send();
    }

    function fetchPublicData(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/public_screensaver_api/state", true);
        xhr.timeout = 15000;
        xhr.ontimeout = function () {
            callback(null, "timeout");
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) { return; }
            if (xhr.status !== 200) {
                callback(null, "HTTP " + xhr.status);
                return;
            }
            try {
                var resp = JSON.parse(xhr.responseText);
                if (!resp || !resp.ok) {
                    callback(null, (resp && resp.error) || "API error");
                    return;
                }
                callback(processPublicResponse(resp), null);
            } catch (e) {
                callback(null, e.message);
            }
        };
        xhr.send();
    }

    function processPublicResponse(resp) {
        var provider = asText(resp.provider, "N/A");
        var rat = asText(resp.rat, "N/A");
        var rsrp = asText(resp.rsrp, "");
        var rsrq = asText(resp.rsrq, "");
        var sinr = asText(resp.sinr, "");
        var cqi = asText(resp.cqi, "");
        var bandLabel = asText(resp.band_label, "");
        var carriers = Array.isArray(resp.carriers) ? resp.carriers : [];
        var grade = calcSignalGrade(rsrp, rsrq, sinr);

        return {
            provider: provider,
            rat: rat,
            ratClass: getRatClass(rat),
            rsrp: rsrp,
            rsrq: rsrq,
            sinr: sinr,
            rsrpText: formatDb(rsrp, " dBm"),
            rsrqText: formatDb(rsrq, " dB"),
            sinrText: formatDb(sinr, " dB"),
            cqi: cqi,
            cqiText: asText(cqi, "N/A"),
            signalClass: getSignalClass(rsrp),
            rsrqClass: getRsrqClass(rsrq),
            sinrClass: getSinrClass(sinr),
            carrierClass: getCarrierClass(provider),
            grade: grade,
            gradeClass: getGradeClass(grade),
            gradeText: grade != null ? grade + "%" : "N/A",
            pci: asText(resp.pci),
            cellId: asText(resp.cell_id),
            arfcn: asText(resp.arfcn),
            bandLabel: bandLabel,
            carriers: carriers,
            bandShort: formatBandShort(carriers),
            temp: "Log in for full detail",
            tempClass: "",
            qnwinfo: { bandLabel: bandLabel },
            servingcell: {},
            signalCrosscheck: null,
            raw: resp,
            publicNote: asText(resp.public_note, ""),
            limitedPublicData: resp.limited_public_data === true
        };
    }

    function processResponse(resp) {
        if (resp.signal_crosscheck) { _lastCrosscheck = resp.signal_crosscheck; }
        var qnwinfo = parseQnwinfo(resp.qnwinfo_summary || "");
        var qspn = parseQspn(resp.qspn_summary || "");
        var cops = parseCops(resp.cops_summary || "");
        var servingcell = parseServingcell(resp.qeng_summary || "");
        var carriers = resp.carriers || [];
        var stockSignal = resp.stock_signal || {};
        var provider = chooseFirst(qspn.displayName, cops.operatorName, resp.rdb_network || "");
        var rat = getRatLabel(qnwinfo, servingcell);
        if (rat === "N/A" && carriers.length) {
            var hasNr = false;
            var hasLte = false;
            var ci;
            for (ci = 0; ci < carriers.length; ci += 1) {
                var cr = String(carriers[ci].rat || "").toUpperCase();
                if (cr === "NR5G") { hasNr = true; }
                if (cr === "LTE") { hasLte = true; }
            }
            if (hasNr && hasLte) { rat = "5G NSA"; }
            else if (hasNr) { rat = "NR5G"; }
            else if (hasLte) { rat = "LTE"; }
        }
        var rsrp = choosePrimarySignal(stockSignal, "rsrp", servingcell.rsrp || null);
        var rsrq = choosePrimarySignal(stockSignal, "rsrq", servingcell.rsrq || null);
        var sinr = choosePrimarySignal(stockSignal, "snr", servingcell.sinr || null);
        var cqi = choosePrimarySignal(stockSignal, "cqi", null);
        var pci = servingcell.pci || null;
        var cellId = servingcell.cellId || null;
        var arfcn = chooseFirst(qnwinfo.arfcn, servingcell.arfcn);
        var bandLabel = chooseFirst(qnwinfo.bandLabel, servingcell.band);
        var grade = calcSignalGrade(rsrp, rsrq, sinr);
        var temp = resp.primary_temperature_text || "N/A";

        return {
            provider: provider,
            rat: rat,
            ratClass: getRatClass(rat),
            rsrp: rsrp,
            rsrq: rsrq,
            sinr: sinr,
            rsrpText: formatDb(rsrp, " dBm"),
            rsrqText: formatDb(rsrq, " dB"),
            sinrText: formatDb(sinr, " dB"),
            cqi: cqi,
            cqiText: asText(cqi, "N/A"),
            signalClass: getSignalClass(rsrp),
            rsrqClass: getRsrqClass(rsrq),
            sinrClass: getSinrClass(sinr),
            carrierClass: getCarrierClass(provider),
            grade: grade,
            gradeClass: getGradeClass(grade),
            gradeText: grade != null ? grade + "%" : "N/A",
            pci: asText(pci),
            cellId: asText(cellId),
            arfcn: arfcn,
            bandLabel: bandLabel,
            carriers: carriers,
            bandShort: formatBandShort(carriers),
            temp: temp,
            tempClass: getTempClass(temp),
            qnwinfo: qnwinfo,
            servingcell: servingcell,
            signalCrosscheck: _lastCrosscheck,
            raw: resp
        };
    }

    // ── Init ──

    loadBandHistory();

    // ── Public API ──

    window.JtoolsScreensaverCore = {
        fetchData: fetchData,
        calcSignalGrade: calcSignalGrade,
        getSignalClass: getSignalClass,
        getRsrqClass: getRsrqClass,
        getSinrClass: getSinrClass,
        getCarrierClass: getCarrierClass,
        getGradeClass: getGradeClass,
        getRatClass: getRatClass,
        getBandToneClass: getBandToneClass,
        buildPhoneBars: buildPhoneBars,
        buildGradientBar: buildGradientBar,
        formatBandwidthMhzSuffix: formatBandwidthMhzSuffix,
        formatBandShort: formatBandShort,
        trackBandChange: trackBandChange,
        formatBandChangeText: formatBandChangeText,
        getTempClass: getTempClass,
        loadSettings: loadSettings,
        getSettings: getSettings,
        processPublicResponse: processPublicResponse,
        escapeHtml: escapeHtml,
        asText: asText,
        hasValue: hasValue,
        asInt: asInt,
        formatDb: formatDb,
        DEFAULTS: DEFAULTS
    };

})(window);
