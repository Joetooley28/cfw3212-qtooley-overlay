(function (window) {
    "use strict";

    var QO = window.JtoolsQuickOverview;
    if (!QO) { return; }

    var POLL_INTERVAL = 6500;
    /** Sliding window of samples (~1h at default poll; trimmed by age, not only count). */
    var CHART_HISTORY_MS = 60 * 60 * 1000;
    /** Hard cap so a stuck tab cannot grow the array without bound. */
    var CHART_MAX_POINTS_CAP = 1000;
    var pollTimer = null;
    var chartData = [];
    var chartCanvas = null;
    var chartCtx = null;

    // ── DOM refs ──

    var els = {};

    function $(id) { return document.getElementById(id); }

    // ── Build page DOM into #htmlGoesHere ──

    function buildPage() {
        var host = document.getElementById("htmlGoesHere");
        if (!host) { return; }

        var page = document.createElement("div");
        page.className = "qo-page";
        page.id = "qoPageRoot";
        page.innerHTML = [
            "<div class='qo-page-header'>",
            "  <span class='qo-page-title'><span class='qo-status-dot' id='qoStatusDot'></span>Quick Overview</span>",
            "</div>",
            "<div id='qoErrorBanner' style='display:none;padding:10px 14px;margin:0 0 10px;border-radius:6px;background:rgba(224,108,79,0.15);border:1px solid rgba(224,108,79,0.4);color:#e06c4f;font-size:12px;font-family:\"Segoe UI\",sans-serif;'></div>",
            "<div class='qo-card'>",
            "  <div class='qo-card-title'>Active Band</div>",
            "  <div id='qoActiveBand'><div class='qo-no-data'>Loading\u2026</div></div>",
            "</div>",
            "<div class='qo-card'>",
            "  <div class='qo-card-title'>Signal Grade</div>",
            "  <div id='qoGradeCard'><div class='qo-no-data'>Loading\u2026</div></div>",
            "</div>",
            "<div class='qo-card'>",
            "  <div class='qo-card-title'>Connection Info</div>",
            "  <div id='qoConnInfo'><div class='qo-no-data'>Loading\u2026</div></div>",
            "</div>",
            "<div class='qo-card'>",
            "  <div class='qo-card-title'>Signal Over Time</div>",
            "  <div class='qo-chart-wrap' id='qoChartWrap'>",
            "    <canvas class='qo-chart-canvas' id='qoChartCanvas'></canvas>",
            "  </div>",
            "  <div class='qo-chart-legend'>",
            "    <span><span class='qo-chart-legend-dot' style='background:#8db9ff'></span>RSRP</span>",
            "    <span><span class='qo-chart-legend-dot' style='background:#00e676'></span>SNR</span>",
            "  </div>",
            "</div>",
            "<div class='qo-card'>",
            "  <div class='qo-card-title'>Band Change History</div>",
            "  <div class='qo-history-list' id='qoHistoryList'><div class='qo-no-data'>No band changes recorded yet</div></div>",
            "</div>",
            ""
        ].join("\n");

        host.appendChild(page);
    }

    // ── Init ──

    function init() {
        buildPage();

        els.activeBand    = $("qoActiveBand");
        els.gradeCard     = $("qoGradeCard");
        els.chartWrap     = $("qoChartWrap");
        els.historyList   = $("qoHistoryList");
        els.connInfo      = $("qoConnInfo");
        els.statusDot     = $("qoStatusDot");
        els.errorBanner   = $("qoErrorBanner");
        chartCanvas       = $("qoChartCanvas");

        if (chartCanvas) {
            chartCtx = chartCanvas.getContext("2d");
        }

        QO.loadSettings(function () {});

        // Initial fetch
        fetchAndRender();
        pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
    }

    // ── Fetch + Render ──

    function fetchAndRender() {
        QO.fetchData(function (data, err) {
            if (err || !data) {
                if (els.statusDot) { els.statusDot.className = "qo-status-dot is-error"; }
                if (els.errorBanner) {
                    els.errorBanner.textContent = QO.friendlyError(err);
                    els.errorBanner.style.display = "block";
                }
                return;
            }
            if (els.statusDot) { els.statusDot.className = "qo-status-dot"; }
            if (els.errorBanner) { els.errorBanner.style.display = "none"; }

            renderActiveBand(data);
            renderSignalGrade(data);
            updateChartData(data);
            renderSparkline();
            QO.trackBandChange(data.carriers, data.qnwinfo);
            renderBandHistory();
            renderConnectionInfo(data);
        });
    }

    // ── Active Band Card ──

    function getCarrierColorClass(provider) {
        var cls = QO.getCarrierClass ? QO.getCarrierClass(provider) : "";
        return cls || "qo-carrier-other";
    }

    function renderActiveBand(data) {
        if (!els.activeBand) { return; }

        var parts = [];
        if (data.carriers && data.carriers.length) {
            data.carriers.forEach(function (c) {
                var num = String(c.band || "").replace(/[^0-9]/g, "");
                var rat = String(c.rat || "").toUpperCase();
                var prefix = rat === "NR5G" ? "N" : "B";
                var cls = c.role === "PCC" ? "qo-ab-pcc" : (rat === "NR5G" ? "qo-ab-nr" : "qo-ab-lte");
                parts.push("<span class='" + cls + "'>" + QO.escapeHtml(prefix + num) + "</span>");
            });
        }

        var combo = parts.length ? parts.join("<span class='qo-ab-plus'>+</span>") : "<span class='qo-ab-none'>No carriers</span>";

        var providerLabel = QO.escapeHtml(data.provider || "");
        var carrierCls = getCarrierColorClass(data.provider);
        var techLabel = QO.escapeHtml(data.rat || "");

        els.activeBand.innerHTML = [
            "<div class='qo-ab-combo'>",
            "  <span class='" + carrierCls + "'>" + providerLabel + "</span>",
            "  <span class='qo-ab-plus'></span>",
            "  " + combo,
            "</div>",
            "<div class='qo-ab-sub'>",
            "  <span class='qt-rat-badge qt-rat-badge-sm " + data.ratClass + "'>" + techLabel + "</span>",
            "</div>"
        ].join("");
    }

    // ── Signal Grade Card ──

    function renderSignalGrade(data) {
        if (!els.gradeCard) { return; }

        var rsrpNorm = QO.normalizeMetric(data.rsrp, QO.DEFAULTS.rsrpMin, QO.DEFAULTS.rsrpMax);
        var rsrqNorm = QO.normalizeMetric(data.rsrq, QO.DEFAULTS.rsrqMin, QO.DEFAULTS.rsrqMax);
        var sinrNorm = QO.normalizeMetric(data.sinr, QO.DEFAULTS.sinrMin, QO.DEFAULTS.sinrMax);

        var html = [
            "<div class='qo-grade-header'>",
            "  <span class='qo-grade-pct " + data.gradeClass + "'>" + QO.escapeHtml(data.gradeText) + "</span>",
            "  <div class='qo-grade-bars-wrap'>" + QO.buildPhoneBars(data.grade) + "</div>",
            "</div>",
            QO.buildGradientBar(data.grade),

            buildMetricRow("RSRP", data.rsrpText, data.rsrp, QO.DEFAULTS.rsrpMin, QO.DEFAULTS.rsrpMax, data.signalClass),
            buildMetricRow("RSRQ", data.rsrqText, data.rsrq, QO.DEFAULTS.rsrqMin, QO.DEFAULTS.rsrqMax,
                rsrqNorm != null ? QO.getGradeClass(rsrqNorm) : "qo-sig-na"),
            buildMetricRow("SNR", data.sinrText, data.sinr, QO.DEFAULTS.sinrMin, QO.DEFAULTS.sinrMax,
                sinrNorm != null ? QO.getGradeClass(sinrNorm) : "qo-sig-na"),
            "<div class='qo-metric-row qo-metric-row-plain'>",
            "  <span class='qo-metric-label'>CQI</span>",
            "  <span class='qo-metric-value qo-sig-na'>" + QO.escapeHtml(data.cqiText || "N/A") + "</span>",
            "</div>"
        ].join("");

        els.gradeCard.innerHTML = html;
    }

    function buildMetricRow(label, valueText, rawValue, min, max, cssClass) {
        return [
            "<div class='qo-metric-row'>",
            "  <span class='qo-metric-label'>" + label + "</span>",
            "  <span class='qo-metric-value " + cssClass + "'>" + QO.escapeHtml(valueText) + "</span>",
            "  <div class='qo-metric-bars'>",
            "    " + QO.buildFillBar(rawValue, min, max, cssClass),
            "    " + QO.buildSpectrumBar(rawValue, min, max),
            "  </div>",
            "</div>"
        ].join("");
    }

    // ── Signal Over Time (sparkline) ──

    function updateChartData(data) {
        var now = Date.now();
        var timeLabel = new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        chartData.push({
            ts: now,
            time: timeLabel,
            rsrp: QO.asInt(data.rsrp),
            sinr: data.sinr != null ? parseFloat(data.sinr) : null,
            grade: data.grade
        });
        var cutoff = now - CHART_HISTORY_MS;
        while (chartData.length && chartData[0].ts < cutoff) {
            chartData.shift();
        }
        while (chartData.length > CHART_MAX_POINTS_CAP) {
            chartData.shift();
        }
    }

    function renderSparkline() {
        if (!chartCanvas || !chartCtx) { return; }

        var w = chartCanvas.parentElement.clientWidth;
        var h = chartCanvas.parentElement.clientHeight;
        chartCanvas.width = w * (window.devicePixelRatio || 1);
        chartCanvas.height = h * (window.devicePixelRatio || 1);
        chartCanvas.style.width = w + "px";
        chartCanvas.style.height = h + "px";
        var ctx = chartCtx;
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, w, h);

        if (chartData.length < 2) {
            ctx.fillStyle = "#8a8f98";
            ctx.font = "13px 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Collecting data\u2026", w / 2, h / 2);
            return;
        }

        var padding = { top: 10, right: 14, bottom: 22, left: 45 };
        var plotW = w - padding.left - padding.right;
        var plotH = h - padding.top - padding.bottom;

        // Draw grid
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        for (var g = 0; g <= 4; g++) {
            var gy = padding.top + (plotH / 4) * g;
            ctx.beginPath();
            ctx.moveTo(padding.left, gy);
            ctx.lineTo(w - padding.right, gy);
            ctx.stroke();
        }

        // RSRP line (range: -120 to -70)
        drawLine(ctx, chartData, "rsrp", -120, -70, padding, plotW, plotH, "#8db9ff", 2);

        // SINR line (range: -5 to 30)
        drawLine(ctx, chartData, "sinr", -5, 30, padding, plotW, plotH, "#00e676", 1.5);

        // Y-axis labels (RSRP)
        ctx.fillStyle = "#8db9ff";
        ctx.font = "10px Consolas, monospace";
        ctx.textAlign = "right";
        ctx.fillText("-70", padding.left - 4, padding.top + 4);
        ctx.fillText("-120", padding.left - 4, padding.top + plotH + 4);

        // Time labels (left/right aligned so text is not clipped at canvas edges)
        ctx.fillStyle = "#8a8f98";
        ctx.font = "9px Consolas, monospace";
        ctx.textBaseline = "alphabetic";
        if (chartData.length > 0) {
            var ty = h - 6;
            ctx.textAlign = "left";
            ctx.fillText(chartData[0].time, padding.left + 2, ty);
            ctx.textAlign = "right";
            ctx.fillText(chartData[chartData.length - 1].time, w - padding.right - 2, ty);
        }
    }

    function drawLine(ctx, data, key, min, max, padding, plotW, plotH, color, lineW) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        var started = false;
        var range = max - min;
        for (var i = 0; i < data.length; i++) {
            var val = data[i][key];
            if (val == null) { continue; }
            var x = padding.left + (i / (data.length - 1)) * plotW;
            var norm = (val - min) / range;
            norm = norm < 0 ? 0 : (norm > 1 ? 1 : norm);
            var y = padding.top + plotH - (norm * plotH);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    // ── Band Change History ──

    function renderBandHistory() {
        if (!els.historyList) { return; }
        var history = QO.getBandChangeHistory();
        if (!history.length) {
            els.historyList.innerHTML = "<div class='qo-no-data'>No band changes recorded yet</div>";
            return;
        }
        var html = "";
        history.forEach(function (entry) {
            var cls = "qo-history-item";
            if (entry.type === "lost") { cls += " is-lost"; }
            else if (entry.type === "restored") { cls += " is-restored"; }
            else if (entry.type === "initial") { cls += " is-initial"; }

            var text = "";
            if (entry.type === "initial") {
                text = "Initial connection: " + QO.escapeHtml(entry.to);
            } else if (entry.type === "lost") {
                text = "Lost service";
            } else if (entry.type === "restored") {
                text = "Service restored: " + QO.escapeHtml(entry.to);
            } else {
                text = "Switched from " + QO.escapeHtml(entry.from) + " \u2192 " + QO.escapeHtml(entry.to);
            }

            html += "<div class='" + cls + "'>" +
                "<span class='qo-history-time'>" + QO.escapeHtml(entry.time) + "</span>" +
                "<span class='qo-history-text'>" + text + "</span>" +
                "</div>";
        });
        els.historyList.innerHTML = html;
    }

    // ── Connection Info ──

    function renderConnectionInfo(data) {
        if (!els.connInfo) { return; }

        var bandPills = "";
        var carrierCls = getCarrierColorClass(data.provider);
        if (data.carriers && data.carriers.length) {
            data.carriers.forEach(function (c) {
                var label = QO.escapeHtml(c.band_label || c.band || "?");
                var bw = QO.formatBandwidthMhzSuffix(c.bandwidth_mhz);
                var role = c.role ? " (" + c.role + ")" : "";
                var rat = String(c.rat || "").toUpperCase();
                var cls = "qt-band-pill";
                var toneCls = QO.getBandToneClass ? QO.getBandToneClass(c) : "";
                if (rat === "NR5G") { cls += " is-nr"; }
                if (c.role === "PCC") { cls += " is-pcc"; }
                if (toneCls) { cls += " " + toneCls; }
                bandPills += "<span class='" + cls + "'>" + label + bw + role + "</span>";
            });
        }

        els.connInfo.innerHTML = [
            "<div class='qo-conn-grid'>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>RAT</span>",
            "    <span class='qo-conn-value'><span class='qt-rat-badge qt-rat-badge-sm " + data.ratClass + "'>" + QO.escapeHtml(data.rat) + "</span></span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>Provider</span>",
            "    <span class='qo-conn-value " + carrierCls + "'>" + QO.escapeHtml(data.provider) + "</span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>Temperature</span>",
            "    <span class='qo-conn-value " + data.tempClass + "'>" + QO.escapeHtml(data.temp) + "</span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>PCI</span>",
            "    <span class='qo-conn-value'>" + QO.escapeHtml(data.pci) + "</span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>Cell ID</span>",
            "    <span class='qo-conn-value'>" + QO.escapeHtml(data.cellId) + "</span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>ARFCN</span>",
            "    <span class='qo-conn-value'>" + QO.escapeHtml(data.arfcn) + "</span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>CQI</span>",
            "    <span class='qo-conn-value'>" + QO.escapeHtml(data.cqiText || "N/A") + "</span>",
            "  </div>",
            bandPills ? "  <div class='qo-conn-bands-row'><span class='qo-conn-label'>Band Combo</span><div style='margin-top:6px;display:flex;flex-wrap:wrap;gap:6px'>" + bandPills + "</div></div>" : "",
            data.firmwareVersion ? "  <div class='qo-conn-item'><span class='qo-conn-label'>Firmware</span><span class='qo-conn-value' style='font-size:11px'>" + QO.escapeHtml(data.firmwareVersion) + "</span></div>" : "",
            "</div>"
        ].join("\n");
    }

    // ── Public API ──

    window.JtoolsQuickOverviewPage = {
        init: init
    };

})(window);
