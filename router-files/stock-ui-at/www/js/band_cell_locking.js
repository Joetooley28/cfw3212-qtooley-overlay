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
        ["band-lock-rat-indicator", "rat-acq-order-indicator", "rat-nr5g-disable-indicator", "band-lock-lte-indicator", "band-lock-nsa-indicator", "band-lock-sa-indicator"].forEach(function (id) {
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

        var acqSelect = document.getElementById("rat-acq-order-select");
        if (acqSelect && state.rat_acq_order) {
            acqSelect.value = state.rat_acq_order;
        }

        var nr5gDisSelect = document.getElementById("rat-nr5g-disable-select");
        if (nr5gDisSelect) {
            nr5gDisSelect.value = state.nr5g_disable_mode || "0";
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
            if (typeof options.onComplete === "function") {
                options.onComplete();
            }
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

    function applyRatAcqOrder() {
        var select = document.getElementById("rat-acq-order-select");
        var order = select ? select.value : "";
        if (!order) {
            setStatus("error", "Choose an acquisition order first.");
            return;
        }

        setBusy(true);
        setIndicator("rat-acq-order-indicator", "pending", "Writing...");
        setStatus("info", "Applying RAT acquisition order " + order + "...");

        $.ajax({
            url: "/band_locking_api/rat_acq_order",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                order: order
            }
        }).done(function (response) {
            if (response && response.ok) {
                setIndicator("rat-acq-order-indicator", "ok", "Readback: " + (response.applied_order || order));
                fetchState({
                    loadingText: "Acquisition order written. Reading back live modem state...",
                    successText: function (liveState) {
                        return "RAT acquisition order applied: " + (liveState.rat_acq_order || order) + ".";
                    }
                });
            } else {
                setStatus("error", (response && response.error) || "Failed to apply acquisition order.");
                setIndicator("rat-acq-order-indicator", "error", "Failed");
                setBusy(false);
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "Acquisition order apply failed.";
            setStatus("error", text);
            setIndicator("rat-acq-order-indicator", "error", "Error");
            setBusy(false);
        });
    }

    function applyNr5gDisable() {
        var select = document.getElementById("rat-nr5g-disable-select");
        var val = select ? select.value : "0";

        setBusy(true);
        setIndicator("rat-nr5g-disable-indicator", "pending", "Writing...");
        var label = val === "1" ? "Disabling" : "Enabling";
        setStatus("info", label + " 5G...");

        $.ajax({
            url: "/band_locking_api/nr5g_disable",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                value: val
            }
        }).done(function (response) {
            if (response && response.ok) {
                var readback = response.applied_value === "1" ? "Disabled" : "Enabled";
                setIndicator("rat-nr5g-disable-indicator", "ok", "Readback: " + readback);
                fetchState({
                    loadingText: "5G disable mode written. Reading back live modem state...",
                    successText: function () {
                        return "5G " + (val === "1" ? "disabled" : "enabled") + " successfully.";
                    }
                });
            } else {
                setStatus("error", (response && response.error) || "Failed to apply 5G disable mode.");
                setIndicator("rat-nr5g-disable-indicator", "error", "Failed");
                setBusy(false);
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "5G disable mode apply failed.";
            setStatus("error", text);
            setIndicator("rat-nr5g-disable-indicator", "error", "Error");
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

        var acqApply = document.getElementById("rat-acq-order-apply");
        if (acqApply) {
            acqApply.addEventListener("click", function () {
                setIndicator("rat-acq-order-indicator", "pending", "Clicked");
                applyRatAcqOrder();
            });
        }

        var nr5gDisApply = document.getElementById("rat-nr5g-disable-apply");
        if (nr5gDisApply) {
            nr5gDisApply.addEventListener("click", function () {
                setIndicator("rat-nr5g-disable-indicator", "pending", "Clicked");
                applyNr5gDisable();
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

    var cellScanData = [];

    function setCellStatus(msg, kind) {
        var node = document.getElementById("cell-lock-status-msg");
        if (!node) {
            return;
        }
        node.style.display = msg ? "block" : "none";
        node.className = "band-lock-status band-lock-status-" + (kind || "info");
        node.textContent = msg || "";
    }

    function setCellBusy(busy) {
        var nodes = document.querySelectorAll("#cell-lock-panel button, #cell-lock-panel select, #cell-lock-panel input");
        Array.prototype.forEach.call(nodes, function (node) {
            if (busy) {
                node.setAttribute("disabled", "disabled");
            } else {
                node.removeAttribute("disabled");
            }
        });
    }

    function fetchCellState() {
        $.ajax({
            url: "/band_locking_api/cell_state",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            if (!response || !response.ok) {
                return;
            }
            var lteNode = document.getElementById("cell-lock-lte-status");
            var nr5gNode = document.getElementById("cell-lock-nr5g-status");
            if (lteNode) {
                lteNode.textContent = response.lte_locked ? "Locked" : "Not Locked";
                lteNode.className = "cell-lock-status-badge " + (response.lte_locked ? "cell-lock-status-locked" : "cell-lock-status-unlocked");
                if (response.lte_locked && response.lte_detail) {
                    lteNode.title = response.lte_detail;
                } else {
                    lteNode.title = "";
                }
            }
            if (nr5gNode) {
                nr5gNode.textContent = response.nr5g_locked ? "Locked" : "Not Locked";
                nr5gNode.className = "cell-lock-status-badge " + (response.nr5g_locked ? "cell-lock-status-locked" : "cell-lock-status-unlocked");
                if (response.nr5g_locked && response.nr5g_detail) {
                    nr5gNode.title = response.nr5g_detail;
                } else {
                    nr5gNode.title = "";
                }
            }
        });
    }

    function scanCells(retryCount) {
        retryCount = retryCount || 0;
        setCellBusy(true);
        setIndicator("cell-lock-scan-indicator", "pending", retryCount > 0 ? "Retrying..." : "Scanning...");
        setCellStatus(retryCount > 0 ? "AT channel was busy, retrying (" + retryCount + "/3)..." : "Scanning cells (serving + neighbor + NR5G scan, may take ~10s)...", "info");

        $.ajax({
            url: "/band_locking_api/cell_scan",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            if (!response || !response.ok) {
                setCellStatus((response && response.error) || "Scan failed.", "error");
                setIndicator("cell-lock-scan-indicator", "error", "Failed");
                setCellBusy(false);
                return;
            }
            cellScanData = response.cells || [];
            var tbody = document.getElementById("cell-lock-scan-tbody");
            var resultsDiv = document.getElementById("cell-lock-scan-results");
            if (tbody) {
                tbody.innerHTML = core.buildScanResultsHtml(cellScanData);
            }
            if (resultsDiv) {
                resultsDiv.style.display = "block";
            }
            setIndicator("cell-lock-scan-indicator", "ok", cellScanData.length + " cells");
            setCellStatus("Found " + cellScanData.length + " cell(s).", "ok");

            bindFillButtons();
            setCellBusy(false);
        }).fail(function (xhr) {
            if (xhr.status === 409 && retryCount < 3) {
                setTimeout(function () { scanCells(retryCount + 1); }, 1000);
                return;
            }
            var errText = "Scan request failed.";
            try {
                var body = JSON.parse(xhr.responseText);
                if (body && body.error) errText = body.error;
            } catch (e) {}
            setCellStatus(errText, "error");
            setIndicator("cell-lock-scan-indicator", "error", "Error");
            setCellBusy(false);
        });
    }

    function fillFromCell(cell) {
        var actionSelect = document.getElementById("cell-lock-action");
        if (!cell || !actionSelect) {
            return;
        }

        var isNr = cell.type && cell.type.indexOf("nr5g") >= 0;

        if (isNr) {
            actionSelect.value = "lock_nr5g";
            onActionChange();
            var earfcnInput = document.getElementById("cell-lock-nr5g-earfcn");
            var pciInput = document.getElementById("cell-lock-nr5g-pci");
            var scsSelect = document.getElementById("cell-lock-nr5g-scs");
            var bandInput = document.getElementById("cell-lock-nr5g-band");
            if (earfcnInput) earfcnInput.value = cell.earfcn || "";
            if (pciInput) pciInput.value = cell.pci || "";
            if (scsSelect && cell.scs && cell.scs !== "-") scsSelect.value = cell.scs;
            if (bandInput && cell.band && cell.band !== "-") bandInput.value = cell.band;
        } else {
            actionSelect.value = "lock_lte";
            onActionChange();
            var earfcn1 = document.getElementById("cell-lock-earfcn-1");
            var pci1 = document.getElementById("cell-lock-pci-1");
            if (earfcn1) earfcn1.value = cell.earfcn || "";
            if (pci1) pci1.value = cell.pci || "";
        }

        setCellStatus("Form filled from scan: " + (cell.type || "cell").replace(/_/g, " ") + " EARFCN=" + (cell.earfcn || "?") + " PCI=" + (cell.pci || "?"), "info");
    }

    function bindFillButtons() {
        Array.prototype.forEach.call(document.querySelectorAll(".cell-lock-fill-btn"), function (btn) {
            btn.addEventListener("click", function () {
                var idx = parseInt(btn.getAttribute("data-cell-idx"), 10);
                if (cellScanData[idx]) {
                    fillFromCell(cellScanData[idx]);
                }
            });
        });
    }

    function onActionChange() {
        var actionSelect = document.getElementById("cell-lock-action");
        var action = actionSelect ? actionSelect.value : "";
        var lteForm = document.getElementById("cell-lock-lte-form");
        var nr5gForm = document.getElementById("cell-lock-nr5g-form");
        var actionArea = document.getElementById("cell-lock-action-area");
        var executeBtn = document.getElementById("cell-lock-execute");

        if (lteForm) lteForm.style.display = (action === "lock_lte") ? "block" : "none";
        if (nr5gForm) nr5gForm.style.display = (action === "lock_nr5g") ? "block" : "none";
        if (actionArea) actionArea.style.display = action ? "block" : "none";

        if (executeBtn) {
            if (action === "unlock_lte") {
                executeBtn.textContent = "Unlock LTE";
            } else if (action === "unlock_nr5g") {
                executeBtn.textContent = "Unlock NR5G-SA";
            } else if (action === "lock_lte") {
                executeBtn.textContent = "Lock LTE Cells";
            } else if (action === "lock_nr5g") {
                executeBtn.textContent = "Lock NR5G-SA Cell";
            } else {
                executeBtn.textContent = "Execute";
            }
        }
    }

    function onNumCellsChange() {
        var numInput = document.getElementById("cell-lock-num-cells");
        var num = parseInt(numInput ? numInput.value : "1", 10) || 1;
        if (num < 1) num = 1;
        if (num > 10) num = 10;
        for (var i = 1; i <= 10; i++) {
            var row = document.getElementById("cell-lock-pair-" + i);
            if (row) {
                row.style.display = (i <= num) ? "flex" : "none";
            }
        }
    }

    function executeCellLock() {
        var actionSelect = document.getElementById("cell-lock-action");
        var action = actionSelect ? actionSelect.value : "";
        if (!action) {
            setCellStatus("Select an action first.", "error");
            return;
        }

        var cfunRestart = document.getElementById("cell-lock-cfun-restart");
        var cfunVal = (cfunRestart && cfunRestart.checked) ? "1" : "0";

        var postData = {
            csrfToken: csrfToken,
            action: action,
            cfun_restart: cfunVal
        };

        if (action === "lock_lte") {
            var numInput = document.getElementById("cell-lock-num-cells");
            var numCells = parseInt(numInput ? numInput.value : "1", 10) || 1;
            var pairs = [];
            for (var i = 1; i <= numCells; i++) {
                var earfcn = document.getElementById("cell-lock-earfcn-" + i);
                var pci = document.getElementById("cell-lock-pci-" + i);
                var eVal = earfcn ? earfcn.value.trim() : "";
                var pVal = pci ? pci.value.trim() : "";
                if (!eVal || !pVal) {
                    setCellStatus("Fill in EARFCN and PCI for cell " + i + ".", "error");
                    return;
                }
                pairs.push({ earfcn: eVal, pci: pVal });
            }
            postData.num_cells = String(numCells);
            postData.pairs = JSON.stringify(pairs);
        }

        if (action === "lock_nr5g") {
            var earfcn = document.getElementById("cell-lock-nr5g-earfcn");
            var pci = document.getElementById("cell-lock-nr5g-pci");
            var scs = document.getElementById("cell-lock-nr5g-scs");
            var band = document.getElementById("cell-lock-nr5g-band");
            var eVal = earfcn ? earfcn.value.trim() : "";
            var pVal = pci ? pci.value.trim() : "";
            var sVal = scs ? scs.value : "";
            var bVal = band ? band.value.trim() : "";
            if (!eVal || !pVal || !sVal || !bVal) {
                setCellStatus("Fill in all fields: EARFCN, PCI, SCS, and Band.", "error");
                return;
            }
            postData.earfcn = eVal;
            postData.pci = pVal;
            postData.scs = sVal;
            postData.band = bVal;
        }

        setCellBusy(true);
        setIndicator("cell-lock-execute-indicator", "pending", "Sending...");
        setCellStatus("Sending cell lock command...", "info");

        $.ajax({
            url: "/band_locking_api/cell_lock",
            type: "POST",
            dataType: "json",
            data: postData
        }).done(function (response) {
            if (response && response.ok) {
                setCellStatus(response.message || "Command sent successfully.", "ok");
                setIndicator("cell-lock-execute-indicator", "ok", "Done");
                fetchCellState();
            } else {
                setCellStatus((response && response.error) || "Cell lock command failed.", "error");
                setIndicator("cell-lock-execute-indicator", "error", "Failed");
            }
        }).fail(function (xhr) {
            var errText = "Cell lock request failed.";
            try {
                var body = JSON.parse(xhr.responseText);
                if (body && body.error) errText = body.error;
            } catch (e) {}
            setCellStatus(errText, "error");
            setIndicator("cell-lock-execute-indicator", "error", "Error");
        }).always(function () {
            setCellBusy(false);
        });
    }

    function bindCellLockEvents() {
        var scanBtn = document.getElementById("cell-lock-scan-btn");
        if (scanBtn) {
            scanBtn.addEventListener("click", scanCells);
        }

        var actionSelect = document.getElementById("cell-lock-action");
        if (actionSelect) {
            actionSelect.addEventListener("change", onActionChange);
        }

        var numInput = document.getElementById("cell-lock-num-cells");
        if (numInput) {
            numInput.addEventListener("input", onNumCellsChange);
            numInput.addEventListener("change", onNumCellsChange);
        }

        var executeBtn = document.getElementById("cell-lock-execute");
        if (executeBtn) {
            executeBtn.addEventListener("click", executeCellLock);
        }

        var refreshStatusBtn = document.getElementById("cell-lock-refresh-status");
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener("click", function () {
                fetchCellState();
                setCellStatus("Refreshing cell lock status...", "info");
            });
        }
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
        bindCellLockEvents();
        fetchState({ onComplete: fetchCellState });
    }

    window.JtoolsBandLocking = {
        init: function () {
            renderPanel();
        }
    };
})(window, jQuery);
