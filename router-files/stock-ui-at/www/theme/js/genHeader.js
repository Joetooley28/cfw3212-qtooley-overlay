// Copyright (c) 2020 Casa Systems.

(function (w) {
    "use strict";
    /** Plain-text 401 bodies (e.g. "Unauthorized") from the stock web stack → one friendly line for Qtooley banners. */
    w.QtooleyXhrMessage = function (xhr, fallback) {
        var status = xhr && typeof xhr.status === "number" ? xhr.status : 0;
        var raw = xhr && xhr.responseText ? String(xhr.responseText).trim() : "";
        if (status === 401 || /^unauthorized$/i.test(raw) || /^unauthorised$/i.test(raw)) {
            return "Login required";
        }
        if (raw) {
            return raw;
        }
        return fallback === undefined || fallback === null ? "" : String(fallback);
    };
})(window);

// generating header and menu
function genThemeHeader(pageData, userGroups) {

    const themeStorageKey = "jtoolsThemeMode";

    function ensureJtoolsDarkModeStylesheet() {
        const darkModePages = {
            "quick_overview.html": true,
            "general_dashboard.html": true,
            "at_terminal.html": true,
            "band_cell_locking.html": true,
            "ookla_speedtest.html": true,
            "ttl_helper.html": true,
            "tailscale.html": true,
            "sms.html": true,
            "screensaver_settings.html": true,
            "status.html": true,
            "profile_list.html": true,
            "operator_setting.html": true,
            "roaming.html": true,
            "lan.html": true,
            "dhcp.html": true,
            "vlan.html": true,
            "NAT.html": true,
            "mac_whitelist.html": true,
            "routing.html": true,
            "service_assurance.html": true,
            "NTP.html": true,
            "TR069.html": true,
            "dns_server.html": true,
            "gps_configuration.html": true,
            "agps.html": true,
            "gps_odometer.html": true,
            "gps_geofence.html": true,
            "lwm2m.html": true,
            "logfile.html": true,
            "logsettings.html": true,
            "ping_diag.html": true,
            "FactoryReset.html": true,
            "web_server_setting.html": true,
            "admin_credentials.html": true,
            "webui_credentials.html": true,
            "settings_backup.html": true,
            "runtime_config.html": true,
            "upgrade.html": true,
            "access_control.html": true,
            "Reboot.html": true,
            "field_test.html": true,
            "encrypted_debuginfo.html": true
        };
        const darkModeHref = "/css/jtools_dark_mode.css?jtools-dark-v20260329a";

        if (!darkModePages[relUrlOfPage]) {
            return false;
        }

        const existingLinks = Array.prototype.slice.call(document.querySelectorAll("link[href*='/css/jtools_dark_mode.css']"));

        if (window.localStorage && window.localStorage.getItem(themeStorageKey) === "light") {
            existingLinks.forEach(function (linkEl) {
                if (linkEl.parentNode) {
                    linkEl.parentNode.removeChild(linkEl);
                }
            });
            return true;
        }

        const existing = existingLinks.find(function (linkEl) {
            return linkEl.getAttribute("href") === darkModeHref;
        });
        if (existing) {
            return true;
        }
        existingLinks.forEach(function (linkEl) {
            if (linkEl.parentNode) {
                linkEl.parentNode.removeChild(linkEl);
            }
        });

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = darkModeHref;
        link.setAttribute("data-jtools-dark-mode", "1");
        document.head.appendChild(link);
        return true;
    }

    function renderThemeToggle() {
        if (!ensureJtoolsDarkModeStylesheet()) {
            return;
        }

        if (document.getElementById("jtoolsThemeToggle")) {
            return;
        }

        const prefersDark = !(window.localStorage && window.localStorage.getItem(themeStorageKey) === "light");

        // Inject toggle switch CSS once
        const styleEl = document.createElement("style");
        styleEl.textContent =
            ".jt-toggle-row{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;}" +
            ".jt-toggle-label{font-family:'Open Sans Regular','Segoe UI',sans-serif;font-size:11px;color:#8a919a;white-space:nowrap;}" +
            ".jt-toggle-track{position:relative;width:36px;height:20px;border-radius:10px;background:#3a3f46;border:1px solid #59606a;transition:background 0.2s,border-color 0.2s;flex-shrink:0;}" +
            ".jt-toggle-track.is-on{background:#4a7cdb;border-color:#5a8ae6;}" +
            ".jt-toggle-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#d7dde4;transition:transform 0.2s;}" +
            ".jt-toggle-track.is-on .jt-toggle-knob{transform:translateX(16px);}" +
            "#jtoolsHeaderBtns{max-width:calc(100vw - 24px);}" +
            "@media (max-width:1280px){#jtoolsHeaderBtns{right:12px!important;top:12px!important;align-items:flex-end;}}" +
            "@media (max-width:768px){#jtoolsHeaderBtns{gap:4px;right:8px!important;top:8px!important;transform:scale(.96);transform-origin:top right;}}";
        document.head.appendChild(styleEl);

        function makeToggleRow(id, label, isOn, onChange) {
            const row = document.createElement("label");
            row.className = "jt-toggle-row";
            row.setAttribute("for", id);

            const track = document.createElement("div");
            track.className = "jt-toggle-track" + (isOn ? " is-on" : "");
            const knob = document.createElement("div");
            knob.className = "jt-toggle-knob";
            track.appendChild(knob);

            const lbl = document.createElement("span");
            lbl.className = "jt-toggle-label";
            lbl.id = id + "Label";
            lbl.textContent = label;

            row.appendChild(track);
            row.appendChild(lbl);

            row.addEventListener("click", function (e) {
                e.preventDefault();
                const on = track.classList.toggle("is-on");
                onChange(on, lbl);
            });
            return row;
        }

        // Container — stacked vertically, positioned outside the Casa container's right edge
        const wrap = document.createElement("div");
        wrap.id = "jtoolsHeaderBtns";
        wrap.setAttribute("style",
            "position:absolute;right:-216px;top:80px;z-index:99999;" +
            "display:flex;flex-direction:column;gap:6px;align-items:flex-start;");

        // Dark mode toggle (on = dark, off = light)
        const darkRow = makeToggleRow("jtoolsThemeToggle", "Dark mode", prefersDark, function (on) {
            if (window.localStorage) {
                window.localStorage.setItem(themeStorageKey, on ? "dark" : "light");
            }
            window.location.reload();
        });

        // Screensaver toggle (on = active, off = paused)
        window._jtoolsSsPaused = false;
        const ssRow = makeToggleRow("jtoolsSsPause", "Screensaver", true, function (on, lbl) {
            window._jtoolsSsPaused = !on;
            lbl.textContent = on ? "Screensaver" : "Screensaver paused";
            lbl.style.color = on ? "" : "#e06c4f";
        });

        wrap.appendChild(darkRow);
        wrap.appendChild(ssRow);

        const host = document.querySelector(".container");
        if (host) {
            if (!host.style.position || host.style.position === "static") {
                host.style.position = "relative";
            }
            host.appendChild(wrap);
        }
    }

    // This generates all the html for a simple menu with no submenus
    // @param id Menu entry ID
    // @param title Menu entry title
    // @param url URL
    function genHtmlForSimpleMenu(id, title, url, viewGroups) {
        if (!checkGroupAccess(viewGroups, userGroups)) {
            return "";
        }
        let active = ' ';
        if (pageData.menuPos && id == pageData.menuPos[1]) {
            active=" class='active' ";
        }
        return "<li><a"+active+"href="+url+">"+title+"</a></li>";
    }

    // This generates all the html for a menu and submenus
    // @param menuId Menu entry ID
    // @param menuTitle Menu entry Title
    // @param subMenus Array of submenu entries, where each entry is an array:
    //         [0]: ID; [1]: Title; [2]: URL
    function generateHtmlForMenu(menuId, menuTitle, subMenus) {
        let open ="";
        let hide = " hide";
        let html="";
        let numMenus = subMenus.length;
        let numVisible = 0;
        if (numMenus==0)
            return "";
        for ( let i = 0; i < numMenus; i++ )
        {
            let subMenu=subMenus[i];
            if (subMenu.length < 4 ) {
                continue;
            }

            let subMenuGroups = subMenu[3];
            if (!checkGroupAccess(subMenuGroups, userGroups)) {
                continue;
            }

            let subMenuId=subMenu[0];
            let subMenuTitle=subMenu[1];
            let subMenuUrl=subMenu[2];

            let active = " ";
            if (pageData.menuPos && menuId == pageData.menuPos[1] && subMenuId == pageData.menuPos[2]) {
                active =" class='active' ";
                open = " class='open'";
                hide = "";
            } else {
                active =" class='inactive' ";
            }
            numVisible += 1;
            html += "<a"+active+"href="+subMenuUrl+">"+subMenuTitle+"</a>";
        }
        if (numVisible == 0) {
            return "";
        }
        return "<li"+open+"><a class='expandable'>"+menuTitle+"</a><div class='submenu"+hide+"'>"+html+"</div></li>";
    }

    ensureJtoolsDarkModeStylesheet();

    let h_top="<div class='container'><header class='site-header'>\
    <a href='https://www.casa-systems.com' target='_blank'><h1 class='grid-4 alpha'> </h1></a>\
    <nav class='top-right grid-9 omega'>\
        <ul class='main-menu list-inline'>"

    // top menu
    for (let i = 0; i < MENU_ENTRIES.length; i++) {
        if (typeof MENU_ENTRIES[i]["url"] == "undefined") {
            continue;
        }
        let attr = " class='top_menu_" + MENU_ENTRIES[i].id + "'";
        if (pageData.menuPos && pageData.menuPos[0] == MENU_ENTRIES[i].id) {
            attr = " class='active'";
        }
        h_top += "<li "+attr + "><a href='" + MENU_ENTRIES[i]["url"] + "'>"+_(MENU_ENTRIES[i]["title"])+"</a></li>";
    }

    h_top+="</ul>\
    </nav></header>\
    <div class='right-item account-btn'>\
    <span class='login-foot'></span><span class='login-foot-user'>"+user+"</span>\
    <span id='logOff'><form id='logOffForm' method='post' action='logout'><button type='submit' class='log-off'></button></form></span>\
    </div></div>";

    $("#main-menu").append(h_top);

    let h_side="<ul>";
    if (typeof pageData.menuPos != "undefined" && typeof pageData.menuPos[1] != "undefined") {
        let topMenuEntry = null;
        for (let i = 0; i < MENU_ENTRIES.length; i++) {
            if (pageData.menuPos[0] == MENU_ENTRIES[i].id) {
                topMenuEntry = MENU_ENTRIES[i];
                break;
            }
        }

        if (topMenuEntry) {
            for (let j = 0; j < topMenuEntry.children.length; j++) {
                let menuEntry = topMenuEntry.children[j];
                if (menuEntry.children.length == 0) {
                    if (menuEntry["url"]) {
                        //create side menu main entry
                        h_side += genHtmlForSimpleMenu(menuEntry["id"], _(menuEntry["title"]), menuEntry["url"], menuEntry["viewGroups"]);
                    }
                } else {
                    // create sub-side-menu
                    let subMenus = [];
                    for (let k = 0; k < menuEntry.children.length; k++) {
                        let subMenuEntry = menuEntry.children[k];
                        if (subMenuEntry["url"]) {
                            subMenus.push([subMenuEntry["id"], _(subMenuEntry["title"]), subMenuEntry["url"], subMenuEntry["viewGroups"]]);
                        }
                    }
                    h_side += generateHtmlForMenu(menuEntry["id"], _(menuEntry["title"]), subMenus);
                }
            }

        }
    }

    h_side+="</ul>";

    $("#side-menu").append(h_side);
    renderThemeToggle();

    // Screensaver: dark-mode pages + Screensaver Settings (light mode needs manual open)
    var injectScreensaverJs = document.querySelector("link[data-jtools-dark-mode]") ||
        (typeof relUrlOfPage !== "undefined" && relUrlOfPage === "screensaver_settings.html");
    if (injectScreensaverJs) {
        var ssScript = document.createElement("script");
        ssScript.src = "/js/jtools_screensaver.js?jtools-qo-v20260331e";
        document.head.appendChild(ssScript);
    }

    $("input[type=text]").keyup(function(e) {
        let code = e.keyCode || e.which;
        if (code == '9') {
            $(this).select();
        }
    });
    let pageTitle = "";
    if (pageData["title"]) {
        pageTitle = _(pageData["title"]);
    }
    if (xlat["Site title"]) {
        pageTitle += xlat["Site title"];
    }
    $(document).attr("title", pageTitle);
}

