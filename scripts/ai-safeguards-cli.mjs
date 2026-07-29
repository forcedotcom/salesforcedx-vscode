#!/usr/bin/env node
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  commandDenial,
  formatCompletionFailure,
  formatEditFailure,
  verifyCompletion,
  verifyEdit
} from './ai-safeguards.mjs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const action = process.argv[2];
const root = process.env.CURSOR_PROJECT_DIR ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const deny = reason =>
  reason &&
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason
      }
    })
  );

if (action === 'block-no-verify' || action === 'block-push-no-deps') {
  deny(
    commandDenial(
      {
        command: input.tool_input?.command ?? input.command ?? '',
        cwd: input.cwd ?? process.cwd()
      },
      action === 'block-no-verify' ? 'no-verify' : 'push-dependencies'
    )
  );
} else if (action === 'verify-edit') {
  const result = verifyEdit({ root, files: [input.tool_input?.file_path].filter(Boolean) });
  const message = formatEditFailure(result);
  if (message) console.log(JSON.stringify({ followup_message: message }));
} else if (action === 'verify-stop') {
  if (input.stop_hook_active === true) process.exit(0);
  const marker = resolve(root, '.claude/.edit-marker');
  try {
    rmSync(marker);
  } catch (error) {
    if (error?.code === 'ENOENT') process.exit(0);
    throw error;
  }
  const result = verifyCompletion({ root });
  const reason = formatCompletionFailure(result);
  if (reason) console.log(JSON.stringify({ decision: 'block', reason }));
} else {
  throw new Error(`Unsupported safeguard action: ${action}`);
}
