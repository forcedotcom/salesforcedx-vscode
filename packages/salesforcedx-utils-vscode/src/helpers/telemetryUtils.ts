/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';

/**
 * No-op: production sender uses frozen send-time identity, nothing cached to refresh.
 * Kept for the workspace-context refresh call site.
 */
export const updateUserIDOnTelemetryReporters = async (_coreExtensionContext: ExtensionContext): Promise<void> => {};
