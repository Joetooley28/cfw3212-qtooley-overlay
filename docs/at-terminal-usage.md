# AT Terminal Usage

## Browser UI

Open:

- `http://192.168.1.1:8088/`

## Current UI Features

- single command input
- Send button
- Clear button
- Copy All buttons above and below history
- dark mode toggle
- append-only session history

## Startup Model

The AT terminal can be started manually, and the current package also includes a late boot systemd timer that starts it about 2 minutes after boot.

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

## Current Backend

Default backend:

- `smd7_direct`

The backend talks to the modem through the platform-native AT path directly.
