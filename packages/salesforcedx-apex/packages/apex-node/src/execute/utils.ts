/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { soapTemplate, action, xmlCharMap } from './types';
import * as util from 'util';

function escapeXml(data: string): string {
  return data.replace(/[<>&'"]/g, char => {
    return xmlCharMap[char];
  });
}

export function encodeBody(accessToken: string, data: string): string {
  const escapedData = escapeXml(data);
  const actionBody = `<apexcode>${escapedData}</apexcode>`;
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
