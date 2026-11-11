/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Connection } from '@salesforce/core';
import { type ComponentSet } from '@salesforce/source-deploy-retrieve';
import { type SourceTracking } from '@salesforce/source-tracking';
import { randomUUID } from 'node:crypto';
import { type RemoteHandle } from './protocol';

export class HandleRegistry {
  private readonly componentSets = new Map<string, ComponentSet>();
  private readonly sourceTrackingSessions = new Map<
    string,
    { sourceTracking: SourceTracking; connection: Connection }
  >();

  constructor(private readonly workerId = randomUUID()) {}

  public addComponentSet(componentSet: ComponentSet): RemoteHandle {
    const id = randomUUID();
    this.componentSets.set(id, componentSet);
    return { protocolVersion: 1, workerId: this.workerId, id, kind: 'componentSet' };
  }

  public addSourceTrackingSession(sourceTracking: SourceTracking, connection: Connection): RemoteHandle {
    const id = randomUUID();
    this.sourceTrackingSessions.set(id, { sourceTracking, connection });
    return { protocolVersion: 1, workerId: this.workerId, id, kind: 'sourceTracking' };
  }

  public remove(handle: RemoteHandle): boolean {
    this.assertOwned(handle);
    return handle.kind === 'componentSet'
      ? this.componentSets.delete(handle.id)
      : this.sourceTrackingSessions.delete(handle.id);
  }

  public getSourceTrackingSession(handle: RemoteHandle): { sourceTracking: SourceTracking; connection: Connection } {
    this.assertOwned(handle);
    // eslint-disable-next-line functional/no-throw-statements -- RPC requests are validated at this imperative boundary.
    if (handle.kind !== 'sourceTracking') throw new Error(`Unknown source tracking handle: ${handle.id}`);
    const session = this.sourceTrackingSessions.get(handle.id);
    // eslint-disable-next-line functional/no-throw-statements -- RPC requests are validated at this imperative boundary.
    if (!session) throw new Error(`Unknown source tracking handle: ${handle.id}`);
    return session;
  }

  public getComponentSet(handle: RemoteHandle): ComponentSet {
    this.assertOwned(handle);
    // eslint-disable-next-line functional/no-throw-statements -- RPC requests are validated at this imperative boundary.
    if (handle.kind !== 'componentSet') throw new Error(`Unknown component set handle: ${handle.id}`);
    const componentSet = this.componentSets.get(handle.id);
    // eslint-disable-next-line functional/no-throw-statements -- RPC requests are validated at this imperative boundary.
    if (!componentSet) throw new Error(`Unknown component set handle: ${handle.id}`);
    return componentSet;
  }

  private assertOwned(handle: RemoteHandle): void {
    if (handle.workerId !== this.workerId) {
      // eslint-disable-next-line functional/no-throw-statements -- RPC requests are validated at this imperative boundary.
      throw new Error(`Unknown worker handle: ${handle.id}`);
    }
  }
}
