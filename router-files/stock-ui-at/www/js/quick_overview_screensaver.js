(function (window) {
    "use strict";

    var QO = window.JtoolsQuickOverview;
    if (!QO) { return; }

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
        var p = String(provider || "").toLowerCase();
        if (p.indexOf("t-mobile") !== -1 || p.indexOf("tmobile") !== -1) { return "qo-carrier-tmo"; }
        if (p.indexOf("at&t") !== -1 || p.indexOf("att") !== -1) { return "qo-carrier-att"; }
        if (p.indexOf("verizon") !== -1) { return "qo-carrier-vzw"; }
        return "qo-carrier-other";
    }

    function renderScreensaver(data) {
        var clk = formatClock(new Date());

        var bandPills = "";
        if (data.carriers && data.carriers.length) {
            data.carriers.forEach(function (c) {
                var label = QO.escapeHtml(c.band_label || c.band || "?");
                var bw = c.bandwidth_mhz ? " " + c.bandwidth_mhz + "MHz" : "";
                var role = c.role ? " (" + c.role + ")" : "";
                var rat = String(c.rat || "").toUpperCase();
                var cls = "qo-band-pill";
                if (rat === "NR5G") { cls += " is-nr"; }
                if (c.role === "PCC") { cls += " is-pcc"; }
                bandPills += "<span class='" + cls + "'>" + label + bw + role + "</span>";
            });
        } else if (QO.hasValue(data.bandLabel)) {
            bandPills = "<span class='qo-band-pill'>" + QO.escapeHtml(data.bandLabel) + "</span>";
        }

        return [
            "<div class='qo-ss-corner'>",
            "  <div class='qo-phone-bars'>", QO.buildPhoneBars(data.rsrp), "</div>",
            "  <span class='qo-ss-grade-label " + data.gradeClass + "'>" + QO.escapeHtml(data.gradeText) + "</span>",
            "</div>",
            "<div class='qo-ss-center'>",
            "  <div class='qo-ss-clock' id='qoSsClock'>" + clk.h + ":" + clk.mm + "</div>",
            "  <div class='qo-ss-ampm' id='qoSsAmpm'>" + clk.ampm + "</div>",
            "  <div class='qo-ss-device'>CFW-3212 / RG520N-NA</div>",
            "  <div class='qo-ss-provider " + getCarrierColorClass(data.provider) + "'>" + QO.escapeHtml(data.provider) + "</div>",
            "  <span class='qo-rat-badge " + data.ratClass + "'>" + QO.escapeHtml(data.rat) + "</span>",
            "  <div class='qo-ss-temp " + data.tempClass + "'>" + QO.escapeHtml(data.temp) + "</div>",
            "  <div class='qo-ss-metrics'>",
            "    <div class='qo-ss-metric-item'>",
            "      <span class='qo-ss-metric-label'>RSRP</span>",
            "      <span class='qo-ss-metric-value " + data.signalClass + "'>" + QO.escapeHtml(data.rsrpText) + "</span>",
            "    </div>",
            "    <div class='qo-ss-metric-item'>",
            "      <span class='qo-ss-metric-label'>RSRQ</span>",
            "      <span class='qo-ss-metric-value'>" + QO.escapeHtml(data.rsrqText) + "</span>",
            "    </div>",
            "    <div class='qo-ss-metric-item'>",
            "      <span class='qo-ss-metric-label'>SINR</span>",
            "      <span class='qo-ss-metric-value'>" + QO.escapeHtml(data.sinrText) + "</span>",
            "    </div>",
            "  </div>",
            "  " + QO.buildGradientBar(data.grade),
            "  <div class='qo-ss-bands'>" + bandPills + "</div>",
            "  <div class='qo-ss-detail'>",
            "    <span>PCI: " + QO.escapeHtml(data.pci) + "</span>",
            "    <span>Cell: " + QO.escapeHtml(data.cellId) + "</span>",
            "    <span>ARFCN: " + QO.escapeHtml(data.arfcn) + "</span>",
            "  </div>",
            "</div>",
            "<div class='qo-toast-container' id='qoToastContainer'></div>"
        ].join("\n");
    }

    // ── Clock updater ──

    function startClock() {
        stopClock();
        clockTimer = setInterval(function () {
            var el = document.getElementById("qoSsClock");
            if (!el) { return; }
            var clk = formatClock(new Date());
            el.textContent = clk.h + ":" + clk.mm;
            var ampmEl = document.getElementById("qoSsAmpm");
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
        var container = document.getElementById("qoToastContainer");
        if (!container) { return; }
        var toast = document.createElement("div");
        toast.className = "qo-toast";
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
        var entry = QO.trackBandChange(data.carriers, data.qnwinfo);
        if (entry) {
            showToast(QO.formatBandChangeText(entry));
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
