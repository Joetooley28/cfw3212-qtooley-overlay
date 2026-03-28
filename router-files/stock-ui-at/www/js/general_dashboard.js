(function (window, $) {
    "use strict";

    var core = window.JtoolGeneralDashboardCore;
    var state = core.createState();
    var atRefreshTimer = null;
    var clockTimer = null;
    var rawDetailsOpen = false;

    function setApiBanner(kind, text) {
        var node = document.getElementById("jgd-api-status");
        if (!node) {
            return;
        }
        node.className = "jgd-banner " + (kind ? "is-" + kind : "");
        node.textContent = text || "";
    }

    function updateClock() {
        var node = document.getElementById("jgd-live-time");
        if (node) {
            node.textContent = new Date().toLocaleTimeString();
        }
    }

    function renderDashboard() {
        var host = document.getElementById("jtool-general-dashboard");
        if (!host) {
            return;
        }

        var existingDetails = host.querySelector(".jgd-details");
        if (existingDetails) {
            rawDetailsOpen = !!existingDetails.open;
        }

        host.innerHTML = core.renderDashboard(state);

        var detailsNode = host.querySelector(".jgd-details");
        if (detailsNode) {
            detailsNode.open = rawDetailsOpen;
            detailsNode.addEventListener("toggle", function () {
                rawDetailsOpen = !!detailsNode.open;
            });
        }

        var refreshButton = document.getElementById("jgd-refresh");
        if (refreshButton) {
            refreshButton.addEventListener("click", function () {
                fetchAtState(true);
            });
        }
        updateClock();
    }

    function fetchAtState(manual) {
        $.ajax({
            url: "/jtools_general_api/state",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            if (!response || !response.ok) {
                setApiBanner("error", (response && response.error) || "AT supplement refresh failed.");
                return;
            }
            state.at = response;
            renderDashboard();
            if (response.degraded) {
                setApiBanner("warn", "Modem AT path unavailable (" + (response.degraded_reason || "unknown") + "). Showing RDB-backed signal and identity only.");
                return;
            }
            setApiBanner("ok", manual ? "Refreshed CA and modem temperature from live AT responses." : core.buildBannerText(state.stock.cellular || {}, response));
        }).fail(function (xhr) {
            setApiBanner("error", xhr && xhr.responseText ? xhr.responseText : "AT supplement refresh failed.");
        });
    }

    function ensurePanel() {
        if (document.getElementById("jtool-general-dashboard")) {
            return;
        }
        var panel = document.createElement("div");
        panel.id = "jtool-general-dashboard";
        panel.className = "body-box form-row";
        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (htmlGoesHere) {
            htmlGoesHere.appendChild(panel);
        }
    }

    function stockUpdated() {
        ensurePanel();
        renderDashboard();
    }

    function createSystemInfoObj() {
        return PageObj("StsSystemInfo", "", {
            readOnly: true,
            column: 1,
            pollPeriod: 5000,
            genObjHtml: function () { return ""; },
            populate: function () {
                state.stock.system = this.obj || {};
                stockUpdated();
            },
            members: [
                hiddenVariable("version", "sw.version"),
                hiddenVariable("identityTitle", "system.product.title"),
                hiddenVariable("deviceModel", "system.product.model"),
                hiddenVariable("hw_ver", "system.product.hwver"),
                hiddenVariable("moduleFirmwareVersion", "wwan.0.firmware_version"),
                hiddenVariable("moduleModel", "wwan.0.module_model_name"),
                hiddenVariable("serialNumber", "system.product.sn"),
                hiddenVariable("moduleHardwareVersion", "wwan.0.hardware_version"),
                hiddenVariable("imei", "wwan.0.imei")
            ]
        });
    }

    function createCellularObj() {
        return PageObj("StsCellularConnectionStatus", "", {
            readOnly: true,
            column: 1,
            pollPeriod: 5000,
            genObjHtml: function () { return ""; },
            populate: function () {
                state.stock.cellular = core.normalizeCellular(this.obj || {});
                stockUpdated();
            },
            members: [
                hiddenVariable("networkRegistration", "wwan.0.system_network_status.reg_stat"),
                hiddenVariable("simStatus", "wwan.0.sim.status.status"),
                hiddenVariable("pukRetries", "wwan.0.sim.status.retries_puk_remaining"),
                hiddenVariable("provider", "wwan.0.system_network_status.network"),
                hiddenVariable("connType", "wwan.0.system_network_status.service_type"),
                hiddenVariable("csq", "wwan.0.radio.information.signal_strength"),
                hiddenVariable("coverage", "wwan.0.system_network_status.system_mode"),
                hiddenVariable("roamingStat", "wwan.0.system_network_status.roaming"),
                hiddenVariable("simICCID", "wwan.0.system_network_status.simICCID"),
                hiddenVariable("manualroamResetting", "manualroam.resetting"),
                hiddenVariable("IMSI", "wwan.0.imsi.msin"),
                hiddenVariable("simDataMbn", "wwan.0.sim.data.mbn"),
                hiddenVariable("autopin", "wwan.0.sim.autopin"),
                hiddenVariable("operationMode", "wwan.0.PLMN_selectionMode"),
                hiddenVariable("currBand", "wwan.0.system_network_status.current_band"),
                hiddenVariable("nr5gStatus", "wwan.0.radio_stack.nr5g.up"),
                hiddenVariable("endcAvail", "wwan.0.system_network_status.endc_avail"),
                hiddenVariable("dcnrRestricted", "wwan.0.system_network_status.dcnr_restricted"),
                hiddenVariable("coverage_format", ""),
                hiddenVariable("signalBar", "system.signal_bar_threshold")
            ]
        });
    }

    function createWWanObj() {
        return PageObj("StsWWanStatus", "", {
            readOnly: true,
            column: 1,
            pollPeriod: 5000,
            genObjHtml: function () { return ""; },
            populate: function () {
                state.stock.wwan = core.normalizeWWan(this.obj || {}) || state.stock.wwan;
                stockUpdated();
            },
            members: [
                hiddenVariable("NumProfiles", "")
            ]
        });
    }

    function createAdvObj() {
        return PageObj("StsAdvStatus", "", {
            readOnly: true,
            column: 1,
            pollPeriod: 5000,
            genObjHtml: function () { return ""; },
            populate: function () {
                state.stock.adv = core.normalizeAdv(this.obj || {});
                stockUpdated();
            },
            members: [
                hiddenVariable("simDataMbn", "wwan.0.sim.data.mbn"),
                hiddenVariable("MCC", "wwan.0.system_network_status.MCC"),
                hiddenVariable("MNC", "wwan.0.system_network_status.MNC"),
                hiddenVariable("simICCID", "wwan.0.system_network_status.simICCID"),
                hiddenVariable("IMSI", "wwan.0.imsi.msin"),
                hiddenVariable("psAttached", "wwan.0.system_network_status.attached"),
                hiddenVariable("ECGI", "wwan.0.system_network_status.ECGI"),
                hiddenVariable("enodeB", "wwan.0.system_network_status.eNB_ID"),
                hiddenVariable("cellId", "wwan.0.system_network_status.CellID"),
                hiddenVariable("pci", "wwan.0.system_network_status.PCID"),
                hiddenVariable("earfcn", "wwan.0.system_network_status.channel"),
                hiddenVariable("rsrp", "wwan.0.signal.0.rsrp"),
                hiddenVariable("rsrq", "wwan.0.signal.rsrq"),
                hiddenVariable("snr", "wwan.0.signal.snr"),
                hiddenVariable("cqi", "wwan.0.servcell_info.avg_wide_band_cqi"),
                hiddenVariable("nr5g_ncgi", "wwan.0.radio_stack.nr5g.cgi"),
                hiddenVariable("nr5g_gnodeB", "wwan.0.radio_stack.nr5g.gNB_ID"),
                hiddenVariable("nr5g_cellId", "wwan.0.radio_stack.nr5g.CellID"),
                hiddenVariable("nr5g_arfcn", "wwan.0.radio_stack.nr5g.arfcn"),
                hiddenVariable("nr5g_ssb_arfcn", "wwan.0.radio_stack.nr5g.ssb_arfcn"),
                hiddenVariable("nr5g_pci", "wwan.0.radio_stack.nr5g.pci"),
                hiddenVariable("nr5g_scs", "wwan.0.radio_stack.nr5g.scs"),
                hiddenVariable("nr5g_rsrp", "wwan.0.radio_stack.nr5g.rsrp"),
                hiddenVariable("nr5g_rsrq", "wwan.0.radio_stack.nr5g.rsrq"),
                hiddenVariable("nr5g_snr", "wwan.0.radio_stack.nr5g.snr"),
                hiddenVariable("nr5g_cqi", "wwan.0.radio_stack.nr5g.cqi"),
                hiddenVariable("nr5g_ssbIndex", "wwan.0.radio_stack.nr5g.ssb_index"),
                hiddenVariable("sys_so", "wwan.0.system_network_status.current_system_so"),
                hiddenVariable("scellBand", "wwan.0.system_network_status.lte_ca_scell.list.1.band"),
                hiddenVariable("scellPci", "wwan.0.system_network_status.lte_ca_scell.list.1.pci"),
                hiddenVariable("scellEarfcn", "wwan.0.system_network_status.lte_ca_scell.list.1.freq"),
                hiddenVariable("scellState", "wwan.0.system_network_status.lte_ca_scell.list.1.scell_state")
            ]
        });
    }

    function createCellInfoObj() {
        return PageObj("cellInfo", "", {
            readOnly: true,
            column: 1,
            pollPeriod: 7000,
            genObjHtml: function () { return ""; },
            decodeRdb: function (objs) {
                var coverage = state.stock.cellular ? String(state.stock.cellular.coverage || "").toLowerCase() : "lte";
                return core.decodeCellInfo(objs, coverage);
            },
            populate: function () {
                state.stock.cells = this.obj || { rows: [] };
                stockUpdated();
            },
            members: [
                staticTextVariable("cellPci", "PCI"),
                staticTextVariable("cellEarfcn", "EARFCN"),
                staticTextVariable("cellRsrp", "RSRP"),
                staticTextVariable("cellRsrq", "RSRQ"),
                staticTextVariable("cellServ", "RAT")
            ]
        });
    }

    window.JtoolGeneralDashboard = {
        createPageObjects: function () {
            return [
                createSystemInfoObj(),
                createCellularObj(),
                createWWanObj(),
                createAdvObj(),
                createCellInfoObj()
            ];
        },
        init: function () {
            ensurePanel();
            renderDashboard();
            fetchAtState(false);
            if (atRefreshTimer) {
                window.clearInterval(atRefreshTimer);
            }
            atRefreshTimer = window.setInterval(function () {
                fetchAtState(false);
            }, 6500);
            if (clockTimer) {
                window.clearInterval(clockTimer);
            }
            clockTimer = window.setInterval(updateClock, 1000);
        }
    };
})(window, jQuery);
