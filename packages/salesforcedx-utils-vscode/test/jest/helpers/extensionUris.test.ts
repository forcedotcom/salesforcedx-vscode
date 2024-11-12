/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { extensionUris } from '../../../src';

describe('extensionUris Unit Tests.', () => {
  describe('extensionUri()', () => {
    const fakeExtensionRef = {
      extensionUri: { url: 'fake' }
    };
    const fakeExtensionName = 'salesforce.someExtension';

    beforeEach(() => {
      vscode.extensions.getExtension = jest.fn();
    });

    it('Should return extensionUri if found.', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(fakeExtensionRef);
      const result = extensionUris.extensionUri(fakeExtensionName);
      expect(vscode.extensions.getExtension).toHaveBeenCalledWith(fakeExtensionName);
      expect(result).toEqual(fakeExtensionRef.extensionUri);
    });

    it('Should throw an error if extension is not found.', () => {
      (vscode.extensions.getExtension as any).mockReturnValue(undefined);
      expect(() => {
        extensionUris.extensionUri(fakeExtensionName);
      }).toThrowError(/^Unable to find extension/);
    });
  });

  describe('join()', () => {
    const fakeResultUri = { url: 'file://totallyfake' };
    it('Should return joined Uri and relative path.', () => {
      const fakeUri: any = { scheme: true };
      const path = '/a/b/c/e';
      (vscode.Uri.joinPath as any).mockReturnValue(fakeResultUri);
      const result = extensionUris.join(fakeUri, path);
      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(fakeUri, path);
      expect(result).toEqual(fakeResultUri);
    });
  });
});
