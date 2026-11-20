/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as Schema from 'effect/Schema';
import { getExtensionExports } from './extensionExports';

export const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';

/** Activates the New Apex LS and returns the consumer's validated API surface. */
export const getApexLanguageServerExports = <S extends Schema.Schema.AnyNoContext>(schema: S) =>
  getExtensionExports({ extId: APEX_LANGUAGE_SERVER_EXTENSION_ID, schema });
