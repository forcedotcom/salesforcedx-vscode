/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';

/** Localized by the provider; no import of the transitional V3 extension. */
export class TemplateMessages extends Context.Service<
  TemplateMessages,
  {
    readonly extensionUnavailable: string;
    readonly manifestLoadFailed: (cause: string) => string;
    readonly manifestParseFailed: string;
    readonly fileCopyFailed: (path: string, cause: string) => string;
    readonly missingSourceApiVersion: string;
  }
>()('@salesforce/vscode-services/internal/TemplateMessages') {}
