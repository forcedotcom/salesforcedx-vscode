/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { action } from './types';

const xmlCharMap: { [key: string]: string } = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

const escapeXml = (data: string): string =>
  data.replace(/[<>&'\"]/g, (char: string) => xmlCharMap[char]);

export function encodeBody(accessToken: string, data: string): string {
  const escapedData = escapeXml(data);

  return `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>${accessToken}</cmd:sessionId>
        </cmd:SessionHeader>
        <apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>
    </env:Header>
    <env:Body>
        <${action} xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>${escapedData}</apexcode>
        </${action}>
    </env:Body>
</env:Envelope>`;
}
