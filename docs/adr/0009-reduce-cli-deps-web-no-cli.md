# Prefer in-process libs over CLI; web extensions must avoid the CLI entirely

The general preference is fewer `sf`/`sfdx` shell-outs — use in-process libraries/services instead. For web this is a hard requirement: there is no CLI in the browser, so any web-enabled extension must not shell out (the services `terminalService` fails on web — `ESBUILD_PLATFORM === 'web'`). Known-never-web, desktop-only features (e.g. the org extension) may still use the CLI; do not force CLI removal on desktop-only code.
