"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Duration = exports.Unit = void 0;
exports.pause = pause;
exports.log = log;
exports.debug = debug;
exports.error = error;
exports.currentOsUserName = currentOsUserName;
exports.transformedUserName = transformedUserName;
exports.findElementByText = findElementByText;
exports.createCommand = createCommand;
exports.setDefaultOrg = setDefaultOrg;
exports.isDuration = isDuration;
exports.sleep = sleep;
exports.openFolder = openFolder;
exports.openFile = openFile;
const os_1 = __importDefault(require("os"));
const environmentSettings_1 = require("../environmentSettings");
const outputView_1 = require("./outputView");
const commandPrompt_1 = require("./commandPrompt");
const notifications_1 = require("./notifications");
const DurationKit = __importStar(require("@salesforce/kit"));
const path_1 = __importDefault(require("path"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const workbench_1 = require("./workbench");
const chai_1 = require("chai");
async function pause(duration = Duration.seconds(1)) {
    await sleep(duration.milliseconds);
}
function log(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel !== 'silent') {
        console.log(message);
    }
}
function debug(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel in ['debug', 'trace']) {
        const timestamp = new Date().toISOString();
        console.debug(`${timestamp}:${message}`);
    }
}
function error(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel === 'error') {
        console.error(`Error: ${message}`);
    }
}
function currentOsUserName() {
    const userName = os_1.default.userInfo().username ||
        process.env.SUDO_USER ||
        process.env.C9_USER ||
        process.env.LOGNAME ||
        process.env.USER ||
        process.env.LNAME ||
        process.env.USERNAME;
    return userName;
}
// There is an issue with InputBox.setText().  When a
// period is present, the string passed to the input box
// becomes truncated.  An fix for this is to replace
// the periods with an underscore.
function transformedUserName() {
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
async function findElementByText(type, attribute, labelText, waitForClickable = false, waitOptions) {
    if (!labelText) {
        throw new Error('labelText must be defined');
    }
    debug(`findElementByText //${type}[@${attribute}="${labelText}"]`);
    const element = await (0, workbench_1.getWorkbench)().findElement(vscode_extension_tester_1.By.xpath(`//${type}[@${attribute}="${labelText}"]`));
    if (!element) {
        throw new Error(`Element with selector: "${type}[${attribute}=\"${labelText}\"]" not found}`);
    }
    if (waitForClickable) {
        await (0, workbench_1.getBrowser)().wait(async () => {
            const isDisplayedAndEnabled = (await element.isDisplayed()) && (await element.isEnabled());
            return waitOptions?.reverse ? !isDisplayedAndEnabled : isDisplayedAndEnabled;
        }, waitOptions?.timeout?.milliseconds ?? Duration.seconds(5).milliseconds, waitOptions?.timeoutMsg, waitOptions?.interval?.milliseconds ?? Duration.milliseconds(500).milliseconds);
    }
    return element;
}
async function createCommand(type, name, folder, extension) {
    await (0, outputView_1.clearOutputView)();
    const inputBox = await (0, commandPrompt_1.executeQuickPick)(`SFDX: Create ${type}`, Duration.seconds(1));
    // Set the name of the new component to name.
    await inputBox.setText(name);
    await inputBox.confirm();
    await pause(Duration.seconds(1));
    // Select the default directory (press Enter/Return).
    await inputBox.confirm();
    const successNotificationWasFound = await (0, notifications_1.notificationIsPresentWithTimeout)(`SFDX: Create ${type} successfully ran`, Duration.minutes(10));
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
    const outputPanelText = await (0, outputView_1.attemptToFindOutputPanelText)(`Salesforce CLI`, `Finished SFDX: Create ${type}`, 10);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (0, chai_1.expect)(outputPanelText).not.to.be.undefined;
    const typePath = path_1.default.join(`force-app`, `main`, `default`, folder, `${name}.${extension}`);
    (0, chai_1.expect)(outputPanelText).to.include(`create ${typePath}`);
    const metadataPath = path_1.default.join(`force-app`, `main`, `default`, folder, `${name}.${extension}-meta.xml`);
    (0, chai_1.expect)(outputPanelText).to.include(`create ${metadataPath}`);
    return outputPanelText;
}
async function setDefaultOrg(targetOrg) {
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('SFDX: Set a Default Org');
    await (0, commandPrompt_1.findQuickPickItem)(inputBox, targetOrg, false, true);
}
// Type guard function to check if the argument is a Duration
function isDuration(predicateOrWait) {
    return predicateOrWait.milliseconds !== undefined;
}
var Unit;
(function (Unit) {
    Unit[Unit["MINUTES"] = 0] = "MINUTES";
    Unit[Unit["MILLISECONDS"] = 1] = "MILLISECONDS";
    Unit[Unit["SECONDS"] = 2] = "SECONDS";
    Unit[Unit["HOURS"] = 3] = "HOURS";
    Unit[Unit["DAYS"] = 4] = "DAYS";
    Unit[Unit["WEEKS"] = 5] = "WEEKS";
})(Unit || (exports.Unit = Unit = {}));
class Duration extends DurationKit.Duration {
    scaleFactor;
    constructor(quantity, unit, scaleFactor) {
        super(quantity, unit);
        if (scaleFactor !== undefined) {
            this.scaleFactor = scaleFactor;
        }
        else {
            this.scaleFactor = environmentSettings_1.EnvironmentSettings.getInstance().throttleFactor;
        }
    }
    get minutes() {
        return super.minutes * this.scaleFactor;
    }
    get hours() {
        return super.hours * this.scaleFactor;
    }
    get milliseconds() {
        return super.milliseconds * this.scaleFactor;
    }
    get seconds() {
        return super.seconds * this.scaleFactor;
    }
    get days() {
        return super.days * this.scaleFactor;
    }
    get weeks() {
        return super.weeks * this.scaleFactor;
    }
    static ONE_MINUTE = Duration.minutes(1);
    static FIVE_MINUTES = Duration.minutes(5);
    static TEN_MINUTES = Duration.minutes(10);
    // Static methods for creating new instances without specifying scaleFactor
    static milliseconds(quantity) {
        return new Duration(quantity, Unit.MILLISECONDS);
    }
    static seconds(quantity) {
        return new Duration(quantity, Unit.SECONDS);
    }
    static minutes(quantity) {
        return new Duration(quantity, Unit.MINUTES);
    }
    static hours(quantity) {
        return new Duration(quantity, Unit.HOURS);
    }
    static days(quantity) {
        return new Duration(quantity, Unit.DAYS);
    }
    static weeks(quantity) {
        return new Duration(quantity, Unit.WEEKS);
    }
}
exports.Duration = Duration;
async function sleep(duration) {
    return new Promise(resolve => {
        setTimeout(resolve, duration);
    });
}
/*
 * VSCode will be working on the new workspace, and the previous one is closed.
 */
async function openFolder(path) {
    const prompt = await (0, commandPrompt_1.executeQuickPick)('File: Open Folder...'); // use this cmd palette to open
    // Set the location of the project
    console.log('open Folder A');
    await prompt.setText(path);
    console.log('open Folder B');
    await pause(Duration.seconds(2));
    const projectName = path.substring(path.lastIndexOf('/') + 1);
    console.log('open Folder C');
    await prompt.selectQuickPick(projectName);
    console.log('open Folder D');
    await (0, commandPrompt_1.clickFilePathOkButton)();
    console.log('open Folder E');
}
/**
 * An definite alternative of getTextEditor to open a file in text editor
 * @param path
 */
async function openFile(path) {
    const prompt = await (0, commandPrompt_1.executeQuickPick)('File: Open File...'); // use this cmd palette to open
    // Set the location of the project
    await prompt.setText(path);
    await pause(Duration.seconds(2));
    const fileName = path.substring(path.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1);
    await prompt.selectQuickPick(fileName);
}
//# sourceMappingURL=miscellaneous.js.map