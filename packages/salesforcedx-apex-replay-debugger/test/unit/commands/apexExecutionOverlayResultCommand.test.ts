/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CLIENT_ID,
  DEFAULT_CONNECTION_TIMEOUT_MS
} from '@salesforce/salesforcedx-utils-vscode/out/src/constants';
import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { ActionScriptEnum } from '../../../src/commands';
import {
  ApexExecutionOverlayResultCommand,
  ApexExecutionOverlayResultCommandFailure,
  ApexExecutionOverlayResultCommandSuccess
} from '../../../src/commands/apexExecutionOverlayResultCommand';
import { SOBJECTS_URL } from '../../../src/constants';

const apexExecutionOverlayResult = 'ApexExecutionOverlayResult';

describe('ApexExecutionOverlayResult basic class tests', () => {
  let overlayResultCommand: ApexExecutionOverlayResultCommand;
  const requestString = undefined;
  const heapdumpKey = '07nxx00000000ALAAY';
  const urlElements = [SOBJECTS_URL, apexExecutionOverlayResult, heapdumpKey];
  const expectedGetUrl = urlElements.join('/');

  it('Should have an undefined requestString', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    expect(overlayResultCommand.getCommandUrl()).to.equal(expectedGetUrl);
    expect(overlayResultCommand.getRequest()).to.equal(requestString);
  });
});

describe('ApexExecutionOverlayResult basic heapdump response parsing, no actionScript', () => {
  let sendRequestSpy: sinon.SinonStub;
  let overlayResultCommand: ApexExecutionOverlayResultCommand;
  const requestServiceInstanceUrl = 'https://www.salesforce.com';
  const heapdumpKey = '07nxx00000000BOAAY';
  const urlElements = [SOBJECTS_URL, apexExecutionOverlayResult, heapdumpKey];
  const expectedGettUrl = `/${urlElements.join('/')}`;
  const fakeUserId = '005xx000001UtEwAAK';
  const requestService = new RequestService();
  // Note: This was generated against a private local appserver using an Org and Users that were generated.
  // None of the IDs in this response map to a real Org or User.
  const responseSuccess =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v43.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000BOAAY"},"Id":"07nxx00000000BOAAY","IsDeleted":false,"CreatedDate":"2018-06-14T20:41:35.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-14T20:41:35.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-14T20:41:35.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":3499,"HeapDump":{"className":"TriggerTest","extents":[{"collectionType":null,"count":7,"definition":[],"extent":[{"address":"0x484889c1","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete4"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1SAAS"}}]}},{"address":"0x2af6c0c3","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete0"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1OAAS"}}]}},{"address":"0x41a7990b","size":16,"symbols":["a"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete5"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1TAAS"}}]}},{"address":"0x419440c","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete3"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1RAAS"}}]}},{"address":"0x29f53bd2","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete1"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1PAAS"}}]}},{"address":"0x4fe40625","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1QAAS"}}]}},{"address":"0x759f8f2c","size":16,"symbols":["foo"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"yyy"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt1QAAS"}}]}}],"totalSize":112,"typeName":"Account"},{"collectionType":"Account","count":2,"definition":[],"extent":[{"address":"0x67581704","size":16,"symbols":["accts2"],"value":{"value":[{"value":"0x419440c"},{"value":"0x484889c1"},{"value":"0x41a7990b"}]}},{"address":"0x7ee19456","size":16,"symbols":["accts"],"value":{"value":[{"value":"0x2af6c0c3"},{"value":"0x29f53bd2"},{"value":"0x4fe40625"}]}}],"totalSize":32,"typeName":"List<Account>"},{"collectionType":null,"count":1,"definition":[{"name":"value","type":"Double"}],"extent":[{"address":"0x31324ba9","size":8,"symbols":["i"],"value":{"value":6.0}}],"totalSize":8,"typeName":"Integer"},{"collectionType":null,"count":23,"definition":[{"name":"stringValue","type":"char[]"}],"extent":[{"address":"0x2997a582","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x6fabc54c","size":13,"symbols":null,"value":{"value":"AccountNumber"}},{"address":"0x157c88cd","size":18,"symbols":null,"value":{"value":"001xx000003Dt1QAAS"}},{"address":"0x661513cf","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x25089450","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x4a133a13","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x41fdd694","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x72c1ffd5","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x5edb0cd2","size":11,"symbols":null,"value":{"value":"okToDelete1"}},{"address":"0x5551729c","size":18,"symbols":null,"value":{"value":"001xx000003Dt1SAAS"}},{"address":"0x29cc091e","size":3,"symbols":null,"value":{"value":"foo"}},{"address":"0x48439a20","size":3,"symbols":null,"value":{"value":"yyy"}},{"address":"0x3a99f3a0","size":11,"symbols":null,"value":{"value":"okToDelete3"}},{"address":"0x73dadd26","size":13,"symbols":null,"value":{"value":"AccountNumber"}},{"address":"0x407d1be9","size":11,"symbols":null,"value":{"value":"okToDelete4"}},{"address":"0x29883d6c","size":18,"symbols":null,"value":{"value":"001xx000003Dt1QAAS"}},{"address":"0x5843f270","size":11,"symbols":null,"value":{"value":"okToDelete5"}},{"address":"0x71c78df0","size":11,"symbols":null,"value":{"value":"okToDelete0"}},{"address":"0x777c58b2","size":18,"symbols":null,"value":{"value":"001xx000003Dt1PAAS"}},{"address":"0x44623a37","size":3,"symbols":null,"value":{"value":"xxx"}},{"address":"0x194cbdf9","size":18,"symbols":null,"value":{"value":"001xx000003Dt1OAAS"}},{"address":"0x258191fa","size":18,"symbols":null,"value":{"value":"001xx000003Dt1TAAS"}},{"address":"0x46c6227f","size":18,"symbols":null,"value":{"value":"001xx000003Dt1RAAS"}}],"totalSize":250,"typeName":"String"}],"heapDumpDate":"2018-06-14T20:41:34.377+0000","namespace":"none"},"ApexResult":null,"SOQLResult":null,"Line":23,"Iteration":1,"ExpirationDate":"2018-06-14T21:05:57.000+0000","IsDumpingHeap":true,"ActionScript":null,"ActionScriptType":"None","ClassName":"TriggerTest","Namespace":"none"}';

  // Reseponse failures are going to be a message and an errorCode string
  const responseFailure =
    '[{"message":"Session expired or invalid","errorCode":"INVALID_SESSION_ID"}]';
  const responseFailureMessage = 'Session expired or invalid';
  const responseFailureErrorCode = 'INVALID_SESSION_ID';

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('ApexExecutionOverlayResultCommand GET REST call with parse-able heapdump success result', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccess
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    // Verify the basic information has been parsed.
    expect(response.ActionScript).to.equal(null);
    expect(response.ActionScriptType).to.equal('None');
    expect(response.ApexResult).to.equal(null);
    expect(response.ClassName).to.equal('TriggerTest');
    expect(response.CreatedById).to.equal(fakeUserId);
    expect(response.CreatedDate).to.equal('2018-06-14T20:41:35.000+0000');
    expect(response.ExpirationDate).to.equal('2018-06-14T21:05:57.000+0000');
    expect(response.Id).to.equal(heapdumpKey);
    expect(response.IsDeleted).to.equal(false);
    expect(response.IsDumpingHeap).to.equal(true);
    expect(response.Iteration).to.equal(1);
    expect(response.LastModifiedById).to.equal(fakeUserId);
    expect(response.LastModifiedDate).to.equal('2018-06-14T20:41:35.000+0000');
    expect(response.Line).to.equal(23);
    expect(response.Namespace).to.equal('none');
    expect(response.OverlayResultLength).to.equal(3499);
    expect(response.RequestedById).to.equal(fakeUserId);
    expect(response.SOQLResult).to.equal(null);
    expect(response.SystemModstamp).to.equal('2018-06-14T20:41:35.000+0000');
    expect(response.UserId).to.equal(fakeUserId);

    // Verify the response.attributes
    expect(response.attributes.type).to.equal(apexExecutionOverlayResult);
    expect(response.attributes.url).to.equal(expectedGettUrl);

    // Verity the response.heapdump top level information
    expect(response.HeapDump.className).to.equal('TriggerTest');
    expect(response.HeapDump.heapDumpDate).to.equal(
      '2018-06-14T20:41:34.377+0000'
    );
    expect(response.HeapDump.namespace).to.equal('none');

    // There should be 4 extents
    expect(response.HeapDump.extents.length).to.equal(4);
    // The first extent should contain 7 Account items, no collection type with a total size of 112
    expect(response.HeapDump.extents[0].collectionType).to.equal(null);
    expect(response.HeapDump.extents[0].count).to.equal(7);
    expect(response.HeapDump.extents[0].definition.length).to.equal(0);
    expect(response.HeapDump.extents[0].totalSize).to.equal(112);
    expect(response.HeapDump.extents[0].typeName).to.equal('Account');
    // For the Account items in the extent, verify that they have keyDisplayValues for Name, AccountNumber and Id
    let extent = response.HeapDump.extents[0].extent;
    let symbolFoo = false;
    let symbolA = false;
    for (let i = 0; i < response.HeapDump.extents[0].count; i++) {
      expect(isHex(extent[i].address)).to.equal(true);
      expect(extent[i].size).to.equal(16);

      // Verify the Name keyDisplayValue and that the value starts with okToDelete
      expect(extent[i].value.entry![0].keyDisplayValue).to.equal('Name');
      expect(
        extent[i].value.entry![0].value.value!.startsWith('okToDelete')
      ).to.equal(true);

      // Verity the AccountNumber keyDisplayValue
      expect(extent[i].value.entry![1].keyDisplayValue).to.equal(
        'AccountNumber'
      );

      // Verify the Id keyDisplayValue and the value starts with 001xx000003Dt1
      expect(extent[i].value.entry![2].keyDisplayValue).to.equal('Id');
      expect(
        extent[i].value.entry![2].value.value!.startsWith('001xx000003Dt1')
      ).to.equal(true);

      // Symbols are only there for 2 local variables, 'a' and 'foo', verify we got them
      if (extent[i].symbols) {
        if (extent[i].symbols![0] === 'a') {
          symbolA = true;
        } else if (extent[i].symbols![0] === 'foo') {
          symbolFoo = true;
        }
      }
    }
    // verify that both symbols were found
    expect(symbolA).to.equal(true);
    expect(symbolFoo).to.equal(true);

    // extent 1 should have a collectionType of Account, count of 2, total size of 32 a typeName of List<Account>
    expect(response.HeapDump.extents[1].collectionType).to.equal('Account');
    expect(response.HeapDump.extents[1].count).to.equal(2);
    expect(response.HeapDump.extents[1].definition.length).to.equal(0);
    expect(response.HeapDump.extents[1].totalSize).to.equal(32);
    expect(response.HeapDump.extents[1].typeName).to.equal('List<Account>');
    extent = response.HeapDump.extents[1].extent;
    for (let i = 0; i < response.HeapDump.extents[1].count; i++) {
      expect(isHex(extent[i].address)).to.equal(true);
      expect(extent[i].size).to.equal(16);
      expect(extent[i].symbols![0].startsWith('accts')).to.equal(true);
      // The collection type is account, each account list should contain a list of addresses
      for (let j = 0; j < extent[i].value.value!.length; j++) {
        expect(isHex(extent[i].value.value[j].value)).to.equal(true);
      }
    }

    // extent 2 should have a tyepName of Integer, count 1, size/total
    expect(response.HeapDump.extents[2].collectionType).to.equal(null);
    expect(response.HeapDump.extents[2].count).to.equal(1);
    expect(response.HeapDump.extents[2].definition.length).to.equal(1);
    expect(response.HeapDump.extents[2].definition[0].name).to.equal('value');
    expect(response.HeapDump.extents[2].definition[0].type).to.equal('Double');
    expect(response.HeapDump.extents[2].totalSize).to.equal(8);
    expect(response.HeapDump.extents[2].typeName).to.equal('Integer');
    // There's only one value in the extent
    extent = response.HeapDump.extents[2].extent;
    expect(isHex(extent[0].address)).to.equal(true);

    // extent 3 contains all the the strings. It should have a typeName of String, count of
    // 23 and a total size of 250. Rather than look at every random string in the heapdump
    // just verify that each string has an address, size > 0 and a value.value that isn't null
    expect(response.HeapDump.extents[3].collectionType).to.equal(null);
    expect(response.HeapDump.extents[3].count).to.equal(23);
    expect(response.HeapDump.extents[3].totalSize).to.equal(250);
    expect(response.HeapDump.extents[3].typeName).to.equal('String');
    extent = response.HeapDump.extents[3].extent;
    for (let i = 0; i < response.HeapDump.extents[3].count; i++) {
      // the address is in hex
      expect(isHex(extent[i].address)).to.equal(true);
      // size will be greater than 0
      expect(extent[i].size).to.greaterThan(0);
      // symbols will be null
      expect(extent[i].symbols).to.equal(null);
      // verify that the value isn't null
      expect(extent[i].value.value).to.not.equal(null);
    }
  });

  it('ApexExecutionOverlayResultCommand GET REST call with parse-able heapdump failure result', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseFailure
        } as XHRResponse)
      );

    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandFailure[];

    expect(response.length).to.equal(1);
    expect(response[0].message).to.equal(responseFailureMessage);
    expect(response[0].errorCode).to.equal(responseFailureErrorCode);
  });
});

describe('ApexExecutionOverlayResult heapdump parsing with ActionScript SOQL results', () => {
  let sendRequestSpy: sinon.SinonStub;
  let overlayResultCommand: ApexExecutionOverlayResultCommand;
  const requestServiceInstanceUrl = 'https://www.salesforce.com';
  const heapdumpKey = '07nxx00000000BOAAY';
  const urlElements = [SOBJECTS_URL, apexExecutionOverlayResult, heapdumpKey];
  const expectedGettUrl = `/${urlElements.join('/')}`;
  const requestService = new RequestService();

  const responseSuccessSOQL =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v43.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000CHAAY"},"Id":"07nxx00000000CHAAY","IsDeleted":false,"CreatedDate":"2018-06-18T16:00:44.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-18T16:00:44.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-18T16:00:44.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":5854,"HeapDump":{"className":"TriggerTest","extents":[{"collectionType":null,"count":7,"definition":[],"extent":[{"address":"0x1eb9a287","size":16,"symbols":["a"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete5"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2RAAS"}}]}},{"address":"0x4d58024c","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete1"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2NAAS"}}]}},{"address":"0x277111ce","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete0"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2MAAS"}}]}},{"address":"0x6e9e59d6","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete3"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2PAAS"}}]}},{"address":"0x83ee3a9","size":16,"symbols":["foo"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"yyy"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2OAAS"}}]}},{"address":"0x789d46b4","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2OAAS"}}]}},{"address":"0x61e536b9","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete4"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2QAAS"}}]}}],"totalSize":112,"typeName":"Account"},{"collectionType":"Account","count":2,"definition":[],"extent":[{"address":"0x494570be","size":16,"symbols":["accts"],"value":{"value":[{"value":"0x277111ce"},{"value":"0x4d58024c"},{"value":"0x789d46b4"}]}},{"address":"0x6274a4ae","size":16,"symbols":["accts2"],"value":{"value":[{"value":"0x6e9e59d6"},{"value":"0x61e536b9"},{"value":"0x1eb9a287"}]}}],"totalSize":32,"typeName":"List<Account>"},{"collectionType":null,"count":1,"definition":[{"name":"value","type":"Double"}],"extent":[{"address":"0x4437681f","size":8,"symbols":["i"],"value":{"value":6.0}}],"totalSize":8,"typeName":"Integer"},{"collectionType":null,"count":23,"definition":[{"name":"stringValue","type":"char[]"}],"extent":[{"address":"0x432f75fe","size":3,"symbols":null,"value":{"value":"foo"}},{"address":"0x79e58884","size":11,"symbols":null,"value":{"value":"okToDelete4"}},{"address":"0x3fb38fc5","size":11,"symbols":null,"value":{"value":"okToDelete3"}},{"address":"0x151e3c89","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x7acb3e8c","size":18,"symbols":null,"value":{"value":"001xx000003Dt2QAAS"}},{"address":"0x23e5508e","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x6bd5451","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x6da087d2","size":3,"symbols":null,"value":{"value":"xxx"}},{"address":"0x1ea6f551","size":18,"symbols":null,"value":{"value":"001xx000003Dt2OAAS"}},{"address":"0x1b59239a","size":18,"symbols":null,"value":{"value":"001xx000003Dt2OAAS"}},{"address":"0x4152e51f","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x2a2bbd60","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x7fc464e0","size":11,"symbols":null,"value":{"value":"okToDelete0"}},{"address":"0x630c1420","size":18,"symbols":null,"value":{"value":"001xx000003Dt2NAAS"}},{"address":"0x10910624","size":11,"symbols":null,"value":{"value":"okToDelete1"}},{"address":"0x1a9d3e68","size":18,"symbols":null,"value":{"value":"001xx000003Dt2RAAS"}},{"address":"0x4c3140ec","size":11,"symbols":null,"value":{"value":"okToDelete5"}},{"address":"0x56e11a34","size":18,"symbols":null,"value":{"value":"001xx000003Dt2MAAS"}},{"address":"0x568c2039","size":13,"symbols":null,"value":{"value":"AccountNumber"}},{"address":"0x7468263c","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x61dd12bd","size":18,"symbols":null,"value":{"value":"001xx000003Dt2PAAS"}},{"address":"0x699195be","size":3,"symbols":null,"value":{"value":"yyy"}},{"address":"0x4ffda43f","size":13,"symbols":null,"value":{"value":"AccountNumber"}}],"totalSize":250,"typeName":"String"}],"heapDumpDate":"2018-06-18T16:00:44.577+0000","namespace":"none"},"ApexResult":null,"SOQLResult":{"queryError":null,"queryMetadata":{"columnMetadata":[{"aggregate":false,"apexType":"Id","booleanType":false,"columnName":"Id","custom":false,"displayName":"Id","foreignKeyName":null,"insertable":false,"joinColumns":[],"numberType":false,"textType":false,"updatable":false},{"aggregate":false,"apexType":"String","booleanType":false,"columnName":"Name","custom":false,"displayName":"Name","foreignKeyName":null,"insertable":true,"joinColumns":[],"numberType":false,"textType":true,"updatable":true},{"aggregate":false,"apexType":"String","booleanType":false,"columnName":"AccountNumber","custom":false,"displayName":"AccountNumber","foreignKeyName":null,"insertable":true,"joinColumns":[],"numberType":false,"textType":true,"updatable":true}],"entityName":"Account","groupBy":false,"idSelected":true,"keyPrefix":"001"},"queryResult":[{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2MAAS"},"Id":"001xx000003Dt2MAAS","Name":"okToDelete0","AccountNumber":"yyy"},{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2NAAS"},"Id":"001xx000003Dt2NAAS","Name":"okToDelete1","AccountNumber":"yyy"},{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2OAAS"},"Id":"001xx000003Dt2OAAS","Name":"okToDelete2","AccountNumber":"yyy"},{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2PAAS"},"Id":"001xx000003Dt2PAAS","Name":"okToDelete3","AccountNumber":"yyy"},{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2QAAS"},"Id":"001xx000003Dt2QAAS","Name":"okToDelete4","AccountNumber":"yyy"},{"attributes":{"type":"Account","url":"/services/data/v43.0/tooling/sobjects/Account/001xx000003Dt2RAAS"},"Id":"001xx000003Dt2RAAS","Name":"okToDelete5","AccountNumber":"yyy"}]},"Line":23,"Iteration":1,"ExpirationDate":"2018-06-18T16:30:13.000+0000","IsDumpingHeap":true,"ActionScript":"SELECT Id, Name, AccountNumber FROM Account WHERE Name like \'okToDelete%\'","ActionScriptType":"SOQL","ClassName":"TriggerTest","Namespace":"none"}';
  const expectedActionScript =
    "SELECT Id, Name, AccountNumber FROM Account WHERE Name like 'okToDelete%'";

  const reseponseErrorSOQL =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000CMAAY"},"Id":"07nxx00000000CMAAY","IsDeleted":false,"CreatedDate":"2018-06-18T18:40:19.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-18T18:40:19.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-18T18:40:19.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":4043,"HeapDump":{"className":"TriggerTest","extents":[{"collectionType":null,"count":7,"definition":[],"extent":[{"address":"0x444e4e83","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2YAAS"}}]}},{"address":"0x49d41795","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete0"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2WAAS"}}]}},{"address":"0x154b7a1f","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete1"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2XAAS"}}]}},{"address":"0x592cade4","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete4"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2aAAC"}}]}},{"address":"0x5aafa32e","size":16,"symbols":["a"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete5"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2bAAC"}}]}},{"address":"0x8f2d830","size":16,"symbols":null,"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete3"}},{"keyDisplayValue":"AccountNumber","value":{"value":"xxx"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2ZAAS"}}]}},{"address":"0x59ab457a","size":16,"symbols":["foo"],"value":{"entry":[{"keyDisplayValue":"Name","value":{"value":"okToDelete2"}},{"keyDisplayValue":"AccountNumber","value":{"value":"yyy"}},{"keyDisplayValue":"Id","value":{"value":"001xx000003Dt2YAAS"}}]}}],"totalSize":112,"typeName":"Account"},{"collectionType":"Account","count":2,"definition":[],"extent":[{"address":"0x93ad942","size":16,"symbols":["accts"],"value":{"value":[{"value":"0x49d41795"},{"value":"0x154b7a1f"},{"value":"0x444e4e83"}]}},{"address":"0x2c1dbd56","size":16,"symbols":["accts2"],"value":{"value":[{"value":"0x8f2d830"},{"value":"0x592cade4"},{"value":"0x5aafa32e"}]}}],"totalSize":32,"typeName":"List<Account>"},{"collectionType":null,"count":1,"definition":[{"name":"value","type":"Double"}],"extent":[{"address":"0x4437681f","size":8,"symbols":["i"],"value":{"value":6.0}}],"totalSize":8,"typeName":"Integer"},{"collectionType":null,"count":23,"definition":[{"name":"stringValue","type":"char[]"}],"extent":[{"address":"0x432f75fe","size":3,"symbols":null,"value":{"value":"foo"}},{"address":"0x4ffda43f","size":13,"symbols":null,"value":{"value":"AccountNumber"}},{"address":"0x71c93045","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x151e3c89","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x23e5508e","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x7f6deccf","size":11,"symbols":null,"value":{"value":"okToDelete3"}},{"address":"0x6bd5451","size":2,"symbols":null,"value":{"value":"Id"}},{"address":"0x6da087d2","size":3,"symbols":null,"value":{"value":"xxx"}},{"address":"0x69c6ed15","size":18,"symbols":null,"value":{"value":"001xx000003Dt2WAAS"}},{"address":"0x6b7fb095","size":18,"symbols":null,"value":{"value":"001xx000003Dt2aAAC"}},{"address":"0x6a48115b","size":18,"symbols":null,"value":{"value":"001xx000003Dt2YAAS"}},{"address":"0xde0b05e","size":11,"symbols":null,"value":{"value":"okToDelete5"}},{"address":"0x432efee2","size":11,"symbols":null,"value":{"value":"okToDelete0"}},{"address":"0x4b00d2a3","size":18,"symbols":null,"value":{"value":"001xx000003Dt2XAAS"}},{"address":"0x79de8b26","size":11,"symbols":null,"value":{"value":"okToDelete2"}},{"address":"0x26a7eb28","size":11,"symbols":null,"value":{"value":"okToDelete4"}},{"address":"0x73929baf","size":18,"symbols":null,"value":{"value":"001xx000003Dt2YAAS"}},{"address":"0x211d1872","size":18,"symbols":null,"value":{"value":"001xx000003Dt2ZAAS"}},{"address":"0x612cd233","size":11,"symbols":null,"value":{"value":"okToDelete1"}},{"address":"0x568c2039","size":13,"symbols":null,"value":{"value":"AccountNumber"}},{"address":"0x7468263c","size":4,"symbols":null,"value":{"value":"Name"}},{"address":"0x67c2213e","size":3,"symbols":null,"value":{"value":"yyy"}},{"address":"0x3593f2bf","size":18,"symbols":null,"value":{"value":"001xx000003Dt2bAAC"}}],"totalSize":250,"typeName":"String"}],"heapDumpDate":"2018-06-18T18:40:18.956+0000","namespace":"none"},"ApexResult":null,"SOQLResult":{"queryError":"\\nSELECT Id, Name, AccountNumber FROM AccountOpps WHERE Name like \'okToDelete%\'\\n                                    ^\\nERROR at Row:1:Column:37\\nsObject type \'AccountOpps\' is not supported. If you are attempting to use a custom object, be sure to append the \'__c\' after the entity name. Please reference your WSDL or the describe call for the appropriate names.","queryMetadata":null,"queryResult":null},"Line":23,"Iteration":1,"ExpirationDate":"2018-06-18T19:09:36.000+0000","IsDumpingHeap":true,"ActionScript":"SELECT Id, Name, AccountNumber FROM AccountOpps WHERE Name like \'okToDelete%\'","ActionScriptType":"SOQL","ClassName":"TriggerTest","Namespace":"none"}';
  const expectedErrorActionScript =
    "SELECT Id, Name, AccountNumber FROM AccountOpps WHERE Name like 'okToDelete%'";
  const expectedQueryError =
    "\nSELECT Id, Name, AccountNumber FROM AccountOpps WHERE Name like 'okToDelete%'\n                                    ^\nERROR at Row:1:Column:37\nsObject type 'AccountOpps' is not supported. If you are attempting to use a custom object, be sure to append the '__c' after the entity name. Please reference your WSDL or the describe call for the appropriate names.";

  const expectedKeyPrefix = '001';
  const apexTypeId = 'Id';
  const apexTypeString = 'String';
  const accountType = 'Account';
  const urlBase = `/${SOBJECTS_URL}/${accountType}/`;
  const metadataId = 0;
  const metadataName = 1;
  const metadataAccountNumber = 2;

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('ApexExecutionOverlayResultCommand GET REST call with SOQL ActionScript success result', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccessSOQL
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    // Parsing the SOQL first requires reading the metadata returned with the result
    // There will only ever be one type of result as a checkpoint cannot have both Apex and SOQL results
    expect(response.ApexResult).to.equal(null);
    expect(response.ActionScript).to.equal(expectedActionScript);
    expect(response.ActionScriptType).to.equal(ActionScriptEnum.SOQL);
    expect(response.SOQLResult!.queryError).to.equal(null);
    expect(response.SOQLResult!.queryMetadata!.entityName).to.equal(
      accountType
    );
    expect(response.SOQLResult!.queryMetadata!.groupBy).to.equal(false);
    expect(response.SOQLResult!.queryMetadata!.idSelected).to.equal(true);
    expect(response.SOQLResult!.queryMetadata!.keyPrefix).to.equal(
      expectedKeyPrefix
    );

    // There are 3 pieces of metdata, Id, Name and AccountNumber in that order.
    // Verify the Id metadata
    let columnMetadata = response.SOQLResult!.queryMetadata!.columnMetadata[
      metadataId
    ];
    expect(columnMetadata.aggregate).to.equal(false);
    expect(columnMetadata.apexType).to.equal(apexTypeId);
    expect(columnMetadata.booleanType).to.equal(false);
    expect(columnMetadata.columnName).to.equal('Id');
    expect(columnMetadata.custom).to.equal(false);
    expect(columnMetadata.displayName).to.equal('Id');
    expect(columnMetadata.foreignKeyName).to.equal(null);
    expect(columnMetadata.insertable).to.equal(false);
    expect(columnMetadata.joinColumns.length).to.equal(0); // expect join columns to be empty
    expect(columnMetadata.numberType).to.equal(false);
    expect(columnMetadata.textType).to.equal(false);
    expect(columnMetadata.updatable).to.equal(false);

    // very the Name metadata
    columnMetadata = response.SOQLResult!.queryMetadata!.columnMetadata[
      metadataName
    ];
    expect(columnMetadata.aggregate).to.equal(false);
    expect(columnMetadata.apexType).to.equal(apexTypeString);
    expect(columnMetadata.booleanType).to.equal(false);
    expect(columnMetadata.columnName).to.equal('Name');
    expect(columnMetadata.custom).to.equal(false);
    expect(columnMetadata.displayName).to.equal('Name');
    expect(columnMetadata.foreignKeyName).to.equal(null);
    expect(columnMetadata.insertable).to.equal(true);
    expect(columnMetadata.joinColumns.length).to.equal(0); // expect join columns to be empty
    expect(columnMetadata.numberType).to.equal(false);
    expect(columnMetadata.textType).to.equal(true);
    expect(columnMetadata.updatable).to.equal(true);

    // Verify the AccountNumber metadata
    columnMetadata = response.SOQLResult!.queryMetadata!.columnMetadata[
      metadataAccountNumber
    ];
    expect(columnMetadata.aggregate).to.equal(false);
    expect(columnMetadata.apexType).to.equal(apexTypeString);
    expect(columnMetadata.booleanType).to.equal(false);
    expect(columnMetadata.columnName).to.equal('AccountNumber');
    expect(columnMetadata.custom).to.equal(false);
    expect(columnMetadata.displayName).to.equal('AccountNumber');
    expect(columnMetadata.foreignKeyName).to.equal(null);
    expect(columnMetadata.insertable).to.equal(true);
    expect(columnMetadata.joinColumns.length).to.equal(0); // expect join columns to be empty
    expect(columnMetadata.numberType).to.equal(false);
    expect(columnMetadata.textType).to.equal(true);
    expect(columnMetadata.updatable).to.equal(true);

    // Loop through and verify all of the results. The HeapDumpSOQLResultQueryResult contains the index
    // that the metadata's columnName will be used to access.
    // In this example the query pulls back the Id, Name and AccountNumber which means that the columnNames
    // in the metadata would be used to field data from the result. For example:
    // response.SOQLResult!.queryResult[]['Name'] would be used to get the Name field from the returned data.
    expect(response.SOQLResult!.queryResult!.length).to.equal(6);
    for (const singleEntry of response.SOQLResult!.queryResult!) {
      expect(singleEntry.attributes.type).to.equal(accountType);
      // The accountId is needed to verify the url in the attributes
      const accountId = singleEntry[
        response.SOQLResult!.queryMetadata!.columnMetadata[metadataId]
          .columnName
      ] as string;
      expect(accountId.startsWith('001xx000003Dt')).to.equal(true);
      expect(singleEntry.attributes.url).to.equal(`${urlBase}${accountId}`);
      expect(
        (singleEntry[
          response.SOQLResult!.queryMetadata!.columnMetadata[metadataName]
            .columnName
        ] as string).startsWith('okToDelete')
      ).to.equal(true);
      expect(singleEntry[
        response.SOQLResult!.queryMetadata!.columnMetadata[
          metadataAccountNumber
        ].columnName
      ] as string).to.equal('yyy');
    }
  });

  it('ApexExecutionOverlayResultCommand GET REST call with SOQL ActionScript failure result', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: reseponseErrorSOQL
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    expect(response.ActionScript).to.equal(expectedErrorActionScript);
    expect(response.ActionScriptType).to.equal(ActionScriptEnum.SOQL);
    expect(response.SOQLResult!.queryError).to.equal(expectedQueryError);
    expect(response.SOQLResult!.queryMetadata).to.equal(null);
    expect(response.SOQLResult!.queryResult).to.equal(null);
  });
});

describe('ApexExecutionOverlayResult heapdump parsing with ActionScript SOQL results', () => {
  let sendRequestSpy: sinon.SinonStub;
  let overlayResultCommand: ApexExecutionOverlayResultCommand;
  const requestServiceInstanceUrl = 'https://www.salesforce.com';
  const heapdumpKey = '07nxx00000000BOAAY';
  const urlElements = [SOBJECTS_URL, apexExecutionOverlayResult, heapdumpKey];
  const expectedGettUrl = `/${urlElements.join('/')}`;
  const requestService = new RequestService();

  const responseSuccess =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000CRAAY"},"Id":"07nxx00000000CRAAY","IsDeleted":false,"CreatedDate":"2018-06-18T20:50:59.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-18T20:50:59.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-18T20:50:59.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":617,"HeapDump":{"className":"SimpleTestClass","extents":[],"heapDumpDate":"2018-06-18T20:50:58.721+0000","namespace":"none"},"ApexResult":{"apexError":null,"apexExecutionResult":{"column":-1,"compileProblem":null,"compiled":true,"exceptionMessage":null,"exceptionStackTrace":null,"line":-1,"success":true}},"SOQLResult":null,"Line":6,"Iteration":1,"ExpirationDate":"2018-06-18T21:06:29.000+0000","IsDumpingHeap":true,"ActionScript":"System.Debug(4/2);","ActionScriptType":"Apex","ClassName":"SimpleTestClass","Namespace":"none"}';
  const expectedSuccessActionScript = 'System.Debug(4/2);';

  const reseponseFailureRuntimeException =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000CqAAI"},"Id":"07nxx00000000CqAAI","IsDeleted":false,"CreatedDate":"2018-06-18T21:33:11.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-18T21:33:11.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-18T21:33:11.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":686,"HeapDump":{"className":"SimpleTestClass","extents":[],"heapDumpDate":"2018-06-18T21:33:11.027+0000","namespace":"none"},"ApexResult":{"apexError":null,"apexExecutionResult":{"column":1,"compileProblem":null,"compiled":true,"exceptionMessage":"System.MathException: Divide by 0","exceptionStackTrace":"AnonymousBlock: line 1, column 1","line":1,"success":false}},"SOQLResult":null,"Line":6,"Iteration":1,"ExpirationDate":"2018-06-18T21:06:29.000+0000","IsDumpingHeap":true,"ActionScript":"System.Debug(4/0);","ActionScriptType":"Apex","ClassName":"SimpleTestClass","Namespace":"none"}';
  const expectedFailureRuntimeExceptionActionScript = 'System.Debug(4/0);';
  const expectedFailureRuntimeExceptionStackTrace =
    'AnonymousBlock: line 1, column 1';
  const expectedFailureRuntimeExceptionMessage =
    'System.MathException: Divide by 0';

  const reseponseFailureCompilationError =
    '{"attributes":{"type":"ApexExecutionOverlayResult","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayResult/07nxx00000000CvAAI"},"Id":"07nxx00000000CvAAI","IsDeleted":false,"CreatedDate":"2018-06-18T21:33:51.000+0000","CreatedById":"005xx000001UtEwAAK","LastModifiedDate":"2018-06-18T21:33:51.000+0000","LastModifiedById":"005xx000001UtEwAAK","SystemModstamp":"2018-06-18T21:33:51.000+0000","UserId":"005xx000001UtEwAAK","RequestedById":"005xx000001UtEwAAK","OverlayResultLength":652,"HeapDump":{"className":"SimpleTestClass","extents":[],"heapDumpDate":"2018-06-18T21:33:51.902+0000","namespace":"none"},"ApexResult":{"apexError":null,"apexExecutionResult":{"column":1,"compileProblem":"Expression cannot be a statement.","compiled":false,"exceptionMessage":null,"exceptionStackTrace":null,"line":1,"success":false}},"SOQLResult":null,"Line":6,"Iteration":1,"ExpirationDate":"2018-06-18T21:06:29.000+0000","IsDumpingHeap":true,"ActionScript":"\'Neener neener neener\';","ActionScriptType":"Apex","ClassName":"SimpleTestClass","Namespace":"none"}';
  const expectedFailureCompilationErrorActionScript = "'Neener neener neener';";
  const expectedFailureCompilationErrorCompileProblem =
    'Expression cannot be a statement.';

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('ApexExecutionOverlayResultCommand GET REST call with Apex ActionScript success result', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccess
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    expect(response.ActionScript).to.equal(expectedSuccessActionScript);
    expect(response.ActionScriptType).to.equal(ActionScriptEnum.Apex);
    expect(response.ApexResult!.apexError).to.equal(null);
    expect(response.ApexResult!.apexExecutionResult).to.not.equal(undefined);
    const apexExecutionResult = response.ApexResult!.apexExecutionResult;
    if (apexExecutionResult) {
      expect(apexExecutionResult.column).to.equal(-1);
      expect(apexExecutionResult.compiled).to.equal(true);
      expect(apexExecutionResult.compileProblem).to.equal(null);
      expect(apexExecutionResult.exceptionMessage).to.equal(null);
      expect(apexExecutionResult.exceptionStackTrace).to.equal(null);
      expect(apexExecutionResult.line).to.equal(-1);
      expect(apexExecutionResult.success).to.equal(true);
    }
  });

  it('ApexExecutionOverlayResultCommand GET REST call with Apex ActionScript unhandled runtime exception', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: reseponseFailureRuntimeException
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    expect(response.ActionScript).to.equal(
      expectedFailureRuntimeExceptionActionScript
    );
    expect(response.ActionScriptType).to.equal(ActionScriptEnum.Apex);
    expect(response.ApexResult!.apexError).to.equal(null);
    expect(response.ApexResult!.apexExecutionResult).to.not.equal(undefined);
    const apexExecutionResult = response.ApexResult!.apexExecutionResult;
    if (apexExecutionResult) {
      expect(apexExecutionResult.column).to.equal(1);
      expect(apexExecutionResult.compiled).to.equal(true);
      expect(apexExecutionResult.compileProblem).to.equal(null);
      expect(apexExecutionResult.exceptionMessage).to.equal(
        expectedFailureRuntimeExceptionMessage
      );
      expect(apexExecutionResult.exceptionStackTrace).to.equal(
        expectedFailureRuntimeExceptionStackTrace
      );
      expect(apexExecutionResult.line).to.equal(1);
      expect(apexExecutionResult.success).to.equal(false);
    }
  });

  it('ApexExecutionOverlayResultCommand GET REST call with Apex ActionScript compilation error', async () => {
    overlayResultCommand = new ApexExecutionOverlayResultCommand(heapdumpKey);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: reseponseFailureCompilationError
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Get
    // The query string needs to be pulled from the overlayResultCommand since it contains the
    // milliseconds
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined,
      `${requestServiceInstanceUrl}${expectedGettUrl}`,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      overlayResultCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlayResultCommandSuccess;

    expect(response.ActionScript).to.equal(
      expectedFailureCompilationErrorActionScript
    );
    expect(response.ActionScriptType).to.equal(ActionScriptEnum.Apex);
    expect(response.ApexResult!.apexError).to.equal(null);
    expect(response.ApexResult!.apexExecutionResult).to.not.equal(undefined);
    const apexExecutionResult = response.ApexResult!.apexExecutionResult;
    if (apexExecutionResult) {
      expect(apexExecutionResult.column).to.equal(1);
      expect(apexExecutionResult.compiled).to.equal(false);
      expect(apexExecutionResult.compileProblem).to.equal(
        expectedFailureCompilationErrorCompileProblem
      );
      expect(apexExecutionResult.exceptionMessage).to.equal(null);
      expect(apexExecutionResult.exceptionStackTrace).to.equal(null);
      expect(apexExecutionResult.line).to.equal(1);
      expect(apexExecutionResult.success).to.equal(false);
    }
  });
});

// Verify that the number passed in is a hex address
function isHex(inputString: string): boolean {
  if (inputString.startsWith('0x')) {
    inputString = inputString.substr(2);
  }
  const a = parseInt(inputString, 16);
  return a.toString(16) === inputString.toLowerCase();
}

export function createExpectedXHROptions(
  requestBody: string | undefined,
  requestUrl: string,
  restHttpMethodEnum: RestHttpMethodEnum
): XHROptions {
  return {
    type: restHttpMethodEnum,
    url: requestUrl,
    timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      Accept: 'application/json',
      Authorization: `OAuth 123`,
      'Content-Length': requestBody
        ? Buffer.byteLength(requestBody, 'utf-8')
        : 0,
      'Sforce-Call-Options': `client=${CLIENT_ID}`
    },
    data: requestBody
  } as XHROptions;
}

/* The test code used to generate the heap dump. This is important because of the ordering for the verification
   There are comments below where the checkpoints were set and where the various SOQL/Apex ActionScript were executed
@IsTest
public with sharing class TriggerTest {
public static string bar = 'foo';
   @IsTest
   public static void testTriggerInsert() {
       Account[] accts = new Account[]{};
       for(Integer i=0;i<3;i++) {
           Account a = new Account(Name='okToDelete' + i,
                                   AccountNumber='xxx');
           accts.add(a);
        }
        insert accts;
        System.assertEquals(accts.size(), 3);
        Account foo = [select Name, AccountNumber, Id from Account where Name='okToDelete2'];
       Account[] accts2 = new List<Account>();
       for(Integer i=3;i<6;i++) {
           Account a = new Account(Name='okToDelete' + i,
                                   AccountNumber='xxx');
           accts2.add(a);
        }
        insert accts2;
        System.assertEquals(accts2.size(), 3);
        System.debug(foo); // This is the line where the checkpoint was set. This is also where the SOQL and Action Scripts were executed
   }
}
*/
/* The trigger code
trigger MyAccountTrigger on Account(before delete, before insert, before update,
                                    after delete, after insert, after update) {
if (Trigger.isBefore) {
    if (Trigger.isDelete) {

        // In a before delete trigger, the trigger accesses the records that will be
        // deleted with the Trigger.old list.
        for (Account a : Trigger.old) {
            if (!a.name.startsWith('okToDelete')) {
                a.addError('You can\'t delete this record!');
            }
        }
    } else {

    // In before insert or before update triggers, the trigger accesses the new records
    // with the Trigger.new list.
        for (Account a : Trigger.new) {
            if (a.name == 'bad') {
                a.name.addError('Bad name');
            }
    }
    if (Trigger.isInsert) {
        for (Account a : Trigger.new) {
            System.assertEquals('xxx', a.accountNumber);
            a.accountNumber = 'yyy';
        }

// If the trigger is not a before trigger, it must be an after trigger.
} else {
    if (Trigger.isInsert) {
        List<Contact> contacts = new List<Contact>();
        for (Account a : Trigger.new) {
            if(a.Name == 'makeContact') {
                contacts.add(new Contact (LastName = a.Name,
                                          AccountId = a.Id));
            }
        }
      insert contacts;
    }
  }
}}}

// The ApexResult doesn't require the same type of test as SOQL. The ApexResult is a simple execute anonymous and requires
// less setup. The code below will be used with the following Apex. Also of note: Because the checkpoints use ExecuteAnonymous
// the apexError in the HeapDumpApexResult will never get set. Any error, whether it's a compiler error or unhandled runtime
// exception is going to show up in the apexExecutionResult.
// For the success case: System.Debug(4/2);
// For the runtime exception: System.Debug(4/0);
// For the compile error: 'Neener neener neener';
@isTest
public class SimpleTestClass {

    @isTest
    public static void SimpleTest() {
        System.debug('This is just a simple test class'); // Checkpoint was set here and the various Apex lines (above) were executed on this line
    }
}
*/
