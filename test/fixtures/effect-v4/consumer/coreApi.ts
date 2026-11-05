/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeCoreApi } from '../../../../packages/salesforcedx-vscode-core/out/src/index.js';
import type { ExtensionContext } from 'vscode';

// Compile actual public declarations against the production IAC call pattern.
export const useCoreLikeIac = async (
  api: SalesforceVSCodeCoreApi,
  context: ExtensionContext,
  username: string
): Promise<void> => {
  api.services.ChannelService.getInstance('IAC');
  const workspace = api.services.WorkspaceContext.getInstance(false);
  api.services.CommandEventDispatcher.getInstance();
  const telemetry = api.services.TelemetryService.getInstance('IAC');
  await telemetry.initializeService(context);
  await workspace.getConnection();
  await api.workspaceContextUtils.getOrgShape(username);
};
