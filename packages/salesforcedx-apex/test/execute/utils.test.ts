/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { encodeBody } from '../../src/execute/utils';
import { expect } from 'chai';

describe('encodeBody for execute request', () => {
  const accessToken = '0000000000x189';
  let actionBody = `System.assert(true);`;
  const debugHeader =
    '<apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>';
  const action = 'executeAnonymous';
  const expectedBody = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>${accessToken}</cmd:sessionId>
        </cmd:SessionHeader>
        ${debugHeader}
    </env:Header>
    <env:Body>
        <${action} xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>${actionBody}</apexcode>
        </${action}>
    </env:Body>
</env:Envelope>`;
  it('should correctly return encoded body given the parameters', () => {
    const encodedBody = encodeBody(accessToken, actionBody);
    expect(encodedBody).to.eql(expectedBody);
  });

  it('should correctly return encoded body given parameters with characters that must be escaped', () => {
    actionBody = `System.assert(true);\n// > & < & '"' "'"`;
    const expectedResponse = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>${accessToken}</cmd:sessionId>
        </cmd:SessionHeader>
        ${debugHeader}
    </env:Header>
    <env:Body>
        <${action} xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>System.assert(true);\n// &gt; &amp; &lt; &amp; &apos;&quot;&apos; &quot;&apos;&quot;</apexcode>
        </${action}>
    </env:Body>
</env:Envelope>`;
    const encodedBody = encodeBody(accessToken, actionBody);
    expect(encodedBody).to.eql(expectedResponse);
  });
});
