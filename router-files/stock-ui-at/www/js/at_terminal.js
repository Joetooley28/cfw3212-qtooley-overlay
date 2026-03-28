(function (window, $) {
    "use strict";

    var COMMAND_REF = [
        { section: "Module / Hardware Info", commands: [
            { cmd: "ATI", desc: "Module identification" },
            { cmd: "AT+QGMR", desc: "Query firmware version" },
            { cmd: "AT+QTEMP", desc: "Get module temperature" }
        ]},
        { section: "SIM Management", commands: [
            { cmd: "AT+CPIN?", desc: "Query SIM card status" },
            { cmd: "AT+QSIMSTAT?", desc: "SIM card status report" }
        ]},
        { section: "IMEI", commands: [
            { cmd: "AT+CGSN", desc: "Query IMEI" },
            { cmd: "AT+GSN", desc: "Query IMEI (alt)" },
            { cmd: "AT+EGMR=0,7", desc: "Query IMEI (EGMR)" },
            { cmd: "AT+EGMR=1,7,\"IMEI\"", desc: "Change IMEI (replace IMEI with value)" }
        ]},
        { section: "Network Information", commands: [
            { cmd: "AT+CSQ", desc: "Signal quality (4G)" },
            { cmd: "AT+COPS?", desc: "Query network operator" },
            { cmd: "AT+QNWINFO", desc: "Network info detailed" },
            { cmd: "AT+QCAINFO", desc: "Carrier aggregation parameters" },
            { cmd: "AT+QRSRP", desc: "5G signal strength (RSRP)" },
            { cmd: "AT+QENG=\"servingcell\"", desc: "Serving cell info" },
            { cmd: "AT+QENG=\"neighbourcell\"", desc: "Neighbor cell info" }
        ]},
        { section: "PDP / IP Information", commands: [
            { cmd: "AT+CGDCONT?", desc: "Query PDP context" },
            { cmd: "AT+CGPADDR", desc: "Query PDP address" }
        ]},
        { section: "Function / Power Control", commands: [
            { cmd: "AT+CFUN?", desc: "Query current functionality mode" },
            { cmd: "AT+CFUN=0", desc: "Minimum functionality mode" },
            { cmd: "AT+CFUN=1", desc: "Full functionality mode" },
            { cmd: "AT+CFUN=1,1", desc: "Restart module" }
        ]},
        { section: "Network Mode", commands: [
            { cmd: "AT+QNWPREFCFG=\"mode_pref\"", desc: "Query current mode preference" },
            { cmd: "AT+QNWPREFCFG=\"mode_pref\",AUTO", desc: "Restore automatic network search" },
            { cmd: "AT+QNWPREFCFG=\"mode_pref\",LTE", desc: "Lock to 4G" },
            { cmd: "AT+QNWPREFCFG=\"mode_pref\",NR5G", desc: "Lock to 5G" },
            { cmd: "AT+QNWPREFCFG=\"mode_pref\",NR5G-NSA", desc: "Lock to 5G NSA" },
            { cmd: "AT+QNWPREFCFG=\"mode_pref\",NR5G-SA", desc: "Lock to 5G SA" }
        ]},
        { section: "Band Queries", commands: [
            { cmd: "AT+QNWPREFCFG=\"lte_band\"", desc: "Check LTE band settings" },
            { cmd: "AT+QNWPREFCFG=\"nsa_nr5g_band\"", desc: "Check NSA 5G band settings" },
            { cmd: "AT+QNWPREFCFG=\"nr5g_band\"", desc: "Check SA 5G band settings" },
            { cmd: "AT+QNWPREFCFG=\"ue_capability_band\"", desc: "Query UE capability bands" },
            { cmd: "AT+QNWPREFCFG=\"policy_band\"", desc: "Query policy band list" }
        ]},
        { section: "USB / Interface (Query Only)", commands: [
            { cmd: "AT+QCFG=\"usbnet\"", desc: "Query current dial mode" },
            { cmd: "AT+QCFG=\"usbspeed\"", desc: "Query current USB speed" },
            { cmd: "AT+QCFG=\"data_interface\"", desc: "Query current data interface" }
        ]}
    ];

    var MY_SECTION = "My saved commands";
    var MAX_CMD_LEN = 128;
    var MAX_DESC_LEN = 200;

    var savedState = {
        custom: [],
        hidden_builtin: [],
        max_custom: 50
    };

    var FRIENDLY_ERRORS = {
        "at_channel_busy": "AT port is busy. Another command or page is using the modem right now. Try again in a few seconds.",
        "timeout": "The modem did not respond in time. It may be busy or temporarily unavailable. Try again shortly.",
        "backend_internal_error": "An internal error occurred communicating with the modem. Try again or check the AT terminal for diagnostics.",
        "request_failed": "The request to the modem failed. Check that the router is reachable and try again.",
        "config_read_failed": "Could not read the AT backend configuration file.",
        "backend_bad_result": "The modem returned an unexpected result. Try again.",
        "response_too_large": "The modem response was too large to process.",
        "API error": "The API returned an error. The modem may be busy or restarting.",
        "duplicate_command": "That command is already in the list or still visible in the built-in reference.",
        "custom_limit_reached": "You can save at most 50 custom commands. Remove one before adding another.",
        "description_too_long": "Description is too long.",
        "invalid_description_format": "Description must be plain ASCII text.",
        "not_builtin_command": "Only built-in reference rows can be hidden this way.",
        "save_failed": "Could not save command list on the router.",
        "invalid_command_format": "Invalid AT command format (single line, no semicolons or shell characters).",
        "command_too_long": "Command is too long.",
        "missing_command": "Command is required.",
        "unknown_op": "Unknown save operation.",
        "internal_handler_error": "Server error while saving commands.",
        "not_found": "That saved entry was not found.",
        "not_hidden": "That built-in command is not in the hidden list."
    };

    function friendlyError(raw) {
        if (!raw) { return "An unknown error occurred."; }
        var s = String(raw);
        if (FRIENDLY_ERRORS[s]) { return FRIENDLY_ERRORS[s]; }
        var prefix = s.split(":")[0];
        if (FRIENDLY_ERRORS[prefix]) { return FRIENDLY_ERRORS[prefix]; }
        if (s.indexOf("CME_ERROR") === 0 || s.indexOf("CMS_ERROR") === 0) {
            return "The modem returned an error: " + s.replace(/_/g, " ") + ".";
        }
        return s;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function cmdKey(s) {
        return String(s || "").replace(/^\s+/, "").replace(/\s+$/, "").toUpperCase();
    }

    function validateClientCommand(cmd) {
        if (!cmd || !String(cmd).trim()) {
            return "missing_command";
        }
        cmd = String(cmd).replace(/^\s+/, "").replace(/\s+$/, "");
        if (cmd.length > MAX_CMD_LEN) {
            return "command_too_long";
        }
        if (/[\r\n]/.test(cmd) || /;/.test(cmd) || /[`|<>$]/.test(cmd)) {
            return "invalid_command_format";
        }
        if (!/^AT[\x20-\x7E]+$/.test(cmd)) {
            return "invalid_command_format";
        }
        return null;
    }

    function validateClientDesc(desc) {
        desc = desc == null ? "" : String(desc).replace(/^\s+/, "").replace(/\s+$/, "");
        if (desc.length > MAX_DESC_LEN) {
            return "description_too_long";
        }
        if (!/^[\x20-\x7E]*$/.test(desc)) {
            return "invalid_description_format";
        }
        return null;
    }

    function buildHiddenSet(arr) {
        var o = {};
        (arr || []).forEach(function (k) {
            o[cmdKey(k)] = true;
        });
        return o;
    }

    function filterBuiltinGroups(hiddenSet) {
        return COMMAND_REF.map(function (group) {
            var cmds = group.commands.filter(function (item) {
                return !hiddenSet[cmdKey(item.cmd)];
            });
            return { section: group.section, commands: cmds };
        }).filter(function (g) {
            return g.commands.length > 0;
        });
    }

    function buildRefRowHtml(item, meta) {
        meta = meta || {};
        var kind = meta.kind || "builtin";
        var idPart = kind === "custom" && meta.id
            ? " data-custom-id=\"" + escapeHtml(meta.id) + "\""
            : "";
        return [
            "<div class=\"at-ref-item\" data-ref-kind=\"", kind, "\">",
            "<div class=\"at-ref-item-left\">",
            "<code class=\"at-ref-cmd\">", escapeHtml(item.cmd), "</code>",
            "<span class=\"at-ref-desc\">", escapeHtml(item.desc), "</span>",
            "</div>",
            "<div class=\"at-ref-item-actions\">",
            "<button class=\"at-ref-load qt-btn qt-btn-primary\" type=\"button\" data-cmd=\"", escapeHtml(item.cmd), "\">Load</button>",
            "<button class=\"at-ref-copy qt-btn qt-btn-primary\" type=\"button\" data-cmd=\"", escapeHtml(item.cmd), "\">Copy</button>",
            "<button class=\"at-ref-remove\" type=\"button\" data-ref-row=\"", kind, "\" data-cmd=\"", escapeHtml(item.cmd), "\"", idPart, ">Remove</button>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildRefCommandsHtml(state) {
        state = state || savedState;
        var hiddenSet = buildHiddenSet(state.hidden_builtin);
        var groups = filterBuiltinGroups(hiddenSet);
        var html = [];

        groups.forEach(function (group) {
            html.push("<div class=\"at-ref-section-title\">" + escapeHtml(group.section) + "</div>");
            html.push("<div class=\"at-ref-list\">");
            group.commands.forEach(function (item) {
                html.push(buildRefRowHtml(item, { kind: "builtin" }));
            });
            html.push("</div>");
        });

        if (state.custom && state.custom.length > 0) {
            html.push("<div class=\"at-ref-section-title\">" + escapeHtml(MY_SECTION) + "</div>");
            html.push("<div class=\"at-ref-list\">");
            state.custom.forEach(function (row) {
                html.push(buildRefRowHtml(
                    { cmd: row.cmd, desc: row.desc },
                    { kind: "custom", id: row.id }
                ));
            });
            html.push("</div>");
        }

        if (html.length === 0) {
            return "<p class=\"at-ref-note\">No reference commands are shown. Use <strong>Manage my commands</strong> to restore hidden built-ins or add your own.</p>";
        }
        return html.join("");
    }

    function setManageMessage(text, isError) {
        var el = document.getElementById("at-manage-msg");
        if (!el) { return; }
        el.textContent = text || "";
        el.className = "at-manage-msg" + (text ? (isError ? " at-manage-err" : " at-manage-ok") : "");
    }

    function renderManageLists(state) {
        state = state || savedState;
        var customEl = document.getElementById("at-manage-custom-list");
        var hiddenEl = document.getElementById("at-manage-hidden-list");
        var countEl = document.getElementById("at-manage-count");
        if (countEl) {
            countEl.textContent = String((state.custom || []).length) + " / " + String(state.max_custom || 50);
        }
        if (customEl) {
            if (!state.custom || !state.custom.length) {
                customEl.innerHTML = "<li class=\"at-manage-row at-manage-row-empty\">No saved commands yet.</li>";
            } else {
                var parts = [];
                state.custom.forEach(function (row) {
                    parts.push(
                        "<li class=\"at-manage-row\">",
                        "<div>",
                        "<code>", escapeHtml(row.cmd), "</code>",
                        "<div class=\"at-manage-row-meta\">", escapeHtml(row.desc), "</div>",
                        "</div>",
                        "<button type=\"button\" class=\"qt-btn qt-btn-primary at-manage-remove-custom\" data-id=\"", escapeHtml(row.id), "\">Remove</button>",
                        "</li>"
                    );
                });
                customEl.innerHTML = parts.join("");
            }
        }
        if (hiddenEl) {
            var hidden = state.hidden_builtin || [];
            if (!hidden.length) {
                hiddenEl.innerHTML = "<li class=\"at-manage-row at-manage-row-empty\">None</li>";
            } else {
                var hp = [];
                hidden.forEach(function (k) {
                    hp.push(
                        "<li class=\"at-manage-row\">",
                        "<code>", escapeHtml(k), "</code>",
                        "<button type=\"button\" class=\"qt-btn qt-btn-primary at-manage-unhide\" data-cmd=\"", escapeHtml(k), "\">Restore</button>",
                        "</li>"
                    );
                });
                hiddenEl.innerHTML = hp.join("");
            }
        }
    }

    function applySavedState(res) {
        if (!res || !res.ok) { return; }
        savedState.custom = res.custom || [];
        savedState.hidden_builtin = res.hidden_builtin || [];
        savedState.max_custom = res.max_custom || 50;
        var root = document.getElementById("at-ref-commands-root");
        if (root) {
            root.innerHTML = buildRefCommandsHtml(savedState);
        }
        renderManageLists(savedState);
    }

    function postSavedOp(op, fields, done) {
        var data = $.extend({ csrfToken: csrfToken, op: op }, fields || {});
        $.ajax({
            url: "/at_terminal_api/saved_commands",
            type: "POST",
            dataType: "json",
            data: data
        }).done(function (res) {
            if (res && res.ok) {
                applySavedState(res);
                if (done) { done(null, res); }
            } else {
                var err = friendlyError(res && res.error);
                if (done) { done(err); }
            }
        }).fail(function (xhr) {
            var errMsg = "Request failed.";
            if (xhr && xhr.responseText) {
                try {
                    var body = JSON.parse(xhr.responseText);
                    if (body && body.error) {
                        errMsg = friendlyError(body.error);
                    }
                } catch (e1) {
                    errMsg = friendlyError("request_failed");
                }
            }
            if (done) { done(errMsg); }
        });
    }

    function refreshSavedCommands() {
        $.ajax({
            url: "/at_terminal_api/saved_commands",
            type: "GET",
            dataType: "json"
        }).done(function (res) {
            if (res && res.ok) {
                applySavedState(res);
                setManageMessage("", false);
            } else {
                setManageMessage(friendlyError(res && res.error) || "Could not load saved commands.", true);
            }
        }).fail(function () {
            setManageMessage("Could not load saved commands from the router.", true);
        });
    }

    function nowTime() {
        var d = new Date();
        return d.toLocaleTimeString();
    }

    function appendHistory(kind, title, body) {
        var history = document.getElementById("at-terminal-history");
        if (!history) {
            return;
        }

        var empty = history.querySelector(".at-history-empty");
        if (empty) { empty.remove(); }

        var entry = document.createElement("div");
        entry.className = "at-entry at-entry-" + kind;
        entry.innerHTML =
            "<div class=\"at-entry-meta\">" + escapeHtml(nowTime()) + " \u2014 " + escapeHtml(title) + "</div>" +
            "<pre class=\"at-entry-body\">" + escapeHtml(body || "") + "</pre>";

        history.insertBefore(entry, history.firstChild);
    }

    function setBusy(busy) {
        var input = document.getElementById("at-command-input");
        var send = document.getElementById("at-command-send");
        if (input) {
            input.disabled = busy;
        }
        if (send) {
            send.disabled = busy;
            send.textContent = busy ? "Sending..." : "Send";
        }
    }

    function getCommand() {
        var input = document.getElementById("at-command-input");
        return input ? input.value : "";
    }

    function clearCommand() {
        var input = document.getElementById("at-command-input");
        if (input) {
            input.value = "";
            input.focus();
        }
    }

    function clearHistory() {
        var history = document.getElementById("at-terminal-history");
        if (history) {
            history.innerHTML = "";
        }
    }

    function copyAllHistory() {
        var bodies = document.querySelectorAll("#at-terminal-history .at-entry-body");
        var chunks = [];
        Array.prototype.forEach.call(bodies, function (node) {
            chunks.push(node.textContent || "");
        });
        var fullText = chunks.join("\n\n");
        if (!fullText) {
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).catch(function () {});
            return;
        }

        var temp = document.createElement("textarea");
        temp.value = fullText;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
    }

    function loadToTerminal(cmd) {
        var input = document.getElementById("at-command-input");
        if (input) {
            input.value = cmd;
            input.focus();
            input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function copyToClipboard(text, button) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                flashButton(button, "Copied");
            }).catch(function () {});
            return;
        }
        var temp = document.createElement("textarea");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        flashButton(button, "Copied");
    }

    function flashButton(button, text) {
        if (!button) return;
        var original = button.textContent;
        button.textContent = text;
        button.disabled = true;
        setTimeout(function () {
            button.textContent = original;
            button.disabled = false;
        }, 800);
    }

    function submitCommand() {
        var command = getCommand();
        if (!command || !command.trim()) {
            appendHistory("error", "Validation", "Command is empty.");
            clearCommand();
            return;
        }

        setBusy(true);

        $.ajax({
            url: "/at_terminal_api/run",
            type: "POST",
            dataType: "json",
            data: {
                csrfToken: csrfToken,
                command: command
            }
        }).done(function (response) {
            appendHistory("command", "Command", command);

            if (response && response.ok) {
                appendHistory("response", "Response", response.response || "");
            } else if (response) {
                var rawErr = response.error || "request_failed";
                var details = response.response || "";
                appendHistory("error", "Error", friendlyError(rawErr) + (details ? "\n\n" + details : ""));
            } else {
                appendHistory("error", "Error", "Empty response from server.");
            }
        }).fail(function (xhr) {
            appendHistory("command", "Command", command);
            var errMsg = "Request failed.";
            if (xhr && xhr.responseText) {
                try {
                    var body = JSON.parse(xhr.responseText);
                    if (body && body.error) {
                        errMsg = friendlyError(body.error);
                    }
                } catch (e2) {
                    errMsg = friendlyError("request_failed");
                }
            }
            appendHistory("error", "Error", errMsg);
        }).always(function () {
            setBusy(false);
            clearCommand();
        });
    }

    function bindPageEvents(page) {
        page.addEventListener("click", function (event) {
            var target = event.target;
            if (!target || !target.closest) { return; }

            var refBody = target.closest(".at-ref-body");
            if (refBody && target.classList.contains("at-ref-load")) {
                loadToTerminal(target.getAttribute("data-cmd") || "");
                return;
            }
            if (refBody && target.classList.contains("at-ref-copy")) {
                copyToClipboard(target.getAttribute("data-cmd") || "", target);
                return;
            }
            if (refBody && target.classList.contains("at-ref-remove")) {
                var rowKind = target.getAttribute("data-ref-row");
                var cmd = target.getAttribute("data-cmd") || "";
                if (rowKind === "custom") {
                    var cid = target.getAttribute("data-custom-id") || "";
                    postSavedOp("remove_custom", { id: cid }, function (err) {
                        if (err) { setManageMessage(err, true); }
                        else { setManageMessage("Removed saved command.", false); }
                    });
                } else {
                    postSavedOp("hide_builtin", { cmd: cmd }, function (err) {
                        if (err) { setManageMessage(err, true); }
                        else { setManageMessage("Built-in row hidden from reference.", false); }
                    });
                }
                return;
            }

            if (target.classList.contains("at-manage-add")) {
                var cmdIn = document.getElementById("at-manage-cmd");
                var descIn = document.getElementById("at-manage-desc");
                var cmdVal = cmdIn ? cmdIn.value : "";
                var descVal = descIn ? descIn.value : "";
                var cErr = validateClientCommand(cmdVal);
                if (cErr) {
                    setManageMessage(friendlyError(cErr), true);
                    return;
                }
                var dErr = validateClientDesc(descVal);
                if (dErr) {
                    setManageMessage(friendlyError(dErr), true);
                    return;
                }
                postSavedOp("add", { cmd: cmdVal, desc: descVal }, function (err) {
                    if (err) {
                        setManageMessage(err, true);
                    } else {
                        setManageMessage("Command saved.", false);
                        if (cmdIn) { cmdIn.value = ""; }
                        if (descIn) { descIn.value = ""; }
                    }
                });
                return;
            }

            if (target.classList.contains("at-manage-remove-custom")) {
                var rid = target.getAttribute("data-id") || "";
                postSavedOp("remove_custom", { id: rid }, function (err) {
                    if (err) { setManageMessage(err, true); }
                    else { setManageMessage("Removed saved command.", false); }
                });
                return;
            }

            if (target.classList.contains("at-manage-unhide")) {
                var ucmd = target.getAttribute("data-cmd") || "";
                postSavedOp("unhide_builtin", { cmd: ucmd }, function (err) {
                    if (err) { setManageMessage(err, true); }
                    else { setManageMessage("Built-in command restored to reference.", false); }
                });
                return;
            }

            if (target.classList.contains("at-manage-restore-all")) {
                postSavedOp("reset_hidden_builtins", {}, function (err) {
                    if (err) { setManageMessage(err, true); }
                    else { setManageMessage("All built-in reference rows restored.", false); }
                });
            }
        });
    }

    function renderPanel() {
        if (document.getElementById("at-terminal-panel")) {
            return;
        }

        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (!htmlGoesHere) { return; }

        var page = document.createElement("div");
        page.id = "at-terminal-page-root";
        page.className = "at-page";

        page.innerHTML = [
            "<div class=\"at-page-header\">",
            "<div class=\"at-page-title\"><span class=\"at-page-title-icon\">&#9002;</span>AT Terminal</div>",
            "</div>"
        ].join("");

        var panel = document.createElement("div");
        panel.id = "at-terminal-panel";
        panel.className = "at-card";
        panel.innerHTML = [
            "<div class=\"at-panel-content\">",
            "<h3 class=\"at-card-header\">Command Console</h3>",
            "<div class=\"at-split\">",
            "<div class=\"at-split-left\">",
            "<p class=\"at-panel-note\">Authenticated Qtooley terminal. AT access stays serialized through the shared modem lock, so only one client can talk to the modem at a time.</p>",
            "<div class=\"at-input-row\">",
            "<input id=\"at-command-input\" class=\"at-command-input\" type=\"text\" maxlength=\"128\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"Enter a single AT command...\">",
            "</div>",
            "<div class=\"at-left-actions\">",
            "<button id=\"at-command-send\" class=\"qt-btn qt-btn-danger at-send-button\" type=\"button\">Send</button>",
            "<button id=\"at-command-copy\" class=\"qt-btn qt-btn-primary\" type=\"button\">Copy all</button>",
            "<button id=\"at-command-clear\" class=\"qt-btn qt-btn-primary\" type=\"button\">Clear history</button>",
            "</div>",
            "</div>",
            "<div class=\"at-split-right\">",
            "<div id=\"at-terminal-history\" class=\"at-history\">",
            "<div class=\"at-history-empty\">Run an AT command to see results here</div>",
            "</div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");

        page.appendChild(panel);

        var refCard = document.createElement("div");
        refCard.className = "at-ref-card";
        refCard.innerHTML = [
            "<details id=\"at-manage-details\" class=\"at-manage-details\">",
            "<summary class=\"at-manage-summary\"><span class=\"at-ref-arrow\"></span> Manage my commands</summary>",
            "<div class=\"at-manage-body\">",
            "<p class=\"at-manage-note\">Saved on the router under <code>/usrdata/at-stock-ui</code>. Root and admin share the same list (max 50). Built-in rows you remove are hidden, not deleted from firmware.</p>",
            "<div class=\"at-manage-form\">",
            "<div class=\"at-manage-field\">",
            "<label for=\"at-manage-cmd\">AT command</label>",
            "<input id=\"at-manage-cmd\" type=\"text\" maxlength=\"128\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"e.g. AT+CSQ\">",
            "</div>",
            "<div class=\"at-manage-field\">",
            "<label for=\"at-manage-desc\">Description</label>",
            "<input id=\"at-manage-desc\" class=\"at-manage-desc-input\" type=\"text\" maxlength=\"200\" autocomplete=\"off\" placeholder=\"Short label (optional)\">",
            "</div>",
            "<button type=\"button\" class=\"qt-btn qt-btn-primary at-manage-add\">Add to list</button>",
            "</div>",
            "<div id=\"at-manage-msg\" class=\"at-manage-msg\"></div>",
            "<div class=\"at-manage-subhead\">My saved commands (<span id=\"at-manage-count\">0 / 50</span>)</div>",
            "<ul id=\"at-manage-custom-list\" class=\"at-manage-list\"></ul>",
            "<div class=\"at-manage-subhead\">Hidden built-in commands</div>",
            "<ul id=\"at-manage-hidden-list\" class=\"at-manage-list\"></ul>",
            "<div class=\"at-manage-restore-wrap\">",
            "<button type=\"button\" class=\"qt-btn qt-btn-primary at-manage-restore-all\">Restore all hidden built-in commands</button>",
            "</div>",
            "</div>",
            "</details>",
            "<details id=\"at-ref-details\" class=\"at-ref-details\" open>",
            "<summary class=\"at-ref-summary\"><span class=\"at-ref-arrow\"></span> AT Command Reference \u2014 Quectel RG520N-NA</summary>",
            "<div class=\"at-ref-body\">",
            "<p class=\"at-ref-note\">Tap Load to populate the terminal, or Copy to clipboard. Remove hides a built-in row from this list or deletes a saved custom row. Use Manage above to add commands or restore hidden built-ins.</p>",
            "<div id=\"at-ref-commands-root\"></div>",
            "</div>",
            "</details>"
        ].join("");

        page.appendChild(refCard);
        htmlGoesHere.appendChild(page);

        document.getElementById("at-ref-commands-root").innerHTML = buildRefCommandsHtml(savedState);
        renderManageLists(savedState);

        document.getElementById("at-command-send").addEventListener("click", submitCommand);
        document.getElementById("at-command-copy").addEventListener("click", copyAllHistory);
        document.getElementById("at-command-clear").addEventListener("click", clearHistory);
        document.getElementById("at-command-input").addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                submitCommand();
            }
        });

        bindPageEvents(page);
        refreshSavedCommands();
    }

    window.StockAtTerminal = {
        init: function () {
            renderPanel();
        }
    };
})(window, jQuery);
