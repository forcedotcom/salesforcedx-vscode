/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import os from 'os';
import { EnvironmentSettings } from '../environmentSettings';
import { attemptToFindOutputPanelText, clearOutputView } from './outputView';
import { clickFilePathOkButton, executeQuickPick, findQuickPickItem } from './commandPrompt';
import { notificationIsPresentWithTimeout } from './notifications';
import * as DurationKit from '@salesforce/kit';
import path from 'path';
import { PredicateWithTimeout } from './predicates';
import { By, WebElement } from 'vscode-extension-tester';
import { getBrowser, getWorkbench } from './workbench';
import { expect, util } from 'chai';

export async function pause(duration: Duration = Duration.seconds(1)): Promise<void> {
  await sleep(duration.milliseconds);
}

export function log(message: string): void {
  if (EnvironmentSettings.getInstance().logLevel !== 'silent') {
    console.log(message);
  }
}

export function debug(message: string): void {
  if (EnvironmentSettings.getInstance().logLevel in ['debug', 'trace']) {
    const timestamp = new Date().toISOString();
    console.debug(`${timestamp}:${message}`);
  }
}

export function error(message: string): void {
  if (EnvironmentSettings.getInstance().logLevel === 'error') {
    console.error(`Error: ${message}`);
  }
}

export function currentOsUserName(): string {
  const userName =
    os.userInfo().username ||
    process.env.SUDO_USER ||
    process.env.C9_USER ||
    process.env.LOGNAME ||
    process.env.USER ||
    process.env.LNAME ||
    process.env.USERNAME;

  return userName!;
}

// There is an issue with InputBox.setText().  When a
// period is present, the string passed to the input box
// becomes truncated.  An fix for this is to replace
// the periods with an underscore.
export function transformedUserName(): string {
  debug('transformedUsername()');
  return currentOsUserName().replace('.', '_');
}

/**
 * @param type type of html tag we want to find
 * @param attribute attribute that holds the given text
 * @param labelText text of the element we want to find
 * @param waitForClickable whether to wait until the element is clickable
 * @param waitOptions options for waiting until the element is clickable
 * @returns element that contains the given text
 */
export async function findElementByText(
  type: string,
  attribute: string,
  labelText: string | undefined,
  waitForClickable: boolean | undefined = false,
  waitOptions?: {
    timeout?: Duration;
    interval?: Duration;
    reverse?: boolean;
    timeoutMsg?: string;
  }
): Promise<WebElement> {
  if (!labelText) {
    throw new Error('labelText must be defined');
  }
  debug(`findElementByText //${type}[@${attribute}="${labelText}"]`);
  const element = await getWorkbench().findElement(By.xpath(`//${type}[@${attribute}="${labelText}"]`));
  if (!element) {
    throw new Error(`Element with selector: "${type}[${attribute}=\"${labelText}\"]" not found}`);
  }
  if (waitForClickable) {
    await getBrowser().wait(
      async () => {
        const isDisplayedAndEnabled = (await element.isDisplayed()) && (await element.isEnabled());
        return waitOptions?.reverse ? !isDisplayedAndEnabled : isDisplayedAndEnabled;
      },
      waitOptions?.timeout?.milliseconds ?? Duration.seconds(5).milliseconds,
      waitOptions?.timeoutMsg,
      waitOptions?.interval?.milliseconds ?? Duration.milliseconds(500).milliseconds
    );
  }

  return element;
}

export async function createCommand(
  type: string,
  name: string,
  folder: string,
  extension: string
): Promise<string | undefined> {
  await clearOutputView();
  const inputBox = await executeQuickPick(`SFDX: Create ${type}`, Duration.seconds(1));

  // Set the name of the new component to name.
  await inputBox.setText(name);
  await inputBox.confirm();
  await pause(Duration.seconds(1));

  // Select the default directory (press Enter/Return).
  await inputBox.confirm();

  const successNotificationWasFound = await notificationIsPresentWithTimeout(
    `SFDX: Create ${type} successfully ran`,
    Duration.minutes(10)
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  expect(successNotificationWasFound).to.equal(true);

  const outputPanelText = await attemptToFindOutputPanelText(`Salesforce CLI`, `Finished SFDX: Create ${type}`, 10);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  expect(outputPanelText).not.to.be.undefined;
  const typePath = path.join(`force-app`, `main`, `default`, folder, `${name}.${extension}`);
  expect(outputPanelText).to.include(`create ${typePath}`);

  const metadataPath = path.join(`force-app`, `main`, `default`, folder, `${name}.${extension}-meta.xml`);
  expect(outputPanelText).to.include(`create ${metadataPath}`);
  return outputPanelText;
}

export async function setDefaultOrg(targetOrg: string): Promise<void> {
  const inputBox = await executeQuickPick('SFDX: Set a Default Org');
  await findQuickPickItem(inputBox, targetOrg, false, true);
}

// Type guard function to check if the argument is a Duration
export function isDuration(predicateOrWait: PredicateWithTimeout | Duration): predicateOrWait is Duration {
  return (predicateOrWait as Duration).milliseconds !== undefined;
}

export enum Unit {
  MINUTES = DurationKit.Duration.Unit.MINUTES,
  MILLISECONDS = DurationKit.Duration.Unit.MILLISECONDS,
  SECONDS = DurationKit.Duration.Unit.SECONDS,
  HOURS = DurationKit.Duration.Unit.HOURS,
  DAYS = DurationKit.Duration.Unit.DAYS,
  WEEKS = DurationKit.Duration.Unit.WEEKS
}

export class Duration extends DurationKit.Duration {
  private scaleFactor: number;

  constructor(quantity: number, unit: Unit, scaleFactor?: number) {
    super(quantity, unit);
    if (scaleFactor !== undefined) {
      this.scaleFactor = scaleFactor;
    } else {
      this.scaleFactor = EnvironmentSettings.getInstance().throttleFactor;
    }
  }

  public get minutes(): number {
    return super.minutes * this.scaleFactor;
  }

  public get hours(): number {
    return super.hours * this.scaleFactor;
  }

  public get milliseconds(): number {
    return super.milliseconds * this.scaleFactor;
  }

  public get seconds(): number {
    return super.seconds * this.scaleFactor;
  }

  public get days(): number {
    return super.days * this.scaleFactor;
  }

  public get weeks(): number {
    return super.weeks * this.scaleFactor;
  }

  public static ONE_MINUTE = Duration.minutes(1);
  public static FIVE_MINUTES = Duration.minutes(5);
  public static TEN_MINUTES = Duration.minutes(10);

  // Static methods for creating new instances without specifying scaleFactor
  public static milliseconds(quantity: number): Duration {
    return new Duration(quantity, Unit.MILLISECONDS);
  }

  public static seconds(quantity: number): Duration {
    return new Duration(quantity, Unit.SECONDS);
  }

  public static minutes(quantity: number): Duration {
    return new Duration(quantity, Unit.MINUTES);
  }

  public static hours(quantity: number): Duration {
    return new Duration(quantity, Unit.HOURS);
  }

  public static days(quantity: number): Duration {
    return new Duration(quantity, Unit.DAYS);
  }

  public static weeks(quantity: number): Duration {
    return new Duration(quantity, Unit.WEEKS);
  }
}

export async function sleep(duration: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, duration);
  });
}

/*
 * VSCode will be working on the new workspace, and the previous one is closed.
 */
export async function openFolder(path: string) {
  const prompt = await executeQuickPick('File: Open Folder...'); // use this cmd palette to open
  // Set the location of the project
  await prompt.setText(path);
  await pause(Duration.seconds(2));
  const projectName = path.substring(path.lastIndexOf('/') + 1);
  await prompt.selectQuickPick(projectName);
  await clickFilePathOkButton();
}

/**
 * An definite alternative of getTextEditor to open a file in text editor
 * @param path
 */
export async function openFile(path: string) {
  const prompt = await executeQuickPick('File: Open File...'); // use this cmd palette to open
  // Set the location of the project
  await prompt.setText(path);
  await pause(Duration.seconds(2));
  const fileName = path.substring(path.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1);
  await prompt.selectQuickPick(fileName);
}
