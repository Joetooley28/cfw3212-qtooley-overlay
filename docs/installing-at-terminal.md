# How to Install

This note covers the current public install flow for the standalone AT terminal package on the Casa Systems `CFW-3212`.

## Prerequisites

- rooted Casa Systems `CFW-3212`
- Lua working on-box
- SSH access

Optional:
- ADB access

## Files

Install under `/usrdata/at-http/`:

- `config.json`
- `at_backend.lua`
- `at_http.lua`
- `at_lock.lua`
- `at_validate.lua`
- `index.html`
- `app.js`
- `app.css`

Install outside that directory:

- `start-at-http.sh` -> `/usrdata/start-at-http.sh`
- `at-http-start.service` -> `/etc/systemd/system/at-http-start.service`
- `at-http-start.timer` -> `/etc/systemd/system/at-http-start.timer`

## Install Steps

### 1. Copy the app files

Copy the router files into:

- `/usrdata/at-http/`

### 2. Copy the autostart files

Copy:

- `start-at-http.sh` -> `/usrdata/start-at-http.sh`
- `at-http-start.service` -> `/etc/systemd/system/at-http-start.service`
- `at-http-start.timer` -> `/etc/systemd/system/at-http-start.timer`

### 3. Make the start script executable

```sh
chmod +x /usrdata/start-at-http.sh
```

### 4. Reload systemd and enable the timer

```sh
systemctl daemon-reload
systemctl enable --now at-http-start.timer
```

## Verify

Check the listener:

```sh
netstat -tulpn 2>/dev/null | grep 8088
```

Expected:

- `192.168.1.1:8088`

Check the timer and service:

```sh
systemctl status at-http-start.timer 2>/dev/null | sed -n '1,20p'
systemctl status at-http-start.service 2>/dev/null | sed -n '1,20p'
```

Open in browser:

- `http://192.168.1.1:8088/`

## Manual Start and Stop

Manual start:

```sh
cd /usrdata/at-http
lua /usrdata/at-http/at_http.lua /usrdata/at-http/config.json
```

Manual stop:

```sh
ps | grep '[l]ua /usrdata/at-http/at_http.lua'
kill <PID>
rm -f /tmp/at-http.lock
```

## Rollback

Disable the timer:

```sh
systemctl disable --now at-http-start.timer
```

Kill the running AT terminal if needed:

```sh
ps | grep '[l]ua /usrdata/at-http/at_http.lua'
kill <PID>
rm -f /tmp/at-http.lock
```

Remove files if desired:

- `/usrdata/at-http/*`
- `/usrdata/start-at-http.sh`
- `/etc/systemd/system/at-http-start.service`
- `/etc/systemd/system/at-http-start.timer`
