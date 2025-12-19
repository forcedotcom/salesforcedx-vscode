/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TextDocument } from 'vscode-languageserver';
import templateLinter from '../linter';

it('returns a list of all the template compilation errors', () => {
    const content = '<template><template if:true="invalidExpression"></template>{Math.random()}<lighting-card></lighting-card></template>';
    const document = TextDocument.create('test://test.html', 'html', 0, content);

    const diagnostics = templateLinter(document);
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0].message).toMatch(/If directive should be an expression/);
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 20 },
        end: { character: 47 },
    });
    expect(diagnostics[1].message).toMatch(/Invalid expression/);
    expect(diagnostics[1].range).toMatchObject({
        start: { character: 59 },
        end: { character: 74 },
    });
    expect(diagnostics[2].message).toMatch(/<lighting- is not a valid namespace, sure you didn't mean "<lightning-"?/);
    expect(diagnostics[2].range).toMatchObject({
        start: { character: 74 },
        end: { character: 84 },
    });
});
