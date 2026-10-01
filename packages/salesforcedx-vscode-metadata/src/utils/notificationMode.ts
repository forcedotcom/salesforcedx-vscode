/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type pkg from '../../package.json';

type CommandNotificationKey =
  keyof (typeof pkg)['contributes']['configuration']['properties']['salesforcedx-vscode-metadata.commandLevelNotifications']['properties'];

export type ProgressOnlyCommandKey = 'SFDX: Diff Source Against Org';

export type ProgressAndSuccessCommandKey = Exclude<CommandNotificationKey, ProgressOnlyCommandKey>;

export type CommandKey = ProgressAndSuccessCommandKey | ProgressOnlyCommandKey;
