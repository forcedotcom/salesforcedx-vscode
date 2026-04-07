#!/usr/bin/env bash
set -euo pipefail

# Poll until the Jorje LSP Java process is gone. 100ms between iterations.
#
# 1) Prefer /usr/bin/pgrep: matches full argv from the kernel (no ps column /
#    tty width issues).
# 2) Use /usr/bin/ps and /usr/bin/grep explicitly so Homebrew coreutils does
#    not swap in GNU ps(1), which does not understand BSD `ps auxww` the same
#    way and can make `ps | grep` look empty even when `ps -ef` works in the
#    same shell.
# 3) `if ! …` keeps failed grep/pgrep (no match) safe under `set -e` + `pipefail`.

needle='apex.jorje.lsp.ApexLanguageServerLauncher'

pgrep_bin=''
for candidate in /usr/bin/pgrep /bin/pgrep; do
  if [[ -x "$candidate" ]]; then
    pgrep_bin=$candidate
    break
  fi
done

while true; do
  if [[ -n "$pgrep_bin" ]]; then
    if ! "$pgrep_bin" -fq "$needle" 2>/dev/null; then
      break
    fi
    "$pgrep_bin" -fl "$needle" 2>/dev/null || true
  else
    if ! /usr/bin/ps -efww 2>/dev/null | /usr/bin/grep -Fq -- "$needle"; then
      break
    fi
    /usr/bin/ps -efww 2>/dev/null | /usr/bin/grep -F -- "$needle" | /usr/bin/grep -Fv grep || true
  fi
  sleep 0.5
done

printf '%s\n' 'ApexLanguageServerLauncher process no longer running.' >&2
