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
import { Application, SpectronClient as WebClient } from 'spectron';
import { Screenshot } from '../helpers/screenshot';
import { SpectronClient } from './client';

const WEBDRIVER_PORT = 7777;
const SALESFORCEDX_EXTENSIONS = path.join(process.cwd(), '..');
export const VSCODE_BINARY_PATH = process.env.VSCODE_BINARY_PATH as string;

/**
 * Wraps Spectron's Application instance with its used methods.
 */
export class SpectronApplication {
  public client: SpectronClient;

  private spectron: Application;
  private keybindings: any[] = [];
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

    // Prevent 'Getting Started' web page from opening on clean user-data-dir
    args.push('--skip-release-notes');

    // Prevent Quick Open from closing when focus is stolen, this allows concurrent smoketest suite running
    args.push('--sticky-quickopen');

    // Disable telemetry
    args.push('--disable-telemetry');

    // Disable updates
    args.push('--disable-updates');

    // Disable crash reporter
    // This seems to be the fix for the strange hangups in which Code stays unresponsive
    // and tests finish badly with timeouts, leaving Code running in the background forever
    args.push('--disable-crash-reporter');

    // Ensure that running over extensions directory using this DX extension set
    args.push(`--extensions-dir=${SALESFORCEDX_EXTENSIONS}`);

    this.spectron = new Application({
      port: WEBDRIVER_PORT,
      path: electronPath,
      args,
      chromeDriverArgs,
      startTimeout: 10000,
      requireName: 'nodeRequire'
      // https://github.com/electron/spectron/pull/247
      // deprecationWarnings: false
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

  public get webclient(): WebClient {
    if (!this.spectron) {
      throw new Error('Application not started');
    }

    return this.spectron.client;
  }

  private async checkWindowReady(): Promise<any> {
    await this.webclient.waitUntilWindowLoaded(60000);

    // Pick the first workbench window here
    const count = await this.webclient.getWindowCount();

    for (let i = 0; i < count; i++) {
      await this.webclient.windowByIndex(i);

      if (/bootstrap\/index\.html/.test(await this.webclient.getUrl())) {
        break;
      }
    }

    await this.waitFor(this.spectron.client.getHTML, '.monaco-workbench');
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
          console.log(` Attempt #${trial}: ${args} :::: ${e}`);
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

  public static removeWebdriverDeprecationWarning() {
    /**
     * WebDriverIO 4.8.0 outputs all kinds of "deprecation" warnings
     * for common commands like `keys` and `moveToObject`.
     * According to https://github.com/Codeception/CodeceptJS/issues/531,
     * these deprecation warnings are for Firefox, and have no alternative replacements.
     * Since we can't downgrade WDIO as suggested (it's Spectron's dep, not ours),
     * we must suppress the warning with a classic monkey-patch.
     *
     * @see webdriverio/lib/helpers/depcrecationWarning.js
     * @see https://github.com/webdriverio/webdriverio/issues/2076
     */
    // Filter out the following messages:
    const wdioDeprecationWarning = /^WARNING: the "\w+" command will be (deprecated|depcrecated) soon..*/; // [sic]
    // Monkey patch:
    const warn = console.warn;
    console.warn = function suppressWebdriverWarnings(message: string) {
      if (wdioDeprecationWarning.test(message)) {
        return;
      }
      warn.apply(console, arguments);
    };
  }
}
SpectronApplication.removeWebdriverDeprecationWarning();
