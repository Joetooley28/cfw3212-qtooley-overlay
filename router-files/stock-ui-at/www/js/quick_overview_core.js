(function (window) {
    "use strict";

    // ── Helpers (inlined from general_dashboard_core.js for self-containment) ──

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
            item.tac = asText(parts[8], "");
            item.arfcn = asText(parts[9], "");
            item.band = hasValue(parts[10]) ? "NR5G BAND " + parts[10] : "";
            item.nrDlBw = asText(parts[11], "");
            item.rsrp = asText(parts[12], "");
            item.rsrq = asText(parts[13], "");
            item.sinr = asText(parts[14], "");
        }
        return item;
    }

    // ── Signal Grade ──

    var DEFAULTS = {
        rsrpMin: -120, rsrpMax: -70,
        rsrqMin: -20,  rsrqMax: -5,
        sinrMin: -5,   sinrMax: 30,
        weightRsrp: 50,
        weightSinr: 30,
        weightRsrq: 20
    };

    function getSettings() {
        var s = {};
        try {
            var raw = window.localStorage.getItem("jtoolsQoSettings");
            if (raw) { s = JSON.parse(raw); }
        } catch (e) { /* ignore */ }
        return {
            enabled:       s.enabled !== false,
            timeout:       asInt(s.timeout) || 10000,
            weightRsrp:    asInt(s.weightRsrp) != null ? asInt(s.weightRsrp) : DEFAULTS.weightRsrp,
            weightSinr:    asInt(s.weightSinr) != null ? asInt(s.weightSinr) : DEFAULTS.weightSinr,
            weightRsrq:    asInt(s.weightRsrq) != null ? asInt(s.weightRsrq) : DEFAULTS.weightRsrq
        };
    }

    function saveSettings(obj) {
        try {
            var current = getSettings();
            var merged = {};
            var key;
            for (key in current) { merged[key] = current[key]; }
            for (key in obj) { merged[key] = obj[key]; }
            window.localStorage.setItem("jtoolsQoSettings", JSON.stringify(merged));
        } catch (e) { /* ignore */ }
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
        if (v == null) { return "qo-sig-na"; }
        if (v > -80)  { return "qo-sig-excellent"; }
        if (v > -90)  { return "qo-sig-good"; }
        if (v > -100) { return "qo-sig-fair"; }
        if (v > -110) { return "qo-sig-poor"; }
        return "qo-sig-vpoor";
    }

    function getGradeClass(grade) {
        if (grade == null) { return "qo-sig-na"; }
        if (grade >= 80) { return "qo-sig-excellent"; }
        if (grade >= 60) { return "qo-sig-good"; }
        if (grade >= 40) { return "qo-sig-fair"; }
        if (grade >= 20) { return "qo-sig-poor"; }
        return "qo-sig-vpoor";
    }

    function getRatClass(rat) {
        var r = String(rat || "").toUpperCase();
        if (r.indexOf("NSA") !== -1 || r === "5GNSA") { return "qo-rat-nsa"; }
        if (r.indexOf("NR") !== -1 || r.indexOf("5G") !== -1) { return "qo-rat-nr"; }
        return "qo-rat-lte";
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

    // ── Phone-style Signal Bars ──

    function buildPhoneBars(rsrp) {
        var v = asInt(rsrp);
        var level = 0;
        if (v != null) {
            if (v > -70) { level = 5; }
            else if (v > -80) { level = 4; }
            else if (v > -90) { level = 3; }
            else if (v > -100) { level = 2; }
            else if (v > -120) { level = 1; }
        }
        var bars = [];
        for (var i = 1; i <= 5; i++) {
            bars.push("<span class='qo-bar" + (i <= level ? " is-on" : "") + "' style='height:" + (i * 20) + "%'></span>");
        }
        return bars.join("");
    }

    // ── Gradient Bar (H5000-style) ──

    function buildGradientBar(grade) {
        var pct = grade != null ? clamp(grade, 0, 100) : 0;
        var show = grade != null;
        return [
            "<div class='qo-gradient-bar'>",
            "<div class='qo-gradient-track'></div>",
            show ? "<div class='qo-gradient-marker' style='left:" + pct + "%'></div>" : "",
            "</div>"
        ].join("");
    }

    // ── Per-Metric Fill Bar ──

    function buildFillBar(value, min, max, cssClass) {
        var pct = normalizeMetric(value, min, max);
        if (pct == null) { pct = 0; }
        return "<div class='qo-fill-bar'><div class='qo-fill-bar-inner " + (cssClass || "") + "' style='width:" + pct + "%'></div></div>";
    }

    // ── Per-Metric Spectrum Bar ──

    function buildSpectrumBar(value, min, max) {
        var pct = normalizeMetric(value, min, max);
        var show = pct != null;
        if (pct == null) { pct = 0; }
        return [
            "<div class='qo-spectrum-bar'>",
            "<div class='qo-spectrum-track'></div>",
            show ? "<div class='qo-spectrum-marker' style='left:" + pct + "%'></div>" : "",
            "</div>"
        ].join("");
    }

    // ── Band Combo Formatting ──

    function formatBandCombo(carriers) {
        if (!carriers || !carriers.length) { return "N/A"; }
        return carriers.map(function (c) {
            var label = c.band_label || c.band || "?";
            var bw = c.bandwidth_mhz ? " " + c.bandwidth_mhz + "MHz" : "";
            var role = c.role ? " (" + c.role + ")" : "";
            return label + bw + role;
        }).join("  +  ");
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
            var raw = window.localStorage.getItem("jtoolsBandHistory");
            if (raw) {
                bandChangeHistory = JSON.parse(raw);
                if (!Array.isArray(bandChangeHistory)) { bandChangeHistory = []; }
            }
        } catch (e) { bandChangeHistory = []; }
    }

    function saveBandHistory() {
        try {
            window.localStorage.setItem("jtoolsBandHistory", JSON.stringify(bandChangeHistory));
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

    function getBandChangeHistory() {
        return bandChangeHistory.slice(0, 5);
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

    // ── Temperature Formatting ──

    function getTempClass(tempText) {
        var match = String(tempText || "").match(/(\d+)/);
        if (!match) { return ""; }
        var val = parseInt(match[1], 10);
        if (val >= 55) { return "qo-temp-hot"; }
        if (val >= 45) { return "qo-temp-warm"; }
        return "qo-temp-ok";
    }

    // ── Data Fetch ──

    function fetchData(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/jtools_general_api/state", true);
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
                callback(processResponse(resp), null);
            } catch (e) {
                callback(null, e.message);
            }
        };
        xhr.send();
    }

    function processResponse(resp) {
        var qnwinfo = parseQnwinfo(resp.qnwinfo_summary || "");
        var qspn = parseQspn(resp.qspn_summary || "");
        var cops = parseCops(resp.cops_summary || "");
        var servingcell = parseServingcell(resp.qeng_summary || "");
        var carriers = resp.carriers || [];
        var provider = chooseFirst(qspn.displayName, cops.operatorName);
        var rat = getRatLabel(qnwinfo, servingcell);
        var rsrp = servingcell.rsrp || null;
        var rsrq = servingcell.rsrq || null;
        var sinr = servingcell.sinr || null;
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
            signalClass: getSignalClass(rsrp),
            grade: grade,
            gradeClass: getGradeClass(grade),
            gradeText: grade != null ? grade + "%" : "N/A",
            pci: asText(pci),
            cellId: asText(cellId),
            arfcn: arfcn,
            bandLabel: bandLabel,
            carriers: carriers,
            bandComboText: formatBandCombo(carriers),
            bandShort: formatBandShort(carriers),
            temp: temp,
            tempClass: getTempClass(temp),
            qnwinfo: qnwinfo,
            servingcell: servingcell,
            raw: resp
        };
    }

    // ── Init ──

    loadBandHistory();

    // ── Public API ──

    window.JtoolsQuickOverview = {
        fetchData: fetchData,
        processResponse: processResponse,
        calcSignalGrade: calcSignalGrade,
        normalizeMetric: normalizeMetric,
        getSignalClass: getSignalClass,
        getGradeClass: getGradeClass,
        getRatClass: getRatClass,
        buildPhoneBars: buildPhoneBars,
        buildGradientBar: buildGradientBar,
        buildFillBar: buildFillBar,
        buildSpectrumBar: buildSpectrumBar,
        formatBandCombo: formatBandCombo,
        formatBandShort: formatBandShort,
        trackBandChange: trackBandChange,
        getBandChangeHistory: getBandChangeHistory,
        formatBandChangeText: formatBandChangeText,
        getTempClass: getTempClass,
        getSettings: getSettings,
        saveSettings: saveSettings,
        escapeHtml: escapeHtml,
        asText: asText,
        hasValue: hasValue,
        asInt: asInt,
        formatDb: formatDb,
        DEFAULTS: DEFAULTS
    };

})(window);
