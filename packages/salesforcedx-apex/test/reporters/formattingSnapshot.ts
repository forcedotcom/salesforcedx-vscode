/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const normalizeFormatterOutput = (output: string): string =>
  output
    .replaceAll('\r\n', '\n')
    .replaceAll(/(<property name="testStartTime" value=")[^"]+("\/>)/g, '$1<timestamp>$2')
    .replaceAll(/^(\*\*Run completed:\*\* |Run completed: ).*$/gm, '$1<timestamp>')
    // Render padding explicitly so snapshot files do not contain trailing whitespace.
    .replaceAll(/ +$/gm, spaces => '␠'.repeat(spaces.length));
