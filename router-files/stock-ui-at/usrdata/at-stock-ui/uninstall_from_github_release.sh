#!/bin/sh

set -eu

REPO_OWNER="${REPO_OWNER:-Joetooley28}"
REPO_NAME="${REPO_NAME:-cfw3212-qtooley-overlay}"
RELEASE_CHANNEL="${RELEASE_CHANNEL:-latest}"
ASSET_PATTERN="${ASSET_PATTERN:-stock-ui-at-installer-.*\\.zip}"
TMP_ROOT="${TMPDIR:-/tmp}/qtooley-github-uninstall.$$"
ARCHIVE_PATH="$TMP_ROOT/release.zip"
EXTRACT_ROOT="$TMP_ROOT/extracted"
UNINSTALL_SCRIPT=""

log() {
    echo "$1"
}

read_yes_no() {
    prompt="$1"
    default_value="$2"

    while true; do
        if [ "$default_value" = "1" ]; then
            suffix="[Y/n]"
        else
            suffix="[y/N]"
        fi

        printf "%s %s " "$prompt" "$suffix" >&2
        IFS= read -r reply || reply=""
        reply="$(printf "%s" "$reply" | tr '[:upper:]' '[:lower:]')"

        case "$reply" in
            "")
                echo "$default_value"
                return 0
                ;;
            y|yes)
                echo "1"
                return 0
                ;;
            n|no)
                echo "0"
                return 0
                ;;
        esac

        echo "Enter y or n." >&2
    done
}

cleanup() {
    rm -rf "$TMP_ROOT"
}

trap cleanup EXIT INT TERM

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

normalize_shell_scripts() {
    root="$1"

    find "$root" -type f -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
}

extract_zip() {
    archive="$1"
    dest="$2"
    unzip_status=0

    if need_cmd unzip; then
        unzip -oq "$archive" -d "$dest" >/dev/null 2>&1 || unzip_status=$?
        case "$unzip_status" in
            0|1)
                return 0
                ;;
        esac
    fi

    if need_cmd busybox; then
        if busybox unzip -oq "$archive" -d "$dest" >/dev/null 2>&1; then
            return 0
        fi
    fi

    if need_cmd bsdtar; then
        bsdtar -xf "$archive" -C "$dest"
        return 0
    fi

    if need_cmd python3; then
        python3 - "$archive" "$dest" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
        return 0
    fi

    if need_cmd python; then
        python - "$archive" "$dest" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
        return 0
    fi

    echo "Unable to extract release ZIP: no unzip-compatible tool is available on the router." >&2
    echo "Use the Windows ZIP uninstall path from a PC, or add unzip/busybox unzip/python to the router environment." >&2
    exit 1
}

find_uninstall_script() {
    find "$EXTRACT_ROOT" -path '*/router-files/stock-ui-at/package/uninstall_stock_ui_release.sh' -print -quit 2>/dev/null || true
}

fetch_text() {
    url="$1"

    if need_cmd curl; then
        curl -fsSL "$url"
        return 0
    fi

    if need_cmd wget; then
        wget -qO- "$url"
        return 0
    fi

    echo "Neither curl nor wget is available." >&2
    exit 1
}

fetch_to_file() {
    url="$1"
    dest="$2"

    if need_cmd curl; then
        curl -fsSL "$url" -o "$dest"
        return 0
    fi

    if need_cmd wget; then
        wget -qO "$dest" "$url"
        return 0
    fi

    echo "Neither curl nor wget is available." >&2
    exit 1
}

resolve_release_url() {
    if [ -n "${RELEASE_URL:-}" ]; then
        echo "$RELEASE_URL"
        return 0
    fi

    if [ -n "${API_RELEASE_URL:-}" ]; then
        api_url="$API_RELEASE_URL"
    elif [ "$RELEASE_CHANNEL" = "latest" ]; then
        api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
    else
        api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$RELEASE_CHANNEL"
    fi

    release_json="$(fetch_text "$api_url")"
    release_url="$(printf '%s\n' "$release_json" | sed -n "s/.*\"browser_download_url\": \"\\([^\"]*stock-ui-at-installer-[^\"]*\\.zip\\)\".*/\\1/p" | head -n 1)"

    if [ -z "$release_url" ]; then
        echo "Unable to locate a release ZIP asset in GitHub release metadata." >&2
        exit 1
    fi

    case "$release_url" in
        *stock-ui-at-installer-*.zip)
            echo "$release_url"
            return 0
            ;;
    esac

    if printf '%s\n' "$release_url" | grep -Eq "$ASSET_PATTERN"; then
        echo "$release_url"
        return 0
    fi

    echo "Release ZIP asset did not match expected naming pattern." >&2
    exit 1
}

mkdir -p "$TMP_ROOT" "$EXTRACT_ROOT"

RELEASE_URL_RESOLVED="$(resolve_release_url)"

log "Downloading Qtooley release ZIP from GitHub..."
fetch_to_file "$RELEASE_URL_RESOLVED" "$ARCHIVE_PATH"
extract_zip "$ARCHIVE_PATH" "$EXTRACT_ROOT"
normalize_shell_scripts "$EXTRACT_ROOT"
UNINSTALL_SCRIPT="$(find_uninstall_script)"

if [ -n "$UNINSTALL_SCRIPT" ] && [ ! -x "$UNINSTALL_SCRIPT" ]; then
    chmod 755 "$UNINSTALL_SCRIPT" 2>/dev/null || true
fi

if [ -z "$UNINSTALL_SCRIPT" ] || [ ! -f "$UNINSTALL_SCRIPT" ]; then
    echo "Downloaded package is missing uninstall script: $UNINSTALL_SCRIPT" >&2
    exit 1
fi

if [ -z "${REMOVE_TAILSCALE+x}" ]; then
    log "Choose uninstall mode:"
    log "- default: remove Qtooley and bundled Ookla, keep Tailscale"
    log "- optional: also remove Tailscale"
    REMOVE_TAILSCALE="$(read_yes_no 'Also remove Tailscale?' 0)"
fi

log "Running packaged Qtooley uninstall..."
REMOVE_TAILSCALE="${REMOVE_TAILSCALE:-0}" \
REMOVE_PAYLOAD="${REMOVE_PAYLOAD:-1}" \
/bin/sh "$UNINSTALL_SCRIPT"

log "Qtooley GitHub uninstall complete."
