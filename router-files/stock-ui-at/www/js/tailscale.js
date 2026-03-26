(function (window, $) {
    "use strict";

    var POLL_MS = 7000;
    var AUTH_POLL_MS = 3000;
    var state = {
        installed: false,
        service_active: false,
        service_enabled: false,
        logged_in: false,
        hostname: "",
        tailscale_ip: "",
        ssh_enabled: false,
        status_text: "",
        auth_url: "",
        peers: [],
        raw_output: "",
        last_action: "",
        backend_state: "",
        busy: false,
        loaded: false,
        search: "",
        openPeer: "",
        rawOpen: false,
        peerListScrollTop: 0,
        rawScrollTop: 0,
        ssh_preference: false,
        sshPreferenceDirty: false,
        showForceReinstallModal: false
    };
    var pollTimer = null;
    var pageEventsBound = false;

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function currentLogoPath() {
        return document.querySelector("link[data-jtools-dark-mode]")
            ? "/img/qtooley/tailscale-logo-white.svg"
            : "/img/qtooley/tailscale-logo-black.svg";
    }

    function tipAttr(text) {
        var safe = escapeHtml(text || "");
        return safe ? " title='" + safe + "' aria-label='" + safe + "'" : "";
    }

    function setBanner(kind, message) {
        var node = byId("tailscale-banner");
        if (!node) return;
        var classes = ["qt-banner", "ts-banner"];
        if (kind === "ok") classes.push("qt-banner-ok");
        else if (kind === "warn") classes.push("qt-banner-warn");
        else if (kind === "error") classes.push("qt-banner-error");
        else classes.push("qt-banner-info");
        node.className = classes.join(" ");
        node.textContent = message || "";
    }

    function statusChip() {
        if (!state.installed) return { cls: "is-off", label: "Not installed" };
        if (!state.service_active) return { cls: "is-off", label: "Service stopped" };
        if (state.auth_url) return { cls: "is-warn", label: "Auth required" };
        if (state.logged_in) return { cls: "is-ok", label: "Connected" };
        return { cls: "is-warn", label: "Waiting" };
    }

    function boolPill(value, trueLabel, falseLabel) {
        return value
            ? "<span class='qt-pill qt-pill-ok'>" + escapeHtml(trueLabel) + "</span>"
            : "<span class='qt-pill qt-pill-na'>" + escapeHtml(falseLabel) + "</span>";
    }

    function buildPeerRows() {
        var filter = (state.search || "").toLowerCase();
        var peers = (state.peers || []).filter(function (peer) {
            var name = String(peer.name || "").toLowerCase();
            var ip = String(peer.tailscale_ip || "").toLowerCase();
            return !filter || name.indexOf(filter) >= 0 || ip.indexOf(filter) >= 0;
        });

        if (!peers.length) {
            return "<div class='ts-empty'>No tailnet devices match the current search.</div>";
        }

        return peers.map(function (peer) {
            var key = peer.name + "|" + peer.tailscale_ip;
            var open = state.openPeer === key;
            var statusText = peer.connected ? "Connected" : "Offline";
            return [
                "<div class='ts-peer-row", open ? " is-open" : "", "' data-peer-key='", escapeHtml(key), "'>",
                "<button type='button' class='ts-peer-button' data-peer-toggle='", escapeHtml(key), "'", tipAttr("Show details for " + (peer.name || "this device")), ">",
                "<span class='ts-peer-dot ", peer.connected ? "is-online" : "is-offline", "'></span>",
                "<span class='ts-peer-name'>", escapeHtml(peer.name || "Peer"), "</span>",
                "<span class='ts-peer-ip-inline'>", escapeHtml(peer.tailscale_ip || "Unavailable"), "</span>",
                "<span class='ts-peer-chevron'>&rsaquo;</span>",
                "</button>",
                "<div class='ts-peer-details'>",
                "<div class='ts-peer-details-grid'>",
                "<div class='ts-peer-detail'><div class='ts-peer-detail-label'>Status</div><div class='ts-peer-detail-value'>", escapeHtml(statusText), "</div></div>",
                "<div class='ts-peer-detail'><div class='ts-peer-detail-label'>Tailscale IP</div><div class='ts-peer-detail-value'>", escapeHtml(peer.tailscale_ip || "Unavailable"), "</div></div>",
                "<div class='ts-peer-detail'><div class='ts-peer-detail-label'>Last seen</div><div class='ts-peer-detail-value'>", escapeHtml(peer.last_seen || "Unavailable"), "</div></div>",
                "</div>",
                "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function render() {
        var panel = byId("tailscale-panel");
        if (!panel) return;
        var peerList = byId("ts-peer-list");
        var rawOutput = byId("ts-raw-output");
        if (peerList) {
            state.peerListScrollTop = peerList.scrollTop || 0;
        }
        if (rawOutput) {
            state.rawScrollTop = rawOutput.scrollTop || 0;
        }

        var chip = statusChip();
        panel.innerHTML = [
            "<div class='ts-page'>",
            "  <div class='ts-hero'>",
            "    <div class='ts-brand'>",
            "      <div class='ts-brand-logo'>",
            "        <img id='ts-logo-img' src='", currentLogoPath(), "' alt='Tailscale logo'>",
            "        <div id='ts-logo-fallback' class='ts-brand-fallback is-hidden'>",
            "          <span class='ts-brand-icon'><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span>",
            "          <span>tailscale</span>",
            "        </div>",
            "      </div>",
            "      <div class='ts-brand-copy'>",
            "        <div class='ts-eyebrow'>Qtooley Service Control</div>",
            "        <h2 class='ts-title'>Tailscale on the router</h2>",
            "        <p class='ts-subtitle'>Modern tailnet management inside the stock UI overlay. Install, connect, manage SSH access, and watch the rest of the tailnet from the same Qtooley control surface.</p>",
            "      </div>",
            "    </div>",
            "    <div class='ts-hero-meta'>",
            "      <div class='ts-status-chip ", chip.cls, "'", tipAttr("Current Tailscale state for this router"), "><span class='ts-status-chip-dot'></span>", escapeHtml(chip.label), "</div>",
            state.auth_url ? "      <a class='qt-btn qt-btn-primary' target='_blank' rel='noopener noreferrer' href='" + escapeHtml(state.auth_url) + "'" + tipAttr("Open the Tailscale login link in a new browser tab") + ">Open auth link</a>" : "",
            "    </div>",
            "  </div>",
            "  <div id='tailscale-banner' class='qt-banner ts-banner qt-banner-info'>", escapeHtml(state.status_text || "Loading Tailscale status..."), "</div>",
            "  <div class='ts-grid'>",
            "    <div class='ts-card'>",
            "      <h3 class='ts-card-title'>Lifecycle and session actions</h3>",
            "      <div class='ts-actions-grid'>",
            "        <div class='ts-action-group'>",
            "          <h4>Install</h4>",
            "          <div class='ts-button-row ts-install-button-row'>",
            "            <button id='ts-install' class='qt-btn qt-btn-primary' type='button'", tipAttr("Check for the latest stable 32-bit ARM Tailscale build and install it only if needed"), ">Install / update</button>",
            "            <button id='ts-remove' class='qt-btn qt-btn-danger' type='button'", tipAttr("Stop Tailscale and remove the installed runtime from this router"), ">Remove</button>",
            "          </div>",
            "        </div>",
            "        <div class='ts-action-group'>",
            "          <h4>Service</h4>",
            "          <div class='ts-button-row'>",
            "            <button id='ts-start' class='qt-btn qt-btn-primary' type='button'", tipAttr("Start the Tailscale service without reinstalling it"), ">Start</button>",
            "            <button id='ts-stop' class='qt-btn qt-btn-secondary' type='button'", tipAttr("Stop the Tailscale service but keep it installed"), ">Stop</button>",
            "            <button id='ts-restart' class='qt-btn qt-btn-primary' type='button'", tipAttr("Restart the Tailscale service to refresh the local daemon"), ">Restart</button>",
            "          </div>",
            "        </div>",
            "        <div class='ts-action-group ts-action-group-tailnet ts-action-group-wide'>",
            "          <h4>Tailnet</h4>",
            "          <div class='ts-tailnet-stack'>",
            "          <label class='ts-toggle-row' for='ts-ssh-toggle'", tipAttr("Choose whether the next Connect action should enable Tailscale SSH on this router"), ">",
            "            <span class='ts-toggle-copy'>SSH over tailnet</span>",
            "            <span class='ts-toggle-shell", state.ssh_preference ? " is-on" : "", "'>",
            "              <input id='ts-ssh-toggle' type='checkbox'", state.ssh_preference ? " checked" : "", tipAttr("Enable or disable Tailscale SSH for the next connect action"), ">",
            "              <span class='ts-toggle-track'><span class='ts-toggle-knob'></span></span>",
            "            </span>",
            "          </label>",
            "          <div class='ts-button-row ts-tailnet-button-row'>",
            "            <button id='ts-connect' class='qt-btn qt-btn-primary' type='button'", tipAttr("Connect this router to your tailnet using the current SSH toggle setting"), ">Connect</button>",
            "          </div>",
            "          </div>",
            "        </div>",
            "        <div class='ts-action-group ts-action-group-session ts-action-group-wide'>",
            "          <h4>Session cleanup</h4>",
            "          <div class='ts-button-row'>",
            "            <button id='ts-disconnect' class='qt-btn qt-btn-secondary' type='button'", tipAttr("Bring the Tailscale interface down without removing the install or logging out"), ">Disconnect</button>",
            "            <button id='ts-logout' class='qt-btn qt-btn-danger' type='button'", tipAttr("Log this router out of Tailscale and clear the current tailnet session"), ">Logout</button>",
            "            <button id='ts-refresh' class='qt-btn qt-btn-primary' type='button'", tipAttr("Refresh the page with the latest router and Tailscale status"), ">Refresh</button>",
            "          </div>",
            "        </div>",
            "      </div>",
            "    </div>",
            "    <div class='ts-card'>",
            "      <h3 class='ts-card-title'>Local router node</h3>",
            "      <div class='ts-node-grid'>",
            "        <div class='ts-node-item'><div class='ts-node-label'>Install state</div><div class='ts-node-value'>", state.installed ? "Installed" : "Not installed", "</div></div>",
            "        <div class='ts-node-item'><div class='ts-node-label'>Service</div><div class='ts-node-value'>", state.service_active ? "Active" : "Stopped", "</div></div>",
            "        <div class='ts-node-item'><div class='ts-node-label'>Hostname</div><div class='ts-node-value'>", escapeHtml(state.hostname || "Unavailable"), "</div></div>",
            "        <div class='ts-node-item'><div class='ts-node-label'>Tailscale IP</div><div class='ts-node-value'>", escapeHtml(state.tailscale_ip || "Unavailable"), "</div></div>",
            "        <div class='ts-node-item'><div class='ts-node-label'>Logged in</div><div class='ts-node-value'>", state.logged_in ? "Yes" : "No", "</div></div>",
            "        <div class='ts-node-item'><div class='ts-node-label'>SSH over tailnet</div><div class='ts-node-value'>", state.ssh_enabled ? "Enabled" : "Disabled", "</div></div>",
            "      </div>",
            "      <div class='ts-button-row' style='margin-top:14px;'>",
            state.logged_in ? "        " + boolPill(true, "Tailnet ready", "Tailnet idle") : "        " + boolPill(false, "Tailnet ready", state.auth_url ? "Auth required" : "Tailnet idle"),
            "        ", state.service_enabled ? boolPill(true, "Auto-start on", "Auto-start off") : boolPill(false, "Auto-start on", "Auto-start off"),
            "      </div>",
            "    </div>",
            "  </div>",
            "  <div class='ts-card ts-list-card'>",
            "    <h3 class='ts-card-title'>Tailnet devices</h3>",
            "    <div class='ts-search-shell'>",
            "      <span class='ts-search-icon'>&#128269;</span>",
            "      <input id='ts-search' class='ts-search-input' type='text' placeholder='Search devices...' value='", escapeHtml(state.search), "'" , tipAttr("Filter the tailnet device list by device name or Tailscale IP"), ">",
            "    </div>",
            "    <div id='ts-peer-list' class='ts-peer-list'>", buildPeerRows(), "</div>",
            "  </div>",
            "  <div class='ts-card ts-raw-card'>",
            "    <details id='ts-raw-details'", state.rawOpen ? " open" : "", ">",
            "      <summary", tipAttr("Expand raw Tailscale status and recent command output for troubleshooting"), ">Raw diagnostics</summary>",
            "      <div class='ts-raw-shell'>",
            "        <div class='ts-raw-actions'>",
            "          <button id='ts-refresh-raw' class='qt-btn qt-btn-secondary' type='button'", tipAttr("Reload the raw Tailscale status output shown below"), ">Refresh raw output</button>",
            state.auth_url ? "          <button id='ts-copy-auth' class='qt-btn qt-btn-primary' type='button'" + tipAttr("Copy the current Tailscale login link to the clipboard") + ">Copy auth link</button>" : "",
            "        </div>",
            "        <pre id='ts-raw-output' class='qt-terminal ts-terminal'>", escapeHtml(state.raw_output || "No raw output captured yet."), "</pre>",
            "      </div>",
            "    </details>",
            "  </div>",
            state.showForceReinstallModal ? [
            "  <div class='ts-modal-backdrop'>",
            "    <div class='ts-modal' role='dialog' aria-modal='true' aria-labelledby='ts-modal-title'>",
            "      <h3 id='ts-modal-title' class='ts-modal-title'>Tailscale is already up to date</h3>",
            "      <p class='ts-modal-copy'>The router already has the latest stable 32-bit ARM build installed. Reinstall anyway?</p>",
            "      <div class='ts-modal-actions'>",
            "        <button id='ts-modal-cancel' class='qt-btn qt-btn-secondary' type='button'", tipAttr("Close this dialog and keep the current installed version"), ">Cancel</button>",
            "        <button id='ts-modal-force-reinstall' class='qt-btn qt-btn-primary' type='button'", tipAttr("Reinstall the same Tailscale version anyway to repair a buggy install"), ">Reinstall anyway</button>",
            "      </div>",
            "    </div>",
            "  </div>"
            ].join("") : "",
            "</div>"
        ].join("");

        wireControls();

        var logo = byId("ts-logo-img");
        var fallback = byId("ts-logo-fallback");
        if (logo && fallback) {
            logo.addEventListener("error", function () {
                logo.style.display = "none";
                fallback.className = "ts-brand-fallback";
            });
        }

        peerList = byId("ts-peer-list");
        rawOutput = byId("ts-raw-output");
        if (peerList) {
            peerList.scrollTop = state.peerListScrollTop || 0;
        }
        if (rawOutput) {
            rawOutput.scrollTop = state.rawScrollTop || 0;
        }
    }

    function applyState(payload) {
        if (!payload) return;
        state.installed = !!payload.installed;
        state.service_active = !!payload.service_active;
        state.service_enabled = !!payload.service_enabled;
        state.logged_in = !!payload.logged_in;
        state.hostname = payload.hostname || "";
        state.tailscale_ip = payload.tailscale_ip || "";
        state.ssh_enabled = !!payload.ssh_enabled;
        if (!state.sshPreferenceDirty) {
            state.ssh_preference = state.ssh_enabled;
        }
        state.status_text = payload.status_text || "";
        state.auth_url = payload.auth_url || "";
        state.peers = Array.isArray(payload.peers) ? payload.peers : [];
        state.raw_output = payload.raw_output || "";
        state.last_action = payload.last_action || "";
        state.backend_state = payload.backend_state || "";
        state.loaded = true;
    }

    function requestState() {
        $.ajax({
            url: "/tailscale_api/state",
            type: "GET",
            dataType: "json"
        }).done(function (payload) {
            applyState(payload);
            restartPolling();
            render();
        }).fail(function (xhr) {
            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Failed to read Tailscale state.");
        });
    }

    function restartPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
        }
        pollTimer = setInterval(requestState, state.auth_url ? AUTH_POLL_MS : POLL_MS);
    }

    function requestRaw() {
        $.ajax({
            url: "/tailscale_api/raw",
            type: "GET",
            dataType: "json"
        }).done(function (payload) {
            state.raw_output = payload && payload.raw_output ? payload.raw_output : "";
            var node = byId("ts-raw-output");
            if (node) {
                node.textContent = state.raw_output || "No raw output captured yet.";
            }
        }).fail(function () {
            setBanner("error", "Failed to read Tailscale raw diagnostics.");
        });
    }

    function postAction(actionName, successMessage) {
        if (state.busy) return;
        state.busy = true;
        $.ajax({
            url: "/tailscale_api/" + actionName,
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken
            }
        }).done(function (payload) {
            state.busy = false;
            state.sshPreferenceDirty = false;
            applyState(payload);
            restartPolling();
            if (actionName === "install" && payload && payload.already_current) {
                state.showForceReinstallModal = true;
            } else {
                state.showForceReinstallModal = false;
            }
            render();
            if (payload && payload.ok === false) {
                setBanner("error", payload.status_text || payload.error || "Tailscale action failed.");
                return;
            }
            setBanner(payload && payload.pending_auth ? "warn" : "ok", payload && payload.status_text ? payload.status_text : successMessage);
        }).fail(function (xhr) {
            state.busy = false;
            state.showForceReinstallModal = false;
            render();
            setBanner("error", xhr && xhr.responseText ? xhr.responseText : "Tailscale action failed.");
        });
    }

    function connectActionForPreference() {
        return state.ssh_preference ? "connect_ssh" : "connect";
    }

    function connectSuccessMessage() {
        return state.ssh_preference
            ? "Connecting Tailscale with SSH enabled."
            : "Connecting Tailscale.";
    }

    function copyAuthUrl() {
        if (!state.auth_url) return;
        var temp = document.createElement("textarea");
        temp.value = state.auth_url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        setBanner("ok", "Auth link copied.");
    }

    function wireControls() {
        var search = byId("ts-search");
        if (search) {
            search.addEventListener("input", function (event) {
                state.search = event.target.value || "";
                render();
            });
        }

        var sshToggle = byId("ts-ssh-toggle");
        if (sshToggle) {
            sshToggle.addEventListener("change", function () {
                state.ssh_preference = !!sshToggle.checked;
                state.sshPreferenceDirty = true;
                var shell = sshToggle.closest(".ts-toggle-shell");
                if (shell) {
                    shell.className = "ts-toggle-shell" + (state.ssh_preference ? " is-on" : "");
                }
            });
        }

        var rawDetails = byId("ts-raw-details");
        if (rawDetails) {
            rawDetails.addEventListener("toggle", function () {
                state.rawOpen = !!rawDetails.open;
                if (state.rawOpen) {
                    requestRaw();
                }
            });
        }

        var peerList = byId("ts-peer-list");
        if (peerList) {
            peerList.addEventListener("scroll", function () {
                state.peerListScrollTop = peerList.scrollTop || 0;
            });
        }

        var rawOutput = byId("ts-raw-output");
        if (rawOutput) {
            rawOutput.addEventListener("scroll", function () {
                state.rawScrollTop = rawOutput.scrollTop || 0;
            });
        }

        Array.prototype.forEach.call(document.querySelectorAll("[data-peer-toggle]"), function (button) {
            button.addEventListener("click", function () {
                var key = button.getAttribute("data-peer-toggle");
                state.openPeer = state.openPeer === key ? "" : key;
                render();
            });
        });

        var modalCancel = byId("ts-modal-cancel");
        if (modalCancel) {
            modalCancel.addEventListener("click", function () {
                state.showForceReinstallModal = false;
                render();
            });
        }

        var modalForce = byId("ts-modal-force-reinstall");
        if (modalForce) {
            modalForce.addEventListener("click", function () {
                state.showForceReinstallModal = false;
                render();
                postAction("update", "Tailscale reinstall started.");
            });
        }

        var map = {
            "ts-install": ["install", "Tailscale install/update started."],
            "ts-remove": ["remove", "Tailscale remove started."],
            "ts-start": ["start", "Starting Tailscale."],
            "ts-stop": ["stop", "Stopping Tailscale."],
            "ts-restart": ["restart", "Restarting Tailscale."],
            "ts-connect": ["__connect_dynamic__", ""],
            "ts-disconnect": ["disconnect", "Disconnecting Tailscale."],
            "ts-logout": ["logout", "Logging out of Tailscale."],
            "ts-refresh": ["__refresh__", ""],
            "ts-refresh-raw": ["__raw__", ""],
            "ts-copy-auth": ["__copy_auth__", ""]
        };
        var needsInstall = {
            "ts-remove": true,
            "ts-start": true,
            "ts-stop": true,
            "ts-restart": true,
            "ts-connect": true,
            "ts-disconnect": true,
            "ts-logout": true
        };

        Object.keys(map).forEach(function (id) {
            var node = byId(id);
            if (!node) return;
            node.disabled = state.busy || (!!needsInstall[id] && !state.installed);
            node.addEventListener("click", function () {
                var action = map[id][0];
                if (action === "__refresh__") {
                    requestState();
                } else if (action === "__raw__") {
                    requestRaw();
                } else if (action === "__copy_auth__") {
                    copyAuthUrl();
                } else if (action === "__connect_dynamic__") {
                    postAction(connectActionForPreference(), connectSuccessMessage());
                } else {
                    postAction(action, map[id][1]);
                }
            });
        });
    }

    function buildShell() {
        var host = byId("htmlGoesHere");
        if (!host || byId("tailscale-panel")) return;
        var panel = document.createElement("div");
        panel.id = "tailscale-panel";
        host.appendChild(panel);
    }

    function bindPageEvents() {
        if (pageEventsBound) {
            return;
        }
        pageEventsBound = true;

        window.addEventListener("focus", requestState);
        window.addEventListener("pageshow", requestState);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                requestState();
            }
        });
    }

    function init() {
        buildShell();
        bindPageEvents();
        render();
        requestState();
        restartPolling();
    }

    window.JtoolsTailscalePage = {
        init: init
    };
})(window, jQuery);
