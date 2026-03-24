(function (window, $) {
    "use strict";

    var HISTORY_KEY = "jtoolsOoklaSpeedtestHistory";
    var MAX_HISTORY = 10;
    var POLL_MS = 2000;
    var pollTimer = null;
    var state = {
        phase: "idle",
        running: false,
        installed: false,
        state_loaded: false,
        state_read_failures: 0,
        auto_recover_attempted: false,
        default_interface: "",
        binary_path: "",
        install_script: "",
        selected_server_id: "",
        servers: [],
        result: null,
        live: null,
        ca_info: null,
        last_error_message: "",
        status_text: "",
        error: "",
        details_open: false,
        history: []
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatNumber(value, digits) {
        var num = Number(value);
        if (!isFinite(num)) {
            return "0";
        }
        return num.toFixed(digits == null ? 2 : digits);
    }

    function formatMaybe(value, suffix) {
        if (value == null || value === "") {
            return "N/A";
        }
        return formatNumber(value, 2) + (suffix || "");
    }

    function resultScale() {
        var values = [];
        if (state.result) {
            values.push(Number(state.result.download_mbps) || 0);
            values.push(Number(state.result.upload_mbps) || 0);
        }
        if (state.live) {
            values.push(Number(state.live.download_mbps) || 0);
            values.push(Number(state.live.upload_mbps) || 0);
        }
        state.history.forEach(function (item) {
            values.push(Number(item.download_mbps) || 0);
            values.push(Number(item.upload_mbps) || 0);
        });
        var max = Math.max.apply(Math, values.concat([250]));
        return Math.ceil(max / 100) * 100;
    }

    function liveGaugeState() {
        var live = state.live || {};
        var scale = resultScale();
        var mode = live.stage || (state.running ? "starting" : "idle");
        var downloadValue = Number(live.download_mbps);
        var uploadValue = Number(live.upload_mbps);

        if (!isFinite(downloadValue)) {
            downloadValue = state.result ? (Number(state.result.download_mbps) || 0) : 0;
        }
        if (!isFinite(uploadValue)) {
            uploadValue = state.result ? (Number(state.result.upload_mbps) || 0) : 0;
        }

        return {
            scale: scale,
            mode: mode,
            progress: Number(live.progress) || 0,
            downloadValue: downloadValue,
            uploadValue: uploadValue
        };
    }

    function titleCase(value) {
        var text = String(value || "");
        if (!text) {
            return "";
        }
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function buildLiveStripHtml() {
        if (!state.running || !state.live) {
            return "";
        }

        var progressPct = Math.max(0, Math.min(100, Math.round((Number(state.live.progress) || 0) * 100)));
        var stage = titleCase(state.live.stage || "running");
        var bits = [
            "<div class='ookla-live-strip'>",
            "<div class='ookla-live-strip-top'>",
            "<div class='ookla-live-stage'>", escapeHtml(stage), "</div>",
            "<div class='ookla-live-progress'>", escapeHtml(String(progressPct)), "%</div>",
            "</div>",
            "<div class='ookla-live-bar'><span style='width:", escapeHtml(String(progressPct)), "%;'></span></div>",
            "<div class='ookla-live-metrics'>",
            "<div class='ookla-live-metric'><span>Down</span><strong>", escapeHtml(formatNumber(state.live.download_mbps || 0, 2)), " Mbps</strong></div>",
            "<div class='ookla-live-metric'><span>Up</span><strong>", escapeHtml(formatNumber(state.live.upload_mbps || 0, 2)), " Mbps</strong></div>",
            "<div class='ookla-live-metric'><span>Ping</span><strong>", escapeHtml(formatMaybe(state.live.ping_latency_ms, " ms")), "</strong></div>",
            "</div>",
            "</div>"
        ];

        return bits.join("");
    }

    function loadHistory() {
        if (!window.localStorage) {
            state.history = [];
            return;
        }
        try {
            var raw = window.localStorage.getItem(HISTORY_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            state.history = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            state.history = [];
        }
    }

    function saveHistory() {
        if (!window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
        } catch (err) {}
    }

    function pushHistory(result) {
        if (!result || !result.result_url) {
            return;
        }
        state.history = state.history.filter(function (item) {
            return item.result_url !== result.result_url;
        });
        state.history.unshift({
            timestamp: result.timestamp,
            download_mbps: result.download_mbps,
            upload_mbps: result.upload_mbps,
            latency_ms: result.latency_ms,
            jitter_ms: result.jitter_ms,
            packet_loss: result.packet_loss,
            server_name: result.server_name,
            server_location: result.server_location,
            result_url: result.result_url,
            result_png_url: result.result_png_url
        });
        state.history = state.history.slice(0, MAX_HISTORY);
        saveHistory();
    }

    function setBanner(kind, text) {
        var node = document.getElementById("ookla-speedtest-banner");
        if (!node) {
            return;
        }
        node.className = "ookla-banner" + (kind ? " is-" + kind : "");
        node.textContent = text || "";
    }

    function gaugeStyle(value, scale) {
        var safeValue = Math.max(0, Number(value) || 0);
        var safeScale = Math.max(50, Number(scale) || 100);
        var ratio = Math.min(safeValue / safeScale, 1);
        return "--ookla-gauge-turn:" + ratio.toFixed(4) + "turn;";
    }

    function buildGaugeHtml(title, value, scale, accentClass, subtitle, phaseText) {
        return [
            "<div class='ookla-gauge-card ", accentClass, "'>",
            "<div class='ookla-gauge-head'>",
            "<div class='ookla-gauge-kicker'>", escapeHtml(title), "</div>",
            "<div class='ookla-gauge-phase-text'>", escapeHtml(phaseText || ""), "</div>",
            "</div>",
            "<div class='ookla-gauge' style='", gaugeStyle(value, scale), "'>",
            "<div class='ookla-gauge-inner'>",
            "<div class='ookla-gauge-value'>", escapeHtml(formatNumber(value, 2)), "</div>",
            "<div class='ookla-gauge-unit'>Mbps</div>",
            "</div>",
            "</div>",
            "<div class='ookla-gauge-scale'>Scale max ", escapeHtml(String(scale)), " Mbps</div>",
            "<div class='ookla-gauge-subtitle'>", escapeHtml(subtitle || ""), "</div>",
            "</div>"
        ].join("");
    }

    function buildIdleGaugeHtml(title, accentClass, subtitle, phaseText) {
        return [
            "<div class='ookla-gauge-card ", accentClass, " is-idle'>",
            "<div class='ookla-gauge-head'>",
            "<div class='ookla-gauge-kicker'>", escapeHtml(title), "</div>",
            "<div class='ookla-gauge-phase-text'>", escapeHtml(phaseText || ""), "</div>",
            "</div>",
            "<div class='ookla-gauge ookla-gauge-idle' style='--ookla-gauge-turn:0turn;'>",
            "<div class='ookla-gauge-inner'>",
            "<div class='ookla-gauge-value'>--</div>",
            "<div class='ookla-gauge-unit'>Mbps</div>",
            "</div>",
            "</div>",
            "<div class='ookla-gauge-scale'>Waiting for test data</div>",
            "<div class='ookla-gauge-subtitle'>", escapeHtml(subtitle || ""), "</div>",
            "</div>"
        ].join("");
    }

    function getGaugeMode() {
        var liveStage = state.live && state.live.stage ? String(state.live.stage) : "";
        if (state.running) {
            if (liveStage === "upload") {
                return "upload";
            }
            return "download";
        }
        return "download";
    }

    function buildPhaseRailHtml() {
        var liveStage = state.live && state.live.stage ? String(state.live.stage) : "";
        var stage = state.running ? liveStage : (state.phase === "completed" ? "completed" : "idle");
        var steps = [
            { id: "ping", label: "Ping" },
            { id: "download", label: "Download" },
            { id: "upload", label: "Upload" }
        ];
        var phaseIndex = { ping: 0, download: 1, upload: 2 };
        var currentIndex = phaseIndex[stage];

        return [
            "<div class='ookla-phase-rail'>",
            steps.map(function (step, index) {
                var classes = ["ookla-phase-step"];
                if (stage === "completed") {
                    classes.push("is-done");
                } else if (typeof currentIndex === "number") {
                    if (index < currentIndex) {
                        classes.push("is-done");
                    } else if (index === currentIndex) {
                        classes.push("is-active");
                    }
                }
                return "<div class='" + classes.join(" ") + "'><span class='ookla-phase-dot'></span><span class='ookla-phase-label'>" + escapeHtml(step.label) + "</span></div>";
            }).join(""),
            "</div>"
        ].join("");
    }

    function buildGaugeStatsHtml() {
        var pingValue = "N/A";
        var downloadValue = "--";
        var uploadValue = "--";
        if (state.result) {
            pingValue = formatMaybe(state.result.latency_ms, " ms");
            downloadValue = formatNumber(state.result.download_mbps, 2) + " Mbps";
            uploadValue = formatNumber(state.result.upload_mbps, 2) + " Mbps";
        } else if (state.live) {
            pingValue = formatMaybe(state.live.ping_latency_ms, " ms");
            downloadValue = formatNumber(state.live.download_mbps || 0, 2) + " Mbps";
            uploadValue = formatNumber(state.live.upload_mbps || 0, 2) + " Mbps";
        }
        return [
            "<div class='ookla-gauge-stats'>",
            "<div class='ookla-gauge-stat'><span class='ookla-gauge-stat-label'>Ping</span><span class='ookla-gauge-stat-value'>", escapeHtml(pingValue), "</span></div>",
            "<div class='ookla-gauge-stat is-download'><span class='ookla-gauge-stat-label'>Download</span><span class='ookla-gauge-stat-value'>", escapeHtml(downloadValue), "</span></div>",
            "<div class='ookla-gauge-stat is-upload'><span class='ookla-gauge-stat-label'>Upload</span><span class='ookla-gauge-stat-value'>", escapeHtml(uploadValue), "</span></div>",
            "</div>"
        ].join("");
    }

    function renderMainGauge() {
        var slot = document.getElementById("ookla-flip-gauge-slot");
        if (!slot) return;

        var liveGauge = liveGaugeState();
        var scale = liveGauge.scale;
        var isDl = getGaugeMode() === "download";

        var value, title, subtitle, accentClass, phaseText;
        if (isDl) {
            value = liveGauge.downloadValue;
            title = "Download";
            accentClass = "is-download";
            phaseText = state.running ? "Download phase" : (state.phase === "completed" ? "Final result" : "Ready");
            subtitle = state.running ? "Live downstream test from the router" : "Primary result view";
        } else {
            value = liveGauge.uploadValue;
            title = "Upload";
            accentClass = "is-upload";
            phaseText = "Upload phase";
            subtitle = "Live upstream test from the router";
        }

        var hasData = state.running || state.result;
        if (hasData) {
            slot.innerHTML = buildGaugeHtml(title, value, scale, accentClass, subtitle, phaseText);
        } else {
            slot.innerHTML = buildIdleGaugeHtml(title, accentClass, "Waiting for the next speed test run", "Idle");
        }
    }

    function buildServerOptions() {
        var html = ["<option value=''>Automatic (recommended)</option>"];
        state.servers.forEach(function (server) {
            var label = "#" + server.id + " - " + server.name + " - " + server.location + ", " + server.country;
            var selected = String(state.selected_server_id || "") === String(server.id) ? " selected" : "";
            html.push("<option value='" + escapeHtml(server.id) + "'" + selected + ">" + escapeHtml(label) + "</option>");
        });
        return html.join("");
    }

    function buildHistoryHtml() {
        if (!state.history.length) {
            return "<div class='ookla-empty'>No browser-local history yet. Run a test and it will appear here on this browser.</div>";
        }
        return state.history.map(function (item) {
            return [
                "<div class='ookla-history-item'>",
                "<div class='ookla-history-top'>",
                "<div class='ookla-history-speed'><strong>", escapeHtml(formatNumber(item.download_mbps, 2)), "</strong> down / <strong>", escapeHtml(formatNumber(item.upload_mbps, 2)), "</strong> up</div>",
                "<div class='ookla-history-time'>", escapeHtml(item.timestamp || ""), "</div>",
                "</div>",
                "<div class='ookla-history-meta'>", escapeHtml((item.server_name || "") + (item.server_location ? " - " + item.server_location : "")), "</div>",
                "<div class='ookla-history-actions'>",
                "<a class='ookla-link-button' target='_blank' rel='noopener noreferrer' href='", escapeHtml(item.result_url || "#"), "'>Result</a>",
                "<a class='ookla-link-button' target='_blank' rel='noopener noreferrer' href='", escapeHtml(item.result_png_url || "#"), "'>PNG</a>",
                "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function buildCaBandsHtml() {
        var ca = state.ca_info || {};
        var bands = Array.isArray(ca.bands) ? ca.bands : [];
        var carriers = Array.isArray(ca.carriers) ? ca.carriers : [];
        var isSnapshot = !!ca.snapshot;
        var comboText = ca.combo_text || (bands.length ? bands.join(" + ") : "Waiting for live CA data");
        var caption;
        if (isSnapshot && bands.length) {
            caption = "Frozen at test start \u2014 live refresh resumes when the test finishes.";
        } else if (bands.length) {
            caption = "Live carrier aggregation snapshot from QCAINFO.";
        } else {
            caption = "No active carrier aggregation bands reported right now.";
        }
        return [
            "<div class='ookla-ca-card", (isSnapshot ? " is-snapshot" : ""), "'>",
            "<div class='ookla-ca-copy'>",
            "<div class='ookla-ca-label'>Band info", (isSnapshot ? " <span class='ookla-ca-frozen-tag'>snapshot</span>" : ""), "</div>",
            "<div class='ookla-ca-caption'>", escapeHtml(caption), "</div>",
            "<div class='ookla-ca-combo'>", escapeHtml(comboText), "</div>",
            "</div>",
            "<div class='ookla-ca-pills'>",
            (bands.length ? bands.map(function (band, index) {
                var carrier = carriers[index] || {};
                var rat = String(carrier.rat || "").toUpperCase();
                var role = String(carrier.role || "").toUpperCase();
                var cls = "ookla-ca-pill";
                if (rat === "NR5G") {
                    cls += " is-nr";
                }
                if (role === "PCC") {
                    cls += " is-pcc";
                }
                return "<span class='" + cls + "'>" + escapeHtml(band) + "</span>";
            }).join("") : "<span class='ookla-ca-pill is-muted'>No CA</span>"),
            "</div>",
            "</div>"
        ].join("");
    }

    function renderPanel() {
        if (document.getElementById("ookla-speedtest-panel")) {
            return;
        }

        var panel = document.createElement("div");
        panel.id = "ookla-speedtest-panel";
        panel.className = "body-box form-row qt-card";
        panel.innerHTML = [
            "<div class='ookla-page'>",
            "<h3 class='qt-card-header'>Ookla Speedtest</h3>",
            "<div class='ookla-eyebrow'>Qtooley speed lab</div>",
            "<p class='ookla-subtitle'>Run official speed tests from the router itself, keep nearby servers handy, and jump straight to the shareable result page.</p>",
            "<div id='ookla-speedtest-banner' class='ookla-banner'></div>",
            "<div class='ookla-banner-actions'>",
            "<button id='ookla-recover' class='qt-btn qt-btn-secondary ookla-recover-button' type='button'>Restart speedtest backend</button>",
            "</div>",

            "<div class='ookla-above-fold'>",

            "<div class='ookla-fold-left'>",
            "<div id='ookla-phase-rail-slot'></div>",
            "<div id='ookla-flip-gauge-slot' class='ookla-flip-gauge-slot'></div>",
            "<div id='ookla-gauge-stats-slot'></div>",
            "<div id='ookla-live-strip-slot'></div>",
            "</div>",

            "<div class='ookla-fold-right'>",
            "<div class='ookla-toolbar-stacked'>",
            "<div class='ookla-field'>",
            "<label for='ookla-server-select'>Server</label>",
            "<select id='ookla-server-select' class='ookla-select'></select>",
            "</div>",
            "<div class='ookla-field ookla-readonly'>",
            "<label>Interface</label>",
            "<div id='ookla-interface-label' class='ookla-static'>Detecting...</div>",
            "</div>",
            "<div class='ookla-field ookla-readonly'>",
            "<label>Status</label>",
            "<div id='ookla-phase-label' class='ookla-static'>Idle</div>",
            "</div>",
            "</div>",
            "<div class='ookla-stage-actions'>",
            "<button id='ookla-start' class='qt-btn qt-btn-danger ookla-run-button' type='button'>Run speed test</button>",
            "<button id='ookla-refresh-servers' class='qt-btn qt-btn-primary ookla-secondary-button' type='button'>Refresh servers</button>",
            "</div>",
            "<div id='ookla-ca-bands' class='ookla-ca-slot ookla-ca-slot-side'></div>",
            "</div>",

            "</div>",

            "<div id='ookla-gauges' class='ookla-gauges' style='display:none'></div>",

            "<div class='ookla-grid ookla-grid-lower'>",
            "<div class='ookla-card'>",
            "<div class='ookla-card-title'>See results online</div>",
            "<div id='ookla-result-actions' class='ookla-action-grid'></div>",
            "</div>",
            "<div class='ookla-card'>",
            "<div class='ookla-card-title'>Latest result</div>",
            "<div id='ookla-result-summary' class='ookla-summary'></div>",
            "</div>",
            "<div class='ookla-card'>",
            "<div class='ookla-card-title'>Recent browser history</div>",
            "<div id='ookla-history' class='ookla-history'></div>",
            "</div>",
            "</div>",
            "<div class='ookla-card ookla-card-bottom'>",
            "<details id='ookla-run-details' class='ookla-details qt-details'>",
            "<summary class='ookla-details-summary qt-details-summary'><span class='qt-details-arrow'></span> Run details</summary>",
            "<div id='ookla-result-meta' class='ookla-meta-grid'></div>",
            "</details>",
            "</div>",
            "</div>"
        ].join("");

        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (htmlGoesHere) {
            htmlGoesHere.appendChild(panel);
        }

        try {
        document.getElementById("ookla-start").addEventListener("click", startTest);
        document.getElementById("ookla-recover").addEventListener("click", recoverBackend);
        document.getElementById("ookla-refresh-servers").addEventListener("click", function () {
            fetchServers(true);
        });
        document.getElementById("ookla-server-select").addEventListener("change", function (event) {
            state.selected_server_id = event.target.value || "";
        });
        document.getElementById("ookla-run-details").addEventListener("toggle", function (event) {
            state.details_open = !!event.target.open;
        });
        } catch (e) { if (window.console) console.error("Speedtest panel bind error:", e); }
    }

    function render() {
        var serverSelect = document.getElementById("ookla-server-select");
        if (serverSelect) {
            serverSelect.innerHTML = buildServerOptions();
            serverSelect.disabled = !!state.running || !state.installed;
            serverSelect.value = state.selected_server_id || "";
        }

        var interfaceLabel = document.getElementById("ookla-interface-label");
        if (interfaceLabel) {
            interfaceLabel.textContent = state.default_interface || "Auto";
        }

        var phaseLabel = document.getElementById("ookla-phase-label");
        if (phaseLabel) {
            phaseLabel.textContent = state.running ? "Running" : (state.phase || "Idle");
        }

        var startButton = document.getElementById("ookla-start");
        if (startButton) {
            startButton.disabled = !!state.running || !state.installed;
            startButton.textContent = state.running ? "Running..." : "Run speed test";
        }

        var recoverButton = document.getElementById("ookla-recover");
        if (recoverButton) {
            recoverButton.disabled = !!state.running;
        }

        renderMainGauge();

        var flipSlot = document.getElementById("ookla-flip-gauge-slot");
        if (flipSlot) {
            flipSlot.className = "ookla-flip-gauge-slot" + (state.running ? " is-running" : "");
        }

        var phaseRailSlot = document.getElementById("ookla-phase-rail-slot");
        if (phaseRailSlot) {
            phaseRailSlot.innerHTML = buildPhaseRailHtml();
        }

        var gaugeStatsSlot = document.getElementById("ookla-gauge-stats-slot");
        if (gaugeStatsSlot) {
            gaugeStatsSlot.innerHTML = buildGaugeStatsHtml();
        }

        var caBands = document.getElementById("ookla-ca-bands");
        if (caBands) {
            caBands.innerHTML = buildCaBandsHtml();
        }

        var liveStripSlot = document.getElementById("ookla-live-strip-slot");
        if (liveStripSlot) {
            liveStripSlot.innerHTML = buildLiveStripHtml();
        }

        var detailsNode = document.getElementById("ookla-run-details");
        if (detailsNode) {
            detailsNode.open = !!state.details_open;
        }

        var summary = document.getElementById("ookla-result-summary");
        if (summary) {
            if (state.result) {
                summary.innerHTML = [
                    "<div class='ookla-summary-line'><strong>", escapeHtml(formatNumber(state.result.download_mbps, 2)), " Mbps</strong> down and <strong>",
                    escapeHtml(formatNumber(state.result.upload_mbps, 2)), " Mbps</strong> up</div>",
                    "<div class='ookla-summary-line'>Latency ", escapeHtml(formatMaybe(state.result.latency_ms, " ms")),
                    " | Jitter ", escapeHtml(formatMaybe(state.result.jitter_ms, " ms")),
                    " | Packet loss ", escapeHtml(state.result.packet_loss == null ? "N/A" : String(state.result.packet_loss) + "%"),
                    "</div>",
                    "<div class='ookla-summary-line'>",
                    escapeHtml(state.result.server_name || "Unknown server"),
                    state.result.server_location ? " - " + escapeHtml(state.result.server_location) : "",
                    state.result.server_country ? ", " + escapeHtml(state.result.server_country) : "",
                    "</div>"
                ].join("");
            } else if (!state.state_loaded) {
                summary.innerHTML = "<div class='ookla-empty'>Waiting for the speedtest backend to report its current state.</div>";
            } else if (!state.installed) {
                summary.innerHTML = "<div class='ookla-empty'>The official Ookla CLI is not installed yet. Use the install script shown below when you are ready to deploy live.</div>";
            } else {
                summary.innerHTML = "<div class='ookla-empty'>No completed result yet.</div>";
            }
        }

        var meta = document.getElementById("ookla-result-meta");
        if (meta) {
            var rows = [];
            rows.push(["Binary", state.installed ? "Installed" : "Missing"]);
            rows.push(["Binary path", state.binary_path || ""]);
            rows.push(["Install helper", state.install_script || ""]);
            rows.push(["Phase", state.phase || "idle"]);
            if (state.live && state.live.stage) {
                rows.push(["Live stage", state.live.stage]);
            }
            if (state.live && state.live.progress != null) {
                rows.push(["Live progress", Math.round((Number(state.live.progress) || 0) * 100) + "%"]);
            }
            rows.push(["Interface", state.result && state.result.interface_name ? state.result.interface_name : (state.default_interface || "Auto")]);
            if (state.last_error_message) {
                rows.push(["Last error", state.last_error_message]);
            }
            if (state.result) {
                rows.push(["ISP", state.result.isp || ""]);
                rows.push(["Server ID", state.result.server_id || ""]);
                rows.push(["External IP", state.result.external_ip || ""]);
                rows.push(["Timestamp", state.result.timestamp || ""]);
            }
            meta.innerHTML = rows.map(function (row) {
                return "<div class='ookla-meta-item'><div class='ookla-meta-label'>" + escapeHtml(row[0]) + "</div><div class='ookla-meta-value'>" + escapeHtml(row[1]) + "</div></div>";
            }).join("");
        }

        var actions = document.getElementById("ookla-result-actions");
        if (actions) {
            var hasResult = !!(state.result && state.result.result_url);
            actions.innerHTML = [
                hasResult ? "<a class='ookla-link-button is-primary' target='_blank' rel='noopener noreferrer' href='" + escapeHtml(state.result.result_url) + "'>Open result</a>" : "<button class='ookla-link-button' type='button' disabled>Open result</button>",
                hasResult ? "<a class='ookla-link-button' target='_blank' rel='noopener noreferrer' href='" + escapeHtml(state.result.result_png_url) + "'>Open PNG</a>" : "<button class='ookla-link-button' type='button' disabled>Open PNG</button>",
                "<button id='ookla-copy-summary' class='ookla-link-button' type='button'" + (hasResult ? "" : " disabled") + ">Copy summary</button>"
            ].join("");

            var copyButton = document.getElementById("ookla-copy-summary");
            if (copyButton && hasResult) {
                copyButton.addEventListener("click", copySummary);
            }
        }

        var history = document.getElementById("ookla-history");
        if (history) {
            history.innerHTML = buildHistoryHtml();
        }

        if (!state.state_loaded) {
            if (state.auto_recover_attempted && state.state_read_failures >= 6) {
                setBanner("warn", "Speedtest backend is still not responding after reboot. Try Restart speedtest backend.");
            } else {
                setBanner("warn", "Speedtest page is waiting for backend state after login or reboot.");
            }
        } else if (!state.installed) {
            setBanner("error", "Ookla CLI is not installed yet. The planned live install helper is " + (state.install_script || "/usrdata/at-stock-ui/install_ookla_speedtest_cli.sh") + ".");
        } else if (state.running) {
            setBanner("info", state.status_text || "Running Ookla Speedtest on the router...");
        } else if (state.phase === "completed") {
            setBanner("ok", state.status_text || "Ookla Speedtest completed successfully.");
        } else if (state.phase === "failed") {
            setBanner("error", (state.status_text || "Ookla Speedtest failed.") + (state.error ? " (" + state.error + ")" : ""));
        } else {
            setBanner("", state.status_text || "Ready to run Ookla Speedtest from the router.");
        }
    }

    function copySummary() {
        if (!state.result || !state.result.result_url) {
            return;
        }
        var text = [
            "Ookla Speedtest",
            "Download: " + formatNumber(state.result.download_mbps, 2) + " Mbps",
            "Upload: " + formatNumber(state.result.upload_mbps, 2) + " Mbps",
            "Latency: " + formatMaybe(state.result.latency_ms, " ms"),
            "Jitter: " + formatMaybe(state.result.jitter_ms, " ms"),
            "Packet loss: " + (state.result.packet_loss == null ? "N/A" : String(state.result.packet_loss) + "%"),
            "Server: " + (state.result.server_name || "") + (state.result.server_location ? " - " + state.result.server_location : ""),
            "Result: " + state.result.result_url
        ].join("\n");

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () {});
            return;
        }

        var temp = document.createElement("textarea");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
    }

    function applyStatePayload(response) {
        var previousResult = state.result;
        if (!response) {
            return;
        }
        state.phase = response.phase || "idle";
        state.running = !!response.running;
        state.installed = !!response.binary_present;
        state.state_loaded = true;
        state.state_read_failures = 0;
        state.default_interface = response.default_interface || "";
        state.binary_path = response.binary_path || "";
        state.install_script = response.install_script || "";
        state.status_text = response.status_text || "";
        state.error = response.error || "";
        state.live = response.live || null;
        state.ca_info = response.ca_info || null;
        state.last_error_message = response.last_error_message || "";
        state.result = response.result || ((response.running || response.phase === "preparing" || response.phase === "running" || response.phase === "failed") ? previousResult : null);
        if (state.result && state.phase === "completed") {
            pushHistory(state.result);
        }
        render();
    }

    function fetchState() {
        $.ajax({
            url: "/ookla_speedtest_api/state",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            applyStatePayload(response || {});
        }).fail(function (xhr) {
            state.state_read_failures += 1;
            if (!state.auto_recover_attempted && state.state_read_failures >= 4) {
                state.auto_recover_attempted = true;
                setBanner("warn", "Speedtest backend looks stale after reboot. Trying one automatic recovery...");
                recoverBackend(true);
                return;
            }

            if (!state.state_loaded) {
                if (state.auto_recover_attempted && state.state_read_failures >= 6) {
                    setBanner("warn", "Speedtest backend is still not responding after reboot. Try Restart speedtest backend.");
                } else {
                    setBanner("warn", "Speedtest backend is still settling after login or reboot...");
                }
                return;
            }

            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Failed to read Ookla Speedtest state.");
        });
    }

    function fetchServers(manual) {
        $.ajax({
            url: "/ookla_speedtest_api/servers",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            if (!response || !response.ok) {
                setBanner("error", (response && response.error) || "Failed to load nearby servers.");
                return;
            }
            state.servers = response.servers || [];
            render();
            if (manual) {
                setBanner("ok", "Nearby Ookla servers refreshed.");
            }
        }).fail(function (xhr) {
            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Failed to load nearby servers.");
        });
    }

    function startPolling() {
        if (pollTimer) {
            window.clearInterval(pollTimer);
        }
        pollTimer = window.setInterval(function () {
            fetchState();
        }, POLL_MS);
    }

    function startTest() {
        $.ajax({
            url: "/ookla_speedtest_api/start",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                server_id: state.selected_server_id || ""
            }
        }).done(function (response) {
            if (!response || !response.ok) {
                setBanner("error", (response && response.error) || "Failed to start Ookla Speedtest.");
                return;
            }
            state.phase = response.phase || "preparing";
            state.running = true;
            state.status_text = response.status_text || "Preparing Ookla Speedtest on the router...";
            render();
            fetchState();
        }).fail(function (xhr) {
            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Failed to start Ookla Speedtest.");
        });
    }

    function recoverBackend(silentAutoRecover) {
        $.ajax({
            url: "/ookla_speedtest_api/recover",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken
            }
        }).done(function (response) {
            if (!response || response.ok === false) {
                setBanner("error", (response && response.error) || "Failed to restart the speedtest backend.");
                return;
            }
            applyStatePayload(response || {});
            if (!silentAutoRecover) {
                setBanner("ok", "Speedtest backend restarted. Ready to run again.");
            }
            fetchServers(false);
        }).fail(function (xhr) {
            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Failed to restart the speedtest backend.");
        });
    }

    window.JtoolsOoklaSpeedtest = {
        init: function () {
            loadHistory();
            renderPanel();
            render();
            window.setTimeout(function () {
                startPolling();
                fetchState();
                fetchServers(false);
            }, 500);
        }
    };
})(window, jQuery);
