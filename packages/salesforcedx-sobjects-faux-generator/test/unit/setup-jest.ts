const getMockVSCode = () => {
  return {
    commands: jest.fn(),
    Disposable: jest.fn(),
    env: {
      machineId: '12345534'
    },
    Uri: {
      parse: jest.fn()
    },
    window: {
      showInformationMessage: jest.fn()
    },
    workspace: {
      getConfiguration: () => {
        return {
          get: () => true
        };
      },
      onDidChangeConfiguration: jest.fn()
    }
  };
};

jest.mock(
  'vscode',
  () => {
    return getMockVSCode();
  },
  { virtual: true }
);
