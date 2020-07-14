import { workspace, Uri, WorkspaceConfiguration } from 'vscode';
import { SinonStub, stub } from 'sinon';

let getConfigurationStub: SinonStub<
  [string?, (Uri | null)?],
  WorkspaceConfiguration
>;
let mockBaseConfiguration = {
  has(section: string) {
    return true;
  },
  inspect(section: string) {
    return undefined;
  },
  async update(section: string, value: any) {}
};

/**
 * Mock "debug.javascript.usePreview" value
 * @param enabled is configuration enabled
 */
export function mockPreviewJavaScriptDebugger(enabled: boolean = true) {
  if (!getConfigurationStub) {
    getConfigurationStub = stub(workspace, 'getConfiguration');
  }
  const mockConfiguration: WorkspaceConfiguration = {
    ...mockBaseConfiguration,
    get(section: string) {
      if (section === 'javascript.usePreview') return enabled;
    }
  };
  getConfigurationStub.returns(mockConfiguration);
}

export function unmockPreviewJavaScriptDebugger() {
  getConfigurationStub.restore();
}
