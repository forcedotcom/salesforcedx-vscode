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

  it('should correctly return encoded body given the parameters', () => {
    const actionBody = 'System.assert(true);';
    const encodedBody = encodeBody(accessToken, actionBody);
    expect(encodedBody).toMatchSnapshot();
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
    const actionBody = 'System.assert(true);\n// > & < & \'"\' "\'"';
    const encodedBody = encodeBody(accessToken, actionBody);
    expect(encodedBody).toMatchSnapshot();
  });
});
