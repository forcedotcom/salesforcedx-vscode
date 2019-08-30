// /*
//  * Copyright (c) 2019, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */

// import { expect } from 'chai';
// import * as path from 'path';
// import * as sinon from 'sinon';
// import * as vscode from 'vscode';
// import { nls } from '../../../../src/messages';

// import {
//   CancelResponse,
//   ContinueResponse,
//   DirFileNameSelection
// } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
// import {
//   BundlePathStrategy,
//   DefaultPathStrategy,
//   FilePathExistsChecker
// } from '../../../../src/commands/commands';
// import {
//   APEX_CLASS_EXTENSION,
//   AURA_DEFINITION_FILE_EXTS
// } from '../../../../src/commands/templates/metadataTypeConstants';
// import { notificationService } from '../../../../src/notifications';

// describe('SourcePathStrategy', () => {
//   it('successfully creates the bundle path', () => {
//     const bundlePathStrategy = new BundlePathStrategy();
//     const expectedPath = path.join('test-dir', 'TestCmp', 'TestCmp.cmp');
//     expect(
//       bundlePathStrategy.getPathToSource('test-dir', 'TestCmp', '.cmp')
//     ).to.equal(expectedPath);
//   });

//   it('successfully creates a default source path', () => {
//     const defaultPathStrategy = new DefaultPathStrategy();
//     const expectedPath = path.join('test-dir', 'TestClass.cls');
//     expect(
//       defaultPathStrategy.getPathToSource('test-dir', 'TestClass', '.cls')
//     ).to.equal(expectedPath);
//   });
// });

// describe('FilePathExistsChecker for Aura bundle', () => {
//   let findFilesSpy: sinon.SinonSpy;
//   let warningSpy: sinon.SinonSpy;

//   afterEach(() => {
//     findFilesSpy.reset();
//     warningSpy.reset();
//   });

//   describe('Without notification warning', () => {
//     before(() => {
//       findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
//       warningSpy = sinon.stub(notificationService, 'showWarningMessage');
//     });

//     after(() => {
//       findFilesSpy.restore();
//       warningSpy.restore();
//     });

//     it('Should return CancelResponse if input passed in is CancelResponse', async () => {
//       const postChecker = new FilePathExistsChecker(
//         AURA_DEFINITION_FILE_EXTS,
//         new BundlePathStrategy(),
//         nls.localize('aura_bundle_message_name')
//       );
//       const input: CancelResponse = { type: 'CANCEL' };
//       const response = await postChecker.check(input);
//       sinon.assert.notCalled(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });

//     it('Should return ContinueResponse if path specified does not have existing lightning files', async () => {
//       const postChecker = new FilePathExistsChecker(
//         AURA_DEFINITION_FILE_EXTS,
//         new BundlePathStrategy(),
//         nls.localize('aura_bundle_message_name')
//       );
//       if (!vscode.workspace.workspaceFolders![0]) {
//         throw new Error('Test workspace should be opened');
//       }
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'test',
//           outputdir: path.join('force-app', 'main', 'default', 'aura')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//       if (response.type === 'CONTINUE') {
//         expect(response).to.equal(input);
//       } else {
//         throw new Error('Response should be of type ContinueResponse');
//       }
//     });
//   });

//   describe('With notification warning', () => {
//     before(() => {
//       findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
//       warningSpy = sinon
//         .stub(notificationService, 'showWarningMessage')
//         .onFirstCall()
//         .returns(nls.localize('warning_prompt_overwrite_confirm'))
//         .onSecondCall()
//         .returns(nls.localize('warning_prompt_overwrite_cancel'));
//     });

//     after(() => {
//       findFilesSpy.restore();
//       warningSpy.restore();
//     });

//     it('Should return ContinueResponse if lightning files exist in specified path and user selects continue', async () => {
//       const postChecker = new FilePathExistsChecker(
//         AURA_DEFINITION_FILE_EXTS,
//         new BundlePathStrategy(),
//         nls.localize('aura_bundle_message_name')
//       );
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'DemoApp',
//           outputdir: path.join('force-app', 'main', 'default', 'aura')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//       if (response.type === 'CONTINUE') {
//         expect(response).to.equal(input);
//       } else {
//         throw new Error('Response should be of type ContinueResponse');
//       }
//     });

//     it('Should return CancelResponse if lightning files exist in specified path and user selects No/Cancel', async () => {
//       const postChecker = new FilePathExistsChecker(
//         AURA_DEFINITION_FILE_EXTS,
//         new BundlePathStrategy(),
//         nls.localize('aura_bundle_message_name')
//       );
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'DemoApp',
//           outputdir: path.join('force-app', 'main', 'default', 'aura')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });
//   });
// });

// describe('FilePathExistsChecker for Apex Class', () => {
//   let findFilesSpy: sinon.SinonSpy;
//   let warningSpy: sinon.SinonSpy;
//   afterEach(() => {
//     findFilesSpy.reset();
//     warningSpy.reset();
//   });

//   describe('Without notification warning', () => {
//     before(() => {
//       findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
//       warningSpy = sinon.stub(notificationService, 'showWarningMessage');
//     });

//     after(() => {
//       findFilesSpy.restore();
//       warningSpy.restore();
//     });

//     it('Should return CancelResponse if input passed in is CancelResponse', async () => {
//       const postChecker = new FilePathExistsChecker(
//         [APEX_CLASS_EXTENSION],
//         new DefaultPathStrategy(),
//         nls.localize('apex_class_message_name')
//       );
//       const input: CancelResponse = { type: 'CANCEL' };
//       const response = await postChecker.check(input);
//       sinon.assert.notCalled(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });

//     it('Should return ContinueResponse if path specified does not have existing file with specified name', async () => {
//       const postChecker = new FilePathExistsChecker(
//         [APEX_CLASS_EXTENSION],
//         new DefaultPathStrategy(),
//         nls.localize('apex_class_message_name')
//       );
//       if (!vscode.workspace.workspaceFolders![0]) {
//         throw new Error('Test workspace should be opened');
//       }
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'test',
//           outputdir: path.join('force-app', 'main', 'default', 'classes')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//       if (response.type === 'CONTINUE') {
//         expect(response).to.equal(input);
//       } else {
//         throw new Error('Response should be of type ContinueResponse');
//       }
//     });
//   });

//   describe('With notification warning', () => {
//     before(() => {
//       findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
//       warningSpy = sinon
//         .stub(notificationService, 'showWarningMessage')
//         .onFirstCall()
//         .returns(nls.localize('warning_prompt_overwrite_confirm'))
//         .onSecondCall()
//         .returns(nls.localize('warning_prompt_overwrite_cancel'));
//     });

//     after(() => {
//       findFilesSpy.restore();
//       warningSpy.restore();
//     });

//     it('Should return ContinueResponse if files exist in specified path and user selects continue', async () => {
//       const postChecker = new FilePathExistsChecker(
//         [APEX_CLASS_EXTENSION],
//         new DefaultPathStrategy(),
//         nls.localize('apex_class_message_name')
//       );
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'DemoController',
//           outputdir: path.join('force-app', 'main', 'default', 'classes')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//       if (response.type === 'CONTINUE') {
//         expect(response).to.equal(input);
//       } else {
//         throw new Error('Response should be of type ContinueResponse');
//       }
//     });

//     it('Should return CancelResponse if files exist in specified path and user selects No/Cancel', async () => {
//       const postChecker = new FilePathExistsChecker(
//         [APEX_CLASS_EXTENSION],
//         new DefaultPathStrategy(),
//         nls.localize('apex_class_message_name')
//       );
//       const input: ContinueResponse<DirFileNameSelection> = {
//         type: 'CONTINUE',
//         data: {
//           fileName: 'DemoController',
//           outputdir: path.join('force-app', 'main', 'default', 'classes')
//         }
//       };
//       const response = await postChecker.check(input);
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });
//   });
// });
