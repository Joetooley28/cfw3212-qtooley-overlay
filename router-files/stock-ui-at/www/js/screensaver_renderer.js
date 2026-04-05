/* ================================================================
   Screensaver Renderer — Standalone
   Depends only on screensaver_core.js (window.JtoolsScreensaverCore).
   No dependency on quick_overview.js or quick_overview_core.js.
   ================================================================ */
(function (window) {
    "use strict";

    var SC = window.JtoolsScreensaverCore;
    if (!SC) { return; }

    var clockTimer = null;

    // ── Build screensaver HTML ──

    function formatClock(date) {
        var h = date.getHours();
        var ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) { h = 12; }
        var mm = String(date.getMinutes()).replace(/^(\d)$/, "0$1");
        return { h: String(h), mm: mm, ampm: ampm };
    }

    function getCarrierColorClass(provider) {
        var cls = SC.getCarrierClass(provider);
        return cls || "ss-carrier-other";
    }

    function renderScreensaver(data) {
        var clk = formatClock(new Date());

        var bandPills = "";
        if (data.carriers && data.carriers.length) {
            data.carriers.forEach(function (c) {
                var label = SC.escapeHtml(c.band_label || c.band || "?");
                var bw = SC.formatBandwidthMhzSuffix(c.bandwidth_mhz);
                var role = c.role ? " (" + c.role + ")" : "";
                var rat = String(c.rat || "").toUpperCase();
                var cls = "ss-band-pill";
                var toneCls = SC.getBandToneClass ? SC.getBandToneClass(c) : "";
                if (rat === "NR5G") { cls += " is-nr"; }
                if (c.role === "PCC") { cls += " is-pcc"; }
                if (toneCls) { cls += " " + toneCls; }
                bandPills += "<span class='" + cls + "'>" + label + bw + role + "</span>";
            });
        } else if (SC.hasValue(data.bandLabel)) {
            bandPills = "<span class='ss-band-pill'>" + SC.escapeHtml(data.bandLabel) + "</span>";
        }

        return [
            "<div class='ss-ov-corner'>",
            "  <div class='ss-phone-bars'>", SC.buildPhoneBars(data.grade), "</div>",
            "  <span class='ss-ov-grade-label " + data.gradeClass + "'>" + SC.escapeHtml(data.gradeText) + "</span>",
            "</div>",
            "<div class='ss-ov-center'>",
            "  <div class='ss-ov-clock' id='ssOvClock'>" + clk.h + ":" + clk.mm + "</div>",
            "  <div class='ss-ov-ampm' id='ssOvAmpm'>" + clk.ampm + "</div>",
            "  <div class='ss-ov-device'>CFW-3212 / RG520N-NA</div>",
            "  <div class='ss-ov-provider " + getCarrierColorClass(data.provider) + "'>" + SC.escapeHtml(data.provider) + "</div>",
            "  <span class='ss-rat-badge ss-rat-badge-sm " + data.ratClass + "'>" + SC.escapeHtml(data.rat) + "</span>",
            data.publicNote ? "  <div class='ss-ov-device' style='margin-top:8px;font-size:12px;color:#8a8f98;'>" + SC.escapeHtml(data.publicNote) + "</div>" : "",
            "  <div class='ss-ov-temp " + data.tempClass + "'>" + SC.escapeHtml(data.temp) + "</div>",
            "  <div class='ss-ov-metrics'>",
            "    <div class='ss-ov-metric-item'>",
            "      <span class='ss-ov-metric-label'>RSRP</span>",
            "      <span class='ss-ov-metric-value " + data.signalClass + "'>" + SC.escapeHtml(data.rsrpText) + "</span>",
            "    </div>",
            "    <div class='ss-ov-metric-item'>",
            "      <span class='ss-ov-metric-label'>RSRQ</span>",
            "      <span class='ss-ov-metric-value " + data.rsrqClass + "'>" + SC.escapeHtml(data.rsrqText) + "</span>",
            "    </div>",
            "    <div class='ss-ov-metric-item'>",
            "      <span class='ss-ov-metric-label'>SINR</span>",
            "      <span class='ss-ov-metric-value " + data.sinrClass + "'>" + SC.escapeHtml(data.sinrText) + "</span>",
            "    </div>",
            "  </div>",
            "  " + SC.buildGradientBar(data.grade),
            "  <div class='ss-ov-bands'>" + bandPills + "</div>",
            "  <div class='ss-ov-detail'>",
            "    <span>PCI: " + SC.escapeHtml(data.pci) + "</span>",
            "    <span>Cell: " + SC.escapeHtml(data.cellId) + "</span>",
            "    <span>ARFCN: " + SC.escapeHtml(data.arfcn) + "</span>",
            "  </div>",
            "</div>",
            "<div class='ss-toast-container' id='ssToastContainer'></div>"
        ].join("\n");
    }

    // ── Clock updater ──

    function startClock() {
        stopClock();
        clockTimer = setInterval(function () {
            var el = document.getElementById("ssOvClock");
            if (!el) { return; }
            var clk = formatClock(new Date());
            el.textContent = clk.h + ":" + clk.mm;
            var ampmEl = document.getElementById("ssOvAmpm");
            if (ampmEl) { ampmEl.textContent = clk.ampm; }
        }, 5000);
    }

    function stopClock() {
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
    }

    // ── Toast notification ──

    function showToast(message) {
        var container = document.getElementById("ssToastContainer");
        if (!container) { return; }
        var toast = document.createElement("div");
        toast.className = "ss-toast";
        toast.textContent = message;
        container.innerHTML = "";
        container.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add("is-visible");
        });

        setTimeout(function () {
            toast.classList.remove("is-visible");
            setTimeout(function () {
                if (toast.parentNode) { toast.parentNode.removeChild(toast); }
            }, 500);
        }, 5000);
    }

    // ── Band change detection for toast ──

    function checkForBandChange(data) {
        var entry = SC.trackBandChange(data.carriers, data.qnwinfo);
        if (entry) {
            showToast(SC.formatBandChangeText(entry));
        }
    }

    // ── Public API ──

    window.JtoolsScreensaverRenderer = {
        renderScreensaver: renderScreensaver,
        showToast: showToast,
        checkForBandChange: checkForBandChange,
        startClock: startClock,
        stopClock: stopClock
    };

})(window);
