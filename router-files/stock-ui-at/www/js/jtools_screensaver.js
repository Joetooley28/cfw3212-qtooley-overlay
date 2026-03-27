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
            var raw = window.localStorage.getItem("jtoolsQoSettings");
            if (raw) { return normalizeSettings(JSON.parse(raw)); }
        } catch (e) { /* ignore */ }
        return normalizeSettings({});
    }

    function writeSettingsToStorage(settings) {
        try {
            var merged = {};
            var raw = window.localStorage.getItem("jtoolsQoSettings");
            if (raw) { merged = JSON.parse(raw) || {}; }
            merged.enabled = settings.enabled;
            merged.timeout = settings.timeout;
            merged.dismissMode = settings.dismissMode;
            window.localStorage.setItem("jtoolsQoSettings", JSON.stringify(merged));
        } catch (e) { /* ignore */ }
    }

    function getSettings() {
        if (window.JtoolsQuickOverview && typeof window.JtoolsQuickOverview.getSettings === "function") {
            return window.JtoolsQuickOverview.getSettings();
        }
        return cachedSettings;
    }

    function refreshSettingsFromServer() {
        if (!window.XMLHttpRequest) { return; }
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/quick_overview_api/settings", true);
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
        idleTimer = setTimeout(activateScreensaver, timeout);
    }

    // ── Lazy-load resources ──

    function loadCSS(href, cb) {
        if (document.querySelector("link[href*='quick_overview.css']")) { cb(); return; }
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
            loadCSS("/css/quick_overview.css?jtools-qo-v20260322a", function () {
                cssLoaded = true;
                done();
            });
        }

        if (!scriptsLoaded) {
            remaining++;
            // Load core first, then screensaver renderer
            if (!window.JtoolsQuickOverview) {
                loadScript("/js/quick_overview_core.js?jtools-qo-v20260327a", function () {
                    loadScript("/js/quick_overview_screensaver.js?jtools-qo-v20260327a", function () {
                        scriptsLoaded = true;
                        done();
                    });
                });
            } else if (!window.JtoolsScreensaverRenderer) {
                loadScript("/js/quick_overview_screensaver.js?jtools-qo-v20260327a", function () {
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

    function activateScreensaver() {
        if (isVisible) { return; }
        if (window._jtoolsSsPaused) { resetIdleTimer(); return; }
        ensureResources(function () {
            if (!window.JtoolsQuickOverview || !window.JtoolsScreensaverRenderer) { return; }
            isVisible = true;
            canDismiss = false;
            overlay = document.createElement("div");
            overlay.className = "qo-screensaver";
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
                    btn.className = "qo-ss-dismiss";
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
        window.JtoolsQuickOverview.fetchData(function (data, err) {
            if (!isVisible || !overlay) { return; }
            if (err || !data) { return; }
            overlay.innerHTML = window.JtoolsScreensaverRenderer.renderScreensaver(data);
            window.JtoolsScreensaverRenderer.checkForBandChange(data);
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

})();
