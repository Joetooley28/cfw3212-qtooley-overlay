(function (window, document) {
    "use strict";

    var INTERVAL_MS = 5 * 60 * 1000;
    var timer = null;
    var inflight = false;

    function isJtoolsPage() {
        return window.pageData &&
            window.pageData.menuPos &&
            window.pageData.menuPos[0] === "JtoolServices";
    }

    function ping() {
        if (inflight || document.visibilityState === "hidden") {
            return;
        }
        inflight = true;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/quick_overview_api/settings", true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            inflight = false;
        };
        xhr.onerror = function () {
            inflight = false;
        };
        xhr.send();
    }

    function start() {
        if (!isJtoolsPage() || timer) {
            return;
        }
        timer = window.setInterval(ping, INTERVAL_MS);
        document.addEventListener("visibilitychange", ping);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})(window, document);
