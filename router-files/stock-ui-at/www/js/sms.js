(function (window, $) {
    "use strict";

    var POLL_MS = 15000;
    var SMS_MAX_CHARS = 1600;
    var pollTimer = null;
    var bannerTimer = null;

    var state = {
        view: "inbox",          // "inbox" | "compose" | "detail"
        filter: "all",          // "all" | "unread" | "sent"
        messages: [],
        storage: null,
        selectedIndex: null,
        selectedMessage: null,
        loading: true,
        sending: false,
        busy: false,
        composePhone: "",
        composeMessage: "",
        bannerType: "",
        bannerText: "",
        confirmAction: null,    // { title, body, onConfirm }
        error: ""
    };

    // ── Helpers ──

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function byId(id) { return document.getElementById(id); }

    function tipAttr(text) {
        return " title='" + escapeHtml(text) + "'";
    }

    function isUnread(msg) {
        return msg.status === "REC UNREAD";
    }

    function isReceived(msg) {
        return msg.status === "REC UNREAD" || msg.status === "REC READ";
    }

    function isSent(msg) {
        return msg.status === "STO SENT" || msg.status === "STO UNSENT";
    }

    function directionLabel(msg) {
        if (isReceived(msg)) return "recv";
        return "sent";
    }

    function formatTimestamp(ts) {
        if (!ts) return "";
        // AT timestamp: "yy/MM/dd,hh:mm:ss+zz" or similar
        var m = ts.match(/(\d{2})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2}):(\d{2})/);
        if (!m) return escapeHtml(ts);
        var yr = parseInt(m[1], 10) + 2000;
        return yr + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6];
    }

    function formatTimeShort(ts) {
        if (!ts) return "";
        var m = ts.match(/(\d{2})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2})/);
        if (!m) return escapeHtml(ts);
        return m[2] + "/" + m[3] + " " + m[4] + ":" + m[5];
    }

    function truncate(text, maxLen) {
        if (!text) return "";
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + "\u2026";
    }

    function filteredMessages() {
        var msgs = state.messages || [];
        if (state.filter === "unread") {
            return msgs.filter(isUnread);
        }
        if (state.filter === "sent") {
            return msgs.filter(isSent);
        }
        return msgs;
    }

    function unreadCount() {
        return (state.messages || []).filter(isUnread).length;
    }

    // ── Banner ──

    function setBanner(type, text) {
        state.bannerType = type;
        state.bannerText = text;
        render();
        if (bannerTimer) clearTimeout(bannerTimer);
        if (type === "ok" || type === "info") {
            bannerTimer = setTimeout(function () {
                state.bannerType = "";
                state.bannerText = "";
                render();
            }, 5000);
        }
    }

    // ── API Calls ──

    function fetchMessages() {
        $.ajax({
            url: "/sms_api/list",
            type: "GET",
            dataType: "json"
        }).done(function (payload) {
            state.loading = false;
            if (payload && payload.ok) {
                state.messages = payload.messages || [];
                state.storage = payload.storage || null;
                state.error = "";
            } else {
                state.error = (payload && payload.error) || "Failed to load messages";
            }
            render();
        }).fail(function (xhr) {
            state.loading = false;
            var fb = "Connection error: " + (xhr && xhr.statusText ? xhr.statusText : "Unknown");
            state.error = window.QtooleyXhrMessage(xhr, fb);
            render();
        });
    }

    function sendMessage(phone, message) {
        if (state.sending) return;
        state.sending = true;
        render();

        $.ajax({
            url: "/sms_api/send",
            type: "POST",
            data: {
                csrfToken: csrfToken,
                phone: phone,
                message: message
            },
            dataType: "json"
        }).done(function (payload) {
            state.sending = false;
            if (payload && payload.ok) {
                state.composePhone = "";
                state.composeMessage = "";
                state.view = "inbox";
                setBanner("ok", "Message sent successfully (ref: " + (payload.message_reference || "?") + ")");
                fetchMessages();
            } else {
                var errMsg = (payload && payload.error) || "Send failed";
                if (errMsg === "sms_no_prompt") {
                    errMsg = "Modem did not respond to send command. Check SIM/signal.";
                } else if (errMsg === "sms_rejected") {
                    errMsg = "Modem rejected the send command. Check phone number format.";
                } else if (errMsg === "timeout") {
                    errMsg = "Send timed out. The network may be congested.";
                }
                setBanner("error", errMsg);
            }
        }).fail(function (xhr) {
            state.sending = false;
            if (xhr.status === 409) {
                setBanner("warn", "AT channel busy \u2014 another operation is in progress. Try again.");
            } else {
                setBanner("error", window.QtooleyXhrMessage(xhr, "Send failed: " + (xhr.statusText || "Connection error")));
            }
        });
    }

    function deleteMessage(index) {
        state.busy = true;
        render();

        $.ajax({
            url: "/sms_api/delete",
            type: "POST",
            data: {
                csrfToken: csrfToken,
                index: index
            },
            dataType: "json"
        }).done(function (payload) {
            state.busy = false;
            if (payload && payload.ok) {
                if (state.selectedIndex === index) {
                    state.view = "inbox";
                    state.selectedIndex = null;
                    state.selectedMessage = null;
                }
                setBanner("ok", "Message deleted");
                fetchMessages();
            } else {
                setBanner("error", "Delete failed: " + ((payload && payload.error) || "Unknown error"));
            }
        }).fail(function (xhr) {
            state.busy = false;
            setBanner("error", window.QtooleyXhrMessage(xhr, "Delete failed: connection error"));
        });
    }

    function deleteAllMessages() {
        state.busy = true;
        state.confirmAction = null;
        render();

        $.ajax({
            url: "/sms_api/delete_all",
            type: "POST",
            data: { csrfToken: csrfToken },
            dataType: "json"
        }).done(function (payload) {
            state.busy = false;
            if (payload && payload.ok) {
                state.view = "inbox";
                state.selectedIndex = null;
                state.selectedMessage = null;
                setBanner("ok", "All messages deleted");
                fetchMessages();
            } else {
                setBanner("error", "Delete all failed: " + ((payload && payload.error) || "Unknown error"));
            }
        }).fail(function (xhr) {
            state.busy = false;
            setBanner("error", window.QtooleyXhrMessage(xhr, "Delete all failed: connection error"));
        });
    }

    // ── Polling ──

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () {
            if (state.view === "inbox" && !state.busy && !state.sending) {
                fetchMessages();
            }
        }, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // ── Render ──

    function render() {
        var panel = byId("sms-panel");
        if (!panel) return;

        var html = [];
        html.push("<div class='sms-page'>");

        // ── Page header
        html.push("<div class='sms-page-header'>");
        html.push("  <div>");
        html.push("    <span class='sms-page-title'>");
        html.push("      <span class='sms-page-title-icon'>\uD83D\uDCF1</span>SMS Messages");
        html.push("    </span>");
        if (state.storage && state.storage.read) {
            html.push("    <span class='sms-storage-info'>" + state.storage.read.used + "/" + state.storage.read.total + " (" + state.storage.read.memory + ")</span>");
        }
        html.push("  </div>");
        html.push("  <div class='sms-header-actions'>");
        html.push("    <button class='sms-btn' id='sms-refresh'" + tipAttr("Refresh messages") + ">\u21BB Refresh</button>");
        html.push("  </div>");
        html.push("</div>");

        // ── Banner
        if (state.bannerText) {
            html.push("<div class='sms-banner is-" + escapeHtml(state.bannerType) + "'>" + escapeHtml(state.bannerText) + "</div>");
        }

        // ── Tabs
        html.push("<div class='sms-tabs'>");
        var uCount = unreadCount();
        html.push("  <button class='sms-tab" + (state.view !== "compose" ? " is-active" : "") + "' id='sms-tab-inbox'>Inbox");
        if (uCount > 0) {
            html.push("    <span class='sms-tab-badge is-unread'>" + uCount + "</span>");
        }
        html.push("  </button>");
        html.push("  <button class='sms-tab" + (state.view === "compose" ? " is-active" : "") + "' id='sms-tab-compose'>Compose</button>");
        html.push("</div>");

        // ── Content Area
        if (state.loading) {
            html.push(renderLoading());
        } else if (state.view === "compose") {
            html.push(renderCompose());
        } else if (state.view === "detail" && state.selectedMessage) {
            html.push(renderDetail());
        } else {
            html.push(renderInbox());
        }

        html.push("</div>"); // end .sms-page

        // ── Confirm modal
        if (state.confirmAction) {
            html.push(renderConfirmModal());
        }

        panel.innerHTML = html.join("");
        wireControls();
    }

    function renderLoading() {
        return [
            "<div class='sms-loading'>",
            "  <div class='sms-spinner'></div>",
            "  <div>Loading messages\u2026</div>",
            "</div>"
        ].join("");
    }

    function renderInbox() {
        var html = [];
        var msgs = filteredMessages();

        // Toolbar
        html.push("<div class='sms-card'>");
        html.push("<div class='sms-toolbar'>");
        html.push("  <div class='sms-toolbar-left'>");
        html.push("    <button class='sms-filter-pill" + (state.filter === "all" ? " is-active" : "") + "' data-filter='all'>All</button>");
        html.push("    <button class='sms-filter-pill" + (state.filter === "unread" ? " is-active" : "") + "' data-filter='unread'>Unread</button>");
        html.push("    <button class='sms-filter-pill" + (state.filter === "sent" ? " is-active" : "") + "' data-filter='sent'>Sent</button>");
        html.push("  </div>");
        html.push("  <div class='sms-toolbar-right'>");
        if (state.messages.length > 0) {
            html.push("    <button class='sms-btn sms-btn-sm sms-btn-danger' id='sms-delete-all'" + tipAttr("Delete all messages from storage") + ">Delete All</button>");
        }
        html.push("  </div>");
        html.push("</div>");

        if (state.error) {
            html.push("<div class='sms-banner is-error'>" + escapeHtml(state.error) + "</div>");
        }

        if (msgs.length === 0) {
            html.push("<div class='sms-empty'>");
            html.push("  <div class='sms-empty-icon'>\uD83D\uDCED</div>");
            if (state.messages.length > 0 && state.filter !== "all") {
                html.push("  <div class='sms-empty-text'>No " + escapeHtml(state.filter) + " messages</div>");
            } else {
                html.push("  <div class='sms-empty-text'>No messages in storage</div>");
            }
            html.push("</div>");
        } else {
            html.push("<div class='sms-message-list'>");
            // Show newest first (highest index)
            var sorted = msgs.slice().sort(function (a, b) { return b.index - a.index; });
            for (var i = 0; i < sorted.length; i++) {
                html.push(renderMessageRow(sorted[i]));
            }
            html.push("</div>");
        }

        html.push("</div>"); // end card
        return html.join("");
    }

    function renderMessageRow(msg) {
        var unread = isUnread(msg);
        var dir = directionLabel(msg);
        var preview = truncate(msg.body || "", 90);
        var cls = "sms-msg-row";
        if (unread) cls += " is-unread";
        if (state.selectedIndex === msg.index) cls += " is-selected";

        return [
            "<div class='" + cls + "' data-msg-index='" + msg.index + "'>",
            "  <div class='sms-msg-indicator'></div>",
            "  <div class='sms-msg-body-area'>",
            "    <div class='sms-msg-top-row'>",
            "      <div>",
            "        <span class='sms-msg-direction is-" + dir + "'>" + (dir === "recv" ? "IN" : "OUT") + "</span>",
            "        <span class='sms-msg-addr'>" + escapeHtml(msg.address || "Unknown") + "</span>",
            "      </div>",
            "      <span class='sms-msg-time'>" + escapeHtml(formatTimeShort(msg.timestamp)) + "</span>",
            "    </div>",
            "    <div class='sms-msg-preview'>" + escapeHtml(preview) + "</div>",
            "  </div>",
            "</div>"
        ].join("");
    }

    function renderDetail() {
        var msg = state.selectedMessage;
        var dir = directionLabel(msg);
        var html = [];

        html.push("<div class='sms-card sms-detail-card'>");

        // Header
        html.push("<div class='sms-detail-header'>");
        html.push("  <div>");
        html.push("    <span class='sms-msg-direction is-" + dir + "'>" + (dir === "recv" ? "RECEIVED" : "SENT") + "</span>");
        html.push("    <span class='sms-detail-addr'>" + escapeHtml(msg.address || "Unknown") + "</span>");
        html.push("  </div>");
        html.push("  <button class='sms-btn sms-btn-sm' id='sms-back-btn'>\u2190 Back</button>");
        html.push("</div>");

        // Meta
        html.push("<div class='sms-detail-meta'>");
        html.push("  <div class='sms-detail-meta-row'><span class='sms-detail-meta-label'>Status</span><span class='sms-detail-meta-value'>" + escapeHtml(msg.status) + "</span></div>");
        html.push("  <div class='sms-detail-meta-row'><span class='sms-detail-meta-label'>Timestamp</span><span class='sms-detail-meta-value'>" + escapeHtml(formatTimestamp(msg.timestamp)) + "</span></div>");
        html.push("  <div class='sms-detail-meta-row'><span class='sms-detail-meta-label'>Index</span><span class='sms-detail-meta-value'>" + msg.index + "</span></div>");
        html.push("</div>");

        // Body
        html.push("<div class='sms-detail-body'>" + escapeHtml(msg.body || "") + "</div>");

        // Actions
        html.push("<div class='sms-detail-actions'>");
        html.push("  <button class='sms-btn sms-btn-primary' id='sms-reply-btn'" + tipAttr("Reply to this number") + ">Reply</button>");
        html.push("  <button class='sms-btn sms-btn-danger sms-btn-sm' id='sms-delete-one'" + tipAttr("Delete this message") + " data-index='" + msg.index + "'>Delete</button>");
        html.push("</div>");

        html.push("</div>"); // end card
        return html.join("");
    }

    function renderCompose() {
        var charLen = state.composeMessage.length;
        var charClass = "sms-char-count";
        if (charLen > 160) charClass += " is-warn";
        if (charLen > SMS_MAX_CHARS) charClass += " is-over";

        var segmentInfo = "";
        if (charLen > 0) {
            var segments = charLen <= 160 ? 1 : Math.ceil(charLen / 153);
            segmentInfo = " \u00B7 " + segments + " segment" + (segments > 1 ? "s" : "");
        }

        var html = [];
        html.push("<div class='sms-card'>");
        html.push("<div class='sms-card-title'>New Message</div>");
        html.push("<div class='sms-compose'>");

        // Phone number
        html.push("  <div class='sms-input-group'>");
        html.push("    <label class='sms-input-label' for='sms-phone'>Recipient</label>");
        html.push("    <input class='sms-input' type='text' id='sms-phone' placeholder='+1 555 123 4567' value='" + escapeHtml(state.composePhone) + "' autocomplete='off' />");
        html.push("  </div>");

        // Message
        html.push("  <div class='sms-input-group'>");
        html.push("    <label class='sms-input-label' for='sms-message'>Message</label>");
        html.push("    <textarea class='sms-input sms-textarea' id='sms-message' placeholder='Type your message\u2026' maxlength='" + SMS_MAX_CHARS + "'>" + escapeHtml(state.composeMessage) + "</textarea>");
        html.push("    <div class='" + charClass + "'>" + charLen + "/" + SMS_MAX_CHARS + segmentInfo + "</div>");
        html.push("  </div>");

        // Actions
        html.push("  <div class='sms-compose-actions'>");
        html.push("    <button class='sms-btn' id='sms-compose-cancel'>Cancel</button>");
        html.push("    <button class='sms-btn sms-btn-success' id='sms-send-btn'" + (state.sending ? " disabled" : "") + ">" + (state.sending ? "Sending\u2026" : "Send") + "</button>");
        html.push("  </div>");

        html.push("</div>"); // end .sms-compose
        html.push("</div>"); // end card
        return html.join("");
    }

    function renderConfirmModal() {
        var act = state.confirmAction;
        return [
            "<div class='sms-modal-overlay' id='sms-modal-overlay'>",
            "  <div class='sms-modal'>",
            "    <div class='sms-modal-title'>" + escapeHtml(act.title) + "</div>",
            "    <div class='sms-modal-body'>" + escapeHtml(act.body) + "</div>",
            "    <div class='sms-modal-actions'>",
            "      <button class='sms-btn' id='sms-modal-cancel'>Cancel</button>",
            "      <button class='sms-btn sms-btn-danger' id='sms-modal-confirm'>Confirm</button>",
            "    </div>",
            "  </div>",
            "</div>"
        ].join("");
    }

    // ── Wire Controls ──

    function wireControls() {
        // Tabs
        var tabInbox = byId("sms-tab-inbox");
        var tabCompose = byId("sms-tab-compose");
        if (tabInbox) {
            tabInbox.addEventListener("click", function () {
                state.view = "inbox";
                state.selectedIndex = null;
                state.selectedMessage = null;
                render();
            });
        }
        if (tabCompose) {
            tabCompose.addEventListener("click", function () {
                state.view = "compose";
                render();
                var phoneInput = byId("sms-phone");
                if (phoneInput) phoneInput.focus();
            });
        }

        // Refresh
        var refreshBtn = byId("sms-refresh");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                state.loading = true;
                render();
                fetchMessages();
            });
        }

        // Filter pills
        var pills = document.querySelectorAll(".sms-filter-pill[data-filter]");
        for (var p = 0; p < pills.length; p++) {
            (function (pill) {
                pill.addEventListener("click", function () {
                    state.filter = pill.getAttribute("data-filter") || "all";
                    render();
                });
            })(pills[p]);
        }

        // Message rows
        var rows = document.querySelectorAll(".sms-msg-row[data-msg-index]");
        for (var r = 0; r < rows.length; r++) {
            (function (row) {
                row.addEventListener("click", function () {
                    var idx = parseInt(row.getAttribute("data-msg-index"), 10);
                    openMessage(idx);
                });
            })(rows[r]);
        }

        // Detail view controls
        var backBtn = byId("sms-back-btn");
        if (backBtn) {
            backBtn.addEventListener("click", function () {
                state.view = "inbox";
                state.selectedIndex = null;
                state.selectedMessage = null;
                render();
            });
        }

        var replyBtn = byId("sms-reply-btn");
        if (replyBtn && state.selectedMessage) {
            replyBtn.addEventListener("click", function () {
                state.composePhone = state.selectedMessage.address || "";
                state.composeMessage = "";
                state.view = "compose";
                render();
                var phoneInput = byId("sms-phone");
                if (phoneInput) phoneInput.focus();
            });
        }

        var deleteOneBtn = byId("sms-delete-one");
        if (deleteOneBtn) {
            deleteOneBtn.addEventListener("click", function () {
                var idx = parseInt(deleteOneBtn.getAttribute("data-index"), 10);
                state.confirmAction = {
                    title: "Delete message?",
                    body: "This will permanently remove message #" + idx + " from modem storage.",
                    onConfirm: function () { deleteMessage(idx); }
                };
                render();
            });
        }

        // Delete all
        var deleteAllBtn = byId("sms-delete-all");
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener("click", function () {
                state.confirmAction = {
                    title: "Delete all messages?",
                    body: "This will permanently remove all " + state.messages.length + " messages from modem storage. This cannot be undone.",
                    onConfirm: deleteAllMessages
                };
                render();
            });
        }

        // Compose controls
        var phoneInput = byId("sms-phone");
        var msgInput = byId("sms-message");
        if (phoneInput) {
            phoneInput.addEventListener("input", function () {
                state.composePhone = phoneInput.value;
            });
        }
        if (msgInput) {
            msgInput.addEventListener("input", function () {
                state.composeMessage = msgInput.value;
                // Update char count without full re-render
                var countEl = msgInput.parentElement.querySelector(".sms-char-count");
                if (countEl) {
                    var len = state.composeMessage.length;
                    var cls = "sms-char-count";
                    if (len > 160) cls += " is-warn";
                    if (len > SMS_MAX_CHARS) cls += " is-over";
                    var segs = len <= 160 ? 1 : Math.ceil(len / 153);
                    var segText = len > 0 ? (" \u00B7 " + segs + " segment" + (segs > 1 ? "s" : "")) : "";
                    countEl.className = cls;
                    countEl.textContent = len + "/" + SMS_MAX_CHARS + segText;
                }
            });
        }

        var cancelBtn = byId("sms-compose-cancel");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", function () {
                state.view = "inbox";
                render();
            });
        }

        var sendBtn = byId("sms-send-btn");
        if (sendBtn) {
            sendBtn.addEventListener("click", function () {
                var phone = (state.composePhone || "").trim();
                var msg = (state.composeMessage || "").trim();
                if (!phone) {
                    setBanner("error", "Please enter a phone number");
                    return;
                }
                if (!msg) {
                    setBanner("error", "Please enter a message");
                    return;
                }
                if (msg.length > SMS_MAX_CHARS) {
                    setBanner("error", "Message exceeds maximum length");
                    return;
                }
                sendMessage(phone, msg);
            });
        }

        // Modal controls
        var modalCancel = byId("sms-modal-cancel");
        var modalConfirm = byId("sms-modal-confirm");
        var modalOverlay = byId("sms-modal-overlay");

        if (modalCancel) {
            modalCancel.addEventListener("click", function () {
                state.confirmAction = null;
                render();
            });
        }
        if (modalConfirm && state.confirmAction) {
            var onConfirm = state.confirmAction.onConfirm;
            modalConfirm.addEventListener("click", function () {
                state.confirmAction = null;
                if (typeof onConfirm === "function") {
                    onConfirm();
                }
            });
        }
        if (modalOverlay) {
            modalOverlay.addEventListener("click", function (e) {
                if (e.target === modalOverlay) {
                    state.confirmAction = null;
                    render();
                }
            });
        }
    }

    // ── Actions ──

    function openMessage(index) {
        // Find message in state
        var msg = null;
        for (var i = 0; i < state.messages.length; i++) {
            if (state.messages[i].index === index) {
                msg = state.messages[i];
                break;
            }
        }
        if (!msg) return;

        state.selectedIndex = index;
        state.selectedMessage = msg;
        state.view = "detail";
        render();

        // If it was unread, it's now read on the modem side (CMGR changes status)
        if (isUnread(msg)) {
            msg.status = "REC READ";
        }
    }

    // ── Init ──

    function buildShell() {
        var host = byId("htmlGoesHere");
        if (!host) return;
        var panel = document.createElement("div");
        panel.id = "sms-panel";
        host.appendChild(panel);
    }

    function init() {
        buildShell();
        render();
        fetchMessages();
        startPolling();
    }

    window.JtoolsSmsPage = { init: init };

})(window, jQuery);
