/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readAsTextDocument } from './testUtils';

const FORCE_APP_ROOT = 'test-workspaces/sfdx-workspace/force-app/main/default';

it('readAsTextDocument()', () => {
    // reads .js file
    let document = readAsTextDocument(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world.js`);
    expect(document.uri).toMatch(new RegExp(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world\\.js$`));
    expect(document.languageId).toBe('javascript');
    expect(document.getText()).toContain('LwcHelloWorld');

    // reads .html file
    document = readAsTextDocument(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world.html`);
    expect(document.uri).toMatch(new RegExp(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world\\.html$`));
    expect(document.languageId).toBe('html');
    expect(document.getText()).toContain('Hello From a Lightning Web Component');

    // aura components have the html languageId in the sfdx extentions
    document = readAsTextDocument(`${FORCE_APP_ROOT}/aura/helloWorldApp/helloWorldApp.app`);
    expect(document.languageId).toBe('html');
    document = readAsTextDocument(`${FORCE_APP_ROOT}/aura/wireLdsCmp/wireLdsCmp.cmp`);
    expect(document.languageId).toBe('html');
});
