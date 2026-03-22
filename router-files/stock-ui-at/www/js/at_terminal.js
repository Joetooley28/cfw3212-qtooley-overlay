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
            { cmd: 'AT+EGMR=0,7', desc: "Query IMEI (EGMR)" },
            { cmd: 'AT+EGMR=1,7,"IMEI"', desc: "Change IMEI (replace IMEI with value)" }
        ]},
        { section: "Network Information", commands: [
            { cmd: "AT+CSQ", desc: "Signal quality (4G)" },
            { cmd: "AT+COPS?", desc: "Query network operator" },
            { cmd: "AT+QNWINFO", desc: "Network info detailed" },
            { cmd: "AT+QCAINFO", desc: "Carrier aggregation parameters" },
            { cmd: "AT+QRSRP", desc: "5G signal strength (RSRP)" },
            { cmd: 'AT+QENG="servingcell"', desc: "Serving cell info" },
            { cmd: 'AT+QENG="neighbourcell"', desc: "Neighbor cell info" }
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
            { cmd: 'AT+QNWPREFCFG="mode_pref"', desc: "Query current mode preference" },
            { cmd: 'AT+QNWPREFCFG="mode_pref",AUTO', desc: "Restore automatic network search" },
            { cmd: 'AT+QNWPREFCFG="mode_pref",LTE', desc: "Lock to 4G" },
            { cmd: 'AT+QNWPREFCFG="mode_pref",NR5G', desc: "Lock to 5G" },
            { cmd: 'AT+QNWPREFCFG="mode_pref",NR5G-NSA', desc: "Lock to 5G NSA" },
            { cmd: 'AT+QNWPREFCFG="mode_pref",NR5G-SA', desc: "Lock to 5G SA" }
        ]},
        { section: "Band Queries", commands: [
            { cmd: 'AT+QNWPREFCFG="lte_band"', desc: "Check LTE band settings" },
            { cmd: 'AT+QNWPREFCFG="nsa_nr5g_band"', desc: "Check NSA 5G band settings" },
            { cmd: 'AT+QNWPREFCFG="nr5g_band"', desc: "Check SA 5G band settings" },
            { cmd: 'AT+QNWPREFCFG="ue_capability_band"', desc: "Query UE capability bands" },
            { cmd: 'AT+QNWPREFCFG="policy_band"', desc: "Query policy band list" }
        ]},
        { section: "USB / Interface (Query Only)", commands: [
            { cmd: 'AT+QCFG="usbnet"', desc: "Query current dial mode" },
            { cmd: 'AT+QCFG="usbspeed"', desc: "Query current USB speed" },
            { cmd: 'AT+QCFG="data_interface"', desc: "Query current data interface" }
        ]}
    ];

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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

        var entry = document.createElement("div");
        entry.className = "at-entry at-entry-" + kind;
        entry.innerHTML =
            "<div class='at-entry-meta'>" + escapeHtml(nowTime()) + " - " + escapeHtml(title) + "</div>" +
            "<pre class='at-entry-body'>" + escapeHtml(body || "") + "</pre>";

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

    function buildRefTableHtml() {
        var rows = [];
        COMMAND_REF.forEach(function (group) {
            rows.push(
                "<tr class='at-ref-section-row'><td colspan='4'>" + escapeHtml(group.section) + "</td></tr>"
            );
            group.commands.forEach(function (item) {
                rows.push([
                    "<tr>",
                    "<td class='at-ref-cmd'><code>", escapeHtml(item.cmd), "</code></td>",
                    "<td class='at-ref-desc'>", escapeHtml(item.desc), "</td>",
                    "<td class='at-ref-action'><button class='at-ref-load' type='button' data-cmd='", escapeHtml(item.cmd), "'>Load</button></td>",
                    "<td class='at-ref-action'><button class='at-ref-copy' type='button' data-cmd='", escapeHtml(item.cmd), "'>Copy</button></td>",
                    "</tr>"
                ].join(""));
            });
        });
        return rows.join("");
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
                var errText = response.error || "request_failed";
                var details = response.response || "";
                appendHistory("error", "Error", errText + (details ? "\n\n" + details : ""));
            } else {
                appendHistory("error", "Error", "Empty response from server.");
            }
        }).fail(function (xhr) {
            var text = xhr && xhr.responseText ? xhr.responseText : "Request failed.";
            appendHistory("command", "Command", command);
            appendHistory("error", "Error", text);
        }).always(function () {
            setBusy(false);
            clearCommand();
        });
    }

    function renderPanel() {
        if (document.getElementById("at-terminal-panel")) {
            return;
        }

        var panel = document.createElement("div");
        panel.id = "at-terminal-panel";
        panel.className = "body-box form-row";
        panel.innerHTML = [
            "<div class='at-panel-content'>",
            "<div class='at-split'>",
            "<div class='at-split-left'>",
            "<p class='at-panel-note'>Authenticated Jtools stock UI terminal. AT access stays serialized through the shared modem lock, so only one client can talk to the modem at a time.</p>",
            "<div class='at-input-row'>",
            "<input id='at-command-input' class='at-command-input' type='text' maxlength='128' autocomplete='off' spellcheck='false' placeholder='Enter a single AT command'>",
            "</div>",
            "<div class='at-left-actions'>",
            "<button id='at-command-send' class='at-primary-button at-send-button' type='button'>Send</button>",
            "<button id='at-command-copy' class='at-primary-button' type='button'>Copy all</button>",
            "<button id='at-command-clear' class='at-primary-button' type='button'>Clear history</button>",
            "</div>",
            "</div>",
            "<div class='at-split-right'>",
            "<div id='at-terminal-history' class='at-history'></div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");

        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (htmlGoesHere) {
            htmlGoesHere.appendChild(panel);
        }

        var refCard = document.createElement("div");
        refCard.id = "at-ref-panel";
        refCard.className = "body-box form-row";
        refCard.innerHTML = [
            "<div class='at-ref-card'>",
            "<details id='at-ref-details' class='at-ref-details' open>",
            "<summary class='at-ref-summary'><span class='at-ref-arrow'></span> AT Command Reference — Quectel RG520N-NA</summary>",
            "<div class='at-ref-body'>",
            "<p class='at-ref-note'>Read-only queries and safe operational commands for the RG520N-NA. Use Load to populate the terminal input, or Copy to clipboard.</p>",
            "<div class='at-ref-table-wrap'>",
            "<table class='at-ref-table'>",
            "<thead><tr><th>Command</th><th>Description</th><th></th><th></th></tr></thead>",
            "<tbody>", buildRefTableHtml(), "</tbody>",
            "</table>",
            "</div>",
            "</div>",
            "</details>",
            "</div>"
        ].join("");

        if (htmlGoesHere) {
            htmlGoesHere.appendChild(refCard);
        }

        document.getElementById("at-command-send").addEventListener("click", submitCommand);
        document.getElementById("at-command-copy").addEventListener("click", copyAllHistory);
        document.getElementById("at-command-clear").addEventListener("click", clearHistory);
        document.getElementById("at-command-input").addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                submitCommand();
            }
        });

        var refBody = document.querySelector(".at-ref-body");
        if (refBody) {
            refBody.addEventListener("click", function (event) {
                var target = event.target;
                if (target.classList.contains("at-ref-load")) {
                    loadToTerminal(target.getAttribute("data-cmd") || "");
                } else if (target.classList.contains("at-ref-copy")) {
                    copyToClipboard(target.getAttribute("data-cmd") || "", target);
                }
            });
        }
    }

    window.StockAtTerminal = {
        init: function () {
            renderPanel();
        }
    };
})(window, jQuery);
