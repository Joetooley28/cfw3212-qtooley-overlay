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
            "<details class='band-lock-section' open>",
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
            "<details class='band-lock-section band-lock-section-top ", extraClass || "", "' open>",
            "<summary>", escapeHtml(title), "</summary>",
            "<div class='band-lock-section-body'>",
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

    function buildPanelHtml() {
        return [
            "<div class='at-panel-content'>",
            "<p class='at-panel-note'>Reads and writes band preferences through QNWPREFCFG. Refresh is manual on purpose so this page does not constantly compete with the stock status UI for modem queries.</p>",
            "<div id='band-lock-status' class='band-lock-status band-lock-status-info'>Ready.</div>",
            buildSectionDetails("RAT selection", [
                "<div class='band-lock-rat-top'>",
                "<div class='band-lock-rat-row'>",
                "<label for='rat-mode-select'>RAT mode</label>",
                "<select id='rat-mode-select'>", buildModeOptions(), "</select>",
                "<button id='rat-mode-apply' class='band-lock-apply-button' type='button'>Apply</button>",
                "<span id='band-lock-rat-indicator' class='band-lock-indicator band-lock-indicator-idle'></span>",
                "</div>",
                "</div>"
            ].join(""), "band-lock-section-top-rat"),
            "<div class='band-lock-top-actions'>",
            "<button id='band-lock-refresh' type='button'>Refresh</button>",
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
            "<div class='band-lock-reset-row'>",
            "<button id='band-lock-reset' type='button' class='secondary' title='Reset wiring will be enabled after restore_band handling is verified on this build.'>Reset to defaults</button>",
            "</div>",
            buildCheckboxes("lte", []),
            buildCheckboxes("nsa", []),
            buildCheckboxes("sa", []),
            "</div>"
        ].join("");
    }

    window.JtoolsBandLockingCore = {
        SECTION_META: SECTION_META,
        formatRawBlock: formatRawBlock,
        describeBandList: describeBandList,
        buildStateSummary: buildStateSummary,
        indicatorIdForSection: indicatorIdForSection,
        buildPanelHtml: buildPanelHtml
    };
})(window);
