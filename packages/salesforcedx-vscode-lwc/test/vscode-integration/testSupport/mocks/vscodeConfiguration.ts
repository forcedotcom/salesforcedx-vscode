import * as vscode from 'vscode';
import { workspace, Uri, WorkspaceConfiguration } from 'vscode';
import { SinonStub, stub } from 'sinon';

let getConfigurationStub: SinonStub<
  [string?, (Uri | null)?],
  WorkspaceConfiguration
>;
const mockBaseConfiguration = {
  has(section: string) {
    return true;
  },
  inspect(section: string) {
    return undefined;
  },
  async update(section: string, value: any) {}
};
const mockDebugConfigurationJson: { [index: string]: any } = {};
const mockDebugConfiguration: WorkspaceConfiguration = {
  ...mockBaseConfiguration,
  get(section: string) {
    return mockDebugConfigurationJson[section];
  }
};

/**
 * Mock "debug.javascript.usePreview" value
 * @param enabled is configuration enabled
 */
export function mockPreviewJavaScriptDebugger(enabled: boolean) {
  getConfigurationStub = stub(workspace, 'getConfiguration');
  mockDebugConfigurationJson['javascript.usePreview'] = enabled;
  getConfigurationStub.returns(mockDebugConfiguration);
}

export function unmockPreviewJavaScriptDebugger() {
  getConfigurationStub.restore();
}
