(function (window) {
    "use strict";

    function createState() {
        return {
            stock: {
                system: null,
                cellular: null,
                wwan: null,
                adv: null,
                cells: []
            },
            at: null
        };
    }

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

    function formatModemName(value) {
        var text = asText(value, "RG520N");
        if (text === "RG520N") {
            return "RG520N-NA";
        }
        return text;
    }

    function isNoSimStatus(value) {
        return /not inserted|sim not|no sim/i.test(asText(value, ""));
    }

    function asInt(value) {
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function formatUptime(value) {
        var seconds = asInt(value);
        if (seconds == null || seconds < 0) {
            return "N/A";
        }
        if (typeof window.toUpTime === "function") {
            return window.toUpTime(seconds);
        }
        return String(seconds) + "s";
    }

    function formatRate(value) {
        var parsed = asInt(value);
        return parsed == null ? "N/A" : String(parsed) + " Kbps";
    }

    function formatDb(value, units) {
        var parsed = asInt(value);
        if (parsed == null || parsed <= -32768) {
            return "N/A";
        }
        return String(parsed) + (units || "");
    }

    function parseQnwinfo(summary) {
        var line = "";
        var match = null;
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QNWINFO:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) {
            return {};
        }
        match = line.match(/^\+QNWINFO:\s*"([^"]*)","([^"]*)","([^"]*)",\s*([0-9-]+)/);
        if (!match) {
            return {};
        }
        return {
            access: asText(match[1], ""),
            operatorCode: asText(match[2], ""),
            bandLabel: asText(match[3], ""),
            arfcn: asText(match[4], "")
        };
    }

    function parseQspn(summary) {
        var line = "";
        var match = null;
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QSPN:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) {
            return {};
        }
        match = line.match(/^\+QSPN:\s*"([^"]*)","([^"]*)","([^"]*)",\s*([0-9-]+),\s*"([^"]*)"/);
        if (!match) {
            return {};
        }
        return {
            longName: asText(match[1], ""),
            shortName: asText(match[2], ""),
            displayName: chooseFirst(match[1], match[2]),
            mccmnc: asText(match[5], "")
        };
    }

    function parseCops(summary) {
        var line = "";
        var match = null;
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+COPS:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) {
            return {};
        }
        match = line.match(/^\+COPS:\s*\d+,\d+,"([^"]+)"(?:,\d+)?/);
        if (!match) {
            return {};
        }
        return {
            operatorName: asText(match[1], "")
        };
    }

    function parseServingcell(summary) {
        var line = "";
        var parts = null;
        var item = {};
        (summary || "").split(/\n/).some(function (part) {
            var trimmed = String(part || "").replace(/^\s+|\s+$/g, "");
            if (trimmed.indexOf("+QENG:") === 0) {
                line = trimmed;
                return true;
            }
            return false;
        });
        if (!line) {
            return {};
        }
        parts = line.replace(/^\+QENG:\s*/, "").split(",");
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
                // LTE: ...,cellID,PCI,EARFCN,band,UL_BW,DL_BW,TAC,RSRP,RSRQ,RSSI,SINR,...
                item.arfcn = asText(parts[8], "");
                item.band = hasValue(parts[9]) ? "LTE BAND " + parts[9] : "";
                item.tac = asText(parts[12], "");
                item.rsrp = asText(parts[13], "");
                item.rsrq = asText(parts[14], "");
                item.sinr = parts.length > 16 ? asText(parts[16], "") : "";
            } else {
                // NR5G-SA: ...,cellID,PCI,TAC,ARFCN,band,DL_BW,RSRP,RSRQ,SINR
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

    function chooseFirst() {
        var i;
        for (i = 0; i < arguments.length; i += 1) {
            if (hasValue(arguments[i])) {
                return asText(arguments[i], "N/A");
            }
        }
        return "N/A";
    }

    function chooseDb() {
        var i;
        for (i = 0; i < arguments.length; i += 1) {
            if (formatDb(arguments[i], "") !== "N/A") {
                return arguments[i];
            }
        }
        return null;
    }

    function decodeCellInfo(objs, coverage) {
        var list = [];
        (objs || []).forEach(function (obj) {
            if (!obj || !obj.rawdata) {
                return;
            }
            var ar = obj.rawdata.split(",");
            var ratMap = { E: "LTE", U: "UMTS", G: "GSM", N: "NR5G" };
            list.push({
                pci: ar[2] || "",
                arfcn: ar[1] || "",
                rsrp: ar[3] || "",
                rsrq: ar[4] || "",
                rat: ratMap[ar[0]] || "N/A"
            });
        });

        return {
            rows: list,
            headings: coverage === "nr5g" ? {
                pci: "gNB PCI",
                arfcn: "NR ARFCN",
                rsrp: "SS-RSRP",
                rsrq: "SS-RSRQ"
            } : {
                pci: "PCI",
                arfcn: "EARFCN",
                rsrp: "RSRP",
                rsrq: "RSRQ"
            }
        };
    }

    function normalizeCellular(obj) {
        var networkRegistration = asText(obj.networkRegistration, "5");
        var simStatus = asText(obj.simStatus, "N/A");
        var regNum = asInt(networkRegistration);
        var coverage = asText(obj.coverage, "N/A");
        var provider = asText(obj.provider, "N/A");
        var signalDbm = asInt(obj.csq);
        var nr5gUp = asText(obj.nr5gStatus, "0");
        var noSim = isNoSimStatus(simStatus);
        var connected = false;
        var ratLabel = coverage.toUpperCase();

        if (!noSim && simStatus === "SIM OK" && (regNum === 1 || regNum === 5)) {
            connected = true;
        }
        if (nr5gUp === "1") {
            ratLabel = "NR5G";
        }
        if (noSim) {
            ratLabel = "No SIM";
        } else if (!connected && provider === "Limited Service") {
            ratLabel = "Limited service";
        }

        return {
            provider: provider,
            coverage: coverage,
            ratLabel: ratLabel,
            currentBand: asText(obj.currBand),
            operationMode: asText(obj.operationMode),
            networkRegistration: networkRegistration,
            signalDbm: signalDbm,
            simStatus: simStatus,
            roaming: noSim ? "N/A" : (asText(obj.roamingStat) === "active" ? "Roaming" : "Not roaming"),
            nr5gUp: nr5gUp,
            connected: connected,
            signalBar: asText(obj.signalBar),
            noSim: noSim
        };
    }

    function normalizeWWan(obj) {
        var chosen = null;
        var i;
        var profileCount = asInt(obj.NumProfiles) || 0;
        for (i = 1; i <= profileCount; i += 1) {
            if (obj[i] && obj[i].enable === "1") {
                chosen = obj[i];
                break;
            }
        }
        if (!chosen) {
            for (i = 1; i <= profileCount; i += 1) {
                if (obj[i]) {
                    chosen = obj[i];
                    break;
                }
            }
        }
        if (!chosen) {
            return null;
        }

        var systemUptime = asInt(obj.uptime);
        var profileUptime = asInt(chosen.uptime);
        var connUptime = null;
        if (systemUptime != null && profileUptime != null) {
            connUptime = systemUptime - profileUptime;
        }

        return {
            profileName: asText(chosen.name),
            statusIpv4: asText(chosen.status_ipv4),
            apn: asText(chosen.apn),
            connUptime: connUptime,
            maxDl: asText(chosen.max_rx_kbps),
            maxUl: asText(chosen.max_tx_kbps),
            currentDl: asText(chosen.rx_kbps),
            currentUl: asText(chosen.tx_kbps),
            wwanIp: asText(chosen.iplocal)
        };
    }

    function normalizeAdv(obj) {
        var sysSo = asText(obj.sys_so);
        if (sysSo.indexOf("5G SA") !== -1) {
            sysSo = "5GSA";
        } else if (sysSo.indexOf("5G NSA") !== -1) {
            sysSo = "5GNSA";
        } else {
            sysSo = "LTE";
        }

        return {
            packetService: asText(obj.psAttached) === "1" ? "Attached" : "Detached",
            mcc: asText(obj.MCC),
            mnc: asText(obj.MNC),
            ecgi: asText(obj.ECGI),
            enodeb: asText(obj.enodeB),
            cellId: asText(obj.cellId),
            pci: asText(obj.pci),
            earfcn: asText(obj.earfcn),
            rsrp: asText(obj.rsrp),
            rsrq: asText(obj.rsrq),
            snr: asText(obj.snr),
            cqi: asText(obj.cqi),
            scellBand: asText(obj.scellBand, ""),
            scellPci: asText(obj.scellPci, ""),
            scellEarfcn: asText(obj.scellEarfcn, ""),
            scellState: asText(obj.scellState, ""),
            nrNcgi: asText(obj.nr5g_ncgi),
            nrGnodeb: asText(obj.nr5g_gnodeB),
            nrCellId: asText(obj.nr5g_cellId),
            nrPci: asText(obj.nr5g_pci),
            nrArfcn: asText(obj.nr5g_arfcn),
            nrSsbArfcn: asText(obj.nr5g_ssb_arfcn),
            nrScs: asText(obj.nr5g_scs),
            nrRsrp: asText(obj.nr5g_rsrp),
            nrRsrq: asText(obj.nr5g_rsrq),
            nrSnr: asText(obj.nr5g_snr),
            nrCqi: asText(obj.nr5g_cqi),
            nrSsbIndex: asText(obj.nr5g_ssbIndex),
            sysSo: sysSo
        };
    }

    function buildSignalBars(signalDbm, signalBarConfig) {
        var thresholds = [-70, -80, -90, -100, -120];
        if (signalBarConfig) {
            var values = signalBarConfig.split(",").map(function (part) {
                return asInt(part);
            }).filter(function (value) {
                return value != null;
            });
            if (values.length >= 5) {
                thresholds = values;
            }
        }

        var level = 0;
        if (signalDbm != null) {
            if (signalDbm > thresholds[0]) {
                level = 5;
            } else if (signalDbm > thresholds[1]) {
                level = 4;
            } else if (signalDbm > thresholds[2]) {
                level = 3;
            } else if (signalDbm > thresholds[3]) {
                level = 2;
            } else if (signalDbm > thresholds[4]) {
                level = 1;
            }
        }

        return [1, 2, 3, 4, 5].map(function (step) {
            return "<span class='jgd-signal-bar" + (step <= level ? " is-on" : "") + "'></span>";
        }).join("");
    }

    function createMetric(label, value, extraClass) {
        return [
            "<div class='jgd-metric'>",
            "<div class='jgd-metric-label'>", escapeHtml(label), "</div>",
            "<div class='jgd-metric-value", extraClass ? " " + extraClass : "", "'>", escapeHtml(value), "</div>",
            "</div>"
        ].join("");
    }

    function getSignalClassForDb(dbValue, metric) {
        var v = asInt(dbValue);
        if (v == null) { return "qt-sig-na"; }
        if (metric === "rsrq") {
            if (v > -8) { return "qt-sig-excellent"; }
            if (v > -11) { return "qt-sig-good"; }
            if (v > -15) { return "qt-sig-fair"; }
            if (v > -18) { return "qt-sig-poor"; }
            return "qt-sig-vpoor";
        }
        if (metric === "sinr") {
            if (v > 20) { return "qt-sig-excellent"; }
            if (v > 13) { return "qt-sig-good"; }
            if (v > 5) { return "qt-sig-fair"; }
            if (v > 0) { return "qt-sig-poor"; }
            return "qt-sig-vpoor";
        }
        // rsrp default
        if (v > -80) { return "qt-sig-excellent"; }
        if (v > -90) { return "qt-sig-good"; }
        if (v > -100) { return "qt-sig-fair"; }
        if (v > -110) { return "qt-sig-poor"; }
        return "qt-sig-vpoor";
    }

    function getTempColorClass(tempText) {
        var match = String(tempText || "").match(/(\d+)/);
        if (!match) { return ""; }
        var val = parseInt(match[1], 10);
        if (val >= 55) { return "qt-temp-red"; }
        if (val >= 48) { return "qt-temp-orange"; }
        if (val >= 40) { return "qt-temp-yellow"; }
        return "qt-temp-green";
    }

    function getCarrierColorClass(provider) {
        var p = String(provider || "").toLowerCase();
        if (p.indexOf("t-mobile") !== -1 || p.indexOf("tmobile") !== -1) { return "qt-carrier-tmobile"; }
        if (p.indexOf("at&t") !== -1 || p.indexOf("att") !== -1) { return "qt-carrier-att"; }
        if (p.indexOf("verizon") !== -1) { return "qt-carrier-verizon"; }
        return "";
    }

    function renderCarrierList(carriers) {
        if (!carriers || !carriers.length) {
            return "<div class='jgd-muted'>No active carrier details from QCAINFO right now.</div>";
        }
        return carriers.map(function (carrier) {
            var meta = [];
            if (carrier.role) {
                meta.push(carrier.role);
            }
            if (carrier.channel) {
                meta.push("ARFCN " + carrier.channel);
            }
            return [
                "<div class='jgd-carrier'>",
                "<div class='jgd-carrier-band'>", escapeHtml(carrier.band_label || carrier.band || "Carrier"), "</div>",
                "<div class='jgd-carrier-meta'>", escapeHtml(meta.join(" | ")), "</div>",
                "<div class='jgd-carrier-bw'>", escapeHtml(carrier.bandwidth_text || "Bandwidth unavailable"), "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function renderTemps(temps) {
        if (!temps || !temps.length) {
            return "<div class='jgd-muted'>Temperature sensors unavailable right now.</div>";
        }
        return temps.map(function (temp) {
            var tempCls = getTempColorClass(temp.value_text);
            return [
                "<div class='jgd-temp'>",
                "<span class='jgd-temp-name'>", escapeHtml(temp.name), "</span>",
                "<span class='jgd-temp-value ", tempCls, "'>", escapeHtml(temp.value_text), "</span>",
                "</div>"
            ].join("");
        }).join("");
    }

    function renderNeighborTable(cellInfo) {
        var headings = cellInfo && cellInfo.headings ? cellInfo.headings : { pci: "PCI", arfcn: "ARFCN", rsrp: "RSRP", rsrq: "RSRQ" };
        var rows = cellInfo && cellInfo.rows ? cellInfo.rows : [];
        var body = rows.length ? rows.map(function (row) {
            return [
                "<tr>",
                "<td>", escapeHtml(row.pci), "</td>",
                "<td>", escapeHtml(row.arfcn), "</td>",
                "<td>", escapeHtml(row.rsrp), "</td>",
                "<td>", escapeHtml(row.rsrq), "</td>",
                "<td>", escapeHtml(row.rat), "</td>",
                "</tr>"
            ].join("");
        }).join("") : "<tr><td colspan='5' class='jgd-muted-cell'>No neighboring cells reported.</td></tr>";

        return [
            "<table class='jgd-neighbor-table'>",
            "<thead><tr>",
            "<th>", escapeHtml(headings.pci), "</th>",
            "<th>", escapeHtml(headings.arfcn), "</th>",
            "<th>", escapeHtml(headings.rsrp), "</th>",
            "<th>", escapeHtml(headings.rsrq), "</th>",
            "<th>RAT</th>",
            "</tr></thead>",
            "<tbody>", body, "</tbody>",
            "</table>"
        ].join("");
    }

    function signalValuesMatch(primaryValue, secondaryValue) {
        return hasValue(primaryValue) && hasValue(secondaryValue) && String(primaryValue) === String(secondaryValue);
    }

    function renderSignalDetailBlock(primaryRsrp, primaryRsrq, primarySinr, primaryCqi, adv, rat) {
        var isNr = String(rat || "").toUpperCase().indexOf("NR") !== -1;
        var hasNrSignals = hasValue(adv.nrRsrp) || hasValue(adv.nrRsrq) || hasValue(adv.nrSnr) || hasValue(adv.nrCqi);
        var ssDistinct = !signalValuesMatch(primaryRsrp, adv.nrRsrp) ||
            !signalValuesMatch(primaryRsrq, adv.nrRsrq) ||
            !signalValuesMatch(primarySinr, adv.nrSnr) ||
            !signalValuesMatch(primaryCqi, adv.nrCqi);

        if (hasNrSignals && (ssDistinct || !isNr)) {
            return [
                createMetric("SS-RSRP", formatDb(adv.nrRsrp, " dBm")),
                createMetric("SS-RSRQ", formatDb(adv.nrRsrq, " dB")),
                createMetric("SS-SINR", formatDb(adv.nrSnr, " dB")),
                createMetric("NR CQI", asText(adv.nrCqi))
            ].join("");
        }

        if (hasNrSignals && isNr) {
            return "<div class='jgd-muted'>NR sync-signal metrics currently match the primary metrics, so the separate SS rows are hidden.</div>";
        }

        return "<div class='jgd-muted'>Separate NR sync-signal metrics are only shown when the modem reports distinct NR-specific values.</div>";
    }

    function buildBannerText(cellular, at) {
        if (cellular && cellular.noSim) {
            return "No SIM inserted. Signal and band fields may reflect the last radio state rather than an active session.";
        }
        if (at && at.primary_temperature_text) {
            return "Live stock data plus targeted AT reads for CA and modem temperature are loaded.";
        }
        return "Using stock UI data plus targeted AT reads for CA and modem temperature.";
    }

    function renderDashboard(state) {
        var system = state.stock.system || {};
        var cellular = state.stock.cellular || {};
        var wwan = state.stock.wwan || {};
        var adv = state.stock.adv || {};
        var cells = state.stock.cells || { rows: [] };
        var at = state.at || {};
        var qnwinfo = parseQnwinfo(at.qnwinfo_summary || "");
        var qspn = parseQspn(at.qspn_summary || "");
        var cops = parseCops(at.cops_summary || "");
        var servingcell = parseServingcell(at.qeng_summary || "");
        var connected = cellular.connected || adv.packetService === "Attached";
        var modemName = formatModemName(system.moduleModel);
        var deviceName = asText(system.identityTitle, "Casa Systems USC-CFW3212");
        var provider = chooseFirst(cellular.provider, qspn.displayName, cops.operatorName);
        var rat = asText(cellular.ratLabel, "N/A");
        var currentBand = chooseFirst(cellular.currentBand, qnwinfo.bandLabel, servingcell.band);
        var uptime = formatUptime(wwan.connUptime);
        var systemUptime = formatUptime(system.uptime);
        var signalDbm = chooseDb(cellular.signalDbm, adv.rsrp, adv.nrRsrp, servingcell.rsrp);
        var primaryTemp = at.primary_temperature_text || "N/A";
        var signalText = signalDbm == null ? "N/A" : String(asInt(signalDbm)) + " dBm";
        var bandSummary = at.carriers && at.carriers.length ? at.carriers.map(function (item) { return item.band_label || item.band || ""; }).join(" + ") : currentBand;
        var bannerText = buildBannerText(cellular, at);
        var sessionLabel = cellular.noSim ? "Session unavailable" : uptime;
        var bandLabel = cellular.noSim ? "Last radio band " + currentBand : "Band " + currentBand;
        var primaryRsrp = chooseFirst(adv.rsrp, adv.nrRsrp, servingcell.rsrp);
        var primaryRsrq = chooseFirst(adv.rsrq, adv.nrRsrq, servingcell.rsrq);
        var primarySinr = chooseFirst(adv.snr, adv.nrSnr, servingcell.sinr);
        var primaryCqi = chooseFirst(adv.cqi, adv.nrCqi);
        var primaryPci = chooseFirst(adv.pci, adv.nrPci, servingcell.pci);
        var primaryArfcn = chooseFirst(adv.earfcn, adv.nrArfcn, qnwinfo.arfcn, servingcell.arfcn);

        return [
            "<div class='jgd-page'>",
            "<div class='jgd-hero'>",
            "<div class='jgd-hero-top'>",
            "<h2 class='jgd-title'>Qtooley General Info</h2>",
            "</div>",
            "<div class='jgd-hero-main'>",
            "<div class='jgd-kicker'>", escapeHtml(deviceName), "</div>",
            "<div class='jgd-subtitle'>", escapeHtml(modemName), " | FW ", escapeHtml(asText(system.moduleFirmwareVersion, "N/A")), "</div>",
            "<div class='jgd-hero-actions'>",
            "<button id='jgd-refresh' class='at-primary-button jgd-refresh' type='button'>Refresh</button>",
            "</div>",
            "</div>",
            "<div class='jgd-hero-spacer'></div>",
            "<div class='jgd-module-strip'>",
            "<div class='qt-device-card'>",
            "<img class='qt-device-img' src='/img/rg520n-na-module.png' alt='RG520N-NA module' onerror='this.style.display=\"none\"'>",
            "<div class='qt-device-info'>",
            "<div class='qt-device-model'>", escapeHtml(modemName), "</div>",
            "<div class='qt-device-detail'>FCC ID: XIA2023RG520NNA</div>",
            "<div class='qt-device-detail'>FW: ", escapeHtml(asText(system.moduleFirmwareVersion, "N/A")), "</div>",
            "<div class='qt-device-detail'>IMEI: ", escapeHtml(asText(system.imei, "N/A")), "</div>",
            "</div>",
            "</div>",
            "<div class='jgd-hero-side'>",
            "<div id='jgd-live-time' class='jgd-clock'></div>",
            "</div>",
            "</div>",
            "</div>",
            "<div class='jgd-status-strip'>",
            "<div class='jgd-status-pill ", connected ? "is-connected" : "is-disconnected", "'>",
            "<span class='jgd-status-light'></span>",
            escapeHtml(connected ? "Connected" : (cellular.noSim ? "No SIM / not connected" : "Not connected")),
            "</div>",
            "<div class='jgd-status-meta'>Carrier <span class='", getCarrierColorClass(provider), "'>", escapeHtml(provider), "</span></div>",
            "<div class='jgd-status-meta'>RAT ", escapeHtml(rat), "</div>",
            "<div class='jgd-status-meta'>", escapeHtml(bandLabel), "</div>",
            "<div class='jgd-status-meta'>Session ", escapeHtml(sessionLabel), "</div>",
            "</div>",
            "<div id='jgd-api-status' class='jgd-banner'>", escapeHtml(bannerText), "</div>",
            "<div class='jgd-grid jgd-grid-hero'>",
            "<section class='jgd-card jgd-card-signal'>",
            "<div class='jgd-card-title'>Signal overview</div>",
            "<div class='jgd-signal-wrap'>",
            "<div class='jgd-signal-bars'>", buildSignalBars(signalDbm, cellular.signalBar), "</div>",
            "<div class='jgd-signal-value'>", escapeHtml(signalText), "</div>",
            "</div>",
            "<div class='jgd-metrics-grid'>",
            createMetric("Primary RSRP", formatDb(primaryRsrp, " dBm"), getSignalClassForDb(primaryRsrp, "rsrp")),
            createMetric("Primary RSRQ", formatDb(primaryRsrq, " dB"), getSignalClassForDb(primaryRsrq, "rsrq")),
            createMetric("Primary SINR", formatDb(primarySinr, " dB"), getSignalClassForDb(primarySinr, "sinr")),
            createMetric("Primary CQI", primaryCqi),
            renderSignalDetailBlock(primaryRsrp, primaryRsrq, primarySinr, primaryCqi, adv, rat),
            "</div>",
            "</section>",
            "<section class='jgd-card'>",
            "<div class='jgd-card-title'>General info</div>",
            "<div class='jgd-metrics-grid'>",
            createMetric("Carrier", provider),
            createMetric("Operator mode", asText(cellular.operationMode)),
            createMetric("Coverage", asText(cellular.coverage)),
            createMetric("SIM status", asText(cellular.simStatus)),
            createMetric("Roaming", asText(cellular.roaming)),
            createMetric("Packet service", asText(adv.packetService)),
            createMetric("System uptime", systemUptime),
            createMetric("Modem temp", primaryTemp, getTempColorClass(primaryTemp)),
            "</div>",
            "</section>",
            "</div>",
            "<div class='jgd-grid'>",
            "<section class='jgd-card'>",
            "<div class='jgd-card-title'>Active connection</div>",
            "<div class='jgd-summary-line'>Current band: <strong>", escapeHtml(currentBand), "</strong></div>",
            "<div class='jgd-summary-line'>Connected bands / CA: <strong>", escapeHtml(bandSummary || "N/A"), "</strong></div>",
            "<div class='jgd-metrics-grid'>",
            createMetric("APN", asText(wwan.apn)),
            createMetric("WWAN IP", asText(wwan.wwanIp)),
            createMetric("Current DL", formatRate(wwan.currentDl)),
            createMetric("Current UL", formatRate(wwan.currentUl)),
            createMetric("Max DL", formatRate(wwan.maxDl)),
            createMetric("Max UL", formatRate(wwan.maxUl)),
            createMetric("PCI", primaryPci),
            createMetric("EARFCN", primaryArfcn),
            createMetric("NR PCI", asText(adv.nrPci)),
            createMetric("NR ARFCN", asText(adv.nrArfcn)),
            "</div>",
            "</section>",
            "<section class='jgd-card'>",
            "<div class='jgd-card-title'>Carrier aggregation</div>",
            "<div class='jgd-carrier-list'>", renderCarrierList(at.carriers), "</div>",
            "<details class='jgd-details'><summary>Raw CA / serving-cell detail</summary><pre class='jgd-raw'>", escapeHtml(asText(at.qcainfo_summary, "QCAINFO unavailable")), "\n\n", escapeHtml(asText(at.qeng_summary, "QENG unavailable")), "</pre></details>",
            "</section>",
            "</div>",
            "<div class='jgd-grid'>",
            "<section class='jgd-card'>",
            "<div class='jgd-card-title'>Neighbor cells</div>",
            renderNeighborTable(cells),
            "</section>",
            "<section class='jgd-card'>",
            "<div class='jgd-card-title'>Modem health</div>",
            "<div class='jgd-temp-list'>", renderTemps(at.temperatures), "</div>",
            "</section>",
            "</div>",
            "</div>"
        ].join("");
    }

    window.JtoolGeneralDashboardCore = {
        createState: createState,
        decodeCellInfo: decodeCellInfo,
        normalizeCellular: normalizeCellular,
        normalizeWWan: normalizeWWan,
        normalizeAdv: normalizeAdv,
        buildBannerText: buildBannerText,
        renderDashboard: renderDashboard
    };
})(window);
