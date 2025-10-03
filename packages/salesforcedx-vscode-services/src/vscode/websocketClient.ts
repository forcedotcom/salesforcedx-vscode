/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SerializedEntryWithPath } from '../virtualFsProvider/fsTypes';
import { getSnapshot, applyFileOperations } from './fileSystemService';

// Configuration - read from VS Code settings or environment
const CODEY_SERVER_WS_URL = 'ws://localhost:3002/ws/filesystem';
const SESSION_ID = 'default-session'; // TODO: Get from VS Code workspace state

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

    /**
     * Connect to codey-server WebSocket endpoint
     * This does NOT use addEventListener - uses WebSocket callback properties
     */
    public connect(): void {
        // eslint-disable-next-line functional/no-try-statements
        try {
            console.log('[WebSocketClient] Connecting to:', CODEY_SERVER_WS_URL);

            // WebSocket constructor is available in browser/worker contexts
            // It doesn't use addEventListener, just callback properties
            this.ws = new WebSocket(CODEY_SERVER_WS_URL);

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
        console.log('[WebSocketClient] Connected to codey-server');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Register with server
        this.send({
            type: 'register',
            sessionId: SESSION_ID
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    private async handleMessage(event: MessageEvent): Promise<void> {
        // eslint-disable-next-line functional/no-try-statements
        try {
            const message: ServerToExtensionMessage = JSON.parse(event.data);
            console.log('[WebSocketClient] Received message:', message.type);

            switch (message.type) {
                case 'snapshot_request':
                    await this.handleSnapshotRequest(message.requestId);
                    break;

                case 'apply_operations':
                    await this.handleApplyOperations(message.requestId, message.operations);
                    break;

                default:
                    console.warn('[WebSocketClient] Unknown message type');
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
            console.log('[WebSocketClient] Applying', operations.length, 'file operations...');
            await applyFileOperations(operations);

            this.send({
                type: 'operations_complete',
                requestId,
                success: true
            });

            console.log('[WebSocketClient] Operations applied successfully');
        } catch (error) {
            console.error('[WebSocketClient] Error applying operations:', error);

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
    private handleError(_error: Event): void {
        // Error is logged by WebSocket itself
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
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[WebSocketClient] Cannot send message - WebSocket not connected');
            return;
        }

        this.ws.send(JSON.stringify(message));
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
