# Licensing Notice

This repository contains a mix of:

- original Qtooley code and repo-authored documentation
- modified stock or vendor-derived router UI material
- third-party trademarks, logos, and service names
- recovery packages, captures, and other bundled artifacts

Unless otherwise noted, original Qtooley material in this repository is copyright Joe Tooley.

## Original Qtooley Code

Unless otherwise noted, the original software/code authored for this repository is made available under the GNU General Public License, version 2 or, at your option, any later version (`GPL-2.0-or-later`).

See [LICENSE](LICENSE).

## Documentation And Repo-Authored Prose

Unless otherwise noted, the original documentation and other original non-code text in this repository are made available under Creative Commons Attribution-ShareAlike 4.0 International (`CC BY-SA 4.0`).

See [LICENSE-docs.md](LICENSE-docs.md).

## Excluded Or Special-Case Material

The blanket repository licenses above do not automatically relicense everything in this tree.

Examples of material that should be treated as excluded, third-party, upstream, or otherwise requiring separate rights analysis include:

- stock Casa web UI content, firmware-related content, stock captures, and fallback recovery archives
- files under [recovery/stock-ui-fallback](recovery/stock-ui-fallback)
- known stock/vendor-derived or shared-stock integration files such as:
  - [router-files/stock-ui-at/www/theme/js/genHeader.js](router-files/stock-ui-at/www/theme/js/genHeader.js)
  - [router-files/stock-ui-at/www/js/generatedMenuEntries.js](router-files/stock-ui-at/www/js/generatedMenuEntries.js)
  - [router-files/stock-ui-at/overlay/www/js/generatedMenuEntries.js](router-files/stock-ui-at/overlay/www/js/generatedMenuEntries.js)
  - [router-files/stock-ui-at/usr/share/lua/5.1/webif/top_menu_entries.lua](router-files/stock-ui-at/usr/share/lua/5.1/webif/top_menu_entries.lua)
  - [router-files/stock-ui-at/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua](router-files/stock-ui-at/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua)
  - [router-files/stock-ui-at/usr/share/lua/5.1/webif/userGroupAuth.lua](router-files/stock-ui-at/usr/share/lua/5.1/webif/userGroupAuth.lua)
  - [router-files/stock-ui-at/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua](router-files/stock-ui-at/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua)
  - files in [router-files/stock-ui-at/usr/share/lua/5.1/webif](router-files/stock-ui-at/usr/share/lua/5.1/webif) to the extent they are based on stock Casa webif material
  - files in [router-files/stock-ui-at/overlay](router-files/stock-ui-at/overlay) to the extent they are copies of or derived from stock router UI content
- third-party names, marks, logos, and branding, including references to Casa Systems, Quectel, Tailscale, Ookla, and US Cellular
- third-party binaries, archives, or downloads, if present, which remain subject to their own upstream terms

Nothing in this repository grants trademark rights, endorsement rights, or ownership over third-party or vendor-owned material.

If you want to reuse excluded material, check the upstream rights holder's terms instead of relying on the repository-wide licenses alone.
