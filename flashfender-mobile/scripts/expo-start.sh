#!/usr/bin/env bash
# Start Expo Go, neutralizing a known Linux RN DevTools chrome-sandbox FATAL
# that otherwise aborts Metro under ~/.cache/dotslash/.../chrome-sandbox.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

disable_broken_chrome_sandbox() {
  local base="${HOME}/.cache/dotslash"
  [[ -d "$base" ]] || return 0
  # Find chrome-sandbox binaries that are not root-owned setuid (broken on this host).
  while IFS= read -r -d '' sandbox; do
    local dir
    dir="$(dirname "$sandbox")"
    chmod u+w "$dir" "$sandbox" 2>/dev/null || true
    if [[ -f "$sandbox" ]]; then
      mv "$sandbox" "${sandbox}.disabled" 2>/dev/null \
        || echo "warn: could not disable $sandbox (Metro may abort on DevTools)" >&2
    fi
  done < <(find "$base" -name 'chrome-sandbox' -type f -print0 2>/dev/null || true)
}

disable_broken_chrome_sandbox

# Prefer no-sandbox if Chromium DevTools still launches (AppArmor / userns).
export ELECTRON_DISABLE_SANDBOX="${ELECTRON_DISABLE_SANDBOX:-1}"
export CHROME_DEVEL_SANDBOX="${CHROME_DEVEL_SANDBOX:-}"

exec npx expo start --go "$@"
