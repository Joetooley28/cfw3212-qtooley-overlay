// Copyright (c) 2020 Casa Systems.

// generating header and menu
function genThemeHeader(pageData, userGroups) {

    const themeStorageKey = "jtoolsThemeMode";

    function ensureJtoolsDarkModeStylesheet() {
        const darkModePages = {
            "general_dashboard.html": true,
            "at_terminal.html": true,
            "band_cell_locking.html": true,
            "ookla_speedtest.html": true,
            "ttl_helper.html": true,
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
        const darkModeHref = "/css/jtools_dark_mode.css?jtools-dark-v20260321d";

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
        const toggle = document.createElement("button");
        toggle.id = "jtoolsThemeToggle";
        toggle.type = "button";
        toggle.textContent = prefersDark ? "Light mode" : "Dark mode";
        toggle.setAttribute("aria-label", "Toggle dark mode");
        toggle.style.background = "#3a3f46";
        toggle.style.border = "1px solid #59606a";
        toggle.style.borderRadius = "5px";
        toggle.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.18)";
        toggle.style.color = "#d7dde4";
        toggle.style.cursor = "pointer";
        toggle.style.display = "inline-flex";
        toggle.style.alignItems = "center";
        toggle.style.fontFamily = "\"Open Sans Regular\", \"Segoe UI\", sans-serif";
        toggle.style.fontSize = "12px";
        toggle.style.height = "32px";
        toggle.style.padding = "0 12px";
        toggle.style.position = "absolute";
        toggle.style.right = "20px";
        toggle.style.top = "92px";
        toggle.style.zIndex = "40";
        toggle.style.whiteSpace = "nowrap";
        toggle.onclick = function () {
            if (window.localStorage) {
                window.localStorage.setItem(themeStorageKey, prefersDark ? "light" : "dark");
            }
            window.location.reload();
        };

        const host = document.querySelector(".container");
        if (host) {
            host.appendChild(toggle);
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

