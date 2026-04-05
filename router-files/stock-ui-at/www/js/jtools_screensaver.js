(function () {
    "use strict";

    var POLL_INTERVAL = 6500;
    var GRACE_MS = 800;
    var overlay = null;
    var idleTimer = null;
    var pollTimer = null;
    var graceTimer = null;
    var cssLoaded = false;
    var scriptsLoaded = false;
    var isVisible = false;
    var canDismiss = false;
    var cachedSettings = readSettingsFromStorage();

    function normalizeSettings(input) {
        var s = input || {};
        return {
            enabled: s.enabled !== false,
            timeout: parseInt(s.timeout, 10) > 0 ? parseInt(s.timeout, 10) : 45000,
            dismissMode: s.dismissMode || "movement"
        };
    }

    function readSettingsFromStorage() {
        try {
            var raw = window.localStorage.getItem("jtoolsScreensaverSettings");
            if (raw) { return normalizeSettings(JSON.parse(raw)); }
            // Migration: try old QO key
            var oldRaw = window.localStorage.getItem("jtoolsQoSettings");
            if (oldRaw) { return normalizeSettings(JSON.parse(oldRaw)); }
        } catch (e) { /* ignore */ }
        return normalizeSettings({});
    }

    function writeSettingsToStorage(settings) {
        try {
            var merged = {};
            var raw = window.localStorage.getItem("jtoolsScreensaverSettings");
            if (raw) { merged = JSON.parse(raw) || {}; }
            merged.enabled = settings.enabled;
            merged.timeout = settings.timeout;
            merged.dismissMode = settings.dismissMode;
            window.localStorage.setItem("jtoolsScreensaverSettings", JSON.stringify(merged));
        } catch (e) { /* ignore */ }
    }

    function getSettings() {
        if (window.JtoolsScreensaverCore && typeof window.JtoolsScreensaverCore.getSettings === "function") {
            return window.JtoolsScreensaverCore.getSettings();
        }
        return cachedSettings;
    }

    function refreshSettingsFromServer() {
        if (!window.XMLHttpRequest) { return; }
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/screensaver_api/settings", true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) { return; }
                if (xhr.status !== 200) { return; }
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response && response.ok && response.settings) {
                        cachedSettings = normalizeSettings(response.settings);
                        writeSettingsToStorage(cachedSettings);
                        resetIdleTimer();
                    }
                } catch (e) { /* ignore */ }
            };
            xhr.send();
        } catch (e) { /* ignore */ }
    }

    function getTimeout() {
        try {
            var s = getSettings();
            if (s.enabled === false) { return 0; }
            if (s.timeout && parseInt(s.timeout, 10) > 0) { return parseInt(s.timeout, 10); }
        } catch (e) { /* ignore */ }
        return 45000;
    }

    function getDismissMode() {
        var s = getSettings();
        return s.dismissMode || "movement";
    }

    function resetIdleTimer() {
        if (idleTimer) { clearTimeout(idleTimer); }
        var timeout = getTimeout();
        if (timeout <= 0) { return; }
        idleTimer = setTimeout(function () { activateScreensaver({}); }, timeout);
    }

    function htmlEscape(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function formatClockNow() {
        var d = new Date();
        var h24 = d.getHours();
        var h = h24 % 12;
        if (h === 0) { h = 12; }
        var m = d.getMinutes();
        var mm = m < 10 ? "0" + m : String(m);
        var ampm = h24 >= 12 ? "PM" : "AM";
        return { clock: h + ":" + mm, ampm: ampm };
    }

    function buildScreensaverLoadingHtml() {
        var t = formatClockNow();
        return (
            "<div class='ss-ov-center'>" +
            "<div class='ss-ov-clock' id='ssOvClock'>" + t.clock + "</div>" +
            "<div class='ss-ov-ampm' id='ssOvAmpm'>" + t.ampm + "</div>" +
            "<div class='ss-ov-device' style='margin-top:20px'>Loading signal\u2026</div>" +
            "</div>"
        );
    }

    function buildScreensaverFallbackHtml(err) {
        var t = formatClockNow();
        var headline = "Unable to load signal data";
        var detail = "";
        if (typeof err === "string") {
            detail = err;
            if (err.indexOf("502") !== -1 || err.indexOf("HTTP 5") !== -1) {
                headline = "Router busy or restarting";
            } else if (err === "timeout") {
                headline = "Request timed out";
            }
        } else if (err) {
            detail = String(err);
        }
        return (
            "<div class='ss-ov-corner'></div>" +
            "<div class='ss-ov-center'>" +
            "<div class='ss-ov-clock' id='ssOvClock'>" + t.clock + "</div>" +
            "<div class='ss-ov-ampm' id='ssOvAmpm'>" + t.ampm + "</div>" +
            "<div class='ss-ov-device' style='margin-top:12px'>" + htmlEscape(headline) + "</div>" +
            (detail ? "<div class='ss-ov-provider' style='font-size:13px;color:#8a8f98;margin-top:8px'>" + htmlEscape(detail) + "</div>" : "") +
            "<div class='ss-ov-device' style='margin-top:22px;font-size:12px'>Move or tap to dismiss</div>" +
            "</div>" +
            "<div class='ss-toast-container' id='ssToastContainer'></div>"
        );
    }

    // ── Lazy-load resources ──

    function loadCSS(href, cb) {
        if (document.querySelector("link[href*='screensaver_overlay.css']")) { cb(); return; }
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = cb;
        link.onerror = cb;
        document.head.appendChild(link);
    }

    function loadScript(src, cb) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = cb;
        s.onerror = cb;
        document.head.appendChild(s);
    }

    function ensureResources(cb) {
        if (cssLoaded && scriptsLoaded) { cb(); return; }

        var remaining = 0;
        function done() {
            remaining--;
            if (remaining <= 0) { cb(); }
        }

        if (!cssLoaded) {
            remaining++;
            loadCSS("/css/screensaver_overlay.css?jtools-ss-v20260405a", function () {
                cssLoaded = true;
                done();
            });
        }

        if (!scriptsLoaded) {
            remaining++;
            if (!window.JtoolsScreensaverCore) {
                loadScript("/js/screensaver_core.js?jtools-ss-v20260405a", function () {
                    loadScript("/js/screensaver_renderer.js?jtools-ss-v20260405a", function () {
                        scriptsLoaded = true;
                        done();
                    });
                });
            } else if (!window.JtoolsScreensaverRenderer) {
                loadScript("/js/screensaver_renderer.js?jtools-ss-v20260405a", function () {
                    scriptsLoaded = true;
                    done();
                });
            } else {
                scriptsLoaded = true;
                done();
            }
        }
    }

    // ── Overlay lifecycle ──

    function activateScreensaver(opts) {
        opts = opts || {};
        if (isVisible) { return; }
        if (!opts.manual && window._jtoolsSsPaused) { resetIdleTimer(); return; }
        ensureResources(function () {
            if (!window.JtoolsScreensaverCore || !window.JtoolsScreensaverRenderer) { return; }
            isVisible = true;
            canDismiss = false;
            overlay = document.createElement("div");
            overlay.className = "ss-screensaver";
            overlay.innerHTML = buildScreensaverLoadingHtml();
            document.body.appendChild(overlay);

            // First fetch and render
            fetchAndRender();
            // Start polling
            pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
            // Start clock
            window.JtoolsScreensaverRenderer.startClock();

            // Fade in
            requestAnimationFrame(function () {
                overlay.classList.add("is-visible");
            });

            // Grace period — ignore events from cursor already on overlay
            graceTimer = setTimeout(function () {
                canDismiss = true;
                if (!overlay) { return; }
                if (getDismissMode() === "button") {
                    var btn = document.createElement("div");
                    btn.className = "ss-ov-dismiss";
                    btn.textContent = "Tap to dismiss";
                    btn.addEventListener("click", dismissScreensaver);
                    btn.addEventListener("touchstart", dismissScreensaver);
                    overlay.appendChild(btn);
                } else {
                    overlay.addEventListener("mousemove", dismissScreensaver);
                    overlay.addEventListener("touchstart", dismissScreensaver);
                    overlay.addEventListener("click", dismissScreensaver);
                }
            }, GRACE_MS);
        });
    }

    function dismissScreensaver() {
        if (!isVisible || !canDismiss) { return; }
        isVisible = false;
        canDismiss = false;
        if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (window.JtoolsScreensaverRenderer) {
            window.JtoolsScreensaverRenderer.stopClock();
        }

        if (overlay) {
            overlay.classList.remove("is-visible");
            overlay.classList.add("is-hiding");
            var el = overlay;
            setTimeout(function () {
                if (el.parentNode) { el.parentNode.removeChild(el); }
            }, 350);
            overlay = null;
        }
        resetIdleTimer();
    }

    function fetchAndRender() {
        if (!isVisible || !overlay) { return; }
        if (!window.JtoolsScreensaverCore || typeof window.JtoolsScreensaverCore.fetchData !== "function") {
            overlay.innerHTML = buildScreensaverFallbackHtml("Screensaver core not loaded");
            return;
        }
        if (!window.JtoolsScreensaverRenderer || typeof window.JtoolsScreensaverRenderer.renderScreensaver !== "function") {
            overlay.innerHTML = buildScreensaverFallbackHtml("Screensaver renderer not loaded");
            return;
        }
        window.JtoolsScreensaverCore.fetchData(function (data, err) {
            if (!isVisible || !overlay) { return; }
            if (err || !data) {
                overlay.innerHTML = buildScreensaverFallbackHtml(err || "No data");
                return;
            }
            try {
                overlay.innerHTML = window.JtoolsScreensaverRenderer.renderScreensaver(data);
                window.JtoolsScreensaverRenderer.checkForBandChange(data);
            } catch (e) {
                overlay.innerHTML = buildScreensaverFallbackHtml(e && e.message ? e.message : "Render error");
            }
        });
    }

    // ── Event listeners for idle detection ──

    var events = ["mousemove", "touchstart", "touchmove", "scroll", "keydown", "click"];
    events.forEach(function (evt) {
        document.addEventListener(evt, resetIdleTimer, { passive: true });
    });

    // ── Keyboard dismiss ──
    document.addEventListener("keydown", function () {
        if (isVisible && canDismiss) { dismissScreensaver(); }
    });

    // Start the idle timer
    refreshSettingsFromServer();
    resetIdleTimer();

    window.JtoolsScreensaver = {
        show: function () {
            activateScreensaver({ manual: true });
        }
    };

})();
