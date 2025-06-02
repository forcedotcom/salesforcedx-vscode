import { test } from 'vscode-test-playwright';

test('test recorder', async ({ page, _enableRecorder }) => {
  await new Promise(resolve => setTimeout(resolve, 100000));
});
