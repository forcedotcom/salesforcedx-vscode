// /*
//  * Copyright (c) 2020, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */

// import { ApiResult, SourceComponent } from '@salesforce/source-deploy-retrieve';
// import { expect } from 'chai';
// import { outputRetrieveTable } from '../../../../src/commands/util/retrieveParser';
// import { nls } from '../../../../src/messages';

// describe('retrieveParser', () => {
//   it('Should handle an ApiResult with no components and no message', () => {
//     const emptyResult = {
//       success: true,
//       components: []
//     } as ApiResult;

//     const parsedResult = outputRetrieveTable(emptyResult);
//     expect(parsedResult).to.equal(
//       nls.localize(
//         'lib_retrieve_result_parse_error',
//         JSON.stringify({ success: true, components: [] })
//       )
//     );
//   });

//   it('Should handle an ApiResult with no components but with message', () => {
//     const emptyResult = {
//       success: true,
//       components: [],
//       message: 'Message from library'
//     } as ApiResult;

//     const parsedResult = outputRetrieveTable(emptyResult);
//     expect(parsedResult).to.equal('Message from library');
//   });

//   it('Should handle an fully formed ApiResult', () => {
//     // @ts-ignore
//     const successfulResult = {
//       success: true,
//       components: [
//         {
//           name: 'MyTestClass',
//           xml: 'some/path/MyTestClass.cls-meta.xml',
//           walkContent: ['some/path/MyTestClass.cls'],
//           type: {
//             name: 'ApexClass',
//             directoryName: 'classes',
//             inFolder: false
//           }
//         }
//       ],
//       message: 'Message from library'
//     } as ApiResult;

//     const parsedResult = outputRetrieveTable(successfulResult);

//     let expectedResult = '=== Retrieved Source\n';
//     expectedResult +=
//       'FULL NAME    TYPE       PROJECT PATH                      \n';
//     expectedResult +=
//       '───────────  ─────────  ──────────────────────────────────\n';
//     expectedResult +=
//       'MyTestClass  ApexClass  some/path/MyTestClass.cls         \n';
//     expectedResult +=
//       'MyTestClass  ApexClass  some/path/MyTestClass.cls-meta.xml\n';

//     expect(parsedResult).to.equal(expectedResult);
//   });

//   it('Should handle a malformed ApiResult', () => {
//     // @ts-ignore
//     const apiResultWithOutType = {
//       success: true,
//       components: [
//         {
//           name: 'MyTestClass',
//           xml: 'some/path/MyTestClass.cls-meta.xml',
//           // @ts-ignore
//           walkContent(): ['some/path/MyTestClass.cls'];
//         }
//       ],
//       message: 'Message from library'
//     } as ApiResult;

//     const parsedResult = outputRetrieveTable(apiResultWithOutType);

//     expect(parsedResult).to.equal(
//       nls.localize(
//         'lib_retrieve_result_parse_error',
//         JSON.stringify(apiResultWithOutType)
//       )
//     );
//   });
// });
