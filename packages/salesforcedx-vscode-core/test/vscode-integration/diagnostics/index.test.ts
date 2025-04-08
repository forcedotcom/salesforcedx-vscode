/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ProjectDeployStartErrorResponse } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as path from 'path';
import { DiagnosticCollection, languages, Uri } from 'vscode';
import { getAbsoluteFilePath, getFileUri, getRange, handlePushDiagnosticErrors } from '../../../src/diagnostics';

describe('Diagnostics', () => {
  let pushErrorResult: ProjectDeployStartErrorResponse;
  const workspacePath = 'local/workspace/path';
  const sourcePath = 'source/file/path';
  let errorCollection: DiagnosticCollection;

  beforeEach(() => {
    errorCollection = languages.createDiagnosticCollection('test-errors');
    pushErrorResult = {
      message: 'Push failed.',
      name: 'PushFailed',
      status: 1,
      warnings: [],
      files: []
    };
  });

  afterEach(() => {
    errorCollection.dispose();
  });

  it('Should prevent generating range with negative positions', () => {
    const range = getRange('0', '-12');
    expect(range.start.line).to.eql(0);
    expect(range.start.character).to.eql(0);
    expect(range.end.line).to.eql(0);
    expect(range.end.character).to.eql(0);
  });

  it('Should convert to 0 based index for range', () => {
    const range = getRange('1', '2');
    expect(range.start.line).to.equal(0);
    expect(range.start.character).to.equal(1);
    expect(range.end.line).to.equal(0);
    expect(range.end.character).to.equal(1);
  });

  it('Should create diagnostics based off of push error results', () => {
    const resultItem = {
      filePath: 'src/classes/Testing.cls',
      error: 'Invalid method referenced.',
      lineNumber: '1',
      columnNumber: '1',
      type: 'ApexClass',
      fullName: 'Testing'
    };

    pushErrorResult.files?.push(resultItem);

    handlePushDiagnosticErrors(pushErrorResult, workspacePath, sourcePath, errorCollection);

    const testDiagnostics = languages.getDiagnostics(Uri.file(path.join(workspacePath, resultItem.filePath)));

    expect(testDiagnostics).to.be.an('array').to.have.lengthOf(1);
    expect(testDiagnostics[0].message).to.be.equals(resultItem.error);
    expect(testDiagnostics[0].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics[0].source).to.be.equals(resultItem.type);
    expect(testDiagnostics[0].range).to.be.an('object');

    const testRange = getRange(resultItem.lineNumber, resultItem.columnNumber);
    expect(testDiagnostics[0].range).to.deep.equal(testRange);
  });

  it('Should create multiple diagnostics based off of push error results', () => {
    const resultItem1 = {
      filePath: 'src/classes/Testing.cls',
      error: 'Invalid method referenced.',
      lineNumber: '8',
      columnNumber: '50',
      type: 'ApexClass',
      fullName: 'Testing'
    };

    const resultItem2 = {
      filePath: 'src/classes/SomeController.cls',
      error:
        'Method does not exist or incorrect signature: void runAsSOMETHINGINVALID(User) from the type System (18:20).',
      lineNumber: '18',
      columnNumber: '20',
      type: 'ApexClass',
      fullName: 'SomeController'
    };

    pushErrorResult.files?.push(resultItem1);
    pushErrorResult.files?.push(resultItem2);

    handlePushDiagnosticErrors(pushErrorResult, workspacePath, sourcePath, errorCollection);

    const testDiagnostics = languages.getDiagnostics(Uri.file(path.join(workspacePath, resultItem1.filePath)));

    expect(testDiagnostics).to.be.an('array').to.have.lengthOf(1);
    expect(testDiagnostics[0].message).to.be.equals(resultItem1.error);
    expect(testDiagnostics[0].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics[0].source).to.be.equals(resultItem1.type);
    expect(testDiagnostics[0].range).to.be.an('object');

    const testRange = getRange(resultItem1.lineNumber, resultItem1.columnNumber);
    expect(testDiagnostics[0].range).to.deep.equal(testRange);

    const testDiagnostics1 = languages.getDiagnostics(Uri.file(path.join(workspacePath, resultItem2.filePath)));

    expect(testDiagnostics1).to.be.an('array').to.have.lengthOf(1);
    expect(testDiagnostics1[0].message).to.be.equals(resultItem2.error);
    expect(testDiagnostics1[0].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics1[0].source).to.be.equals(resultItem2.type);
    expect(testDiagnostics1[0].range).to.be.an('object');

    const testRange1 = getRange(resultItem2.lineNumber, resultItem2.columnNumber);
    expect(testDiagnostics1[0].range).to.deep.equal(testRange1);
  });

  it('Should create diagnostics under sourcePath', () => {
    const resultItem = {
      filePath: 'N/A',
      error: "Missing ';' at '{' (18:60)",
      lineNumber: '18',
      columnNumber: '60',
      type: 'ApexClass'
    };

    pushErrorResult.files?.push(resultItem);
    handlePushDiagnosticErrors(pushErrorResult, workspacePath, sourcePath, errorCollection);

    const testDiagnostics = languages.getDiagnostics(Uri.file(sourcePath));

    expect(testDiagnostics).to.be.an('array').to.have.lengthOf(1);
    expect(testDiagnostics[0].message).to.be.equals(resultItem.error);
    expect(testDiagnostics[0].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics[0].source).to.be.equals(resultItem.type);
    expect(testDiagnostics[0].range).to.be.an('object');

    const testRange = getRange(resultItem.lineNumber, resultItem.columnNumber);
    expect(testDiagnostics[0].range).to.deep.equal(testRange);
  });

  it('Should create multiple diagnostics under sourcePath', () => {
    const resultItem1 = {
      filePath: 'N/A',
      error: "Missing ';' at '{' (18:60)",
      lineNumber: '18',
      columnNumber: '60',
      type: 'ApexClass'
    };
    const resultItem2 = {
      error: 'In field: application - no CustomApplication named Permstachio found',
      type: 'PermissionSet',
      filePath: 'N/A'
    };

    pushErrorResult.files?.push(resultItem1);
    pushErrorResult.files?.push(resultItem2);
    handlePushDiagnosticErrors(pushErrorResult, workspacePath, sourcePath, errorCollection);

    const testDiagnostics = languages.getDiagnostics(Uri.file(sourcePath));
    expect(testDiagnostics).to.be.an('array').to.have.lengthOf(2);
    expect(testDiagnostics[0].message).to.be.equals(resultItem1.error);
    expect(testDiagnostics[0].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics[0].source).to.be.equals(resultItem1.type);
    expect(testDiagnostics[0].range).to.be.an('object');
    const testRange = getRange(resultItem1.lineNumber, resultItem1.columnNumber);
    expect(testDiagnostics[0].range).to.deep.equal(testRange);
    expect(testDiagnostics[1].message).to.be.equals(resultItem2.error);
    expect(testDiagnostics[1].severity).to.be.equals(0); // vscode.DiagnosticSeverity.Error === 0
    expect(testDiagnostics[1].source).to.be.equals(resultItem2.type);
    expect(testDiagnostics[1].range).to.be.an('object');
    const testRange1 = getRange('1', '1');
    expect(testDiagnostics[1].range).to.deep.equal(testRange1);
  });

  it('Should not duplicate the workspace path when constructing the fileUri', () => {
    const absoluteFilePath = `${workspacePath}/src/classes/Testing.cls`;
    const fileUri = getFileUri(workspacePath, absoluteFilePath, '');
    const regEx = new RegExp(workspacePath, 'g');
    const count = (fileUri.match(regEx) || []).length;
    expect(count).to.equal(1);
  });

  it('Should use the default error path as fileUri when N/A is returned as filePath', () => {
    const defaultErrorPath = 'default/error/path';
    const filePath = 'N/A';
    const fileUri = getFileUri(workspacePath, filePath, defaultErrorPath);
    expect(fileUri).to.equal(defaultErrorPath);
  });

  it('Should build the absolute file path when constructing the fileUri', () => {
    const filePath = 'src/classes/Testing.cls';
    const asoluteFilePath = getAbsoluteFilePath(filePath, workspacePath);
    expect(asoluteFilePath).to.equal(workspacePath + '/' + filePath);
  });

  it('Should not duplicate the workspace path when filePath is already absolute', () => {
    const filePath = `${workspacePath}/src/classes/Testing.cls`;
    const asoluteFilePath = getAbsoluteFilePath(filePath, workspacePath);
    expect(asoluteFilePath).to.equal(filePath);
  });

  it('Should use the workspace path as fileUri when filePath is undefined', () => {
    const filePath = undefined;
    const asoluteFilePath = getAbsoluteFilePath(filePath, workspacePath);
    expect(asoluteFilePath).to.equal(workspacePath);
  });
});
