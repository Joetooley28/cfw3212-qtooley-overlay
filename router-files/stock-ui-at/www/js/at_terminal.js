(function (window, $) {
    "use strict";

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
            "<p class='at-panel-note'>Authenticated Jtools stock UI terminal for this project. AT access stays serialized through the shared modem lock, so only one client can talk to the modem at a time.</p>",
            "<div class='at-input-row'>",
            "<input id='at-command-input' class='at-command-input' type='text' maxlength='128' autocomplete='off' spellcheck='false' placeholder='Enter a single AT command'>",
            "<button id='at-command-send' class='at-primary-button at-send-button' type='button'>Send</button>",
            "</div>",
            "<div class='at-history-actions'>",
            "<button id='at-command-copy' class='at-primary-button' type='button'>Copy all</button>",
            "<div class='at-history-actions-right'>",
            "<button id='at-command-clear' class='at-primary-button' type='button'>Clear history</button>",
            "</div>",
            "</div>",
            "<div id='at-terminal-history' class='at-history'></div>",
            "</div>"
        ].join("");

        var htmlGoesHere = document.getElementById("htmlGoesHere");
        if (htmlGoesHere) {
            htmlGoesHere.appendChild(panel);
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
    }

    window.StockAtTerminal = {
        init: function () {
            renderPanel();
        }
    };
})(window, jQuery);
