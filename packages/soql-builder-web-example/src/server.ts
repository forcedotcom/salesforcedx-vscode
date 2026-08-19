/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line no-restricted-imports -- this package is an intentional standalone Node server, not a web extension
import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { type OrgDataSource, isValidSObjectName } from './salesforceOrgDataSource.js';

const staticFiles = new Map<string, { contentType: string; fileName: string }>([
  ['/', { contentType: 'text/html; charset=utf-8', fileName: 'index.html' }],
  ['/index.html', { contentType: 'text/html; charset=utf-8', fileName: 'index.html' }],
  ['/app.js', { contentType: 'text/javascript; charset=utf-8', fileName: 'app.js' }],
  ['/app.js.map', { contentType: 'application/json; charset=utf-8', fileName: 'app.js.map' }],
  ['/styles.css', { contentType: 'text/css; charset=utf-8', fileName: 'styles.css' }]
]);

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(body));
};

const sendError = (response: ServerResponse, error: unknown): void => {
  const actualError = error instanceof Error ? error : new Error(String(error));
  const missingAuthorization =
    actualError.name.includes('OrgNotFound') || actualError.message.includes('No authorization information found');
  console.error(`${actualError.name}: ${actualError.message}`);
  sendJson(response, missingAuthorization ? 503 : 502, {
    error: {
      code: missingAuthorization ? 'ORG_AUTH_ERROR' : 'SALESFORCE_ERROR',
      message: actualError.message
    }
  });
};

const handleApiRequest = async (
  dataSource: OrgDataSource,
  pathName: string,
  response: ServerResponse
): Promise<boolean> => {
  if (pathName === '/api/sobjects') {
    sendJson(response, 200, { sObjects: await dataSource.listSObjects() });
    return true;
  }
  const match = /^\/api\/sobjects\/([^/]+)$/.exec(pathName);
  if (match) {
    const sObjectName = decodeURIComponent(match[1]);
    if (!isValidSObjectName(sObjectName)) {
      sendJson(response, 400, { error: { code: 'INVALID_SOBJECT', message: 'Invalid object API name.' } });
      return true;
    }
    sendJson(response, 200, {
      fields: await dataSource.describeSObject(sObjectName),
      sObject: sObjectName
    });
    return true;
  }
  return false;
};

export const createSoqlBuilderServer = (
  dataSource: OrgDataSource,
  distDirectory = new URL('../../dist/', import.meta.url)
): Server =>
  createServer((request, response) => {
    void (async () => {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported.' } });
        return;
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        try {
          if (!(await handleApiRequest(dataSource, url.pathname, response))) {
            sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'API route not found.' } });
          }
        } catch (error) {
          sendError(response, error);
        }
        return;
      }
      const staticFile = staticFiles.get(url.pathname);
      if (!staticFile) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(new URL(staticFile.fileName, distDirectory));
      response.writeHead(200, {
        'content-type': staticFile.contentType,
        'x-content-type-options': 'nosniff'
      });
      response.end(body);
    })().catch(error => sendError(response, error));
  });
