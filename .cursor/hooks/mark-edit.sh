#!/usr/bin/env bash
# afterFileEdit hook: mark that an edit occurred in this session.
# We use CURSOR_TRACE_ID to distinguish sessions.

if [ -n "$CURSOR_TRACE_ID" ]; then
  touch "/tmp/cursor_edit_${CURSOR_TRACE_ID}"
  echo "[afterFileEdit] marked session ${CURSOR_TRACE_ID} as dirty" >&2
fi
exit 0
