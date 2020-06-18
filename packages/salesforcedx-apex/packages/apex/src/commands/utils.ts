/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { soapTemplate, action } from '../types/execute';
import * as util from 'util';

export function encodeBody(accessToken: string, data: string): string {
  const actionBody = `<apexcode><![CDATA[${data}]]></apexcode>`;
  const debugHeader =
    '<apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>';
  const body = util.format(
    soapTemplate,
    accessToken,
    debugHeader,
    action,
    actionBody,
    action
  );
  return body;
}
