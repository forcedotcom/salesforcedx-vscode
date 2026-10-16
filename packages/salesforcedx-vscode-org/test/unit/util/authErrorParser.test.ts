/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getPortKillInstructions, isAuthPortConflictError } from '../../../src/util/authErrorParser';

describe('authErrorParser', () => {
  it('detects the CLI message about killing process on port 1717', () => {
    const cliError = 'Kill the process running on port 1717 and rerun this command.';
    expect(isAuthPortConflictError(cliError)).toBe(true);
  });

  it('detects port already in use errors for 1717', () => {
    const cliError = 'Error: listen EADDRINUSE: address already in use 127.0.0.1:1717';
    expect(isAuthPortConflictError(cliError)).toBe(true);
  });

  it('does not flag unrelated auth failures as port conflict', () => {
    const cliError = 'Error authenticating with org: invalid_grant';
    expect(isAuthPortConflictError(cliError)).toBe(false);
  });

  it('returns platform-specific port kill instructions', () => {
    expect(getPortKillInstructions('darwin')).toBe(
      'Try this:\n1. Find process: lsof -i :1717\n, 2. Kill process: kill -9 <PID>'
    );
    expect(getPortKillInstructions('win32')).toBe(
      'Try this:\n1. Find process: netstat -ano | findstr :1717\n, 2. Kill process: taskkill /PID <PID> /F'
    );
  });
});
