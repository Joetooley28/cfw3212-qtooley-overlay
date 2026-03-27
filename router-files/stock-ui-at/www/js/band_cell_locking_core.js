(function (window) {
    "use strict";

    var SUPPORTED = {
        ratModes: [
            { value: "AUTO", label: "Auto" },
            { value: "LTE", label: "LTE only" },
            { value: "NR5G", label: "NR5G only" },
            { value: "LTE:NR5G", label: "NSA" },
            { value: "WCDMA", label: "WCDMA only" }
        ],
        ratAcqOrders: [
            { value: "NR5G:LTE", label: "NR5G > LTE" },
            { value: "LTE:NR5G", label: "LTE > NR5G" },
            { value: "NR5G:LTE:WCDMA", label: "NR5G > LTE > WCDMA" },
            { value: "LTE:NR5G:WCDMA", label: "LTE > NR5G > WCDMA" },
            { value: "WCDMA:LTE:NR5G", label: "WCDMA > LTE > NR5G" },
            { value: "LTE:WCDMA:NR5G", label: "LTE > WCDMA > NR5G" },
            { value: "NR5G:WCDMA:LTE", label: "NR5G > WCDMA > LTE" },
            { value: "WCDMA:NR5G:LTE", label: "WCDMA > NR5G > LTE" },
            { value: "LTE:WCDMA", label: "LTE > WCDMA" },
            { value: "WCDMA:LTE", label: "WCDMA > LTE" },
            { value: "NR5G:WCDMA", label: "NR5G > WCDMA" },
            { value: "WCDMA:NR5G", label: "WCDMA > NR5G" }
        ],
        lte: ["2", "4", "5", "7", "12", "13", "14", "17", "25", "26", "29", "30", "38", "41", "42", "43", "48", "66", "71"],
        nsa: ["2", "5", "7", "12", "13", "14", "25", "26", "29", "30", "38", "41", "48", "66", "70", "71", "77", "78"],
        sa: ["2", "5", "7", "12", "13", "14", "25", "26", "29", "30", "38", "41", "48", "66", "70", "71", "77", "78"]
    };

    var SECTION_META = {
        lte: {
            title: "LTE bands",
            group: "lte_band",
            supported: SUPPORTED.lte,
            prefix: "B"
        },
        nsa: {
            title: "NSA 5G bands",
            group: "nsa_nr5g_band",
            supported: SUPPORTED.nsa,
            prefix: "n"
        },
        sa: {
            title: "SA 5G bands",
            group: "nr5g_band",
            supported: SUPPORTED.sa,
            prefix: "n"
        }
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parseBands(raw) {
        if (!raw || raw === "0") {
            return [];
        }
        return raw.split(":").map(function (part) {
            return part.trim();
        }).filter(Boolean);
    }

    function formatRawBlock(raw) {
        return raw && raw !== "0" ? raw : "0";
    }

    function bandLabel(meta, band) {
        return meta.prefix + band;
    }

    function describeBandList(sectionKey, values) {
        var meta = SECTION_META[sectionKey];
        var list = values || [];
        if (!list.length) {
            return "None";
        }
        if (list.length === meta.supported.length) {
            return "All supported (" + list.length + ")";
        }
        return list.map(function (band) {
            return bandLabel(meta, band);
        }).join(", ");
    }

    function buildStateSummary(state) {
        return [
            "Live modem state:",
            "RAT " + (state.mode_pref || "AUTO"),
            "LTE " + ((state.lte_band_list && state.lte_band_list.length) || 0),
            "NSA " + ((state.nsa_nr5g_band_list && state.nsa_nr5g_band_list.length) || 0),
            "SA " + ((state.nr5g_band_list && state.nr5g_band_list.length) || 0)
        ].join(" | ");
    }

    function indicatorIdForSection(sectionKey) {
        if (sectionKey === "lte") {
            return "band-lock-lte-indicator";
        }
        if (sectionKey === "nsa") {
            return "band-lock-nsa-indicator";
        }
        return "band-lock-sa-indicator";
    }

    function buildCheckboxes(sectionKey, selectedValues) {
        var meta = SECTION_META[sectionKey];
        var html = meta.supported.map(function (band) {
            var checked = selectedValues.indexOf(band) >= 0 ? " checked" : "";
            return [
                "<label class='band-lock-checkbox'>",
                "<input type='checkbox' data-section='", sectionKey, "' value='", band, "'", checked, ">",
                "<span>", escapeHtml(meta.prefix + band), "</span>",
                "</label>"
            ].join("");
        }).join("");

        return [
            "<details class='band-lock-section'>",
            "<summary>", escapeHtml(meta.title), "</summary>",
            "<div class='band-lock-section-body'>",
            "<div class='band-lock-actions'>",
            "<button type='button' class='band-lock-toggle-button' data-check-all='", sectionKey, "'>Check all</button>",
            "<button type='button' class='band-lock-toggle-button' data-uncheck-all='", sectionKey, "'>Uncheck all</button>",
            "<button type='button' class='band-lock-apply-button' data-apply-section='", sectionKey, "'>Apply</button>",
            "<span id='", indicatorIdForSection(sectionKey), "' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",
            "<div class='band-lock-grid'>", html, "</div>",
            "</div>",
            "</details>"
        ].join("");
    }

    function buildSectionDetails(title, bodyHtml, extraClass) {
        return [
            "<details class='band-lock-section band-lock-section-top qt-details ", extraClass || "", "'>",
            "<summary class='qt-details-summary'><span class='qt-details-arrow'></span> ", escapeHtml(title), "</summary>",
            "<div class='band-lock-section-body qt-details-body'>",
            bodyHtml,
            "</div>",
            "</details>"
        ].join("");
    }

    function buildModeOptions() {
        return SUPPORTED.ratModes.map(function (option) {
            return "<option value='" + escapeHtml(option.value) + "'>" + escapeHtml(option.label) + "</option>";
        }).join("");
    }

    function buildAcqOrderOptions() {
        return SUPPORTED.ratAcqOrders.map(function (option) {
            return "<option value='" + escapeHtml(option.value) + "'>" + escapeHtml(option.label) + "</option>";
        }).join("");
    }

    function buildRatSectionHtml() {
        return [
            "<details class='band-lock-section rat-section qt-details' id='rat-section'>",
            "<summary class='qt-details-summary'><span class='qt-details-arrow'></span> RAT Control</summary>",
            "<div class='band-lock-section-body qt-details-body'>",

            "<div class='rat-control-row'>",
            "<label for='rat-mode-select'>Mode preference</label>",
            "<select id='rat-mode-select'>", buildModeOptions(), "</select>",
            "<button id='rat-mode-apply' class='band-lock-apply-button qt-btn qt-btn-danger' type='button'>Apply</button>",
            "<span id='band-lock-rat-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",

            "<div class='rat-control-row'>",
            "<label for='rat-acq-order-select'>Acquisition order</label>",
            "<select id='rat-acq-order-select'>", buildAcqOrderOptions(), "</select>",
            "<button id='rat-acq-order-apply' class='band-lock-apply-button qt-btn qt-btn-danger' type='button'>Apply</button>",
            "<span id='rat-acq-order-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",

            "<div class='rat-control-row'>",
            "<label for='rat-nr5g-disable-select'>5G disable</label>",
            "<select id='rat-nr5g-disable-select'>",
            "<option value='0'>Enabled</option>",
            "<option value='1'>Disabled</option>",
            "</select>",
            "<button id='rat-nr5g-disable-apply' class='band-lock-apply-button qt-btn qt-btn-danger' type='button'>Apply</button>",
            "<span id='rat-nr5g-disable-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",

            "</div>",
            "</details>"
        ].join("");
    }

    function buildBandLockSectionHtml() {
        return [
            "<details class='band-lock-section band-lock-wrapper-section qt-details' id='band-lock-section'>",
            "<summary class='qt-details-summary'><span class='qt-details-arrow'></span> Band Locking</summary>",
            "<div class='band-lock-section-body qt-details-body'>",
            "<div class='band-lock-reset-row'>",
            "<button id='band-lock-reset' type='button' class='qt-btn qt-btn-secondary' title='Apply and save: mode_pref=AUTO, rat_acq_order=NR5G:LTE, nr5g_disable_mode=0, and all supported LTE/NSA/SA bands. Cell locks are not changed.'>Reset to safe defaults</button>",
            "</div>",
            buildCheckboxes("lte", []),
            buildCheckboxes("nsa", []),
            buildCheckboxes("sa", []),
            "</div>",
            "</details>"
        ].join("");
    }

    function buildPanelHtml() {
        return [
            "<div class='at-panel-content'>",
            "<h3 class='qt-card-header'>Band &amp; Cell Locking</h3>",
            "<p class='at-panel-note'>Reads and writes preferences through QNWPREFCFG and QNWLOCK. RAT mode, acquisition order, 5G disable, and band masks are saved and reapplied after reboot. Cell locking remains non-persistent. Refresh is manual on purpose so this page does not constantly compete with the stock status UI for modem queries.</p>",
            "<div id='band-lock-status' class='band-lock-status band-lock-status-info'>Ready.</div>",
            "<div class='band-lock-top-actions'>",
            "<button id='band-lock-refresh' class='qt-btn qt-btn-primary' type='button'>Refresh</button>",
            "</div>",
            buildSectionDetails("Current modem state", [
                "<div class='band-lock-current-grid'>",
                "<div class='band-lock-current-card'><h3>Current RAT</h3><div id='band-lock-current-rat' class='band-lock-current-value'></div></div>",
                "<div class='band-lock-current-card'><h3>Current LTE</h3><div id='band-lock-current-lte' class='band-lock-current-value'></div></div>",
                "<div class='band-lock-current-card'><h3>Current NSA</h3><div id='band-lock-current-nsa' class='band-lock-current-value'></div></div>",
                "<div class='band-lock-current-card'><h3>Current SA</h3><div id='band-lock-current-sa' class='band-lock-current-value'></div></div>",
                "</div>"
            ].join(""), "band-lock-section-top-state"),
            buildSectionDetails("Live radio status", [
                "<div class='band-lock-summary-grid'>",
                "<div class='band-lock-summary-card'><h3>Serving cell</h3><pre id='band-lock-servingcell' class='band-lock-raw'></pre></div>",
                "<div class='band-lock-summary-card'><h3>Network info</h3><pre id='band-lock-qnwinfo' class='band-lock-raw'></pre></div>",
                "<div class='band-lock-summary-card'><h3>CA info</h3><pre id='band-lock-qcainfo' class='band-lock-raw'></pre></div>",
                "</div>"
            ].join(""), "band-lock-section-top-radio"),
            buildRatSectionHtml(),
            buildCellLockPanelHtml(),
            buildBandLockSectionHtml(),
            "</div>"
        ].join("");
    }

    function buildEarfcnPciRow(index) {
        return [
            "<div class='cell-lock-pair-row' id='cell-lock-pair-", index, "' style='display:", index === 1 ? "flex" : "none", "'>",
            "<label>Cell ", index, "</label>",
            "<input type='text' class='cell-lock-input' id='cell-lock-earfcn-", index, "' placeholder='EARFCN' data-field='earfcn' data-index='", index, "'>",
            "<input type='text' class='cell-lock-input' id='cell-lock-pci-", index, "' placeholder='PCI' data-field='pci' data-index='", index, "'>",
            "</div>"
        ].join("");
    }

    function buildCellLockPanelHtml() {
        var earfcnPciRows = "";
        for (var i = 1; i <= 10; i++) {
            earfcnPciRows += buildEarfcnPciRow(i);
        }

        return [
            "<details class='band-lock-section cell-lock-section qt-details' id='cell-lock-panel'>",
            "<summary class='qt-details-summary'><span class='qt-details-arrow'></span> Cell Locking</summary>",
            "<div class='band-lock-section-body qt-details-body'>",

            "<div class='cell-lock-status-row'>",
            "<span class='cell-lock-status-label'>LTE:</span>",
            "<span id='cell-lock-lte-status' class='cell-lock-status-badge cell-lock-status-unlocked'>Not Locked</span>",
            "<span class='cell-lock-status-label'>NR5G:</span>",
            "<span id='cell-lock-nr5g-status' class='cell-lock-status-badge cell-lock-status-unlocked'>Not Locked</span>",
            "<button type='button' id='cell-lock-refresh-status' class='cell-lock-small-btn'>Refresh Status</button>",
            "</div>",

            "<div id='cell-lock-status-msg' class='band-lock-status band-lock-status-info' style='display:none'></div>",

            "<div class='cell-lock-scan-section'>",
            "<div class='cell-lock-scan-actions'>",
            "<button type='button' id='cell-lock-scan-btn' class='band-lock-apply-button qt-btn qt-btn-primary'>Scan Neighbor Cells</button>",
            "<span id='cell-lock-scan-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",
            "<div id='cell-lock-scan-results' style='display:none'>",
            "<table class='cell-lock-scan-table'>",
            "<thead><tr>",
            "<th>Type</th><th>EARFCN</th><th>PCI</th><th>Band</th><th>RSRP</th><th>SINR</th><th>SCS</th><th></th>",
            "</tr></thead>",
            "<tbody id='cell-lock-scan-tbody'></tbody>",
            "</table>",
            "</div>",
            "</div>",

            "<div class='cell-lock-form'>",
            "<div class='cell-lock-form-row'>",
            "<label for='cell-lock-action'>Action</label>",
            "<select id='cell-lock-action'>",
            "<option value=''>Select action...</option>",
            "<option value='lock_lte'>Lock LTE</option>",
            "<option value='lock_nr5g'>Lock NR5G-SA</option>",
            "<option value='unlock_lte'>Unlock LTE</option>",
            "<option value='unlock_nr5g'>Unlock NR5G-SA</option>",
            "</select>",
            "</div>",

            "<div id='cell-lock-lte-form' style='display:none'>",
            "<div class='cell-lock-form-row'>",
            "<label for='cell-lock-num-cells'>Number of cells</label>",
            "<input type='number' class='cell-lock-input cell-lock-input-sm' id='cell-lock-num-cells' min='1' max='10' value='1' placeholder='1-10'>",
            "</div>",
            earfcnPciRows,
            "</div>",

            "<div id='cell-lock-nr5g-form' style='display:none'>",
            "<div class='cell-lock-pair-row' style='display:flex'>",
            "<label>Cell</label>",
            "<input type='text' class='cell-lock-input' id='cell-lock-nr5g-earfcn' placeholder='EARFCN'>",
            "<input type='text' class='cell-lock-input' id='cell-lock-nr5g-pci' placeholder='PCI'>",
            "</div>",
            "<div class='cell-lock-pair-row' style='display:flex'>",
            "<label>Params</label>",
            "<select class='cell-lock-input' id='cell-lock-nr5g-scs'>",
            "<option value=''>SCS...</option>",
            "<option value='15'>15 kHz</option>",
            "<option value='30'>30 kHz</option>",
            "<option value='60'>60 kHz</option>",
            "<option value='120'>120 kHz</option>",
            "<option value='240'>240 kHz</option>",
            "</select>",
            "<input type='text' class='cell-lock-input' id='cell-lock-nr5g-band' placeholder='Band'>",
            "</div>",
            "</div>",

            "<div id='cell-lock-action-area' style='display:none'>",
            "<div class='cell-lock-form-row'>",
            "<label class='cell-lock-checkbox-label'>",
            "<input type='checkbox' id='cell-lock-cfun-restart'>",
            "<span>Radio restart (AT+CFUN=0/1)</span>",
            "</label>",
            "</div>",
            "<div class='cell-lock-form-row'>",
            "<button type='button' id='cell-lock-execute' class='band-lock-apply-button qt-btn qt-btn-danger'>Execute</button>",
            "<span id='cell-lock-execute-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
            "</div>",
            "</div>",

            "</div>",

            "<div class='cell-lock-notes'>",
            "<p>Cell locks are not persistent across reboots.</p>",
            "<p>NSA 5G cell locking is not supported by Quectel.</p>",
            "</div>",

            "</div>",
            "</details>"
        ].join("");
    }

    function buildScanResultsHtml(cells) {
        if (!cells || !cells.length) {
            return "<tr><td colspan='8' class='cell-lock-scan-empty'>No cells found.</td></tr>";
        }
        return cells.map(function (cell, idx) {
            var typeLabel = cell.type || "";
            if (cell.serving) {
                typeLabel = typeLabel.replace("_serving", "") + " ★";
            }
            typeLabel = typeLabel.replace(/_/g, " ").replace("lte intra", "LTE nbr").replace("lte inter", "LTE inter").replace("lte scan", "LTE scan").replace("lte", "LTE").replace("nr5g nsa", "NR5G-NSA").replace("nr5g sa", "NR5G-SA").replace("nr5g scan", "NR5G scan");
            var rowClass = cell.serving ? "cell-lock-scan-serving" : "";
            var isNr = cell.type && cell.type.indexOf("nr5g") >= 0;
            return [
                "<tr class='cell-lock-scan-row ", rowClass, "' data-cell-idx='", idx, "'>",
                "<td>", escapeHtml(typeLabel), "</td>",
                "<td>", escapeHtml(cell.earfcn || "-"), "</td>",
                "<td>", escapeHtml(cell.pci || "-"), "</td>",
                "<td>", escapeHtml(cell.band || "-"), "</td>",
                "<td>", escapeHtml(cell.rsrp || "-"), "</td>",
                "<td>", escapeHtml(cell.sinr || "-"), "</td>",
                "<td>", escapeHtml(cell.scs || "-"), "</td>",
                "<td><button type='button' class='cell-lock-fill-btn' data-cell-idx='", idx, "' title='Fill form'>&#8592;</button></td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    window.JtoolsBandLockingCore = {
        SECTION_META: SECTION_META,
        escapeHtml: escapeHtml,
        formatRawBlock: formatRawBlock,
        describeBandList: describeBandList,
        buildStateSummary: buildStateSummary,
        indicatorIdForSection: indicatorIdForSection,
        buildPanelHtml: buildPanelHtml,
        buildCellLockPanelHtml: buildCellLockPanelHtml,
        buildScanResultsHtml: buildScanResultsHtml
    };
})(window);
