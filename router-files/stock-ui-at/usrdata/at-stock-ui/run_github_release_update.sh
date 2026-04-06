#!/bin/sh

set -eu

STATE_FILE="/tmp/qtooley-release-update-state.json"
PID_FILE="/tmp/qtooley-release-update.pid"
LOG_FILE="/tmp/qtooley-release-update.log"
RUNNER_PATH="/usrdata/at-stock-ui/update_from_github_release.sh"

json_escape() {
    printf '%s' "${1:-}" | sed ':a;N;$!ba;s/\\/\\\\/g;s/"/\\"/g;s/\r//g;s/\n/\\n/g'
}

utc_now() {
    date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date
}

read_pid() {
    if [ -f "$PID_FILE" ]; then
        tr -cd '0-9' < "$PID_FILE"
    fi
}

is_running() {
    pid="$(read_pid || true)"
    [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null
}

write_state() {
    status="$1"
    phase="$2"
    message="$3"
    pid="$(read_pid || true)"

    if [ -n "${pid:-}" ]; then
        pid_json="$pid"
    else
        pid_json="null"
    fi

    cat > "$STATE_FILE" <<EOF
{"ok":true,"status":"$(json_escape "$status")","phase":"$(json_escape "$phase")","status_text":"$(json_escape "$message")","updated_at":"$(json_escape "$(utc_now)")","log_path":"$(json_escape "$LOG_FILE")","pid":$pid_json}
EOF
}

start_runner() {
    if is_running; then
        echo "already_running"
        exit 0
    fi

    write_state "starting" "queued" "Preparing Qtooley update from GitHub."

    if command -v systemd-run >/dev/null 2>&1; then
        if systemd-run --quiet --collect --unit=qtooley-release-update /bin/sh "$0" --run >/dev/null 2>&1; then
            echo "started"
            exit 0
        fi
    fi

    nohup /bin/sh "$0" --run >/dev/null 2>&1 &
    echo "started"
}

run_runner() {
    completed="0"

    finalize_interrupted() {
        if [ "$completed" = "1" ]; then
            return 0
        fi

        last_line="$(tail -n 1 "$LOG_FILE" 2>/dev/null || true)"
        if [ -z "$last_line" ]; then
            last_line="Qtooley update was interrupted before it reported a final result."
        fi
        write_state "error" "finished" "$last_line"
        rm -f "$PID_FILE"
    }

    trap finalize_interrupted EXIT HUP INT TERM

    echo "$$" > "$PID_FILE"
    write_state "running" "running" "Downloading and installing the latest Qtooley release from GitHub."

    if /bin/sh "$RUNNER_PATH" > "$LOG_FILE" 2>&1; then
        completed="1"
        write_state "success" "finished" "Qtooley update completed. Give the web UI a moment to come back, then reload this page."
        rm -f "$PID_FILE"
        exit 0
    fi

    completed="1"
    last_line="$(tail -n 1 "$LOG_FILE" 2>/dev/null || true)"
    if [ -z "$last_line" ]; then
        last_line="Qtooley update failed. Check the router update log for more detail."
    fi
    write_state "error" "finished" "$last_line"
    rm -f "$PID_FILE"
    exit 1
}

case "${1:-}" in
    --start)
        start_runner
        ;;
    --run)
        run_runner
        ;;
    *)
        echo "Usage: $0 --start|--run" >&2
        exit 1
        ;;
esac
