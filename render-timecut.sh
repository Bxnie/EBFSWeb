#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_FPS=30
CYCLE_LENGTH=71.5
DEFAULT_CYCLES=1
DEFAULT_SPEED=1
DEFAULT_PORT_START=3001
DEFAULT_VIEWPORT="1080,1080"
viewport=""
CHROMIUM_PATH="/usr/bin/chromium"

fps="$DEFAULT_FPS"
cycles="$DEFAULT_CYCLES"
speed="$DEFAULT_SPEED"
frames=""
port=""
output=""
open_output="false"

usage() {
  cat <<'EOF'
Usage: ./render-timecut.sh [options]

Options:
  --frames N      Render the first N frames instead of the full loop.
  --fps N         Final output fps. Default: 30.
  --cycle N       Number of 71.5s cycles to render. Default: 1.
  --speed N       Query-string speed passed to the page. Default: 1.
  --port N        Local HTTP port. Default: first free port from 3001.
  --output PATH   Output file path. Default full render: ./eb-loop.mp4.
                  Default sample render: /tmp/opencode/eb-<frames>frames-speed<N>.mp4.
  --viewport W,H  Browser viewport size. Default: 1080,1080.
  --open          Open the output file when done.
  -h, --help      Show this help.

Examples:
  ./render-timecut.sh
  ./render-timecut.sh --frames 200 --open
  ./render-timecut.sh --frames 100 --output /tmp/opencode/sample.mp4
  ./render-timecut.sh --viewport 1920,1080 --cycle 2
EOF
}

require_arg() {
  if [[ $# -lt 2 || -z ${2:-} ]]; then
    printf 'Missing value for %s\n' "$1" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frames)
      require_arg "$@"
      frames="$2"
      shift 2
      ;;
    --fps)
      require_arg "$@"
      fps="$2"
      shift 2
      ;;
    --cycle)
      require_arg "$@"
      cycles="$2"
      shift 2
      ;;
    --speed)
      require_arg "$@"
      speed="$2"
      shift 2
      ;;
    --port)
      require_arg "$@"
      port="$2"
      shift 2
      ;;
    --output)
      require_arg "$@"
      output="$2"
      shift 2
      ;;
    --viewport)
      require_arg "$@"
      viewport="$2"
      shift 2
      ;;
    --open)
      open_output="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v timecut >/dev/null 2>&1; then
  printf 'timecut is not installed or not on PATH.\n' >&2
  exit 1
fi

if [[ ! -x "$CHROMIUM_PATH" ]]; then
  printf 'Chromium not found at %s\n' "$CHROMIUM_PATH" >&2
  exit 1
fi

duration="$(python3 - "$cycles" "$CYCLE_LENGTH" <<'PY'
import sys
cycles = float(sys.argv[1])
cycle_length = float(sys.argv[2])
print(f"{cycles * cycle_length:.6f}")
PY
)"

python3 - "$fps" "$duration" "$speed" "$frames" <<'PY'
import sys

fps = float(sys.argv[1])
duration = float(sys.argv[2])
speed = float(sys.argv[3])
frames = sys.argv[4]

if fps <= 0:
    raise SystemExit("--fps must be greater than 0")
if duration <= 0:
    raise SystemExit("--cycle must be greater than 0")
if speed <= 0:
    raise SystemExit("--speed must be greater than 0")
if frames:
    if int(frames) <= 0:
        raise SystemExit("--frames must be greater than 0")
PY

if [[ -n "$frames" ]]; then
  duration="$(python3 - "$frames" "$fps" <<'PY'
import sys
frames = int(sys.argv[1])
fps = float(sys.argv[2])
print(f"{(frames + 0.2) / fps:.6f}")
PY
)"
fi

if [[ -z "$port" ]]; then
  port="$(python3 - "$DEFAULT_PORT_START" <<'PY'
import socket
import sys

start = int(sys.argv[1])
for port in range(start, start + 100):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        raise SystemExit(0)
raise SystemExit("No free port found")
PY
)"
fi

if [[ -z "$output" ]]; then
  if [[ -n "$frames" ]]; then
    safe_speed="${speed//./p}"
    output="/tmp/opencode/eb-${frames}frames-speed${safe_speed}.mp4"
  else
    output="$SITE_DIR/eb-loop.mp4"
  fi
elif [[ "$output" != /* ]]; then
  output="$SITE_DIR/$output"
fi

mkdir -p -- "$(dirname -- "$output")"

url="http://localhost:${port}?speed=${speed}&duration=${duration}"
server_log="$(mktemp /tmp/opencode/render-timecut-server.XXXXXX.log)"
timecut_log="$(mktemp /tmp/opencode/render-timecut.XXXXXX.log)"
progress_pipe="$(mktemp -u /tmp/opencode/render-timecut.XXXXXX.pipe)"
mkfifo "$progress_pipe"

server_pid=""
timecut_pid=""

cleanup() {
  local status=$?
  set +e
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f -- "$progress_pipe" "$server_log" "$timecut_log"
  tput cnorm 2>/dev/null || true
  return "$status"
}
trap cleanup EXIT

format_seconds() {
  python3 - "$1" <<'PY'
import sys

seconds = max(0, int(round(float(sys.argv[1]))))
minutes, seconds = divmod(seconds, 60)
hours, minutes = divmod(minutes, 60)
if hours:
    print(f"{hours:d}:{minutes:02d}:{seconds:02d}")
else:
    print(f"{minutes:02d}:{seconds:02d}")
PY
}

progress_bar() {
  local current="$1" total="$2"
  local width=32 filled=0 percent_tenths=0

  if (( total > 0 )); then
    filled=$(( current * width / total ))
    percent_tenths=$(( current * 1000 / total ))
  fi
  (( filled > width )) && filled=$width
  local empty=$(( width - filled ))

  local bar="" i
  for (( i = 0; i < filled; i++ )); do bar+="▓"; done
  for (( i = 0; i < empty;  i++ )); do bar+="░"; done
  printf '%s  %3d.%d%%' "$bar" "$(( percent_tenths / 10 ))" "$(( percent_tenths % 10 ))"
}

render_ui() {
  local phase="$1" current="$2" total="$3" started_at="$4"

  local now elapsed eta
  now="$(date +%s)"
  elapsed=$(( now - started_at ))
  eta=0
  if (( current > 0 && current < total )); then
    eta=$(( elapsed * (total - current) / current ))
  fi

  local elapsed_h eta_h
  elapsed_h="$(format_seconds "$elapsed")"
  eta_h="$(format_seconds "$eta")"

  printf '\033[1A\r\033[2K  \033[1m\033[36m%-10s\033[0m  \033[32m%s\033[0m  \033[2m%s/%s  %s → %s\033[0m\n' \
    "$phase" \
    "$(progress_bar "$current" "$total")" \
    "$current" "$total" \
    "$elapsed_h" "$eta_h"
}

total_frames="$(python3 - "$frames" "$duration" "$fps" <<'PY'
import sys

frames = sys.argv[1]
duration = float(sys.argv[2])
fps = float(sys.argv[3])
if frames:
    print(int(frames))
else:
    print(int(round(duration * fps)))
PY
)"

python3 -m http.server "$port" --directory "$SITE_DIR" >"$server_log" 2>&1 &
server_pid="$!"
sleep 1

if ! kill -0 "$server_pid" 2>/dev/null; then
  printf 'Failed to start local HTTP server on port %s\n' "$port" >&2
  cat "$server_log" >&2
  exit 1
fi

tput civis 2>/dev/null || true
printf '\n'

{
  timecut "$url" \
    --viewport="${viewport:-$DEFAULT_VIEWPORT}" \
    --fps="$fps" \
    --duration="$duration" \
    --threads=8 \
    --screenshot-type=png \
    --output-options="-preset slow -crf 18" \
    --executable-path="$CHROMIUM_PATH" \
    --launch-arguments="--no-sandbox --disable-dev-shm-usage" \
    --output="$output"
} >"$progress_pipe" 2>&1 &
timecut_pid="$!"

phase="Starting"
current=0
frames_done=0
started_at="$(date +%s)"
render_ui "$phase" "$current" "$total_frames" "$started_at"

while IFS= read -r line; do
  printf '%s\n' "$line" >>"$timecut_log"

  if [[ "$line" =~ Capturing\ Frame\ ([0-9]+) ]]; then
    phase="Capturing"
    frames_done=$(( frames_done + 1 ))
    current="$frames_done"
    render_ui "$phase" "$current" "$total_frames" "$started_at"
    continue
  fi

  if [[ "$line" == "Page loaded" && "$current" -eq 0 ]]; then
    render_ui "Loading" "$current" "$total_frames" "$started_at"
    continue
  fi

  if [[ "$line" =~ ^Elapsed\ capture\ time: ]]; then
    phase="Encoding"
    current=0
    started_at="$(date +%s)"
    render_ui "$phase" "$current" "$total_frames" "$started_at"
    continue
  fi

  if [[ "$line" =~ frame=[[:space:]]*([0-9]+) ]]; then
    phase="Encoding"
    current="${BASH_REMATCH[1]}"
    render_ui "$phase" "$current" "$total_frames" "$started_at"
    continue
  fi
done <"$progress_pipe"

wait "$timecut_pid"

render_ui "Done" "$total_frames" "$total_frames" "$started_at"
printf '  \033[2mSaved  %s\033[0m\n\n' "$output"

if [[ "$open_output" == "true" ]]; then
  xdg-open "$output" >/dev/null 2>&1 || true
fi
