"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusBarItemWhichIncludes = getStatusBarItemWhichIncludes;
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
async function getStatusBarItemWhichIncludes(title) {
    const workbench = (0, workbench_1.getWorkbench)();
    const retries = 10;
    for (let i = retries; i > 0; i--) {
        const statusBar = await workbench.getStatusBar().wait();
        const items = await statusBar.getItems();
        for (const item of items) {
            const ariaLabel = await item.getAttribute('aria-label');
            if (ariaLabel.includes(title)) {
                (0, miscellaneous_1.log)('Status Bar item found.');
                return item;
            }
        }
        await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    }
    throw new Error(`Status bar item containing ${title} was not found`);
}
//# sourceMappingURL=statusBar.js.map