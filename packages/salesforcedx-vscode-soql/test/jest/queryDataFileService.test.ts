import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as vscode from 'vscode';
import { FileFormat, QueryDataFileService} from '../../src/queryDataView/queryDataFileService';

jest.mock('vscode', () => {
  return {
    Uri: {
      file: jest.fn(),
      parse: jest.fn()
    },
    window: {
      showSaveDialog: jest.fn()
    },
    workspace: {
      fs: {
        writeFile: jest.fn()
      }
    }
  };
});

describe('QueryDataFileService', () => {
  const queryText = 'SELECT * FROM Accounts';
  const queryData: QueryResult<JsonMap> = { done: true, totalSize: 1, records: [{ Id: '123' }]};
  const format = FileFormat.JSON;
  const document = { uri: { path: '/path/to/file' } } as unknown as vscode.TextDocument;

  const queryDataFileService = new QueryDataFileService(queryText, queryData, format, document);

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('save() should save the file correctly and return the file path', async () => {
    const mockDefaultFileName = 'test.json';
    const mockFileContentString = '{"test": "content"}';
    const mockSaveDir = '/path/to/save';
    const mockSavedFilePath = `${mockSaveDir}/${mockDefaultFileName}`;
    const mockFileContent = new TextEncoder().encode(mockFileContentString);

    (vscode.window.showSaveDialog as any).mockResolvedValue({ fsPath: mockSavedFilePath } as vscode.Uri);
    (vscode.Uri.file as any).mockReturnValue({} as vscode.Uri);

    queryDataFileService['dataProvider'].getFileName = jest.fn().mockReturnValue(mockDefaultFileName);
    queryDataFileService['dataProvider'].getFileContent = jest.fn().mockReturnValue(mockFileContentString);
    queryDataFileService['showFileInExplorer'] = jest.fn();
    queryDataFileService['showSaveSuccessMessage'] = jest.fn();

    const savedFilePath = await queryDataFileService.save();

    expect(vscode.window.showSaveDialog).toHaveBeenCalled();
    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith({ fsPath: mockSavedFilePath }, mockFileContent);
    expect(queryDataFileService['showFileInExplorer']).toHaveBeenCalledWith(mockSavedFilePath);
    expect(queryDataFileService['showSaveSuccessMessage']).toHaveBeenCalledWith(mockDefaultFileName);
    expect(savedFilePath).toBe(mockSavedFilePath);
  });
});
