/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { getSnapshot, applyFileOperations } from './fileSystemService';

// Configuration - these would be set by Codey Studio via VS Code configuration
// For now, hardcoded for POC
const CODEY_SERVER_URL = 'http://localhost:3002';
const SESSION_ID = 'default-session';

export const handleFileSyncRequest = async (event: MessageEvent): Promise<void> => {
    // eslint-disable-next-line functional/no-try-statements
    try {
        switch (event.data.type) {
            case 'get_snapshot': {
                // eslint-disable-next-line functional/no-try-statements
                try {
                    // Get snapshot from local file system service
                    const snapshot = await getSnapshot();
                    console.log('FileSystemService: get_snapshot requested', { snapshot });

                    // Send snapshot to Codey Server via HTTP
                    const response = await fetch(`${CODEY_SERVER_URL}/api/filesystem/${SESSION_ID}/snapshot`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!response.ok) {
                        // eslint-disable-next-line functional/no-throw-statements
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('FileSystemService: snapshot sent to Codey Server', data);
                } catch (error) {
                    console.error('FileSystemService: Error sending snapshot to Codey Server:', error);
                }
                break;
            }

            case 'apply_operations': {
                // eslint-disable-next-line functional/no-try-statements
                try {
                    await applyFileOperations(event.data.operations);
                    console.log('FileSystemService: apply_operations completed', { operations: event.data.operations });

                    // Send operations to Codey Server via HTTP
                    const response = await fetch(`${CODEY_SERVER_URL}/api/filesystem/${SESSION_ID}/operations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operations: event.data.operations })
                    });

                    if (!response.ok) {
                        // eslint-disable-next-line functional/no-throw-statements
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('FileSystemService: operations sent to Codey Server', data);
                } catch (error) {
                    console.error('FileSystemService: Error sending operations to Codey Server:', error);
                }
                break;
            }
        }
    } catch (error) {
        console.error('Error handling parent message:', error);
    }
};

export const registerFileSyncHandler = (_context: vscode.ExtensionContext): void => {
    // WHY POSTMESSAGE? VS Code extensions cannot directly communicate with external windows.
    // The postMessage serves as a secure bridge: Codey Studio → VS Code Web → Extension
    // This maintains VS Code's security model while enabling controlled communication.

    const globalContext = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis);

    if ('addEventListener' in globalContext) {
        globalContext.addEventListener('message', (event: MessageEvent) => {
            // Only handle messages from the same origin for security
            if (event.origin !== globalContext.location?.origin) return;
            void handleFileSyncRequest(event);
        });

        console.log('FileSystemService: File sync handler registered for HTTP communication with Codey Server');
    } else {
        console.warn('FileSystemService: Cannot register file sync handler - no event listener API available');
    }
};
