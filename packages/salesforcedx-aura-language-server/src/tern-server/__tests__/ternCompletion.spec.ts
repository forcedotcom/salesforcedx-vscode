import { AuraWorkspaceContext } from '../../context/aura-context';
import { startServer, onCompletion, onHover, onDefinition, onReferences } from '../tern-server';

it('tern completions', async () => {
    const ws = 'test-workspaces/sfdx-workspace';
    const context = new AuraWorkspaceContext(ws);
    await context.configureProject();

    await startServer(ws, ws);
    const completions = await onCompletion({
        textDocument: {
            uri: 'force-app/main/default/aura/lightningExamplesApp/lightningExamplesAppController.js',
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
            uri: 'force-app/main/default/aura/lightningExamplesApp/lightningExamplesAppController.js',
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
            uri: 'force-app/main/default/aura/lightningExamplesApp/lightningExamplesAppController.js',
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
            uri: 'force-app/main/default/aura/lightningExamplesApp/lightningExamplesAppHelper.js',
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
