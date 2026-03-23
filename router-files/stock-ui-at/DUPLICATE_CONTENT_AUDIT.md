# Duplicate Content Audit — Qtooley Custom Pages

**Date:** 2026-03-23
**Scope:** All 6 custom pages (Quick Overview, General Dashboard, AT Terminal, Band/Cell Locking, TTL Helper, Speedtest)
**Action:** Audit only. No duplicates removed in this phase.

---

## Per-Page Data Inventory

### Quick Overview (Screensaver + Tab Page)
- Provider / Carrier name
- RAT (Radio Access Technology)
- RSRP, RSRQ, SINR (with color-coded quality)
- Signal grade (weighted 0-100%)
- PCI, Cell ID, ARFCN
- Band label / Carrier aggregation (band pills)
- Temperature (modem)
- Firmware version (tab page only)
- Band change history (tab page only)
- Sparkline chart of signal over time (tab page only)

### General Dashboard
- Device model, Modem name
- Firmware version, IMEI
- Connection status, Provider, RAT
- Current band, Operator mode
- SIM status, Roaming, Packet service
- System uptime, Connection uptime
- APN, WWAN IP
- Current/Max DL/UL rates
- Primary RSRP, RSRQ, SINR, CQI
- PCI, EARFCN, NR PCI, NR ARFCN
- SS-RSRP, SS-RSRQ, SS-SINR (NR-specific)
- Carrier aggregation (band combo)
- Neighboring cells (PCI, ARFCN, RSRP, RSRQ, RAT)
- Temperature (all module probes)
- TAC, MCC/MNC, ECGI/NCGI, eNodeB/gNodeB

### Band/Cell Locking
- Current RAT mode preference
- Current LTE / NSA / SA band settings
- Serving cell (raw QENG output)
- Network info (raw QNWINFO output)
- CA info (raw QCAINFO output)
- Cell lock status (LTE + NR5G)
- Neighbor cell scan results (Type, EARFCN, PCI, Band, RSRP, SINR, SCS)
- Band lock checkboxes (LTE, NSA, SA)
- RAT acquisition order, 5G disable

### AT Terminal
- Command reference table (static, not live data)
- User-submitted AT commands and raw modem responses

### TTL Helper
- TTL override status (active/inactive)
- Configured TTL value
- IPv4/IPv6 rule presence and values
- iptables mangle rules (raw shell output)

### Speedtest
- Download/Upload speeds (Mbps)
- Latency, Jitter, Packet loss
- Server name/location
- Interface, ISP, External IP
- Carrier aggregation band snapshot during test
- Browser-local history of past results

---

## Duplicated Data Items

| Data Item | Quick Overview | General Dashboard | Band/Cell Locking | Notes |
|-----------|:---:|:---:|:---:|-------|
| **RAT / Technology** | Y | Y | Y | QO shows badge, GD shows in status strip, BCL shows mode_pref |
| **Provider / Carrier** | Y | Y | | QO shows colored text, GD shows in status strip |
| **RSRP** | Y | Y | Y (scan) | QO + GD show primary. BCL shows per-cell in scan table |
| **RSRQ** | Y | Y | Y (scan) | Same as RSRP |
| **SINR** | Y | Y | Y (scan) | Same as RSRP |
| **PCI** | Y | Y | Y (scan) | QO + GD show primary. BCL per-cell in scan |
| **ARFCN / EARFCN** | Y | Y | Y (scan) | QO + GD show primary. BCL per-cell in scan |
| **Cell ID** | Y | Y | | QO detail line, GD cell info section |
| **Band / Band Label** | Y | Y | Y | QO pills, GD band field, BCL current state + raw |
| **Carrier Aggregation** | Y | Y | Y (raw) | QO pills, GD parsed list, BCL raw QCAINFO |
| **Firmware Version** | Y | Y | | QO tab page detail, GD module info |
| **Temperature** | Y | Y | | QO screensaver + tab, GD all probes |
| **Serving Cell (QENG)** | | Y (parsed) | Y (raw) | GD parses to fields, BCL shows raw output |
| **Network Info (QNWINFO)** | | Y (parsed) | Y (raw) | GD parses to fields, BCL shows raw output |

---

## Observations

1. **Signal metrics (RSRP/RSRQ/SINR)** are the most widely duplicated, appearing on all three main data pages. Each page presents them differently:
   - QO: color-coded dashboard metric with spectrum bar
   - GD: labeled metric row with signal color
   - BCL: cell scan table column (only for scanned cells, not persistent display)

2. **Carrier aggregation** appears on all three main data pages in different forms:
   - QO: visual band pills with NR/PCC styling
   - GD: parsed band list with details
   - BCL: raw QCAINFO AT response

3. **Serving cell / Network info** is shown parsed on GD and raw on BCL. Both originate from the same AT commands.

4. **Temperature** and **Firmware version** appear on both QO and GD. GD shows all temperature probes while QO shows just the primary reading.

5. **TTL Helper** and **Speedtest** have no overlapping data with other pages (they are utility/tool pages, not status displays).

6. **AT Terminal** is a manual command tool and does not display live data.

---

## Recommendation (deferred)

No duplicates should be removed in this phase. When ready:
- Consider whether BCL's raw QENG/QNWINFO/QCAINFO panels add value beyond GD's parsed versions
- The QO/GD overlap is intentional (QO = at-a-glance, GD = full detail)
- BCL scan results showing RSRP/SINR/PCI is contextually different (per-cell, not primary)
