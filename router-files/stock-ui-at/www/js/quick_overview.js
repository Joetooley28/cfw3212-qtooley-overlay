(function (window) {
    "use strict";

    var QO = window.JtoolsQuickOverview;
    if (!QO) { return; }

    var POLL_INTERVAL = 6500;
    var MAX_CHART_POINTS = 60;
    var pollTimer = null;
    var chartData = [];
    var chartCanvas = null;
    var chartCtx = null;

    // ── DOM refs ──

    var els = {};

    function $(id) { return document.getElementById(id); }

    // ── Init ──

    function init() {
        els.gradeCard     = $("qoGradeCard");
        els.chartWrap     = $("qoChartWrap");
        els.historyList   = $("qoHistoryList");
        els.connInfo      = $("qoConnInfo");
        els.settingsBody  = $("qoSettingsBody");
        els.statusDot     = $("qoStatusDot");
        chartCanvas       = $("qoChartCanvas");

        if (chartCanvas) {
            chartCtx = chartCanvas.getContext("2d");
        }

        renderSettings();
        bindSettingsEvents();

        // Initial fetch
        fetchAndRender();
        pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
    }

    // ── Fetch + Render ──

    function fetchAndRender() {
        QO.fetchData(function (data, err) {
            if (err || !data) {
                if (els.statusDot) { els.statusDot.className = "qo-status-dot is-error"; }
                return;
            }
            if (els.statusDot) { els.statusDot.className = "qo-status-dot"; }

            renderSignalGrade(data);
            updateChartData(data);
            renderSparkline();
            QO.trackBandChange(data.carriers, data.qnwinfo);
            renderBandHistory();
            renderConnectionInfo(data);
        });
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
            "  <div class='qo-grade-bars-wrap'>" + QO.buildPhoneBars(data.rsrp) + "</div>",
            "</div>",
            QO.buildGradientBar(data.grade),

            buildMetricRow("RSRP", data.rsrpText, data.rsrp, QO.DEFAULTS.rsrpMin, QO.DEFAULTS.rsrpMax, data.signalClass),
            buildMetricRow("RSRQ", data.rsrqText, data.rsrq, QO.DEFAULTS.rsrqMin, QO.DEFAULTS.rsrqMax,
                rsrqNorm != null ? QO.getGradeClass(rsrqNorm) : "qo-sig-na"),
            buildMetricRow("SINR", data.sinrText, data.sinr, QO.DEFAULTS.sinrMin, QO.DEFAULTS.sinrMax,
                sinrNorm != null ? QO.getGradeClass(sinrNorm) : "qo-sig-na")
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
        var now = new Date();
        var timeLabel = String(now.getHours()).replace(/^(\d)$/, "0$1") + ":" +
                        String(now.getMinutes()).replace(/^(\d)$/, "0$1") + ":" +
                        String(now.getSeconds()).replace(/^(\d)$/, "0$1");
        chartData.push({
            time: timeLabel,
            rsrp: QO.asInt(data.rsrp),
            sinr: data.sinr != null ? parseFloat(data.sinr) : null,
            grade: data.grade
        });
        if (chartData.length > MAX_CHART_POINTS) {
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

        var padding = { top: 10, right: 10, bottom: 20, left: 45 };
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

        // Time labels
        ctx.fillStyle = "#8a8f98";
        ctx.textAlign = "center";
        ctx.font = "9px Consolas, monospace";
        if (chartData.length > 0) {
            ctx.fillText(chartData[0].time, padding.left, h - 4);
            ctx.fillText(chartData[chartData.length - 1].time, w - padding.right, h - 4);
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
        }

        els.connInfo.innerHTML = [
            "<div class='qo-conn-grid'>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>RAT</span>",
            "    <span class='qo-conn-value'><span class='qo-rat-badge " + data.ratClass + "' style='font-size:11px;padding:2px 10px'>" + QO.escapeHtml(data.rat) + "</span></span>",
            "  </div>",
            "  <div class='qo-conn-item'>",
            "    <span class='qo-conn-label'>Provider</span>",
            "    <span class='qo-conn-value'>" + QO.escapeHtml(data.provider) + "</span>",
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
            bandPills ? "  <div class='qo-conn-bands-row'><span class='qo-conn-label'>Band Combo</span><div style='margin-top:6px;display:flex;flex-wrap:wrap;gap:6px'>" + bandPills + "</div></div>" : "",
            "</div>"
        ].join("\n");
    }

    // ── Settings ──

    function renderSettings() {
        if (!els.settingsBody) { return; }
        var s = QO.getSettings();

        els.settingsBody.innerHTML = [
            "<div class='qo-setting-row'>",
            "  <span class='qo-setting-label'>Screensaver</span>",
            "  <label class='qo-toggle'>",
            "    <input type='checkbox' id='qoSettingEnabled' " + (s.enabled ? "checked" : "") + ">",
            "    <span class='qo-toggle-track'></span>",
            "  </label>",
            "</div>",
            "<div class='qo-setting-row'>",
            "  <span class='qo-setting-label'>Idle timeout</span>",
            "  <select class='qo-select' id='qoSettingTimeout'>",
            "    <option value='5000'" + (s.timeout === 5000 ? " selected" : "") + ">5 seconds</option>",
            "    <option value='10000'" + (s.timeout === 10000 ? " selected" : "") + ">10 seconds</option>",
            "    <option value='15000'" + (s.timeout === 15000 ? " selected" : "") + ">15 seconds</option>",
            "    <option value='30000'" + (s.timeout === 30000 ? " selected" : "") + ">30 seconds</option>",
            "    <option value='60000'" + (s.timeout === 60000 ? " selected" : "") + ">60 seconds</option>",
            "  </select>",
            "</div>",
            "<div class='qo-setting-row'>",
            "  <span class='qo-setting-label'>Grade weights</span>",
            "  <div class='qo-weight-group'>",
            "    <div class='qo-weight-item'>",
            "      <span>RSRP</span>",
            "      <input type='number' class='qo-weight-input' id='qoWeightRsrp' min='0' max='100' value='" + s.weightRsrp + "'>",
            "      <span>%</span>",
            "    </div>",
            "    <div class='qo-weight-item'>",
            "      <span>SINR</span>",
            "      <input type='number' class='qo-weight-input' id='qoWeightSinr' min='0' max='100' value='" + s.weightSinr + "'>",
            "      <span>%</span>",
            "    </div>",
            "    <div class='qo-weight-item'>",
            "      <span>RSRQ</span>",
            "      <input type='number' class='qo-weight-input' id='qoWeightRsrq' min='0' max='100' value='" + s.weightRsrq + "'>",
            "      <span>%</span>",
            "    </div>",
            "    <span class='qo-weight-sum is-valid' id='qoWeightSum'>\u03A3 100%</span>",
            "  </div>",
            "</div>",
            "<div class='qo-formula-info'>",
            "  Each metric is normalized to 0\u2013100% within its range:<br>",
            "  <code>RSRP: -120 to -70 dBm</code> &nbsp; ",
            "  <code>RSRQ: -20 to -5 dB</code> &nbsp; ",
            "  <code>SINR: -5 to 30 dB</code><br>",
            "  Grade = <code>RSRP \u00d7 " + s.weightRsrp + "% + SINR \u00d7 " + s.weightSinr + "% + RSRQ \u00d7 " + s.weightRsrq + "%</code>",
            "</div>"
        ].join("\n");
    }

    function bindSettingsEvents() {
        document.addEventListener("change", function (e) {
            var id = e.target.id;
            if (id === "qoSettingEnabled") {
                QO.saveSettings({ enabled: e.target.checked });
            } else if (id === "qoSettingTimeout") {
                QO.saveSettings({ timeout: parseInt(e.target.value, 10) });
            }
        });

        document.addEventListener("input", function (e) {
            var id = e.target.id;
            if (id === "qoWeightRsrp" || id === "qoWeightSinr" || id === "qoWeightRsrq") {
                var rEl = document.getElementById("qoWeightRsrp");
                var sEl = document.getElementById("qoWeightSinr");
                var qEl = document.getElementById("qoWeightRsrq");
                var sumEl = document.getElementById("qoWeightSum");
                if (!rEl || !sEl || !qEl) { return; }
                var r = parseInt(rEl.value, 10) || 0;
                var s = parseInt(sEl.value, 10) || 0;
                var q = parseInt(qEl.value, 10) || 0;
                var sum = r + s + q;
                if (sumEl) {
                    sumEl.textContent = "\u03A3 " + sum + "%";
                    sumEl.className = "qo-weight-sum " + (sum === 100 ? "is-valid" : "is-invalid");
                }
                if (sum === 100) {
                    QO.saveSettings({ weightRsrp: r, weightSinr: s, weightRsrq: q });
                }
            }
        });

        // Settings toggle
        var toggleBtn = document.getElementById("qoSettingsToggle");
        var settingsWrap = document.getElementById("qoSettingsWrap");
        if (toggleBtn && settingsWrap) {
            toggleBtn.addEventListener("click", function () {
                settingsWrap.classList.toggle("is-open");
                toggleBtn.textContent = settingsWrap.classList.contains("is-open") ? "Close settings" : "Settings";
            });
        }
    }

    // ── Public API ──

    window.JtoolsQuickOverviewPage = {
        init: init
    };

})(window);
