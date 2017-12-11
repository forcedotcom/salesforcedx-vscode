/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/spectron/application.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Application } from 'spectron';
import { Screenshot } from '../helpers/screenshot';
import { SpectronClient } from './client';

const WEBDRIVER_PORT = 7777;
const SALESFORCEDX_EXTENSIONS = path.join(process.cwd(), '..');
export const VSCODE_BINARY_PATH = process.env.VSCODE_BINARY_PATH;

/**
 * Wraps Spectron's Application instance with its used methods.
 */
export class SpectronApplication {
  public client: SpectronClient;

  private spectron: Application;
  private keybindings: any[];
  private screenshot: Screenshot;

  private readonly pollTrials = 5;
  private readonly pollTimeout = 3; // in secs

  constructor(
    electronPath: string,
    testName: string,
    private testRetry: number,
    args?: string[],
    chromeDriverArgs?: string[]
  ) {
    if (!args) {
      args = [];
    }

    // Prevent 'Getting Started' web page from opening on clean user-data-dir
    args.push('--skip-getting-started');

    // Ensure that running over custom extensions directory, rather than picking up the one that was used by a tester previously
    let extensionDirIsSet = false;
    for (const arg of args) {
      if (arg.startsWith('--extensions-dir')) {
        extensionDirIsSet = true;
        break;
      }
    }
    if (!extensionDirIsSet) {
      args.push(`--extensions-dir=${SALESFORCEDX_EXTENSIONS}`);
    }

    this.spectron = new Application({
      port: WEBDRIVER_PORT,
      path: electronPath,
      args: args,
      chromeDriverArgs: chromeDriverArgs,
      startTimeout: 10000,
      requireName: 'nodeRequire'
    });
    this.testRetry += 1; // avoid multiplication by 0 for wait times
    this.screenshot = new Screenshot(this, testName, testRetry);
    this.client = new SpectronClient(this.spectron, this.screenshot);
    this.retrieveKeybindings();
  }

  public get app(): Application {
    return this.spectron;
  }

  public async start(): Promise<any> {
    try {
      await this.spectron.start();
      await this.focusOnWindow(1); // focuses on main renderer window
      return this.checkWindowReady();
    } catch (err) {
      throw err;
    }
  }

  public async stop(): Promise<any> {
    if (this.spectron && this.spectron.isRunning()) {
      return await this.spectron.stop();
    }
  }

  public waitFor(func: (...args: any[]) => any, args: any): Promise<any> {
    return this.callClientAPI(func, args);
  }

  public wait(): Promise<any> {
    return new Promise(resolve =>
      setTimeout(resolve, this.testRetry * this.pollTimeout * 1000)
    );
  }

  public focusOnWindow(index: number): Promise<any> {
    return this.client.windowByIndex(index);
  }

  private checkWindowReady(): Promise<any> {
    return this.waitFor(
      this.spectron.client.getHTML,
      '[id="workbench.main.container"]'
    );
  }

  private getKeybindingPlatform(): string {
    switch (process.platform) {
      case 'darwin':
        return 'osx';
      case 'win32':
        return 'win';
      default:
        return process.platform;
    }
  }

  private retrieveKeybindings() {
    fs.readFile(
      path.join(
        process.cwd(),
        'test_data',
        `keybindings.${this.getKeybindingPlatform()}.json`
      ),
      'utf8',
      (err, data) => {
        if (err) {
          throw err;
        }
        try {
          this.keybindings = JSON.parse(data);
        } catch (e) {
          throw new Error(`Error parsing keybindings JSON: ${e}`);
        }
      }
    );
  }

  private callClientAPI(
    func: (...args: any[]) => Promise<any>,
    args: any
  ): Promise<any> {
    let trial = 1;
    return new Promise(async (res, rej) => {
      while (true) {
        if (trial > this.pollTrials) {
          await this.screenshot.capture();
          rej(
            `Could not retrieve the element in ${this.testRetry *
              this.pollTrials *
              this.pollTimeout} seconds. (${JSON.stringify(args)})`
          );
          break;
        }

        let result;
        try {
          result = await func.call(this.client, args, false);
          // tslint:disable-next-line:no-empty
        } catch (e) {
          console.log(
            `Error calling ${JSON.stringify(args)} :::: ${JSON.stringify(e)}`
          );
          await this.screenshot.capture();
        }

        if (result && result !== '') {
          await this.screenshot.capture();
          res(result);
          break;
        }

        await this.wait();
        trial++;
      }
    });
  }

  public command(command: string, capture?: boolean): Promise<any> {
    const binding = this.keybindings.find(x => x['command'] === command);
    if (!binding) {
      return Promise.reject(`Key binding for ${command} was not found.`);
    }

    const keyBindings: string = binding.key;
    const keysToPress: string[] = [];

    const chords = keyBindings.split(' ');
    chords.forEach(chord => {
      const keys = chord.split('+');
      keys.forEach(key => keysToPress.push(this.transliterate(key)));
      keysToPress.push('NULL');
    });

    return this.client.keys(keysToPress, capture);
  }

  private transliterate(key: string): string {
    switch (key) {
      case 'ctrl':
        return 'Control';
      case 'cmd':
        return 'Meta';
      default:
        return key.length === 1
          ? key
          : key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
}
