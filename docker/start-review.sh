#!/usr/bin/env bash
# Xvfb → Fluxbox → x11vnc → websockify → noVNC
set -Eeuo pipefail

export DISPLAY="${DISPLAY:-:99}"
umask 077

VNC_AUTH_FILE=""

# @description Validates the password required for VNC access.
# @exitcode 0 Password is configured and valid.
# @exitcode 1 Password is missing or shorter than 8 characters.
validate_config() {
  if [[ -z "${WEB_VNC_PASSWORD:-}" ]]; then
    echo "WEB_VNC_PASSWORD must be configured to expose the interactive browser." >&2
    return 1
  fi

  if [[ "${#WEB_VNC_PASSWORD}" -lt 8 ]]; then
    echo "WEB_VNC_PASSWORD must contain at least 8 characters." >&2
    return 1
  fi
}

# @description Removes the temporary VNC authentication file on exit.
cleanup() {
  if [[ -n "$VNC_AUTH_FILE" ]]; then
    rm -f "$VNC_AUTH_FILE"
  fi
}

# @description Creates the temporary VNC authentication file and registers cleanup.
init_vnc_auth() {
  VNC_AUTH_FILE="$(mktemp /tmp/moya-vnc-auth.XXXXXXXX)"
  trap cleanup EXIT
}

# @description Starts the shared virtual X display used by Playwright sessions.
# @exitcode 0 Xvfb started successfully.
# @exitcode 1 Xvfb failed to start.
start_xvfb() {
  local display_number="${DISPLAY#:}"
  display_number="${display_number%%.*}"
  local lock_file="/tmp/.X${display_number}-lock"
  if [[ -f "$lock_file" ]]; then
    local previous_pid
    previous_pid="$(tr -d '[:space:]' < "$lock_file")"
    if [[ "$previous_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$previous_pid" 2>/dev/null; then
      rm -f "$lock_file" "/tmp/.X11-unix/X${display_number}"
    fi
  fi
  Xvfb "$DISPLAY" -screen 0 1600x1000x24 -nolisten tcp -ac &
  local pid=$!

  sleep 1

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Xvfb failed to start." >&2
    return 1
  fi
}

# @description Starts the Fluxbox window manager.
start_fluxbox() {
  fluxbox >/tmp/moya-fluxbox.log 2>&1 &
}

# @description Creates the VNC password file and starts the localhost-bound VNC server.
# @exitcode 0 VNC server launch was initiated.
# @exitcode 1 Password file creation failed.
start_x11vnc() {
  # RFB authentication stays inside the container.
  # The Node RFB adapter authenticates to x11vnc using this server-side secret.
  x11vnc -storepasswd "$WEB_VNC_PASSWORD" "$VNC_AUTH_FILE" \
    >/dev/null 2>&1

  x11vnc -display "$DISPLAY" -localhost -rfbauth "$VNC_AUTH_FILE" \
    -forever -shared -noxdamage -quiet -noprimary \
    >/tmp/moya-x11vnc.log 2>&1 &
}

# @description Starts the noVNC WebSocket proxy.
# @description The published endpoint is restricted by Compose configuration.
start_websockify() {
  websockify --web=/usr/share/novnc 127.0.0.1:6080 localhost:5901 \
    >/tmp/moya-websockify.log 2>&1 &
}

# @description Initializes and starts the browser display and VNC services.
# @arg $@ Command and arguments to execute after initialization.
main() {
  validate_config
  init_vnc_auth

  start_xvfb
  start_fluxbox
  start_x11vnc
  start_websockify

  exec "$@"
}

main "$@"