/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getPreview } from '../../../src/commands/forceLightningLwcPreview';

describe('forceLightningLwcPreview', () => {
  describe('not in container mode', () => {
    it('uses default preview', async () => {
      const preview = getPreview();
      expect(preview.name).toBe('lwcPreview');
    });
  });

  describe('in container mode', () => {
    let initialContainerMode: string | undefined = undefined;

    beforeAll(() => {
      initialContainerMode = process.env.CONTAINER_MODE;
      process.env.CONTAINER_MODE = 'true';
    });

    afterAll(() => {
      process.env.CONTAINER_MODE = initialContainerMode;
    });

    it('uses container mode preview', async () => {
      const preview = getPreview();
      expect(preview.name).toBe('lwcPreviewContainerMode');
    });
  });
});
