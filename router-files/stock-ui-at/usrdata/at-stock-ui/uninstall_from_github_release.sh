#!/bin/sh

set -eu

REPO_OWNER="${REPO_OWNER:-Joetooley28}"
REPO_NAME="${REPO_NAME:-cfw3212-qtooley-overlay}"
RELEASE_CHANNEL="${RELEASE_CHANNEL:-latest}"
ASSET_NAME="${ASSET_NAME:-stock-ui-at-router-package-latest.tar.gz}"
SHA256_ASSET_NAME="${SHA256_ASSET_NAME:-stock-ui-at-router-package-latest.sha256}"
TMP_ROOT="${TMPDIR:-/tmp}/qtooley-github-uninstall.$$"
ARCHIVE_PATH="$TMP_ROOT/$ASSET_NAME"
SHA256_PATH="$TMP_ROOT/$SHA256_ASSET_NAME"
EXTRACT_ROOT="$TMP_ROOT/extracted"
PACKAGE_ROOT="$EXTRACT_ROOT/stock-ui-at"
UNINSTALL_SCRIPT="$PACKAGE_ROOT/package/uninstall_stock_ui_release.sh"

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

verify_archive_if_possible() {
    checksum_url="$1"

    if ! fetch_to_file "$checksum_url" "$SHA256_PATH"; then
        log "Checksum download failed; continuing without checksum verification."
        return 0
    fi

    if ! need_cmd sha256sum; then
        log "sha256sum is not available; continuing without checksum verification."
        return 0
    fi

    expected_hash="$(awk 'NR==1 {print $1}' "$SHA256_PATH")"
    if [ -z "$expected_hash" ]; then
        echo "Checksum file did not contain a SHA256 hash." >&2
        exit 1
    fi

    actual_hash="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
    if [ "$actual_hash" != "$expected_hash" ]; then
        echo "SHA256 verification failed for downloaded release package." >&2
        exit 1
    fi

    log "Release package SHA256 verified."
}

resolve_release_url() {
    if [ -n "${RELEASE_URL:-}" ]; then
        echo "$RELEASE_URL"
        return 0
    fi

    if [ "$RELEASE_CHANNEL" = "latest" ]; then
        echo "https://github.com/$REPO_OWNER/$REPO_NAME/releases/latest/download/$ASSET_NAME"
        return 0
    fi

    echo "https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$RELEASE_CHANNEL/$ASSET_NAME"
}

resolve_checksum_url() {
    if [ -n "${SHA256_URL:-}" ]; then
        echo "$SHA256_URL"
        return 0
    fi

    if [ "$RELEASE_CHANNEL" = "latest" ]; then
        echo "https://github.com/$REPO_OWNER/$REPO_NAME/releases/latest/download/$SHA256_ASSET_NAME"
        return 0
    fi

    echo "https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$RELEASE_CHANNEL/$SHA256_ASSET_NAME"
}

if ! need_cmd tar; then
    echo "tar is required for GitHub release uninstall." >&2
    exit 1
fi

mkdir -p "$TMP_ROOT" "$EXTRACT_ROOT"

RELEASE_URL_RESOLVED="$(resolve_release_url)"
SHA256_URL_RESOLVED="$(resolve_checksum_url)"

log "Downloading Qtooley release package from GitHub..."
fetch_to_file "$RELEASE_URL_RESOLVED" "$ARCHIVE_PATH"
verify_archive_if_possible "$SHA256_URL_RESOLVED"

tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_ROOT"

if [ ! -x "$UNINSTALL_SCRIPT" ]; then
    chmod 755 "$UNINSTALL_SCRIPT" 2>/dev/null || true
fi

if [ ! -f "$UNINSTALL_SCRIPT" ]; then
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
