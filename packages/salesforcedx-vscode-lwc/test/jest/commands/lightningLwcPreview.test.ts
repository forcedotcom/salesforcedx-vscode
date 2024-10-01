/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getPreview } from '../../../src/commands/lightningLwcPreview';

describe('lightningLwcPreview', () => {
  describe('not in container mode', () => {
    it('uses default preview', async () => {
      const preview = getPreview();
      expect(preview.name).toBe('lwcPreview');
    });
  });

  describe('in container mode', () => {
    beforeAll(() => {
      process.env.SF_CONTAINER_MODE = 'true';
    });

    afterAll(() => {
      delete process.env.SF_CONTAINER_MODE;
    });

    it('uses container mode preview', async () => {
      const preview = getPreview();
      expect(preview.name).toBe('lwcPreviewContainerMode');
    });
  });
});
