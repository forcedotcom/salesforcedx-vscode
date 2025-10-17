/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_WORKSPACE_ROOT } from '@salesforce/salesforcedx-lightning-lsp-common/src/__tests__/testUtils';
import { AuraWorkspaceContext } from '../../context/auraContext';
import { startServer, onCompletion, onHover, onDefinition, onReferences } from '../ternServer';

const LIGHTNING_EXAMPLES_APP_PATH = `${SFDX_WORKSPACE_ROOT}/force-app/main/default/aura/lightningExamplesApp/`;

describe('tern completion', () => {
    it('tern completions', async () => {
        const ws = SFDX_WORKSPACE_ROOT;
        const context = new AuraWorkspaceContext(ws);
        await context.configureProject();

        await startServer(ws, ws);
        const completions = await onCompletion({
            textDocument: {
                uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`,
            },
            position: {
                line: 0,
                character: 0,
            },
        });
        expect(completions).toMatchSnapshot();
    });

    it('tern hover', async () => {
        const hover = await onHover({
            textDocument: {
                uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`,
            },
            position: {
                line: 2,
                character: 10,
            },
        });
        expect(hover).toMatchSnapshot();
    });

    it('tern definition, same file', async () => {
        const helper = await onDefinition({
            textDocument: {
                uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`,
            },
            position: {
                line: 2,
                character: 10,
            },
        });
        expect(helper).toMatchSnapshot();
    });

    it('tern references', async () => {
        const functionInsideHelper = await onReferences({
            textDocument: {
                uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppHelper.js`,
            },
            position: {
                line: 1,
                character: 11,
            },
            context: {
                includeDeclaration: false,
            },
        });
        expect(functionInsideHelper).toMatchSnapshot();
    });
});
