/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { resolveSourceText } from '../../../src/oas/sourceTextResolver';

describe('resolveSourceText', () => {
  const uri = URI.file('/project/classes/Example.cls');

  it('uses matching open-document text so unsaved edits win', async () => {
    const readFile = vi.fn(() => Effect.succeed('disk content'));

    const source = await Effect.runPromise(
      resolveSourceText(uri, [{ uri, getText: () => 'unsaved buffer content' }], readFile)
    );

    expect(source).toBe('unsaved buffer content');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('reads an unopened resource without requiring an editor document', async () => {
    const readFile = vi.fn(() => Effect.succeed('disk content'));

    const source = await Effect.runPromise(resolveSourceText(uri, [], readFile));

    expect(source).toBe('disk content');
    expect(readFile).toHaveBeenCalledWith('/project/classes/Example.cls');
  });
});
