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

const escapeXml = (data: string): string => data.replaceAll(/[<>&'"]/g, (char: string) => xmlCharMap[char]);

// Encodes request body with SOAP envelope and explicit DebuggingHeader: Apex_code=Finest, Visualforce=Finer,
// Apex_profiling=Info. Apex_profiling emits the CUMULATIVE_LIMIT_USAGE block (e.g. "Number of SOQL queries:").
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
        <apex:DebuggingHeader>
            <apex:categories><apex:category>Apex_code</apex:category><apex:level>Finest</apex:level></apex:categories>
            <apex:categories><apex:category>Visualforce</apex:category><apex:level>Finer</apex:level></apex:categories>
            <apex:categories><apex:category>Apex_profiling</apex:category><apex:level>Info</apex:level></apex:categories>
        </apex:DebuggingHeader>
    </env:Header>
    <env:Body>
        <${action} xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>${escapedData}</apexcode>
        </${action}>
    </env:Body>
</env:Envelope>`;
}
