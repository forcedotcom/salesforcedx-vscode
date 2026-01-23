/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { readAsTextDocument } from './testUtils';

const FORCE_APP_ROOT = 'test-workspaces/sfdx-workspace/force-app/main/default';

it('readAsTextDocument()', () => {
    const fileSystemProvider = new FileSystemDataProvider();
    void fileSystemProvider.updateFileContent(
        `${FORCE_APP_ROOT}/lwc/hello_world/hello_world.js`,
        'import { LightningElement } from "lwc";\n\nexport default class LwcHelloWorld extends LightningElement {}',
    );
    void fileSystemProvider.updateFileContent(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world.html`, '<template>Hello From a Lightning Web Component</template>\n');
    void fileSystemProvider.updateFileContent(
        `${FORCE_APP_ROOT}/aura/helloWorldApp/helloWorldApp.app`,
        '<aura:application xmlns:aura="http://soap.sforce.com/2006/04/metadata" xmlns:apex="http://soap.sforce.com/2006/04/metadata" xmlns:html="http://www.w3.org/1999/xhtml" xmlns:js="http://soap.sforce.com/2006/04/metadata" xmlns:lwc="http://soap.sforce.com/2006/04/metadata" template="b1">Hello World</aura:application>',
    );
    void fileSystemProvider.updateFileContent(
        `${FORCE_APP_ROOT}/aura/wireLdsCmp/wireLdsCmp.cmp`,
        '<aura:component xmlns:aura="http://soap.sforce.com/2006/04/metadata" xmlns:apex="http://soap.sforce.com/2006/04/metadata" xmlns:html="http://www.w3.org/1999/xhtml" xmlns:js="http://soap.sforce.com/2006/04/metadata" xmlns:lwc="http://soap.sforce.com/2006/04/metadata" template="b1">Hello World</aura:component>',
    );

    // reads .js file
    let document = readAsTextDocument(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world.js`, fileSystemProvider);
    expect(document.uri).toMatch(new RegExp(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world\\.js$`));
    expect(document.languageId).toBe('javascript');
    expect(document.getText()).toContain('LwcHelloWorld');

    // reads .html file
    document = readAsTextDocument(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world.html`, fileSystemProvider);
    expect(document.uri).toMatch(new RegExp(`${FORCE_APP_ROOT}/lwc/hello_world/hello_world\\.html$`));
    expect(document.languageId).toBe('html');
    expect(document.getText()).toContain('Hello From a Lightning Web Component');

    // aura components have the html languageId in the sfdx extentions
    document = readAsTextDocument(`${FORCE_APP_ROOT}/aura/helloWorldApp/helloWorldApp.app`, fileSystemProvider);
    expect(document.languageId).toBe('html');
    document = readAsTextDocument(`${FORCE_APP_ROOT}/aura/wireLdsCmp/wireLdsCmp.cmp`, fileSystemProvider);
    expect(document.languageId).toBe('html');
});
