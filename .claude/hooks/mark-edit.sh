#!/usr/bin/env bash
# PostToolUse / afterFileEdit hook: mark that an edit occurred in this session.
SESSION_ID="${CURSOR_TRACE_ID:-$CLAUDE_CONVERSATION_ID}"
TOOL="${CURSOR_TRACE_ID:+cursor}${CURSOR_TRACE_ID:-claude}"
if [ -n "$SESSION_ID" ]; then
  touch "/tmp/${TOOL}_edit_${SESSION_ID}"
fi
exit 0
