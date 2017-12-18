/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/spectron/client.ts
 */

import { Application } from 'spectron';
import { Element, RawResult } from 'webdriverio';
import { Screenshot } from '../helpers/screenshot';

/**
 * Abstracts the Spectron's WebdriverIO managed client property on the created Application instances.
 */
export class SpectronClient {
  // waitFor calls should not take more than 200 * 100 = 20 seconds to complete, excluding
  // the time it takes for the actual retry call to complete
  private retryCount: number;
  private readonly retryDuration = 100; // in milliseconds

  constructor(
    private spectron: Application,
    private shot: Screenshot,
    waitTime: number = 20
  ) {
    this.retryCount = waitTime * 1000 / this.retryDuration;
  }

  public windowByIndex(index: number): Promise<any> {
    return this.spectron.client.windowByIndex(index);
  }

  public async keys(
    keys: string[] | string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.keys(keys);
  }

  public async getText(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.getText(selector);
  }

  public async getHTML(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.getHTML(selector);
  }

  public async click(selector: string, capture: boolean = true): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.click(selector);
  }

  public async doubleClick(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.doubleClick(selector);
  }

  public async leftClick(
    selector: string,
    xoffset: number,
    yoffset: number,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.leftClick(selector, xoffset, yoffset);
  }

  public async rightClick(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.rightClick(selector);
  }

  public async moveToObject(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.moveToObject(selector);
  }

  public async setValue(
    selector: string,
    text: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.setValue(selector, text);
  }

  public async elements(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.elements(selector);
  }

  public async element(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.element(selector);
  }

  public async dragAndDrop(
    sourceElem: string,
    destinationElem: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.dragAndDrop(sourceElem, destinationElem);
  }

  public async selectByValue(
    selector: string,
    value: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.selectByValue(selector, value);
  }

  public async getValue(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.getValue(selector);
  }

  public async getAttribute(
    selector: string,
    attribute: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return Promise.resolve(
      this.spectron.client.getAttribute(selector, attribute)
    );
  }

  public clearElement(selector: string): any {
    return this.spectron.client.clearElement(selector);
  }

  public buttonDown(): any {
    return this.spectron.client.buttonDown();
  }

  public buttonUp(): any {
    return this.spectron.client.buttonUp();
  }

  public async isVisible(
    selector: string,
    capture: boolean = true
  ): Promise<any> {
    await this.screenshot(capture);
    return this.spectron.client.isVisible(selector);
  }

  public getTitle(): string {
    return this.spectron.client.getTitle();
  }

  public async waitForElements(
    selector: string,
    accept: (result: Element[]) => boolean = result => result.length > 0
  ): Promise<Element[]> {
    return this.waitFor<RawResult<Element[]>>(
      () => this.spectron.client.elements(selector),
      result => accept(result.value),
      `elements with selector ${selector}`
    ).then(result => result.value);
  }

  public waitForElement(
    selector: string,
    accept: (result: Element | undefined) => boolean = result => !!result
  ): Promise<Element> {
    return this.waitFor<RawResult<Element>>(
      () => this.spectron.client.element(selector),
      result => accept(result ? result.value : void 0),
      `element with selector ${selector}`
    ).then(result => result.value);
  }

  private running = false;
  public async waitFor<T>(
    func: () => T | Promise<T | undefined>,
    accept?: (result: T) => boolean | Promise<boolean>,
    timeoutMessage?: string,
    retryCount?: number
  ): Promise<T>;
  public async waitFor<T>(
    func: () => T | Promise<T>,
    accept: (result: T) => boolean | Promise<boolean> = result => !!result,
    timeoutMessage?: string,
    retryCount?: number
  ): Promise<T> {
    if (this.running) {
      throw new Error('Not allowed to run nested waitFor calls!');
    }

    this.running = true;

    try {
      let trial = 1;
      retryCount =
        typeof retryCount === 'number' ? retryCount : this.retryCount;

      while (true) {
        if (trial > retryCount) {
          await this.shot.capture('timeout');
          throw new Error(
            `${timeoutMessage}: Timed out after ${retryCount *
              this.retryDuration /
              1000} seconds.`
          );
        }

        let result;
        try {
          result = await func();

          if (accept(result)) {
            return result;
          }
        } catch (e) {
          console.log(e);
        }

        await new Promise(resolve => setTimeout(resolve, this.retryDuration));
        trial++;
      }
    } finally {
      this.running = false;
    }
  }

  private async screenshot(capture: boolean): Promise<any> {
    if (capture) {
      try {
        await this.shot.capture();
      } catch (e) {
        throw new Error(`Screenshot could not be captured: ${e}`);
      }
    }
  }

  public async getTerminalText(): Promise<string[]> {
    const PANEL_SELECTOR = 'div[id="workbench.panel.terminal"]';
    const XTERM_SELECTOR = `${PANEL_SELECTOR} .terminal-wrapper`;
    return await this.spectron.client.selectorExecute(XTERM_SELECTOR, div => {
      const xterm = (<any>(Array.isArray(div) ? div[0] : div)).xterm;
      const buffer = xterm.buffer;
      const lines: string[] = [];
      for (let i = 0; i < buffer.lines.length; i++) {
        lines.push(buffer.translateBufferLineToString(i, true));
      }
      return lines;
    });
  }
}
