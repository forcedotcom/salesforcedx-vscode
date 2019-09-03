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
// import {
//   ForceSourceRetrieveExecutor,
//   generateSuffix
// } from '../../../src/commands';
// import { LWC_DEFINITION_FILE_EXTS } from '../../../src/commands/templates/metadataTypeConstants';
// import { nls } from '../../../src/messages';
// import { notificationService } from '../../../src/notifications';
// import { BrowserNode, NodeType } from '../../../src/orgBrowser';
// import { FilePathExistsChecker, GlobStrategyFactory } from '../../../src/commands/util';

// describe('Force Source Retrieve', () => {
//   it('should build source retrieve command', async () => {
//     const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
//       'ApexClass',
//       'testComponent'
//     );
//     const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
//     expect(forceSourceRetrieveCmd.toCommand()).to.equal(
//       `sfdx force:source:retrieve -m ApexClass:testComponent`
//     );
//   });
// });

// describe('Generate Appropriate Suffix', () => {
//   it('should generate suffix based on metadata object info', async () => {
//     const metadataObject = {
//       xmlName: 'typeNode1',
//       directoryName: 'testDirectory',
//       suffix: 'cls',
//       inFolder: false,
//       metaFile: false,
//       label: 'Type Node 1'
//     };
//     const typeNode = new BrowserNode(
//       'ApexClass',
//       NodeType.MetadataType,
//       undefined,
//       metadataObject
//     );
//     const suffixes = generateSuffix(typeNode, 'ApexClass');
//     expect(suffixes).to.eql([`.${typeNode.metadataObject!.suffix}-meta.xml`]);
//   });

//   it('should generate appropriate suffix if lightning type', async () => {
//     const metadataObject = {
//       xmlName: 'typeNode2',
//       directoryName: 'testDirectory',
//       inFolder: false,
//       metaFile: false,
//       label: 'Type Node 2'
//     };
//     const typeNode = new BrowserNode(
//       'LightningComponentBundle',
//       NodeType.MetadataType,
//       undefined,
//       metadataObject
//     );
//     const expected = LWC_DEFINITION_FILE_EXTS.map(ext => `${ext!}-meta.xml`);
//     const suffixes = generateSuffix(typeNode, 'LightningComponentBundle');
//     expect(suffixes).to.eql(expected);
//   });
// });

// describe('FilePathExistsChecker for Aura bundle', () => {
//   let findFilesSpy: sinon.SinonSpy;
//   let warningSpy: sinon.SinonSpy;
//   let findFilesStub: sinon.SinonStub;

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

//     it('Should return ContinueResponse if path specified does not have existing lightning files', async () => {
//       const fileExts = LWC_DEFINITION_FILE_EXTS.map(ext => `${ext!}-meta.xml`);

//       const postChecker = new FilePathExistsChecker(
//         fileExts,
//         new BundlePathStrategy(),
//         'testLWC',
//         'aura',
//         'testLWC'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//     });
//   });

//   describe('With notification warning', () => {
//     before(() => {
//       findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
//       warningSpy = sinon
//         .stub(notificationService, 'showWarningMessage')
//         .onFirstCall()
//         .returns(nls.localize('warning_prompt_continue_confirm'))
//         .onSecondCall()
//         .returns(nls.localize('warning_prompt_overwrite_cancel'));
//     });

//     after(() => {
//       findFilesStub.restore();
//       warningSpy.restore();
//     });

//     it('Should return ContinueResponse if lightning files exist in specified path and user selects continue', async () => {
//       const fileExts = LWC_DEFINITION_FILE_EXTS.map(ext => `${ext!}-meta.xml`);
//       const testFile = path.join(
//         'force-app',
//         'main',
//         'default',
//         'aura',
//         'testLWC',
//         'testLWC.js-meta.xml'
//       );
//       findFilesStub.returns([testFile]);
//       const postChecker = new FilePathExistsChecker(
//         GlobStrategyFactory.createCheckBundleInAllPackages(...fileExts),
//         // 'testLWC',
//         // 'aura',
//         'testLWC'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledOnce(findFilesStub);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//     });

//     it('Should return CancelResponse if lightning files exist in specified path and user selects No/Cancel', async () => {
//       const fileExts = LWC_DEFINITION_FILE_EXTS.map(ext => `${ext!}-meta.xml`);
//       const testFile = path.join(
//         'force-app',
//         'main',
//         'default',
//         'aura',
//         'testLWC',
//         'testLWC.js-meta.xml'
//       );
//       findFilesStub.returns([testFile]);
//       const postChecker = new FilePathExistsChecker(
//         fileExts,
//         new BundlePathStrategy(),
//         'testLWC',
//         'aura',
//         'testLWC'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledTwice(findFilesStub);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });
//   });
// });

// describe('FilePathExistsChecker for Apex class', () => {
//   let findFilesSpy: sinon.SinonSpy;
//   let warningSpy: sinon.SinonSpy;
//   let findFilesStub: sinon.SinonStub;

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

//     it('Should return ContinueResponse if path specified does not have existing apex classes', async () => {
//       const postChecker = new FilePathExistsChecker(
//         ['.cls'],
//         new DefaultPathStrategy(),
//         'testClass',
//         'classes',
//         'testClass'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledOnce(findFilesSpy);
//       sinon.assert.notCalled(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//     });
//   });

//   describe('With notification warning', () => {
//     before(() => {
//       findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
//       warningSpy = sinon
//         .stub(notificationService, 'showWarningMessage')
//         .onFirstCall()
//         .returns(nls.localize('warning_prompt_continue_confirm'))
//         .onSecondCall()
//         .returns(nls.localize('warning_prompt_overwrite_cancel'));
//     });

//     after(() => {
//       findFilesStub.restore();
//       warningSpy.restore();
//     });

//     it('Should return ContinueResponse if apex classes exist in specified path and user selects continue', async () => {
//       const testFile = path.join(
//         'force-app',
//         'main',
//         'default',
//         'classes',
//         'testClass.cls-meta.xml'
//       );
//       findFilesStub.returns([testFile]);
//       const postChecker = new FilePathExistsChecker(
//         ['.cls'],
//         new DefaultPathStrategy(),
//         'testClass',
//         'classes',
//         'testClass'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledOnce(findFilesStub);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CONTINUE');
//     });

//     it('Should return CancelResponse if apex classes exist in specified path and user selects No/Cancel', async () => {
//       const testFile = path.join(
//         'force-app',
//         'main',
//         'default',
//         'classes',
//         'testClass.cls-meta.xml'
//       );
//       findFilesStub.returns([testFile]);
//       const postChecker = new FilePathExistsChecker(
//         ['.cls'],
//         new DefaultPathStrategy(),
//         'testClass',
//         'classes',
//         'testClass'
//       );

//       const response = await postChecker.check();
//       sinon.assert.calledTwice(findFilesStub);
//       sinon.assert.called(warningSpy);
//       expect(response.type).to.equal('CANCEL');
//     });
//   });
// });
