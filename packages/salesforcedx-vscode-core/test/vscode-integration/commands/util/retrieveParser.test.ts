/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApiResult,
  registryData,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import {
  ComponentRetrieval,
  RetrieveStatus,
  SourceRetrieveResult
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import { join } from 'path';
import { outputRetrieveTable } from '../../../../src/commands/util/retrieveParser';
import { nls } from '../../../../src/messages';

describe('retrieveParser', () => {
  it('Should handle an ApiResult with no components and no message', () => {
    const emptyResult = {
      status: RetrieveStatus.Succeeded,
      success: true,
      components: []
    } as SourceRetrieveResult;

    const parsedResult = outputRetrieveTable(emptyResult);
    expect(parsedResult).to.equal(
      nls.localize(
        'lib_retrieve_result_parse_error',
        JSON.stringify({ status: RetrieveStatus.Succeeded, success: true, components: [] })
      )
    );
  });

  it('Should handle an ApiResult with no components but with message', () => {
    const emptyResult = {
      status: RetrieveStatus.Succeeded,
      success: true,
      components: [],
      messages: 'Message from library'
    } as SourceRetrieveResult;

    const parsedResult = outputRetrieveTable(emptyResult);
    expect(parsedResult).to.equal('Message from library');
  });

  it('Should handle a fully formed ApiResult', () => {
    const apexClassPath = join('classes', 'MyTestClass.cls');
    const apexClassXmlPath = `${apexClassPath}-meta.xml`;
    const message = 'Message from library';
    const component = SourceComponent.createVirtualComponent(
      {
        name: 'MyTestClass',
        type: registryData.types.apexclass,
        xml: apexClassXmlPath,
        content: apexClassPath
      },
      [
        {
          dirPath: 'classes',
          children: ['MyTestClass.cls', 'MyTestClass.cls-meta.xml']
        }
      ]
    );
    const componentRetrieval = {
      component,
      status: RetrieveStatus.Succeeded,
      diagnostics: { message }
    } as ComponentRetrieval;

    const successfulResult = {
      status: RetrieveStatus.Succeeded,
      success: true,
      components: [componentRetrieval],
      messages: 'Message from library'
    } as SourceRetrieveResult;

    const parsedResult = outputRetrieveTable(successfulResult);

    let expectedResult = '=== Retrieved Source\n';
    expectedResult +=
      'FULL NAME    TYPE       PROJECT PATH                    \n';
    expectedResult +=
      '───────────  ─────────  ────────────────────────────────\n';
    expectedResult += `MyTestClass  ApexClass  ${apexClassPath}         \n`;
    expectedResult += `MyTestClass  ApexClass  ${apexClassXmlPath}\n`;

    expect(parsedResult).to.equal(expectedResult);
  });

  it('Should handle a malformed ApiResult', () => {
    // @ts-ignore
    const apiResultWithOutType = {
      success: true,
      components: [
        {
          name: 'MyTestClass',
          xml: 'some/path/MyTestClass.cls-meta.xml',
          // @ts-ignore
          walkContent(): ['some/path/MyTestClass.cls'];
        }
      ],
      message: 'Message from library'
    } as ApiResult;
    // @ts-ignore
    const parsedResult = outputRetrieveTable(apiResultWithOutType);

    expect(parsedResult).to.equal(
      nls.localize(
        'lib_retrieve_result_parse_error',
        JSON.stringify(apiResultWithOutType)
      )
    );
  });
});
