/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nls } from '../messages';

const PORT_CONFLICT_PATTERNS = [
  /port\s+1717.*already in use/i,
  /port\s+1717.*in use/i,
  /Cannot start the OAuth redirect server on port 1717/i,
  /kill the process running on port 1717/i,
  /EADDRINUSE/i
];

export const isAuthPortConflictError = (errorOutput: string): boolean =>
  PORT_CONFLICT_PATTERNS.some(pattern => pattern.test(errorOutput));

export const extractPortConflictCliMessage = (errorOutput: string): string | undefined => {
  const trimmedOutput = errorOutput.trim();
  const portInUseErrorMatch = trimmedOutput.match(
    /Error \(PortInUseError\):[\s\S]*?OAuthLocalPort in the sfdx-project\.json file\./i
  );
  return portInUseErrorMatch?.[0].trim();
};

export const getPortKillInstructions = (platform = process.platform): string =>
  platform === 'win32'
    ? `${nls.localize('org_login_web_port_conflict_steps_label')}\n1. ${nls.localize(
        'org_login_web_port_conflict_find_process_windows'
      )}\n, 2. ${nls.localize('org_login_web_port_conflict_kill_process_windows')}`
    : `${nls.localize('org_login_web_port_conflict_steps_label')}\n1. ${nls.localize(
        'org_login_web_port_conflict_find_process_unix'
      )}\n, 2. ${nls.localize('org_login_web_port_conflict_kill_process_unix')}`;
