/* ================================================================
   Screensaver Settings — Standalone Page
   Talks directly to /screensaver_api/settings (GET/POST)
   No dependency on quick_overview_core.js or quick_overview.js
   ================================================================ */
(function () {
    "use strict";

    var API_URL = "/screensaver_api/settings";

    var defaults = {
        enabled: true,
        timeout: 45000,
        dismissMode: "movement",
        weightRsrp: 50,
        weightSinr: 30,
        weightRsrq: 20
    };

    var state = {
        settings: null,
        loading: true,
        saving: false
    };

    var toastTimer = null;
    // ── Helpers ──

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(str) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(str));
        return d.innerHTML;
    }

    function showToast(msg) {
        var el = $("ssToast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.classList.remove("is-visible");
        }, 2000);
    }

    // ── API ──

    function loadSettings(cb) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", API_URL + "?csrfToken=" + encodeURIComponent(csrfToken), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    var data = response && response.settings ? response.settings : response;
                    state.settings = {};
                    for (var k in defaults) {
                        state.settings[k] = data.hasOwnProperty(k) ? data[k] : defaults[k];
                    }
                } catch (e) {
                    state.settings = JSON.parse(JSON.stringify(defaults));
                }
            } else {
                state.settings = JSON.parse(JSON.stringify(defaults));
            }
            state.loading = false;
            if (cb) cb();
        };
        xhr.send();
    }

    function saveSettings(partial, cb) {
        if (!state.settings) return;
        for (var k in partial) {
            if (partial.hasOwnProperty(k)) {
                state.settings[k] = partial[k];
            }
        }
        state.saving = true;
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            state.saving = false;
            if (xhr.status === 200) {
                showToast("Settings saved");
            } else {
                showToast("Save failed");
            }
            if (cb) cb();
        };
        xhr.send(JSON.stringify({
            csrfToken: csrfToken,
            settings: state.settings
        }));
    }

    // ── Render ──

    function getHost() {
        return document.getElementById("htmlGoesHere");
    }

    function render() {
        var host = getHost();
        if (!host) return;

        if (state.loading) {
            host.innerHTML = [
                "<div class='ss-page'>",
                "  <div class='ss-page-header'><h1 class='ss-page-title'>Screensaver Settings</h1></div>",
                "  <div class='ss-loading'><span class='ss-loading-dot'>Loading settings\u2026</span></div>",
                "</div>"
            ].join("\n");
            return;
        }

        var s = state.settings;
        var sum = s.weightRsrp + s.weightSinr + s.weightRsrq;
        var sumValid = sum === 100;

        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        var ampm = h >= 12 ? "PM" : "AM";
        var h12 = h % 12 || 12;
        var clockStr = (h12 < 10 ? "0" : "") + h12 + ":" + (m < 10 ? "0" : "") + m;

        host.innerHTML = [
            "<div class='ss-page'>",
            "  <div class='ss-page-header'><h1 class='ss-page-title'>Screensaver Settings</h1></div>",

            // Enable / Disable card
            "  <div class='ss-card'>",
            "    <div class='ss-card-title'>Screensaver Control</div>",
            "    <div class='ss-setting-row'>",
            "      <span class='ss-setting-label'>Enable Screensaver</span>",
            "      <label class='ss-toggle'>",
            "        <input type='checkbox' id='ssEnabled' " + (s.enabled ? "checked" : "") + ">",
            "        <span class='ss-toggle-track'></span>",
            "      </label>",
            "      <span class='ss-status " + (s.enabled ? "is-on" : "is-off") + "' id='ssStatusLabel'>" + (s.enabled ? "Active" : "Disabled") + "</span>",
            "    </div>",
            "    <div class='ss-setting-row'>",
            "      <span class='ss-setting-label'>Idle Timeout</span>",
            "      <select class='ss-select' id='ssTimeout'>",
            "        <option value='30000'" + (s.timeout === 30000 ? " selected" : "") + ">30 seconds</option>",
            "        <option value='45000'" + (s.timeout === 45000 ? " selected" : "") + ">45 seconds</option>",
            "        <option value='60000'" + (s.timeout === 60000 ? " selected" : "") + ">60 seconds</option>",
            "        <option value='120000'" + (s.timeout === 120000 ? " selected" : "") + ">2 minutes</option>",
            "        <option value='300000'" + (s.timeout === 300000 ? " selected" : "") + ">5 minutes</option>",
            "      </select>",
            "    </div>",
            "  </div>",

            // Grade weights card
            "  <div class='ss-card'>",
            "    <div class='ss-card-title'>Signal Grade Weights</div>",
            "    <div class='ss-setting-row'>",
            "      <span class='ss-setting-label'>Grade Formula</span>",
            "      <div class='ss-weight-group'>",
            "        <div class='ss-weight-item'>",
            "          <span>RSRP</span>",
            "          <input type='number' class='ss-weight-input' id='ssWeightRsrp' min='0' max='100' value='" + s.weightRsrp + "'>",
            "          <span>%</span>",
            "        </div>",
            "        <div class='ss-weight-item'>",
            "          <span>SNR</span>",
            "          <input type='number' class='ss-weight-input' id='ssWeightSinr' min='0' max='100' value='" + s.weightSinr + "'>",
            "          <span>%</span>",
            "        </div>",
            "        <div class='ss-weight-item'>",
            "          <span>RSRQ</span>",
            "          <input type='number' class='ss-weight-input' id='ssWeightRsrq' min='0' max='100' value='" + s.weightRsrq + "'>",
            "          <span>%</span>",
            "        </div>",
            "        <span class='ss-weight-sum " + (sumValid ? "is-valid" : "is-invalid") + "' id='ssWeightSum'>\u03A3 " + sum + "%</span>",
            "      </div>",
            "    </div>",
            "    <div class='ss-formula-info'>",
            "      Each metric is normalized to 0\u2013100% within its range:<br>",
            "      <code>RSRP: -120 to -70 dBm</code> &nbsp; ",
            "      <code>RSRQ: -20 to -5 dB</code> &nbsp; ",
            "      <code>SNR: -5 to 30 dB</code><br>",
            "      Grade = <code>RSRP \u00d7 " + s.weightRsrp + "% + SNR \u00d7 " + s.weightSinr + "% + RSRQ \u00d7 " + s.weightRsrq + "%</code>",
            "    </div>",
            "  </div>",

            // Preview card
            "  <div class='ss-card'>",
            "    <div class='ss-card-title'>Preview</div>",
            "    <div class='ss-preview-wrap' id='ssPreviewBtn'>",
            "      <div class='ss-preview-content'>",
            "        <div class='ss-preview-clock'>" + clockStr + " <span style='font-size:16px;color:#8a8f98;letter-spacing:2px'>" + ampm + "</span></div>",
            "        <div class='ss-preview-label'>Click to launch screensaver</div>",
            "      </div>",
            "    </div>",
            "  </div>",

            // Toast
            "  <div class='ss-toast' id='ssToast'></div>",
            "</div>"
        ].join("\n");

        wireControls();
    }

    // ── Wire Controls ──

    function wireControls() {
        var enabledEl = $("ssEnabled");
        var timeoutEl = $("ssTimeout");
        var statusLabel = $("ssStatusLabel");
        var previewBtn = $("ssPreviewBtn");

        if (enabledEl) {
            enabledEl.addEventListener("change", function () {
                var on = enabledEl.checked;
                if (statusLabel) {
                    statusLabel.textContent = on ? "Active" : "Disabled";
                    statusLabel.className = "ss-status " + (on ? "is-on" : "is-off");
                }
                saveSettings({ enabled: on });
            });
        }

        if (timeoutEl) {
            timeoutEl.addEventListener("change", function () {
                saveSettings({ timeout: parseInt(timeoutEl.value, 10) });
            });
        }

        // Weight inputs
        var weightIds = ["ssWeightRsrp", "ssWeightSinr", "ssWeightRsrq"];
        var weightKeys = ["weightRsrp", "weightSinr", "weightRsrq"];

        weightIds.forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener("input", function () {
                var r = parseInt($("ssWeightRsrp").value, 10) || 0;
                var sn = parseInt($("ssWeightSinr").value, 10) || 0;
                var q = parseInt($("ssWeightRsrq").value, 10) || 0;
                var total = r + sn + q;
                var sumEl = $("ssWeightSum");
                if (sumEl) {
                    sumEl.textContent = "\u03A3 " + total + "%";
                    sumEl.className = "ss-weight-sum " + (total === 100 ? "is-valid" : "is-invalid");
                }
                if (total === 100) {
                    saveSettings({ weightRsrp: r, weightSinr: sn, weightRsrq: q });
                }
            });
        });

        // Preview — trigger the screensaver if available
        if (previewBtn) {
            previewBtn.addEventListener("click", function () {
                if (window.JtoolsScreensaver && typeof window.JtoolsScreensaver.show === "function") {
                    window.JtoolsScreensaver.show();
                } else {
                    showToast("Screensaver not loaded on this page");
                }
            });
        }
    }

    // ── Init ──

    function applyShellClass() {
        if (document.body) {
            document.body.classList.add("jtools-layout-wide-sticky");
            document.body.classList.add("jtools-page-screensaver-settings");
        }
    }

    function init() {
        applyShellClass();
        waitForShellReady(80);
    }

    function waitForShellReady(remainingChecks) {
        if (getHost()) {
            loadSettings(function () {
                render();
            });
            return;
        }
        if (remainingChecks <= 0) {
            return;
        }
        setTimeout(function () {
            waitForShellReady(remainingChecks - 1);
        }, 50);
    }

    window.JtoolsScreensaverSettings = {
        init: init
    };

})();
