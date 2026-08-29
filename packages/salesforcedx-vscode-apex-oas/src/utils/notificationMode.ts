/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type pkg from '../../package.json';

type CommandNotificationKey =
  keyof (typeof pkg)['contributes']['configuration']['properties']['salesforcedx-vscode-apex-oas.commandLevelNotifications']['properties'];

export type SuccessOnlyCommandKey = 'SFDX: Validate OpenAPI Document';

export type ProgressAndSuccessCommandKey = Exclude<CommandNotificationKey, SuccessOnlyCommandKey>;
