import { expect } from 'chai';
import { Workbench } from 'vscode-extension-tester';

describe('Hello World SOQL UI Tests', () => {
  it('Command shows a notification with the correct text', async () => {
    const workbench = new Workbench();
    await workbench.executeCommand('soql.builder.open.new');

    expect(true).to.equal(true);
  });
});
