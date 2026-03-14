# Validator Policy

## Current Model

The current validator is no longer a narrow exact-command allowlist.

Instead, it uses:

- broad single-line AT command acceptance
- explicit blocking of a small set of disruptive commands
- special handling for protected `QCFG` items

## Still Blocked

- `AT+QPOWD`
- `AT&F`
- `AT&W`
- `AT+CFUN=1,1`

Also blocked:

- more than one command in a single send
- semicolon chaining such as `AT;ATI`
- multiline input
- shell-like metacharacter junk that is not valid AT usage

## Protected QCFG Items

These query forms are allowed:

- `AT+QCFG="usbnet"`
- `AT+QCFG="data_interface"`
- `AT+QCFG="pcie/mode"`
- `AT+QCFG="usbspeed"`

Write forms for those same items remain blocked.

Examples:

- allowed:
  - `AT+QCFG="usbnet"`
- blocked:
  - `AT+QCFG="usbnet",1`

## Goal

The validator is meant to keep the browser terminal useful for real modem administration while still blocking the small set of commands most likely to disrupt access or cause an avoidable reboot/power event.

Practical note:

- band-setting commands such as `AT+QNWPREFCFG=...` are allowed
- send one AT command at a time
- if a request gets blocked while testing band commands, the most likely cause is multiple commands in one send, semicolon chaining, or another formatting issue, not the band command family itself
