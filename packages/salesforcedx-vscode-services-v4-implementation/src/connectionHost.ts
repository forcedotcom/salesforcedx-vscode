/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgId } from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import type { ExtensionContext } from 'vscode';

/** Services-extension state and localized messages, supplied by its activation owner. */
export class ConnectionHost extends Context.Service<
  ConnectionHost,
  {
    readonly globalState: ExtensionContext['globalState'];
    readonly messages: {
      readonly expired: string;
      readonly expiredDetail: string;
      readonly login: string;
      readonly refreshFailed: string;
      readonly orgChanged: (orgId: OrgId) => string;
    };
  }
>()('@salesforce/vscode-services-v4-implementation/ConnectionHost') {}
