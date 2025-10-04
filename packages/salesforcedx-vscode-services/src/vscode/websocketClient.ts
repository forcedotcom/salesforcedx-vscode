/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { SerializedEntryWithPath } from '../virtualFsProvider/fsTypes';
import { getSnapshot, applyFileOperations } from './fileSystemService';

// Configuration - read from VS Code settings or environment
const CODEY_SERVER_WS_URL = 'ws://localhost:3001/ws/filesystem';

/**
 * Get session ID from VS Code workspace configuration
 * The session ID is set by Code Builder Web from the URL query parameter
 * and passed to extensions via configurationDefaults
 */
function getSessionId(): string {
    try {
        // Read from VS Code workspace configuration
        // Code Builder Web sets this from ?sessionId=xxx URL parameter
        const config = vscode.workspace.getConfiguration('codey');
        const sessionId = config.get<string>('sessionId');

        if (sessionId) {
            console.log('[WebSocketClient] Using session ID from VS Code config:', sessionId);
            return sessionId;
        }
    } catch (e) {
        console.warn('[WebSocketClient] Could not read session ID from config:', e);
    }

    // Fallback to default for POC
    console.log('[WebSocketClient] No session ID in config, using default');
    return 'default-session';
}

type ServerToExtensionMessage =
    | { type: 'snapshot_request'; requestId: string }
    | { type: 'apply_operations'; requestId: string; operations: FileOperation[] };

type ExtensionToServerMessage =
    | { type: 'register'; sessionId: string }
    | { type: 'snapshot_response'; requestId: string; snapshot: SerializedEntryWithPath[] }
    | { type: 'operations_complete'; requestId: string; success: boolean; error?: string };

type FileOperation = {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
};

/**
 * WebSocket client for bidirectional communication with codey-server
 * Uses WebSocket callback properties (onopen, onmessage, etc.) instead of addEventListener
 * This avoids CSP/security issues in VS Code extension host worker
 */
export class WebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // ms
    private isConnected = false;
    private sessionId: string;

    constructor(_context: vscode.ExtensionContext) {
        this.sessionId = getSessionId();
    }

    /**
     * Connect to codey-server WebSocket endpoint
     * This does NOT use addEventListener - uses WebSocket callback properties
     */
    public connect(): void {
        // eslint-disable-next-line functional/no-try-statements
        try {
            console.log('[WebSocketClient] ========== CONNECTING TO WEBSOCKET ==========');
            console.log('[WebSocketClient] URL:', CODEY_SERVER_WS_URL);
            console.log('[WebSocketClient] Session ID:', this.sessionId);

            // WebSocket constructor is available in browser/worker contexts
            // It doesn't use addEventListener, just callback properties
            this.ws = new WebSocket(CODEY_SERVER_WS_URL);

            console.log('[WebSocketClient] WebSocket instance created, readyState:', this.ws.readyState);

            // Set up callbacks (NOT addEventListener - this is the key difference!)
            this.ws.onopen = (): void => this.handleOpen();
            this.ws.onmessage = (event: MessageEvent): Promise<void> => this.handleMessage(event);
            this.ws.onerror = (error: Event): void => this.handleError(error);
            this.ws.onclose = (): void => this.handleClose();

        } catch (error) {
            console.error('[WebSocketClient] Connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket connection opened
     */
    private handleOpen(): void {
        console.log('[WebSocketClient] ========== WEBSOCKET CONNECTED ==========');
        console.log('[WebSocketClient] Connection established to codey-server');
        console.log('[WebSocketClient] ReadyState:', this.ws?.readyState);
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Register with server using the session ID
        console.log('[WebSocketClient] ========== REGISTERING WITH SESSION ID ==========');
        console.log('[WebSocketClient] Session ID:', this.sessionId);
        this.send({
            type: 'register',
            sessionId: this.sessionId
        });
        console.log('[WebSocketClient] Registration message sent');
    }

    /**
     * Handle incoming WebSocket messages
     */
    private async handleMessage(event: MessageEvent): Promise<void> {
        // eslint-disable-next-line functional/no-try-statements
        try {
            console.log('[WebSocketClient] ========== MESSAGE RECEIVED ==========');
            console.log('[WebSocketClient] Raw data:', event.data);
            const message: ServerToExtensionMessage = JSON.parse(event.data);
            console.log('[WebSocketClient] Parsed message type:', message.type);
            console.log('[WebSocketClient] Full message:', JSON.stringify(message, null, 2));

            switch (message.type) {
                case 'snapshot_request':
                    console.log('[WebSocketClient] Handling snapshot_request...');
                    await this.handleSnapshotRequest(message.requestId);
                    break;

                case 'apply_operations':
                    console.log('[WebSocketClient] ========== APPLY OPERATIONS RECEIVED ==========');
                    console.log('[WebSocketClient] Operations count:', message.operations.length);
                    console.log('[WebSocketClient] Operations:', JSON.stringify(message.operations, null, 2));
                    await this.handleApplyOperations(message.requestId, message.operations);
                    break;

                default:
                    console.warn('[WebSocketClient] Unknown message type:', (message as { type: string }).type);
            }
        } catch (error) {
            console.error('[WebSocketClient] Error handling message:', error);
        }
    }

    /**
     * Handle snapshot request from server
     */
    private async handleSnapshotRequest(requestId: string): Promise<void> {
        // eslint-disable-next-line functional/no-try-statements
        try {
            console.log('[WebSocketClient] Getting filesystem snapshot...');
            const snapshot = await getSnapshot();

            this.send({
                type: 'snapshot_response',
                requestId,
                snapshot
            });

            console.log('[WebSocketClient] Snapshot sent:', snapshot.length, 'entries');
        } catch (error) {
            console.error('[WebSocketClient] Error getting snapshot:', error);
        }
    }

    /**
     * Handle apply operations request from server
     */
    private async handleApplyOperations(requestId: string, operations: FileOperation[]): Promise<void> {
        // eslint-disable-next-line functional/no-try-statements
        try {
            console.log('[WebSocketClient] ========== APPLYING FILE OPERATIONS ==========');
            console.log('[WebSocketClient] Request ID:', requestId);
            console.log('[WebSocketClient] Operations count:', operations.length);
            operations.forEach((op, idx) => {
                console.log(`[WebSocketClient] Operation ${idx + 1}:`, {
                    type: op.type,
                    path: op.path,
                    contentLength: op.content?.length || 0
                });
            });

            console.log('[WebSocketClient] Calling applyFileOperations...');
            await applyFileOperations(operations);
            console.log('[WebSocketClient] applyFileOperations completed successfully');

            this.send({
                type: 'operations_complete',
                requestId,
                success: true
            });

            console.log('[WebSocketClient] ========== OPERATIONS APPLIED SUCCESSFULLY ==========');
        } catch (error) {
            console.error('[WebSocketClient] ========== ERROR APPLYING OPERATIONS ==========');
            console.error('[WebSocketClient] Error details:', error);

            this.send({
                type: 'operations_complete',
                requestId,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Handle WebSocket error
     */
    // eslint-disable-next-line class-methods-use-this
    private handleError(error: Event): void {
        console.error('[WebSocketClient] ========== WEBSOCKET ERROR ==========');
        console.error('[WebSocketClient] Error event:', error);
        console.error('[WebSocketClient] Error type:', error.type);
    }

    /**
     * Handle WebSocket connection closed
     */
    private handleClose(): void {
        console.log('[WebSocketClient] Connection closed');
        this.isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocketClient] Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Send message to server
     */
    private send(message: ExtensionToServerMessage): void {
        console.log('[WebSocketClient] ========== SENDING MESSAGE ==========');
        console.log('[WebSocketClient] Message type:', message.type);
        console.log('[WebSocketClient] WebSocket state:', this.ws?.readyState);

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[WebSocketClient] Cannot send message - WebSocket not connected');
            console.error('[WebSocketClient] Current readyState:', this.ws?.readyState);
            return;
        }

        const payload = JSON.stringify(message);
        console.log('[WebSocketClient] Sending payload:', payload);
        this.ws.send(payload);
        console.log('[WebSocketClient] Message sent successfully');
    }

    /**
     * Disconnect from server
     */
    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    /**
     * Get connection status
     */
    public getConnectionStatus(): boolean {
        return this.isConnected;
    }
}
