"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openOrgBrowser = openOrgBrowser;
exports.verifyOrgBrowserIsOpen = verifyOrgBrowserIsOpen;
exports.findTypeInOrgBrowser = findTypeInOrgBrowser;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const vscode_extension_tester_1 = require("vscode-extension-tester");
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const chai_1 = require("chai");
async function openOrgBrowser(wait = miscellaneous_1.Duration.seconds(1)) {
    await (0, commandPrompt_1.executeQuickPick)('View: Show Org Browser', wait);
    await (0, commandPrompt_1.executeQuickPick)('SFDX: Refresh Types', miscellaneous_1.Duration.seconds(30));
}
async function verifyOrgBrowserIsOpen() {
    const orgBrowser = new vscode_extension_tester_1.SideBarView();
    const titlePart = orgBrowser.getTitlePart();
    const title = await titlePart.getTitle();
    (0, chai_1.expect)(title).to.equal('ORG BROWSER: METADATA');
}
async function findTypeInOrgBrowser(type) {
    const orgBrowser = new vscode_extension_tester_1.SideBarView();
    const content = orgBrowser.getContent();
    const treeItems = await content.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row'));
    let element;
    for (const item of treeItems) {
        const label = await item.getAttribute('aria-label');
        if (label.includes(type))
            return item;
    }
    return element;
}
//# sourceMappingURL=orgBrowser.js.map