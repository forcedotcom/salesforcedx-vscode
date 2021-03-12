import { expect } from 'chai';
import * as path from 'path';
import { EditorView, InputBox, Workbench } from 'vscode-extension-tester';

// tslint:disable-next-line:only-arrow-functions
describe('Hello World SOQL UI Tests', function() {
  this.timeout(55000);
  let editorView: EditorView;
  const filePath = path.resolve(__dirname, 'example.soql');

  before(async () => {
    editorView = await new EditorView();
  });

  after(async () => {
    await editorView.closeAllEditors();
  });

  it('openEditor works with text editor', async done => {
    await new Promise(res => {
      setTimeout(res, 5000);
    });
    console.log('====>', filePath);
    await editorView.closeAllEditors();
    await new Workbench().executeCommand('File: Open file...');
    const input = await InputBox.create();
    await new Promise(res => setTimeout(res, 5000));
    await input.setText(filePath);
    await new Promise(res => setTimeout(res, 5000));
    await input.confirm();
    await new Promise(res => setTimeout(res, 1000));

    const editor = await editorView.openEditor('example.soql');
    const title = await editor.getTitle();
    console.log('HEY JONNY====> ', title);
    expect(title).equal('example.soql');
    done();
  });
});
