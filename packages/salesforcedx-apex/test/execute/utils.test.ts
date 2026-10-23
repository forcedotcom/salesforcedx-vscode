/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseStringPromise } from 'xml2js';
import { encodeBody } from '../../src/execute/utils';

describe('encodeBody for execute request', () => {
  const accessToken = '0000000000x189';
  let actionBody = 'System.assert(true);';
  const debugHeader = `<apex:DebuggingHeader>
            <apex:categories><apex:category>Apex_code</apex:category><apex:level>Finest</apex:level></apex:categories>
            <apex:categories><apex:category>Visualforce</apex:category><apex:level>Finer</apex:level></apex:categories>
            <apex:categories><apex:category>Apex_profiling</apex:category><apex:level>Info</apex:level></apex:categories>
        </apex:DebuggingHeader>`;
  const action = 'executeAnonymous';
  const expectedBody = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header xmlns="http://soap.sforce.com/2006/08/apex">
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
    expect(encodedBody).toEqual(expectedBody);
  });

  it.each([false, true])(
    'preserves SOAP namespaces when the proxy replaces SessionHeader (explicit namespace: %s)',
    async explicitNamespace => {
      const apexNamespace = 'http://soap.sforce.com/2006/08/apex';
      const soapNamespace = 'http://schemas.xmlsoap.org/soap/envelope/';
      const sessionHeader = `<SessionHeader${explicitNamespace ? ` xmlns="${apexNamespace}"` : ''}><sessionId>server-session</sessionId></SessionHeader>`;
      const forwardedBody = encodeBody('web-console-managed', "System.debug('hello, world');")
        .replaceAll(/<(?:\w+:)?SessionHeader\b[^>]*>[\s\S]*?<\/(?:\w+:)?SessionHeader>/g, '')
        .replace(/<env:Header\b[^>]*>/, `$&${sessionHeader}`);

      expect(forwardedBody).not.toContain('web-console-managed');
      expect(await parseStringPromise(forwardedBody, { xmlns: true, explicitArray: false })).toMatchObject({
        'env:Envelope': {
          $ns: { uri: soapNamespace, local: 'Envelope' },
          'env:Header': {
            $ns: { uri: soapNamespace, local: 'Header' },
            SessionHeader: {
              $ns: { uri: apexNamespace, local: 'SessionHeader' },
              sessionId: { $ns: { uri: apexNamespace, local: 'sessionId' }, _: 'server-session' }
            },
            'apex:DebuggingHeader': {
              $ns: { uri: apexNamespace, local: 'DebuggingHeader' },
              'apex:categories': [
                ['Apex_code', 'Finest'],
                ['Visualforce', 'Finer'],
                ['Apex_profiling', 'Info']
              ].map(([category, level]) => ({
                $ns: { uri: apexNamespace, local: 'categories' },
                'apex:category': { $ns: { uri: apexNamespace, local: 'category' }, _: category },
                'apex:level': { $ns: { uri: apexNamespace, local: 'level' }, _: level }
              }))
            }
          },
          'env:Body': {
            $ns: { uri: soapNamespace, local: 'Body' },
            executeAnonymous: {
              $ns: { uri: apexNamespace, local: 'executeAnonymous' },
              apexcode: { $ns: { uri: apexNamespace, local: 'apexcode' }, _: "System.debug('hello, world');" }
            }
          }
        }
      });
    }
  );

  it('should correctly return encoded body given parameters with characters that must be escaped', () => {
    actionBody = 'System.assert(true);\n// > & < & \'"\' "\'"';
    const expectedResponse = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header xmlns="http://soap.sforce.com/2006/08/apex">
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
    expect(encodedBody).toEqual(expectedResponse);
  });
});
