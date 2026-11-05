#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${WEB_VNC_PASSWORD:-}" ]]; then
  echo "WEB_VNC_PASSWORD must be configured to expose the interactive browser." >&2
  exit 1
fi
if [[ "${#WEB_VNC_PASSWORD}" -lt 8 ]]; then
  echo "WEB_VNC_PASSWORD must contain at least 8 characters." >&2
  exit 1
fi

export DISPLAY="${DISPLAY:-:99}"
umask 077
VNC_AUTH_FILE="$(mktemp /tmp/moya-vnc-auth.XXXXXXXX)"

cleanup() {
  rm -f "$VNC_AUTH_FILE"
}
trap cleanup EXIT

# One display is shared by the API-managed Playwright sessions.
Xvfb "$DISPLAY" -screen 0 1600x1000x24 -nolisten tcp -ac &
XVFB_PID=$!
sleep 1
if ! kill -0 "$XVFB_PID" 2>/dev/null; then
  echo "Xvfb failed to start." >&2
  exit 1
fi
fluxbox >/tmp/moya-fluxbox.log 2>&1 &

# RFB auth stays inside the container. The only published port is
# the localhost-bound noVNC websocket endpoint (defined in Compose).
x11vnc -storepasswd "$WEB_VNC_PASSWORD" "$VNC_AUTH_FILE" >/dev/null 2>&1
unset WEB_VNC_PASSWORD
x11vnc -display "$DISPLAY" -localhost -rfbauth "$VNC_AUTH_FILE" \
  -forever -shared -noxdamage -quiet >/tmp/moya-x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc 0.0.0.0:6080 localhost:5900 \
  >/tmp/moya-websockify.log 2>&1 &

exec "$@"
