// /*
//  * Copyright (c) 2020, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */

// import {
//   registryData,
//   SourceComponent
// } from '@salesforce/source-deploy-retrieve';
// import {
//   ComponentDiagnostic,
//   ComponentRetrieval,
//   RetrieveStatus,
//   SourceRetrieveResult
// } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
// import { expect } from 'chai';
// import { join } from 'path';
// import { outputRetrieveTable } from '../../../../src/commands/util/retrieveParser';
// import { nls } from '../../../../src/messages';

// describe('retrieveParser', () => {
//   it('Should handle an SourceRetrieveResult with no components and no message', () => {
//     const emptyResult = {
//       status: RetrieveStatus.Succeeded,
//       success: true,
//       components: []
//     } as SourceRetrieveResult;

//     const parsedResult = outputRetrieveTable(emptyResult);
//     expect(parsedResult).to.equal(
//       nls.localize(
//         'lib_retrieve_result_parse_error',
//         JSON.stringify({
//           status: RetrieveStatus.Succeeded,
//           success: true,
//           components: []
//         })
//       )
//     );
//   });

//   it('Should handle an SourceRetrieveResult with no components but with message', () => {
//     const emptyResult = {
//       status: RetrieveStatus.Succeeded,
//       success: true,
//       components: [],
//       messages: 'Message from library'
//     } as SourceRetrieveResult;

//     const parsedResult = outputRetrieveTable(emptyResult);
//     expect(parsedResult).to.equal('Message from library');
//   });

//   it('Should handle a fully formed SourceRetrieveResult', () => {
//     const apexClassPath = join('classes', 'MyTestClass.cls');
//     const apexClassXmlPath = `${apexClassPath}-meta.xml`;
//     const component = SourceComponent.createVirtualComponent(
//       {
//         name: 'MyTestClass',
//         type: registryData.types.apexclass,
//         xml: apexClassXmlPath,
//         content: apexClassPath
//       },
//       [
//         {
//           dirPath: 'classes',
//           children: ['MyTestClass.cls', 'MyTestClass.cls-meta.xml']
//         }
//       ]
//     );
//     const componentRetrieval = {
//       component,
//       status: RetrieveStatus.Succeeded
//     } as ComponentRetrieval;

//     const successfulResult = {
//       status: RetrieveStatus.Succeeded,
//       success: true,
//       components: [componentRetrieval]
//     } as SourceRetrieveResult;

//     const parsedResult = outputRetrieveTable(successfulResult);

//     let expectedResult = '=== Retrieved Source\n';
//     expectedResult +=
//       'FULL NAME    TYPE       PROJECT PATH                    \n';
//     expectedResult +=
//       '───────────  ─────────  ────────────────────────────────\n';
//     expectedResult += `MyTestClass  ApexClass  ${apexClassPath}         \n`;
//     expectedResult += `MyTestClass  ApexClass  ${apexClassXmlPath}\n`;

//     expect(parsedResult).to.equal(expectedResult);
//   });

//   it('Should handle a malformed SourceRetrieveResult', () => {
//     // @ts-ignore
//     const apiResultWithOutType = {
//       success: true,
//       status: RetrieveStatus.Succeeded,
//       components: [
//         {
//           // @ts-ignore
//           name: 'MyTestClass',
//           xml: 'some/path/MyTestClass.cls-meta.xml',
//           // @ts-ignore
//           walkContent(): ['some/path/MyTestClass.cls'];
//         }
//       ],
//       messages: 'Message from library'
//     } as SourceRetrieveResult;
//     const parsedResult = outputRetrieveTable(apiResultWithOutType);

//     expect(parsedResult).to.equal(
//       nls.localize(
//         'lib_retrieve_result_parse_error',
//         JSON.stringify(apiResultWithOutType)
//       )
//     );
//   });

//   it('Should handle a SourceRetrieveResult with components and diagnostics', () => {
//     const apexClassPath = join('classes', 'MyTestClass.cls');
//     const apexClassXmlPath = `${apexClassPath}-meta.xml`;
//     const component = SourceComponent.createVirtualComponent(
//       {
//         name: 'MyTestClass',
//         type: registryData.types.apexclass,
//         xml: apexClassXmlPath,
//         content: apexClassPath
//       },
//       [
//         {
//           dirPath: 'classes',
//           children: ['MyTestClass.cls', 'MyTestClass.cls-meta.xml']
//         }
//       ]
//     );
//     const badComponent = SourceComponent.createVirtualComponent(
//       {
//         name: 'MyBadClass',
//         type: registryData.types.apexclass,
//         xml: apexClassXmlPath,
//         content: apexClassPath
//       },
//       [
//         {
//           dirPath: 'classes',
//           children: ['MyBadClass.cls', 'MyBadClass.cls-meta.xml']
//         }
//       ]
//     );
//     const componentRetrieval = {
//       component,
//       status: RetrieveStatus.Succeeded
//     } as ComponentRetrieval;

//     const componentDiagnostic = {
//       filePath: apexClassPath,
//       type: 'Error',
//       message: 'Missing metadata'
//     } as ComponentDiagnostic;
//     const badComponentRetrieval = {
//       component: badComponent,
//       status: RetrieveStatus.Succeeded,
//       diagnostics: componentDiagnostic
//     } as ComponentRetrieval;

//     const successfulResult = {
//       status: RetrieveStatus.Succeeded,
//       success: true,
//       components: [componentRetrieval, badComponentRetrieval]
//     } as SourceRetrieveResult;

//     const parsedResult = outputRetrieveTable(successfulResult);

//     let expectedResult = '=== Retrieved Source\n';
//     expectedResult +=
//       'FULL NAME    TYPE       PROJECT PATH                    \n';
//     expectedResult +=
//       '───────────  ─────────  ────────────────────────────────\n';
//     expectedResult += `MyTestClass  ApexClass  ${apexClassPath}         \n`;
//     expectedResult += `MyTestClass  ApexClass  ${apexClassXmlPath}\n`;

//     expectedResult += '\n=== Retrieve Warnings\n';
//     expectedResult += 'FULL NAME   MESSAGE TYPE  MESSAGE         \n';
//     expectedResult += '──────────  ────────────  ────────────────\n';
//     expectedResult += 'MyBadClass  Error         Missing metadata\n';

//     expect(parsedResult).to.equal(expectedResult);
//   });
// });
