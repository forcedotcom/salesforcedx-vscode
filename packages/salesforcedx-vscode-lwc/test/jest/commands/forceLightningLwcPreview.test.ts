/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
const lwcPath = vscode.Uri.parse('/force-app/main/default/lwc');
const lwcComponent = 'component';
const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);

// ------ import functions + mock ------

import {
  forceLightningLwcPreview,
  lwcPreview
} from '../../../src/commands/forceLightningLwcPreview';

jest.mock(
  '../../../src/commands/forceLightningLwcPreview',
  () => {
    const original = jest.requireActual(
      '../../../src/commands/forceLightningLwcPreview'
    );

    return {
      ...original,
      lwcPreview: jest.fn(() => true)
    };
  },
  { virtual: true }
);

describe('forceLightningLwcPreview', () => {
  describe('not in container mode', () => {
    it('uses default preview', async () => {
      console.log(forceLightningLwcPreview);
      console.log(lwcPreview);

      forceLightningLwcPreview(sourceUri);
      expect(lwcPreview).toHaveBeenCalled();
    });
  });
});

// ------ import as module + spy ------

// import * as forceLightningLwcPreview from '../../../src/commands/forceLightningLwcPreview';

// describe('forceLightningLwcPreview', () => {
//   const lwcPreviewSpy = jest
//     .spyOn(forceLightningLwcPreview, 'lwcPreview')
//     .mockResolvedValue(undefined);

//   const forceSpy = jest.spyOn(
//     forceLightningLwcPreview,
//     'forceLightningLwcPreview'
//   );

//   describe('not in container mode', () => {
//     it('uses default preview', async () => {
//       console.log(forceLightningLwcPreview);
//       console.log(lwcPreviewSpy);

//       await forceLightningLwcPreview.forceLightningLwcPreview(sourceUri);

//       console.log(forceSpy.mock);

//       expect(forceLightningLwcPreview.lwcPreview).toEqual(lwcPreviewSpy);
//       expect(forceLightningLwcPreview.lwcPreview).toHaveBeenCalled();
//     });
//   });
// });
