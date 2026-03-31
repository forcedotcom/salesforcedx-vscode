#!/usr/bin/env bash
# PostToolUse hook: mark that an edit occurred in this session.
# We use CLAUDE_CONVERSATION_ID to distinguish sessions.

if [ -n "$CLAUDE_CONVERSATION_ID" ]; then
  touch "/tmp/claude_edit_${CLAUDE_CONVERSATION_ID}"
  echo "[afterFileEdit] marked session ${CLAUDE_CONVERSATION_ID} as dirty" >&2
fi
exit 0
