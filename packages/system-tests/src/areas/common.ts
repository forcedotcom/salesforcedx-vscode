/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/areas/common.ts
 */

import { Util } from '../helpers/utilities';
import { SpectronApplication } from '../spectron/application';

/**
 * Contains methods that are commonly used across test areas.
 */
export class CommonActions {
  private util: Util;

  constructor(private spectron: SpectronApplication) {
    this.util = new Util();
  }

  public async getWindowTitle(): Promise<any> {
    return this.spectron.client.getTitle();
  }

  public enter(): Promise<any> {
    return this.spectron.client.keys(['Enter', 'NULL']);
  }

  public async addSetting(setting: string, value: string): Promise<any> {
    await this.spectron.command('workbench.action.openGlobalSettings');
    await this.spectron.wait();
    await this.spectron.client.keys(
      ['ArrowDown', 'NULL', 'ArrowRight', 'NULL'],
      false
    );
    await this.spectron.client.keys(`"${setting}": "${value}"`);
    await this.spectron.wait();
    return this.saveOpenedFile();
  }

  public async newUntitledFile(): Promise<any> {
    await this.spectron.command('workbench.action.files.newUntitledFile');
    return this.spectron.wait();
  }

  public closeTab(): Promise<any> {
    return this.spectron.client.keys(['Control', 'w', 'NULL']);
  }

  public async getTab(tabName: string, active?: boolean): Promise<any> {
    await this.closeCurrentNotification(); // close any notification messages that could overlap tabs

    const tabSelector = active ? '.tab.active' : 'div';
    const el = await this.spectron.client.element(
      `.tabs-container ${tabSelector}[aria-label="${tabName}, tab"]`
    );
    if (el.status === 0) {
      return el;
    }

    return undefined;
  }

  public async selectTab(tabName: string): Promise<any> {
    await this.closeCurrentNotification(); // close any notification messages that could overlap tabs
    return this.spectron.client.click(
      `.tabs-container div[aria-label="${tabName}, tab"]`
    );
  }

  public async getConsoleOutput(): Promise<any> {
    const htmlTag = `div[class="view-lines"]`;
    const el = await this.spectron.client.element(htmlTag);
    if (el.status === 0) {
      const textFromElement = await this.spectron.client.getText(htmlTag);
      return textFromElement;
    }
    return undefined;
  }

  public async openFirstMatchFile(fileName: string): Promise<any> {
    await this.openQuickOpen();
    await this.type(fileName);
    await this.spectron.wait();
    await this.enter();
    return this.spectron.wait();
  }

  public saveOpenedFile(): Promise<any> {
    return this.spectron.command('workbench.action.files.save');
  }

  public type(text: string): Promise<any> {
    const spectron = this.spectron;

    return new Promise(res => {
      const textSplit = text.split(' ');

      async function type(i: number) {
        if (!textSplit[i] || textSplit[i].length <= 0) {
          return res();
        }

        const toType = textSplit[i + 1] ? `${textSplit[i]} ` : textSplit[i];
        await spectron.client.keys(toType, false);
        await spectron.client.keys(['NULL']);
        await type(i + 1);
      }

      return type(0);
    });
  }

  public showCommands(): Promise<any> {
    return this.spectron.command('workbench.action.showCommands');
  }

  public openQuickOpen(): Promise<any> {
    return this.spectron.command('workbench.action.quickOpen');
  }

  public closeQuickOpen(): Promise<any> {
    return this.spectron.command('workbench.action.closeQuickOpen');
  }

  public selectNextQuickOpenElement(): Promise<any> {
    return this.spectron.client.keys(['ArrowDown', 'NULL']);
  }

  public async getQuickOpenElements(): Promise<number> {
    const elements = await this.spectron.waitFor(
      this.spectron.client.elements,
      'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row'
    );
    console.log(elements);
    return elements.value.length;
  }

  public async getQuickOpenElementsText(): Promise<string[]> {
    const elements = await this.spectron.client.getText(
      'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row'
    );
    return elements;
  }

  public async openFile(fileName: string, explorer?: boolean): Promise<any> {
    let selector = `div[class="monaco-icon-label file-icon ${fileName}-name-file-icon ${this.getExtensionSelector(
      fileName
    )}`;
    if (explorer) {
      selector += ' explorer-item';
    }
    selector += '"]';

    try {
      await this.spectron.waitFor(this.spectron.client.doubleClick, selector);
    } catch (e) {
      return Promise.reject(`Cannot fine ${fileName} in a viewlet.`);
    }

    return this.spectron.wait();
  }

  public getExtensionSelector(fileName: string): string {
    const extension = fileName.split('.')[1];
    if (extension === 'js') {
      return 'js-ext-file-icon javascript-lang-file-icon';
    } else if (extension === 'json') {
      return 'json-ext-file-icon json-lang-file-icon';
    } else if (extension === 'md') {
      return 'md-ext-file-icon markdown-lang-file-icon';
    }

    throw new Error('No class defined for this file extension');
  }

  public async getEditorFirstLinePlainText(): Promise<any> {
    const trials = 3;
    let retry = 0;
    let error;

    while (retry < trials) {
      try {
        const span = await this.spectron.client.getText(
          '.view-lines span span'
        );
        if (Array.isArray(span)) {
          return span[0];
        }

        return span;
      } catch (e) {
        error = e;
        retry++;

        if (retry < trials) {
          await this.spectron.wait();
        } else {
          error = e;
        }
      }
    }

    return Promise.reject(
      'Could not obtain text on the first line of an editor: ' + error
    );
  }

  public removeFile(filePath: string): void {
    this.util.removeFile(filePath);
  }

  public removeDirectory(directory: string): Promise<any> {
    try {
      return this.util.rimraf(directory);
    } catch (e) {
      throw new Error(`Failed to remove ${directory} with an error: ${e}`);
    }
  }

  private closeCurrentNotification(): Promise<any> {
    return this.spectron.command('workbench.action.closeMessages');
  }
}
