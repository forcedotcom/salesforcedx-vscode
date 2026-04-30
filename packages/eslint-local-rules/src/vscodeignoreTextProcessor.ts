/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Linter } from 'eslint';

const pluginMeta = {
  name: 'eslint-plugin-vscode-extensions-local',
  version: '1.0.0'
};

export const vscodeignoreTextProcessor: Linter.Processor = {
  meta: pluginMeta,
  preprocess: sourceText => [
    sourceText
      .split(/\r?\n/)
      .map(line => JSON.stringify(line))
      .join('\n')
  ],
  postprocess: messages => messages.flat(),
  supportsAutofix: false
};
