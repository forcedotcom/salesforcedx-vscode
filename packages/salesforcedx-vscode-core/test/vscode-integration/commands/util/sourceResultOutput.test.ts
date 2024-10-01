/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// import { Table } from '@salesforce/salesforcedx-utils-vscode';
// import {
//   ComponentStatus,
//   registryData,
//   SourceComponent,
//   SourceDeployResult,
//   SourceRetrieveResult,
//   ToolingDeployStatus
// } from '@salesforce/source-deploy-retrieve-bundle';
// import { expect } from 'chai';
// import * as path from 'path';
// import {
//   createDeployOutput,
//   createRetrieveOutput
// } from '../../../../src/commands/util';
// import { nls } from '../../../../src/messages';

// describe('Source Deploy/Retrieve Output Utils', () => {
//   const root = path.join(path.sep, 'path', 'to', 'project');
//   const packageDirs = ['force-app', path.join('test', 'force-app2')];
//   const apexClassPathOne = path.join(packageDirs[0], 'classes', 'test.cls');
//   const apexClassXmlPathOne = `${apexClassPathOne}-meta.xml`;
//   const apexClassPathTwo = path.join(packageDirs[1], 'classes', 'testTwo.cls');
//   const apexClassXmlPathTwo = `${apexClassPathTwo}-meta.xml`;
//   const lwcJsPath = path.join(packageDirs[0], 'lwc', 'test', 'test.js');
//   const lwcXmlPath = `${lwcJsPath}-meta.xml`;
//   const apexComponentOne = SourceComponent.createVirtualComponent(
//     {
//       name: 'test',
//       type: registryData.types.apexclass,
//       xml: path.join(root, apexClassXmlPathOne),
//       content: path.join(root, apexClassPathOne)
//     },
//     [
//       {
//         dirPath: path.join(root, packageDirs[0], 'classes'),
//         children: ['test.cls', 'test.cls-meta.xml']
//       }
//     ]
//   );
//   const apexComponentTwo = SourceComponent.createVirtualComponent(
//     {
//       name: 'test',
//       type: registryData.types.apexclass,
//       xml: path.join(root, apexClassXmlPathTwo),
//       content: path.join(root, apexClassPathTwo)
//     },
//     [
//       {
//         dirPath: path.join(root, packageDirs[1], 'classes'),
//         children: ['testTwo.cls', 'testTwo.cls-meta.xml']
//       }
//     ]
//   );
//   const lwcComponent = SourceComponent.createVirtualComponent(
//     {
//       name: 'test',
//       type: registryData.types.lightningcomponentbundle,
//       xml: path.join(root, lwcXmlPath),
//       content: path.join(root, packageDirs[0], 'lwc', 'test')
//     },
//     [
//       {
//         dirPath: path.join(root, packageDirs[0], 'lwc'),
//         children: ['test']
//       },
//       {
//         dirPath: path.join(root, packageDirs[0], 'lwc', 'test'),
//         children: ['test.js', 'test.js-meta.xml']
//       }
//     ]
//   );

//   describe('createDeployOutput', () => {
//     const deploySuccessColumns = [
//       { key: 'state', label: nls.localize('table_header_state') },
//       { key: 'fullName', label: nls.localize('table_header_full_name') },
//       { key: 'type', label: nls.localize('table_header_type') },
//       {
//         key: 'filePath',
//         label: nls.localize('table_header_project_path')
//       }
//     ];
//     const deployFailureColumns = [
//       {
//         key: 'filePath',
//         label: nls.localize('table_header_project_path')
//       },
//       { key: 'error', label: nls.localize('table_header_errors') }
//     ];
//     it('should create a table with successful results', async () => {
//       const { fullName, type } = apexComponentOne;
//       const result: SourceDeployResult = {
//         success: true,
//         id: '',
//         status: ToolingDeployStatus.Completed,
//         components: [
//           {
//             component: apexComponentOne,
//             status: ComponentStatus.Changed,
//             diagnostics: []
//           }
//         ]
//       };
//       const expectedOutput = new Table().createTable(
//         [
//           {
//             state: 'Changed',
//             fullName,
//             type: type.name,
//             filePath: apexClassPathOne
//           },
//           {
//             state: 'Changed',
//             fullName,
//             type: type.name,
//             filePath: apexClassXmlPathOne
//           }
//         ],
//         deploySuccessColumns,
//         nls.localize(`table_title_deployed_source`)
//       );
//       expect(createDeployOutput(result, packageDirs)).to.equal(expectedOutput);
//     });

//     it('should create a table with successful results for multiple components', async () => {
//       const result: SourceDeployResult = {
//         success: true,
//         id: '',
//         status: ToolingDeployStatus.Completed,
//         components: [
//           {
//             component: apexComponentOne,
//             status: ComponentStatus.Changed,
//             diagnostics: []
//           },
//           {
//             component: apexComponentTwo,
//             status: ComponentStatus.Changed,
//             diagnostics: []
//           }
//         ]
//       };
//       const expectedOutput = new Table().createTable(
//         [
//           {
//             state: 'Changed',
//             fullName: apexComponentOne.fullName,
//             type: apexComponentOne.type.name,
//             filePath: apexClassPathOne
//           },
//           {
//             state: 'Changed',
//             fullName: apexComponentOne.fullName,
//             type: apexComponentOne.type.name,
//             filePath: apexClassXmlPathOne
//           },
//           {
//             state: 'Changed',
//             fullName: apexComponentTwo.fullName,
//             type: apexComponentTwo.type.name,
//             filePath: apexClassPathTwo
//           },
//           {
//             state: 'Changed',
//             fullName: apexComponentTwo.fullName,
//             type: apexComponentTwo.type.name,
//             filePath: apexClassXmlPathTwo
//           }
//         ],
//         deploySuccessColumns,
//         nls.localize(`table_title_deployed_source`)
//       );
//       expect(createDeployOutput(result, packageDirs)).to.equal(expectedOutput);
//     });

//   it('should create a table with successful results for a bundle type component', async () => {
//     const { fullName, type } = lwcComponent;
//     const result: SourceDeployResult = {
//       success: true,
//       id: '',
//       status: DeployStatus.Succeeded,
//       components: [
//         {
//           component: lwcComponent,
//           status: ComponentStatus.Created,
//           diagnostics: []
//         }
//       ]
//     };
//     const expectedOutput = new Table().createTable(
//       [
//         {
//           state: 'Created',
//           fullName,
//           type: type.name,
//           filePath: lwcJsPath
//         },
//         {
//           state: 'Created',
//           fullName,
//           type: type.name,
//           filePath: lwcXmlPath
//         }
//       ],
//       deploySuccessColumns,
//       nls.localize(`table_title_deployed_source`)
//     );
//     expect(createDeployOutput(result, packageDirs)).to.equal(expectedOutput);
//   });

//   it('should create a table with failed results', async () => {
//     const result: SourceDeployResult = {
//       success: false,
//       id: '',
//       status: DeployStatus.Failed,
//       components: [
//         {
//           component: apexComponentOne,
//           status: ComponentStatus.Failed,
//           diagnostics: [
//             {
//               lineNumber: 4,
//               columnNumber: 5,
//               filePath: apexClassPathOne,
//               message: "Missing ';' at '}'",
//               type: 'Error'
//             },
//             {
//               lineNumber: 7,
//               columnNumber: 9,
//               filePath: apexClassPathOne,
//               message: "Extra ':' at '}'",
//               type: 'Error'
//             }
//           ]
//         }
//       ]
//     };
//     const expectedOutput = new Table().createTable(
//       [
//         {
//           filePath: apexClassPathOne,
//           error: "Missing ';' at '}' (4:5)"
//         },
//         {
//           filePath: apexClassPathOne,
//           error: "Extra ':' at '}' (7:9)"
//         }
//       ],
//       deployFailureColumns,
//       nls.localize(`table_title_deploy_errors`)
//     );
//     expect(createDeployOutput(result, packageDirs)).to.equal(expectedOutput);
//   });

//   it('should create a table with failures that do not have line and column info', async () => {
//     const result: SourceDeployResult = {
//       id: '',
//       success: false,
//       status: ToolingDeployStatus.Error,
//       components: [
//         {
//           component: apexComponentOne,
//           status: ComponentStatus.Failed,
//           diagnostics: [
//             {
//               type: 'Error',
//               filePath: apexClassPathOne,
//               message: 'Unexpected error happened during deploy'
//             }
//           ]
//         }
//       ]
//     };
//     const expectedOutput = new Table().createTable(
//       [
//         {
//           filePath: apexClassPathOne,
//           error: 'Unexpected error happened during deploy'
//         }
//       ],
//       deployFailureColumns,
//       nls.localize(`table_title_deploy_errors`)
//     );
//     expect(createDeployOutput(result, packageDirs)).to.equal(expectedOutput);
//   });

//   it('should create a table with queued results', async () => {
//     const result: SourceDeployResult = {
//       id: '',
//       status: ToolingDeployStatus.Queued,
//       components: [],
//       success: false
//     };
//     expect(createDeployOutput(result, packageDirs)).to.equal(
//       nls.localize('beta_tapi_queue_status')
//     );
//   });
// });

// describe('createRetrieveOutput', () => {
//   const retrieveSuccessColumns = [
//     { key: 'fullName', label: nls.localize('table_header_full_name') },
//     { key: 'type', label: nls.localize('table_header_type') },
//     {
//       key: 'filePath',
//       label: nls.localize('table_header_project_path')
//     }
//   ];
//   const retrieveFailureColumns = [
//     { key: 'fullName', label: nls.localize('table_header_full_name') },
//     { key: 'type', label: nls.localize('table_header_error_type') },
//     { key: 'message', label: nls.localize('table_header_message') }
//   ];

//   it('Should handle a retrieve result with successes and no failures', () => {
//     const { fullName, type } = apexComponentOne;
//     const result: SourceRetrieveResult = {
//       status: RetrieveStatus.Succeeded,
//       success: true,
//       successes: [{ component: apexComponentOne }],
//       failures: []
//     };
//     const expectedOutput = new Table().createTable(
//       [
//         {
//           fullName,
//           type: type.name,
//           filePath: apexClassPathOne
//         },
//         {
//           fullName,
//           type: type.name,
//           filePath: apexClassXmlPathOne
//         }
//       ],
//       retrieveSuccessColumns,
//       nls.localize('lib_retrieve_result_title')
//     );
//     expect(createRetrieveOutput(result, packageDirs)).to.equal(
//       expectedOutput
//     );
//   });

//   it('Should handle a retrieve result with failures and no successes', () => {
//     const result: SourceRetrieveResult = {
//       status: RetrieveStatus.Failed,
//       success: false,
//       successes: [],
//       failures: [
//         {
//           component: apexComponentOne,
//           message: 'Missing metadata'
//         }
//       ]
//     };
//     const expectedOutput = new Table().createTable(
//       [
//         {
//           fullName: apexComponentOne.fullName,
//           type: 'Error',
//           message: 'Missing metadata'
//         }
//       ],
//       retrieveFailureColumns,
//       nls.localize('lib_retrieve_message_title')
//     );
//     expect(createRetrieveOutput(result, packageDirs)).to.equal(
//       expectedOutput
//     );
//   });

//   it('Should handle a SourceRetrieveResult with successes and failures', () => {
//     const result: SourceRetrieveResult = {
//       status: RetrieveStatus.PartialSuccess,
//       success: true,
//       successes: [{ component: apexComponentOne }],
//       failures: [{ component: apexComponentTwo, message: 'Missing metadata' }]
//     };
//     const expectedSuccessOutput = new Table().createTable(
//       [
//         {
//           fullName: apexComponentOne.fullName,
//           type: apexComponentOne.type.name,
//           filePath: apexClassPathOne
//         },
//         {
//           fullName: apexComponentOne.fullName,
//           type: apexComponentOne.type.name,
//           filePath: apexClassXmlPathOne
//         }
//       ],
//       retrieveSuccessColumns,
//       nls.localize('lib_retrieve_result_title')
//     );
//     const expectedFailureOutput = new Table().createTable(
//       [
//         {
//           fullName: apexComponentTwo.fullName,
//           type: 'Error',
//           message: 'Missing metadata'
//         }
//       ],
//       retrieveFailureColumns,
//       nls.localize('lib_retrieve_message_title')
//     );
//     const combinedTableOutput = `${expectedSuccessOutput}\n${expectedFailureOutput}`;
//     expect(createRetrieveOutput(result, packageDirs)).to.equal(
//       combinedTableOutput
//     );
//   });

//   it('Should handle a malformed SourceRetrieveResult', () => {
//     // @ts-ignore
//     const apiResultWithOutType = {
//       success: true,
//       status: RetrieveStatus.Succeeded,
//       components: [
//         {
//           name: 'MyTestClass',
//           xml: 'some/path/MyTestClass.cls-meta.xml'
//         }
//       ],
//       messages: 'Message from library'
//     } as SourceRetrieveResult;
//     expect(createRetrieveOutput(apiResultWithOutType, packageDirs)).to.equal(
//       nls.localize(
//         'lib_retrieve_result_parse_error',
//         JSON.stringify(apiResultWithOutType)
//       )
//     );
//   });
//   });
// });
