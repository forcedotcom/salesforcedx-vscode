/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/helpers/screenshot.ts
 */

import * as fs from 'fs';
import { SpectronApplication } from '../spectron/application';

const TEST_TIME = new Date().toISOString();

export class Screenshot {
  private index = 0;
  private testPath: string;

  constructor(
    private spectron: SpectronApplication,
    testName: string,
    testRetry: number
  ) {
    const testTime = this.sanitizeFolderName(TEST_TIME);
    testName = this.sanitizeFolderName(testName);

    this.testPath = `test_data/screenshots/${testTime}/${testName}/${testRetry}`;
    this.createFolder(this.testPath);
  }

  public async capture(): Promise<any> {
    return new Promise(async (res, rej) => {
      const image: Electron.NativeImage = await this.spectron.app.browserWindow.capturePage();
      fs.writeFile(`${this.testPath}/${this.index}.png`, image, err => {
        if (err) {
          rej(err);
        }
        this.index++;
        res();
      });
    });
  }

  private createFolder(name: string): void {
    name.split('/').forEach((folderName, i, fullPath) => {
      const folder = fullPath.slice(0, i + 1).join('/');
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
      }
    });
  }

  private sanitizeFolderName(name: string): string {
    return name.replace(/[&*:\/]/g, '');
  }
}
