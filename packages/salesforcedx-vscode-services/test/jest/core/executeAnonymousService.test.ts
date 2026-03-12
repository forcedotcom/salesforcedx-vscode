/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildSoapRequest,
  parseSoapResponse
} from '../../../src/core/executeAnonymousService';

describe('buildSoapRequest', () => {
  it('produces correct URL with orgId from accessToken', () => {
    const req = buildSoapRequest(
      'https://myorg.my.salesforce.com',
      '59.0',
      '00Dxx!APItoken',
      'System.debug(1);'
    );
    expect(req.url).toBe(
      'https://myorg.my.salesforce.com/services/Soap/s/59.0/00Dxx'
    );
    expect(req.method).toBe('POST');
    expect(req.headers['content-type']).toBe('text/xml');
    expect(req.headers.soapaction).toBe('executeAnonymous');
  });

  it('escapes apex code in body', () => {
    const req = buildSoapRequest('https://x.com', '59.0', 'token', 'x < 1 && y > 0');
    expect(req.body).toContain('&lt;');
    expect(req.body).toContain('&gt;');
    expect(req.body).toContain('&amp;');
  });
});

describe('parseSoapResponse', () => {
  const fullSuccess = {
    'soapenv:Envelope': {
      'soapenv:Header': { DebuggingInfo: { debugLog: 'LOG BODY HERE' } },
      'soapenv:Body': {
        executeAnonymousResponse: {
          result: {
            column: 5,
            compiled: 'true',
            compileProblem: '',
            exceptionMessage: '',
            exceptionStackTrace: '',
            line: 1,
            success: 'true'
          }
        }
      }
    }
  };

  it('parses full success response with debug log', () => {
    const parsed = parseSoapResponse(fullSuccess);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.result.compiled).toBe(true);
    expect(parsed.result.success).toBe(true);
    expect(parsed.result.line).toBe(1);
    expect(parsed.result.column).toBe(5);
    expect(parsed.result.compileProblem).toBe('');
    expect(parsed.logBody).toBe('LOG BODY HERE');
  });

  it('returns empty logBody when header absent', () => {
    const noHeader = {
      'soapenv:Envelope': {
        'soapenv:Body': {
          executeAnonymousResponse: {
            result: {
              column: 1,
              compiled: 'true',
              compileProblem: '',
              exceptionMessage: '',
              exceptionStackTrace: '',
              line: 1,
              success: 'true'
            }
          }
        }
      }
    };
    const parsed = parseSoapResponse(noHeader);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.result.success).toBe(true);
    expect(parsed.logBody).toBe('');
  });

  it('handles compile error with empty-object fields (xml2js quirk)', () => {
    const compileError = {
      'soapenv:Envelope': {
        'soapenv:Body': {
          executeAnonymousResponse: {
            result: {
              column: 12,
              compiled: 'false',
              compileProblem: 'Unexpected token',
              exceptionMessage: {},
              exceptionStackTrace: {},
              line: 3,
              success: 'false'
            }
          }
        }
      }
    };
    const parsed = parseSoapResponse(compileError);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const { result } = parsed;
    expect(result.compiled).toBe(false);
    expect(result.success).toBe(false);
    expect(result.compileProblem).toBe('Unexpected token');
    expect(result.exceptionMessage).toBeNull();
    expect(result.exceptionStackTrace).toBeNull();
  });

  it('returns error when result missing', () => {
    const r1 = parseSoapResponse({});
    expect(r1.success).toBe(false);
    if (r1.success) return;
    expect(r1.error).toContain('Invalid SOAP response');
    const r2 = parseSoapResponse({ 'soapenv:Envelope': { 'soapenv:Body': {} } });
    expect(r2.success).toBe(false);
  });
});
