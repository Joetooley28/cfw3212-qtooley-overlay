/* ================================================================
   Settings page
   Screensaver settings + release update status
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
        release: null,
        loading: true,
        saving: false,
        checkingUpdates: false
    };

    var toastTimer = null;

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(str) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(str == null ? "" : String(str)));
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
        }, 2200);
    }

    function parseResponse(xhr) {
        try {
            return JSON.parse(xhr.responseText);
        } catch (e) {
            return null;
        }
    }

    function formatUtc(value) {
        if (!value) return "Unavailable";
        var date = new Date(value);
        if (isNaN(date.getTime())) {
            return escapeHtml(value);
        }
        return escapeHtml(date.toLocaleString());
    }

    function releaseBadgeClass(release) {
        var status = release && release.status ? release.status : "unknown";
        if (status === "current") return "is-current";
        if (status === "update_available") return "is-update";
        return "is-unknown";
    }

    function releaseBadgeText(release) {
        var status = release && release.status ? release.status : "unknown";
        if (status === "current") return "Up to date";
        if (status === "update_available") return "Update available";
        return "Check unavailable";
    }

    function fetchSettings(forceRefresh, cb) {
        var xhr = new XMLHttpRequest();
        var url = API_URL + "?csrfToken=" + encodeURIComponent(csrfToken);
        if (forceRefresh) {
            url += "&refresh=1";
        }

        xhr.open("GET", url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            var response = parseResponse(xhr) || {};
            var data = response.settings || {};
            var release = response.release || {};

            state.settings = {};
            for (var k in defaults) {
                if (Object.prototype.hasOwnProperty.call(defaults, k)) {
                    state.settings[k] = Object.prototype.hasOwnProperty.call(data, k) ? data[k] : defaults[k];
                }
            }
            state.release = release;
            state.loading = false;
            state.checkingUpdates = false;

            if (cb) cb(xhr.status === 200, response);
        };
        xhr.send();
    }

    function loadSettings(cb) {
        fetchSettings(false, cb);
    }

    function refreshReleaseInfo() {
        if (state.checkingUpdates) {
            return;
        }
        state.checkingUpdates = true;
        render();
        fetchSettings(true, function (ok) {
            render();
            showToast(ok ? "Checked for updates" : "Update check failed");
        });
    }

    function saveSettings(partial, cb) {
        if (!state.settings) return;

        for (var k in partial) {
            if (Object.prototype.hasOwnProperty.call(partial, k)) {
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
            showToast(xhr.status === 200 ? "Settings saved" : "Save failed");
            if (cb) cb(xhr.status === 200);
        };
        xhr.send(JSON.stringify({
            csrfToken: csrfToken,
            settings: state.settings
        }));
    }

    function renderLoading(host) {
        host.innerHTML = [
            "<div class='ss-page'>",
            "  <div class='ss-page-header'>",
            "    <div>",
            "      <h1 class='ss-page-title'>Settings</h1>",
            "      <p class='ss-page-subtitle'>Screensaver controls and Qtooley release status.</p>",
            "    </div>",
            "  </div>",
            "  <div class='ss-loading'><span class='ss-loading-dot'>Loading settings...</span></div>",
            "</div>"
        ].join("\n");
    }

    function renderReleaseSection() {
        var release = state.release || {};
        var releaseUrl = release.release_url ? String(release.release_url) : "";
        var releaseLink = releaseUrl
            ? "<a class='ss-link' href='" + escapeHtml(releaseUrl) + "' target='_blank' rel='noopener noreferrer'>Open latest GitHub release</a>"
            : "<span class='ss-muted'>Latest release link unavailable</span>";
        var currentVersion = release.current_version || "Unavailable";
        var currentDate = release.current_release_date || "Unavailable";
        var latestVersion = release.latest_version || "Unavailable";
        var latestPublished = release.latest_published_at ? formatUtc(release.latest_published_at) : "Unavailable";
        var checkedAt = release.checked_at ? formatUtc(release.checked_at) : "Not checked yet";
        var zipAsset = release.zip_asset_name || "Unavailable";
        var statusText = release.status_text || "Latest release information is unavailable.";
        var buttonLabel = state.checkingUpdates ? "Checking..." : "Check now";

        return [
            "<div class='ss-card ss-card-updates'>",
            "  <div class='ss-card-title-row'>",
            "    <div>",
            "      <div class='ss-card-title'>Qtooley Updates</div>",
            "      <div class='ss-card-note'>Use this section to confirm what release the router is on before you update from GitHub or a Windows ZIP.</div>",
            "    </div>",
            "    <button type='button' class='ss-button ss-button-primary' id='ssCheckUpdates'" + (state.checkingUpdates ? " disabled" : "") + ">" + escapeHtml(buttonLabel) + "</button>",
            "  </div>",
            "  <div class='ss-release-summary'>",
            "    <span class='ss-release-badge " + releaseBadgeClass(release) + "'>" + escapeHtml(releaseBadgeText(release)) + "</span>",
            "    <span class='ss-release-status-text'>" + escapeHtml(statusText) + "</span>",
            "  </div>",
            "  <div class='ss-info-grid'>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Current installed version</span>",
            "      <span class='ss-info-value'>" + escapeHtml(currentVersion) + "</span>",
            "    </div>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Installed release date</span>",
            "      <span class='ss-info-value'>" + escapeHtml(currentDate) + "</span>",
            "    </div>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Latest available version</span>",
            "      <span class='ss-info-value'>" + escapeHtml(latestVersion) + "</span>",
            "    </div>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Latest published</span>",
            "      <span class='ss-info-value'>" + latestPublished + "</span>",
            "    </div>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Installer ZIP asset</span>",
            "      <span class='ss-info-value ss-info-value-break'>" + escapeHtml(zipAsset) + "</span>",
            "    </div>",
            "    <div class='ss-info-item'>",
            "      <span class='ss-info-label'>Last checked</span>",
            "      <span class='ss-info-value'>" + checkedAt + "</span>",
            "    </div>",
            "  </div>",
            "  <div class='ss-update-help'>",
            "    <div class='ss-update-help-line'><span class='ss-help-label'>Direct GitHub update path</span><span class='ss-help-value'>Best for routers that already have working internet.</span></div>",
            "    <div class='ss-update-help-line'><span class='ss-help-label'>Windows ZIP path</span><span class='ss-help-value'>Best when the router still needs PC-assisted install or update over SSH.</span></div>",
            "    <div class='ss-update-help-line'><span class='ss-help-label'>Latest release page</span><span class='ss-help-value'>" + releaseLink + "</span></div>",
            "  </div>",
            "</div>"
        ].join("\n");
    }

    function renderSettingsSection() {
        var s = state.settings;
        var sum = s.weightRsrp + s.weightSinr + s.weightRsrq;
        var sumValid = sum === 100;
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        var ampm = h >= 12 ? "PM" : "AM";
        var h12 = h % 12 || 12;
        var clockStr = (h12 < 10 ? "0" : "") + h12 + ":" + (m < 10 ? "0" : "") + m;

        return [
            "<div class='ss-card'>",
            "  <div class='ss-card-title-row'>",
            "    <div>",
            "      <div class='ss-card-title'>Screensaver</div>",
            "      <div class='ss-card-note'>These controls still behave the same as before. This page now also keeps release/update details in one place.</div>",
            "    </div>",
            "  </div>",
            "  <div class='ss-setting-row'>",
            "    <span class='ss-setting-label'>Enable screensaver</span>",
            "    <label class='ss-toggle'>",
            "      <input type='checkbox' id='ssEnabled' " + (s.enabled ? "checked" : "") + ">",
            "      <span class='ss-toggle-track'></span>",
            "    </label>",
            "    <span class='ss-status " + (s.enabled ? "is-on" : "is-off") + "' id='ssStatusLabel'>" + (s.enabled ? "Active" : "Disabled") + "</span>",
            "  </div>",
            "  <div class='ss-setting-row'>",
            "    <span class='ss-setting-label'>Idle timeout</span>",
            "    <select class='ss-select' id='ssTimeout'>",
            "      <option value='30000'" + (s.timeout === 30000 ? " selected" : "") + ">30 seconds</option>",
            "      <option value='45000'" + (s.timeout === 45000 ? " selected" : "") + ">45 seconds</option>",
            "      <option value='60000'" + (s.timeout === 60000 ? " selected" : "") + ">60 seconds</option>",
            "      <option value='120000'" + (s.timeout === 120000 ? " selected" : "") + ">2 minutes</option>",
            "      <option value='300000'" + (s.timeout === 300000 ? " selected" : "") + ">5 minutes</option>",
            "    </select>",
            "  </div>",
            "  <div class='ss-setting-row ss-setting-row-stack'>",
            "    <span class='ss-setting-label'>Signal grade weights</span>",
            "    <div class='ss-weight-group'>",
            "      <div class='ss-weight-item'>",
            "        <span>RSRP</span>",
            "        <input type='number' class='ss-weight-input' id='ssWeightRsrp' min='0' max='100' value='" + s.weightRsrp + "'>",
            "        <span>%</span>",
            "      </div>",
            "      <div class='ss-weight-item'>",
            "        <span>SNR</span>",
            "        <input type='number' class='ss-weight-input' id='ssWeightSinr' min='0' max='100' value='" + s.weightSinr + "'>",
            "        <span>%</span>",
            "      </div>",
            "      <div class='ss-weight-item'>",
            "        <span>RSRQ</span>",
            "        <input type='number' class='ss-weight-input' id='ssWeightRsrq' min='0' max='100' value='" + s.weightRsrq + "'>",
            "        <span>%</span>",
            "      </div>",
            "      <span class='ss-weight-sum " + (sumValid ? "is-valid" : "is-invalid") + "' id='ssWeightSum'>Σ " + sum + "%</span>",
            "    </div>",
            "  </div>",
            "  <div class='ss-formula-info'>",
            "    Each metric is normalized to 0-100% within its range:<br>",
            "    <code>RSRP: -120 to -70 dBm</code> <code>RSRQ: -20 to -5 dB</code> <code>SNR: -5 to 30 dB</code><br>",
            "    Grade = <code>RSRP × " + s.weightRsrp + "% + SNR × " + s.weightSinr + "% + RSRQ × " + s.weightRsrq + "%</code>",
            "  </div>",
            "  <div class='ss-preview-wrap' id='ssPreviewBtn'>",
            "    <div class='ss-preview-content'>",
            "      <div class='ss-preview-clock'>" + clockStr + " <span class='ss-preview-ampm'>" + ampm + "</span></div>",
            "      <div class='ss-preview-label'>Click to launch screensaver preview</div>",
            "    </div>",
            "  </div>",
            "</div>"
        ].join("\n");
    }

    function render() {
        var host = document.getElementById("htmlGoesHere");
        if (!host) return;

        if (state.loading) {
            renderLoading(host);
            return;
        }

        host.innerHTML = [
            "<div class='ss-page'>",
            "  <div class='ss-page-header'>",
            "    <div>",
            "      <h1 class='ss-page-title'>Settings</h1>",
            "      <p class='ss-page-subtitle'>Screensaver controls, installed release details, and update check status in one place.</p>",
            "    </div>",
            "  </div>",
            renderReleaseSection(),
            renderSettingsSection(),
            "  <div class='ss-toast' id='ssToast'></div>",
            "</div>"
        ].join("\n");

        wireControls();
    }

    function wireControls() {
        var enabledEl = $("ssEnabled");
        var timeoutEl = $("ssTimeout");
        var statusLabel = $("ssStatusLabel");
        var previewBtn = $("ssPreviewBtn");
        var checkUpdatesBtn = $("ssCheckUpdates");

        if (checkUpdatesBtn) {
            checkUpdatesBtn.addEventListener("click", refreshReleaseInfo);
        }

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

        ["ssWeightRsrp", "ssWeightSinr", "ssWeightRsrq"].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener("input", function () {
                var r = parseInt($("ssWeightRsrp").value, 10) || 0;
                var sn = parseInt($("ssWeightSinr").value, 10) || 0;
                var q = parseInt($("ssWeightRsrq").value, 10) || 0;
                var total = r + sn + q;
                var sumEl = $("ssWeightSum");
                if (sumEl) {
                    sumEl.textContent = "Σ " + total + "%";
                    sumEl.className = "ss-weight-sum " + (total === 100 ? "is-valid" : "is-invalid");
                }
                if (total === 100) {
                    saveSettings({ weightRsrp: r, weightSinr: sn, weightRsrq: q });
                }
            });
        });

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
        if (document.getElementById("htmlGoesHere")) {
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
