#!/usr/bin/env bash
# afterFileEdit hook: mark that an edit occurred in this session.

ROOT=$(git rev-parse --show-toplevel)
touch "$ROOT/.claude/.edit-marker"
echo "[afterFileEdit] marked session as dirty" >&2
exit 0
