(function (window, $) {
    "use strict";

    var core = window.JtoolsBandLockingCore;

    function setStatus(kind, text) {
        var node = document.getElementById("band-lock-status");
        if (!node) {
            return;
        }
        node.className = "band-lock-status band-lock-status-" + kind;
        node.textContent = text || "";
    }

    function setBusy(busy) {
        var buttons = document.querySelectorAll("#band-lock-panel button, #band-lock-panel select, #band-lock-panel input");
        Array.prototype.forEach.call(buttons, function (node) {
            if (busy) {
                node.setAttribute("disabled", "disabled");
            } else if (node.getAttribute("data-disabled-static") !== "true") {
                node.removeAttribute("disabled");
            }
        });
    }

    function setText(id, value) {
        var node = document.getElementById(id);
        if (node) {
            node.textContent = value || "";
        }
    }

    function setIndicator(id, kind, text) {
        var node = document.getElementById(id);
        if (!node) {
            return;
        }
        node.className = "band-lock-indicator band-lock-indicator-" + kind;
        node.textContent = text || "";
    }

    function clearIndicators() {
        ["band-lock-rat-indicator", "band-lock-lte-indicator", "band-lock-nsa-indicator", "band-lock-sa-indicator"].forEach(function (id) {
            setIndicator(id, "idle", "");
        });
    }

    function getCheckedBands(sectionKey) {
        var nodes = document.querySelectorAll("input[type='checkbox'][data-section='" + sectionKey + "']");
        var selected = [];
        Array.prototype.forEach.call(nodes, function (node) {
            if (node.checked) {
                selected.push(node.value);
            }
        });
        return selected;
    }

    function setCheckedBands(sectionKey, checked) {
        var lookup = {};
        checked.forEach(function (band) {
            lookup[band] = true;
        });
        var nodes = document.querySelectorAll("input[type='checkbox'][data-section='" + sectionKey + "']");
        Array.prototype.forEach.call(nodes, function (node) {
            node.checked = !!lookup[node.value];
        });
    }

    function renderFromState(state) {
        var modeSelect = document.getElementById("rat-mode-select");
        if (modeSelect) {
            modeSelect.value = state.mode_pref || "AUTO";
        }

        var serving = document.getElementById("band-lock-servingcell");
        if (serving) {
            serving.textContent = core.formatRawBlock(state.servingcell_summary);
        }

        var networkInfo = document.getElementById("band-lock-qnwinfo");
        if (networkInfo) {
            networkInfo.textContent = core.formatRawBlock(state.qnwinfo_summary);
        }

        var caInfo = document.getElementById("band-lock-qcainfo");
        if (caInfo) {
            caInfo.textContent = core.formatRawBlock(state.qcainfo_summary);
        }

        setCheckedBands("lte", state.lte_band_list || []);
        setCheckedBands("nsa", state.nsa_nr5g_band_list || []);
        setCheckedBands("sa", state.nr5g_band_list || []);

        setText("band-lock-current-rat", state.mode_pref || "AUTO");
        setText("band-lock-current-lte", core.describeBandList("lte", state.lte_band_list || []));
        setText("band-lock-current-nsa", core.describeBandList("nsa", state.nsa_nr5g_band_list || []));
        setText("band-lock-current-sa", core.describeBandList("sa", state.nr5g_band_list || []));
    }

    function fetchState(options) {
        options = options || {};

        setBusy(true);
        setStatus("info", options.loadingText || "Refreshing current preference state...");

        $.ajax({
            url: "/band_locking_api/state",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            if (!response || !response.ok) {
                setStatus("error", (response && response.error) || "Failed to read current state.");
                return;
            }
            renderFromState(response);
            if (typeof options.successText === "function") {
                setStatus("ok", options.successText(response));
            } else {
                setStatus("ok", options.successText || core.buildStateSummary(response));
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "State request failed.";
            setStatus("error", text);
        }).always(function () {
            setBusy(false);
        });
    }

    function applyRatMode() {
        var modeSelect = document.getElementById("rat-mode-select");
        var mode = modeSelect ? modeSelect.value : "";
        if (!mode) {
            setStatus("error", "Choose a RAT mode first.");
            return;
        }

        setBusy(true);
        setIndicator("band-lock-rat-indicator", "pending", "Writing...");
        setStatus("info", "Applying RAT mode " + mode + "...");

        $.ajax({
            url: "/band_locking_api/mode",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                mode: mode
            }
        }).done(function (response) {
            if (response && response.ok) {
                setIndicator("band-lock-rat-indicator", "ok", "Readback: " + (response.applied_mode || mode));
                fetchState({
                    loadingText: "RAT mode written. Reading back live modem state...",
                    successText: function (liveState) {
                        return "RAT mode applied. Modem now reports " + (liveState.mode_pref || "AUTO") + ".";
                    }
                });
            } else {
                setStatus("error", (response && response.error) || "Failed to apply RAT mode.");
                setIndicator("band-lock-rat-indicator", "error", "Failed");
                setBusy(false);
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "Mode apply failed.";
            setStatus("error", text);
            setIndicator("band-lock-rat-indicator", "error", "Error");
            setBusy(false);
        });
    }

    function applyBandSection(sectionKey) {
        var meta = core.SECTION_META[sectionKey];
        var bands = getCheckedBands(sectionKey);
        if (!bands.length) {
            setStatus("error", "Select at least one band in " + meta.title + ".");
            return;
        }

        var indicatorId = core.indicatorIdForSection(sectionKey);
        setBusy(true);
        setIndicator(indicatorId, "pending", "Writing...");
        setStatus("info", "Applying " + meta.title + "...");

        $.ajax({
            url: "/band_locking_api/bands",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                group: meta.group,
                bands: bands.join(":")
            }
        }).done(function (response) {
            if (response && response.ok) {
                setIndicator(indicatorId, "ok", "Readback: " + ((response.applied_list && response.applied_list.length) || 0) + " bands");
                fetchState({
                    loadingText: meta.title + " written. Reading back live modem state...",
                    successText: function (liveState) {
                        var key = sectionKey === "lte" ? "lte_band_list" : sectionKey === "nsa" ? "nsa_nr5g_band_list" : "nr5g_band_list";
                        var values = liveState[key] || [];
                        return meta.title + " applied. Modem now reports " + core.describeBandList(sectionKey, values) + ".";
                    }
                });
            } else {
                setStatus("error", (response && response.error) || "Failed to apply " + meta.title + ".");
                setIndicator(indicatorId, "error", "Failed");
                setBusy(false);
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "Band apply failed.";
            setStatus("error", text);
            setIndicator(indicatorId, "error", "Error");
            setBusy(false);
        });
    }

    function bindEvents() {
        var refreshBtn = document.getElementById("band-lock-refresh");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                setStatus("info", "Manual refresh requested...");
                fetchState();
            });
        }

        var ratApply = document.getElementById("rat-mode-apply");
        if (ratApply) {
            ratApply.addEventListener("click", function () {
                setIndicator("band-lock-rat-indicator", "pending", "Clicked");
                applyRatMode();
            });
        }

        var resetBtn = document.getElementById("band-lock-reset");
        if (resetBtn) {
            resetBtn.setAttribute("data-disabled-static", "true");
            resetBtn.setAttribute("disabled", "disabled");
        }

        Array.prototype.forEach.call(document.querySelectorAll("[data-check-all]"), function (node) {
            node.addEventListener("click", function () {
                var sectionKey = node.getAttribute("data-check-all");
                setCheckedBands(sectionKey, core.SECTION_META[sectionKey].supported);
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll("[data-uncheck-all]"), function (node) {
            node.addEventListener("click", function () {
                setCheckedBands(node.getAttribute("data-uncheck-all"), []);
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll("[data-apply-section]"), function (node) {
            node.addEventListener("click", function () {
                var sectionKey = node.getAttribute("data-apply-section");
                setIndicator(core.indicatorIdForSection(sectionKey), "pending", "Clicked");
                applyBandSection(sectionKey);
            });
        });
    }

    function renderPanel() {
        if (document.getElementById("band-lock-panel")) {
            return;
        }

        var panel = document.createElement("div");
        panel.id = "band-lock-panel";
        panel.className = "body-box form-row";
        panel.innerHTML = core.buildPanelHtml();

        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (htmlGoesHere) {
            htmlGoesHere.appendChild(panel);
        }

        bindEvents();
        clearIndicators();
        fetchState();
    }

    window.JtoolsBandLocking = {
        init: function () {
            renderPanel();
        }
    };
})(window, jQuery);
