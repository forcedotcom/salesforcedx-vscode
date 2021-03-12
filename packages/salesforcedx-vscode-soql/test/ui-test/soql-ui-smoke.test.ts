import { expect } from 'chai';
import * as path from 'path';
import {
  EditorView,
  InputBox,
  TextEditor,
  Workbench
} from 'vscode-extension-tester';

// tslint:disable-next-line:only-arrow-functions
describe('Hello World SOQL UI Tests', function() {
  this.timeout(55000);
  let editorView: EditorView;
  let editor: TextEditor;
  const folderPath = path.resolve(__dirname, 'resources', 'sfdx-test-project');

  before(async () => {
    editorView = await new EditorView();
    editor = await new TextEditor(editorView);
  });

  after(async () => {
    await editorView.closeAllEditors();
  });

  it('openEditor works with text editor', async done => {
    await new Promise(res => {
      setTimeout(res, 5000);
    });
    console.log('Folder Path====>', folderPath);
    await editorView.closeAllEditors();
    await new Workbench().executeCommand('Extest: Open Folder');
    const input = await InputBox.create();
    await new Promise(res => setTimeout(res, 5000));
    await input.setText(folderPath);
    await new Promise(res => setTimeout(res, 5000));
    await input.confirm();
    await new Promise(res => setTimeout(res, 1000));

    // await editorView.openEditor('example.soql');
    // const title = await editor.getTitle();
    // expect(title).equal('example.soql');
    done();
  });
});
