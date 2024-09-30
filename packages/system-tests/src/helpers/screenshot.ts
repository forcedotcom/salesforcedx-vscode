/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/helpers/screenshot.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpectronApplication } from '../spectron/application';
import { sanitize } from './utilities';

const TEST_TIME = new Date().toISOString();

export class Screenshot {
  private counter = 0;
  private screenshotsDirPath: string;

  constructor(
    private spectron: SpectronApplication,
    private testName: string,
    testRetry: number
  ) {
    this.screenshotsDirPath = path.join(
      'test_data',
      'screenshots',
      sanitize(TEST_TIME)
    );
  }

  public async capture(name?: string): Promise<any> {
    const screenshotPath = path.join(
      this.screenshotsDirPath,
      sanitize(this.testName),
      name !== undefined
        ? `${this.counter++}-${sanitize(name)}.png`
        : `${this.counter++}.png`
    );

    const image = await this.spectron.app.browserWindow
      .capturePage()
      .catch(err => {
        console.log('Error creating test snapshot');
      });
    await new Promise<void>((c, e) =>
      fs.mkdir(path.dirname(screenshotPath), { recursive: true }, err => (err ? e(err) : c()))
    );
    await new Promise<void>((c, e) =>
      fs.writeFile(screenshotPath, image, err => (err ? e(err) : c()))
    );
  }
}
