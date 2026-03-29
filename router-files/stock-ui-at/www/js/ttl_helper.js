(function (window, $) {
    "use strict";

    var state = {
        active: false,
        configured_value: 0,
        live_ipv4_value: null,
        live_ipv6_value: null,
        ipv4_rule_present: false,
        ipv6_rule_present: false,
        pending_value: "",
        busy: false,
        loaded: false
    };

    function setBanner(type, message) {
        var el = document.getElementById("ttl-banner");
        if (!el) return;
        el.className = "ttl-banner ttl-banner-" + type;
        el.textContent = message;
    }

    function clearBanner() {
        var el = document.getElementById("ttl-banner");
        if (!el) return;
        el.className = "ttl-banner ttl-banner-hidden";
        el.textContent = "";
    }

    function setToggle(active) {
        var onRadio  = document.getElementById("ttl_toggle_0");
        var offRadio = document.getElementById("ttl_toggle_1");
        var hidden   = document.getElementById("ttl_toggle");
        if (onRadio)  onRadio.checked  = !!active;
        if (offRadio) offRadio.checked = !active;
        if (hidden)   hidden.value = active ? "1" : "0";
    }

    function render() {
        var statusPill = document.getElementById("ttl-status-pill");
        var configuredEl = document.getElementById("ttl-configured-value");
        var ipv4El = document.getElementById("ttl-ipv4-status");
        var ipv6El = document.getElementById("ttl-ipv6-status");

        if (statusPill) {
            if (state.active) {
                statusPill.textContent = "Active (TTL " + (state.live_ipv4_value || state.live_ipv6_value || "?") + ")";
                statusPill.className = "ttl-pill ttl-pill-active";
            } else {
                statusPill.textContent = "Inactive";
                statusPill.className = "ttl-pill ttl-pill-inactive";
            }
        }

        if (configuredEl) {
            configuredEl.textContent = state.configured_value > 0 ? state.configured_value : "None";
        }

        if (ipv4El) {
            ipv4El.textContent = state.ipv4_rule_present ? ("TTL set to " + state.live_ipv4_value) : "No rule";
        }

        if (ipv6El) {
            ipv6El.textContent = state.ipv6_rule_present ? ("HL set to " + state.live_ipv6_value) : "No rule";
        }

        setToggle(state.active);
        showUpdateBtn();
    }

    function applyPayload(response) {
        if (!response) return;
        state.active = !!response.active;
        state.configured_value = response.configured_value || 0;
        state.live_ipv4_value = response.live_ipv4_value || null;
        state.live_ipv6_value = response.live_ipv6_value || null;
        state.ipv4_rule_present = !!response.ipv4_rule_present;
        state.ipv6_rule_present = !!response.ipv6_rule_present;
        state.loaded = true;
        render();
    }

    function fetchStatus() {
        $.ajax({
            url: "/ttl_helper_api/status",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            applyPayload(response);
        }).fail(function (xhr) {
            setBanner("error", "Failed to read TTL status.");
        });
    }

    function getSelectedValue() {
        var inputEl = document.getElementById("ttl-custom-input");
        var val = inputEl ? parseInt(inputEl.value, 10) : NaN;
        if (isNaN(val) || val < 1 || val > 255) {
            return null;
        }
        return val;
    }

    function selectPreset(value) {
        var inputEl = document.getElementById("ttl-custom-input");
        if (inputEl) {
            inputEl.value = value;
        }
        showUpdateBtn();
    }

    function handleToggle(newVal) {
        if (state.busy) return;
        if (newVal === "1") {
            var value = getSelectedValue();
            if (!value) {
                setBanner("error", "Enter a valid TTL value between 1 and 255.");
                setToggle(false);
                return;
            }
            doApply(value);
        } else {
            doRemove();
        }
    }

    function updateValue() {
        if (state.busy || !state.active) return;
        var value = getSelectedValue();
        if (!value) {
            setBanner("error", "Enter a valid TTL value between 1 and 255.");
            return;
        }
        doApply(value);
    }

    function showUpdateBtn() {
        var btn = document.getElementById("ttl-update-btn");
        if (!btn) return;
        if (!state.active) {
            btn.style.display = "none";
            return;
        }
        var inputVal = getSelectedValue();
        var currentVal = state.live_ipv4_value || state.live_ipv6_value || 0;
        btn.style.display = (inputVal && inputVal !== parseInt(currentVal, 10)) ? "" : "none";
    }

    function doApply(value) {
        state.busy = true;
        render();
        clearBanner();

        $.ajax({
            url: "/ttl_helper_api/apply",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                value: value
            }
        }).done(function (response) {
            state.busy = false;
            if (response && response.ok !== false) {
                applyPayload(response);
                setBanner("ok", "TTL override applied: " + value);
                if (rulesOpen) fetchRules();
            } else {
                setBanner("error", (response && response.error) || "Failed to apply TTL override.");
                setToggle(false);
                fetchStatus();
            }
        }).fail(function (xhr) {
            state.busy = false;
            setBanner("error", "Failed to apply TTL override.");
            setToggle(false);
            fetchStatus();
        });
    }

    function doRemove() {
        state.busy = true;
        render();
        clearBanner();

        $.ajax({
            url: "/ttl_helper_api/remove",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken
            }
        }).done(function (response) {
            state.busy = false;
            if (response && response.ok !== false) {
                applyPayload(response);
                setBanner("ok", "TTL override removed.");
                if (rulesOpen) fetchRules();
            } else {
                setBanner("error", (response && response.error) || "Failed to remove TTL override.");
                setToggle(true);
                fetchStatus();
            }
        }).fail(function (xhr) {
            state.busy = false;
            setBanner("error", "Failed to remove TTL override.");
            setToggle(true);
            fetchStatus();
        });
    }

    function renderPanel() {
        var container = document.getElementById("htmlGoesHere");
        if (!container || document.getElementById("ttl-panel")) return;

        var panel = document.createElement("div");
        panel.id = "ttl-panel";
        panel.className = "qt-card";
        panel.innerHTML = [
            '<h3 class="qt-card-header">TTL Helper</h3>',
            '<div id="ttl-banner" class="ttl-banner ttl-banner-hidden"></div>',

            '<div class="ttl-top-row">',
            '  <div class="ttl-status-card">',
            '    <h3>TTL override status</h3>',
            '    <div class="ttl-status-row">',
            '      <span class="ttl-status-label">Status</span>',
            '      <span id="ttl-status-pill" class="ttl-pill ttl-pill-inactive">Loading...</span>',
            '    </div>',
            '    <div class="ttl-status-row">',
            '      <span class="ttl-status-label">Saved value</span>',
            '      <span id="ttl-configured-value" class="ttl-status-value">--</span>',
            '    </div>',
            '    <div class="ttl-status-row">',
            '      <span class="ttl-status-label">IPv4 rule</span>',
            '      <span id="ttl-ipv4-status" class="ttl-status-value">--</span>',
            '    </div>',
            '    <div class="ttl-status-row">',
            '      <span class="ttl-status-label">IPv6 rule</span>',
            '      <span id="ttl-ipv6-status" class="ttl-status-value">--</span>',
            '    </div>',
            '  </div>',
            '  <div class="ttl-info-card">',
            '    <h3>What is TTL override?</h3>',
            '    <p>TTL (Time-To-Live) and HL (Hop Limit) override modifies outgoing packet headers on the modem\'s rmnet interfaces using iptables mangle rules.</p>',
            '    <p>Common uses include setting TTL to 65 or 128 to prevent carrier detection of tethered traffic.</p>',
            '    <p>The configured value is saved and reapplied automatically after each reboot via the Qtooley overlay.</p>',
            '  </div>',
            '</div>',

            '<div class="ttl-controls-card">',
            '  <h3>Set TTL value</h3>',
            '  <div class="ttl-preset-row">',
            '    <button type="button" class="ttl-preset-button qt-btn qt-btn-primary" onclick="JtoolsTtlHelper.preset(64)">64</button>',
            '    <button type="button" class="ttl-preset-button qt-btn qt-btn-primary" onclick="JtoolsTtlHelper.preset(65)">65</button>',
            '    <button type="button" class="ttl-preset-button qt-btn qt-btn-primary" onclick="JtoolsTtlHelper.preset(128)">128</button>',
            '  </div>',
            '  <div class="ttl-custom-row">',
            '    <label for="ttl-custom-input">Custom value (1-255):</label>',
            '    <input id="ttl-custom-input" type="number" min="1" max="255" step="1" class="ttl-custom-input" value="65">',
            '  </div>',
            '  <div class="ttl-toggle-row">',
            '    <span class="ttl-toggle-label">TTL override</span>',
            '    <input type="hidden" id="ttl_toggle">',
            '    <div class="location-settings">',
            '      <div class="radio-switch">',
            '        <input type="radio" name="ttl_toggle_radio" id="ttl_toggle_0" class="access" value="1" onclick="JtoolsTtlHelper.toggle(\'1\')">',
            '        <label for="ttl_toggle_0" class="on">on</label>',
            '        <input type="radio" name="ttl_toggle_radio" id="ttl_toggle_1" class="access" value="0" onclick="JtoolsTtlHelper.toggle(\'0\')" checked>',
            '        <label for="ttl_toggle_1" class="off">off</label>',
            '      </div>',
            '    </div>',
            '    <button type="button" id="ttl-update-btn" class="ttl-update-button qt-btn qt-btn-danger" onclick="JtoolsTtlHelper.update()" style="display:none">Apply</button>',
            '  </div>',
            '</div>',

            '<div class="ttl-rules-card">',
            '  <div class="ttl-rules-header" onclick="JtoolsTtlHelper.toggleRules()">',
            '    <span id="ttl-rules-arrow" class="ttl-rules-arrow">&#9654;</span>',
            '    <h3>iptables mangle rules</h3>',
            '    <button type="button" class="ttl-rules-refresh qt-btn qt-btn-secondary" onclick="event.stopPropagation(); JtoolsTtlHelper.refreshRules()">Refresh</button>',
            '  </div>',
            '  <div id="ttl-rules-body" class="ttl-rules-body" style="display:none">',
            '    <div class="ttl-rules-section">',
            '      <span class="ttl-rules-label">IPv4 (iptables)</span>',
            '      <pre id="ttl-rules-ipv4" class="ttl-rules-pre">Not loaded</pre>',
            '    </div>',
            '    <div class="ttl-rules-section">',
            '      <span class="ttl-rules-label">IPv6 (ip6tables)</span>',
            '      <pre id="ttl-rules-ipv6" class="ttl-rules-pre">Not loaded</pre>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join("\n");

        container.appendChild(panel);
    }

    var rulesOpen = false;

    function toggleRulesPanel() {
        var body = document.getElementById("ttl-rules-body");
        var arrow = document.getElementById("ttl-rules-arrow");
        if (!body) return;
        rulesOpen = !rulesOpen;
        body.style.display = rulesOpen ? "" : "none";
        if (arrow) arrow.innerHTML = rulesOpen ? "&#9660;" : "&#9654;";
        if (rulesOpen) fetchRules();
    }

    function fetchRules() {
        $.ajax({
            url: "/ttl_helper_api/rules",
            type: "GET",
            dataType: "json"
        }).done(function (response) {
            var ipv4El = document.getElementById("ttl-rules-ipv4");
            var ipv6El = document.getElementById("ttl-rules-ipv6");
            if (ipv4El) ipv4El.textContent = (response && response.ipv4_rules) || "No output";
            if (ipv6El) ipv6El.textContent = (response && response.ipv6_rules) || "No output";
        }).fail(function () {
            var ipv4El = document.getElementById("ttl-rules-ipv4");
            if (ipv4El) ipv4El.textContent = "Failed to load rules";
        });
    }

    function applyShellClass() {
        if (!document.body) { return; }
        document.body.classList.add("jtools-layout-wide-sticky");
        document.body.classList.add("jtools-page-ttl-helper");
    }

    window.JtoolsTtlHelper = {
        init: function () {
            applyShellClass();
            renderPanel();
            render();
            fetchStatus();
            var input = document.getElementById("ttl-custom-input");
            if (input) {
                input.addEventListener("input", showUpdateBtn);
            }
        },
        preset: selectPreset,
        toggle: handleToggle,
        update: updateValue,
        toggleRules: toggleRulesPanel,
        refreshRules: fetchRules
    };
})(window, jQuery);
