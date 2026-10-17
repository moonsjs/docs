#!/usr/bin/env bash
# Lighthouse CI runner.
#
# Two environment quirks are handled here:
# - Chrome discovery: use Playwright's Chromium when CHROME_PATH is unset.
# - WSL: chrome-launcher renders the profile path in Windows form, which a
#   Linux Chrome interprets as a relative path and creates a stray
#   "C:\Users\..." folder in the current directory. Clean it after the run.
set -u

if [ -z "${CHROME_PATH:-}" ]; then
  CHROME_PATH="$(find "$HOME/.cache/ms-playwright" -maxdepth 4 -type f -name chrome 2>/dev/null | head -1)"
  export CHROME_PATH
fi
export TMPDIR=/tmp

lhci autorun
status=$?
rm -rf -- C:*
exit "$status"
