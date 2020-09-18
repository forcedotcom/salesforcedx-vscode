import { Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs';
import { QueryResult } from 'jsforce';
import * as path from 'path';
import * as vscode from 'vscode'; // TODO: only import what we need from vscode
import { QUERY_DATA_DIR_NAME, QUERY_DATA_EXT } from '../constants';

// const sfdxCoreExports = vscode.extensions.getExtension(
//   'salesforce.salesforcedx-vscode-core'
// )!.exports;
// const notificationService = sfdxCoreExports.notificationService;

export class QueryRunner {
  constructor(
    private connection: Connection,
    private document: vscode.TextDocument
  ) {}

  // TODO:
  // handle types better? this returns a jsonMap[], type comes from QueryResult < T >
  // provide some feedback to the user that the query is runing.
  public async runAndSaveQuery(queryText: string) {
    try {
      const rawQueryData = (await this.connection.query(
        queryText
      )) as QueryResult<JsonMap>;
      const cleanQueryRecords = this.flattenQueryData(rawQueryData);
      const queryDataWithDocumentPath = this.saveQueryDataToFile(
        cleanQueryRecords
      );

      return {
        records: cleanQueryRecords,
        filePath: queryDataWithDocumentPath
      };
    } catch (error) {
      error = JSON.stringify(error, null, 2);
      console.log('runQuery error', error);
      vscode.window.showErrorMessage(`Could not run the Query \n ${error}`); // TODO: handle errors from running query results
      throw error;
    }
  }
  /*
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and diplayed correctly
  */
  private flattenQueryData(rawqQueryData: QueryResult<JsonMap>) {
    const records = rawqQueryData.records;
    // filter out the attributes key
    records.forEach(result => delete result.attributes);
    return records;
  }

  // NOTE: can use the VS Code Core Utils to do this get the workspace path.
  private saveQueryDataToFile(queryRecords: JsonMap[]) {
    const queryRecordsJson = JSON.stringify(queryRecords);
    const workspace = vscode.workspace;
    // Assumes a single sfdx-proj is root directory
    const workspacePath = workspace.workspaceFolders![0];

    // --- SAVE REUSLTS IN A FILE WITH TEXT DOCUMENT --- //
    const documentPath = this.document.uri.fsPath;
    const queryDataPathWithDocument = `${documentPath}.${QUERY_DATA_EXT}`;
    fs.writeFileSync(queryDataPathWithDocument, queryRecordsJson);

    // --- SAVE RESULTS IN A DATA DIRECTORY --- //
    const documentName = this.getDocumentName(this.document);
    const queryDataDirectoryUri = vscode.Uri.joinPath(
      workspacePath.uri,
      QUERY_DATA_DIR_NAME
    );
    const queryDataFilePathInDirectory = path.join(
      queryDataDirectoryUri.fsPath,
      `${documentName}.${QUERY_DATA_EXT}`
    );

    // will create the directory if it does not exist
    fs.mkdirSync(queryDataDirectoryUri.fsPath, {
      recursive: true
    });
    fs.writeFileSync(queryDataFilePathInDirectory, queryRecordsJson);

    return queryDataPathWithDocument;
  }

  private getDocumentName(document: vscode.TextDocument) {
    const documentPath = document.uri.fsPath;
    return documentPath.split('/').pop();
  }
}
