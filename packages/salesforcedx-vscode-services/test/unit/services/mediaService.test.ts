/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ICONS, MediaService } from '@salesforce/vscode-services/v2';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { MediaDescriptions } from '../../../src/services/mediaDescriptions.js';
import { MediaServiceLayer } from '../../../src/services/mediaService.js';

it('keeps shared icon IDs and performs the provider localization on every request', async () => {
  let locale = 'first';
  const describe = vi.fn((icon: string) => `${locale}:${icon}`);
  const media = MediaServiceLayer.pipe(Layer.provide(Layer.succeed(MediaDescriptions, describe)));
  const runtime = ManagedRuntime.make(Layer.mergeAll(media, media));
  try {
    const service = await runtime.runPromise(MediaService);
    expect(service.ICONS).toBe(ICONS);
    expect(await runtime.runPromise(service.getIconDescription(ICONS.SF_DEFAULT_ORG))).toBe('first:$(sf-org-leaf)');
    locale = 'second';
    expect(await runtime.runPromise(service.getIconDescription(ICONS.SF_DEFAULT_ORG))).toBe('second:$(sf-org-leaf)');
    expect(describe).toHaveBeenCalledTimes(2);
  } finally {
    await runtime.dispose();
  }
});
