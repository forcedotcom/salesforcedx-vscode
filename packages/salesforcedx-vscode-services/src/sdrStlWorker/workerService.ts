/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Org, SfProject } from '@salesforce/core';
import {
  ComponentSet,
  MetadataConverter,
  MetadataResolver,
  RegistryAccess,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import { getKeyFromObject, SourceTracking, type ChangeResult } from '@salesforce/source-tracking';
import { isError } from 'effect/Predicate';
import { HandleRegistry } from './handleRegistry';
import { type WorkerRequest, type WorkerResponse } from './protocol';

type SourceTrackingRemoteChange = ChangeResult & { name: string; type: string };
const isResolvedRemoteChange = (change: ChangeResult): change is SourceTrackingRemoteChange =>
  typeof change.name === 'string' && typeof change.type === 'string';

export class SdrWorkerService {
  private readonly handles = new HandleRegistry();

  public async execute(request: WorkerRequest): Promise<WorkerResponse> {
    // eslint-disable-next-line functional/no-try-statements -- Convert third-party SDR exceptions to the serializable worker protocol.
    try {
      switch (request._tag) {
        case 'ComponentSetFromSource': {
          const registry = new RegistryAccess(undefined, request.projectDirectory);
          const resolver = new MetadataResolver(registry);
          const componentSet = new ComponentSet(
            request.paths.flatMap(path => resolver.getComponentsFromPath(path)),
            registry
          );
          componentSet.forceIgnoredPaths = resolver.forceIgnoredPaths;
          const handle = this.handles.addComponentSet(componentSet);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'ComponentSetCreated',
            handle,
            componentCount: componentSet.size
          };
        }
        case 'ComponentSetFromManifest': {
          const componentSet = await ComponentSet.fromManifest(request.manifestPath);
          const handle = this.handles.addComponentSet(componentSet);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'ComponentSetCreated',
            handle,
            componentCount: componentSet.size
          };
        }
        case 'Dispose':
          this.handles.remove(request.handle);
          return { protocolVersion: 1, requestId: request.requestId, _tag: 'Disposed', handle: request.handle };
        case 'ConvertToMetadataZip': {
          const componentSet = this.handles.getComponentSet(request.handle);
          const result = await new MetadataConverter().convert(componentSet, 'metadata', {
            type: 'zip',
            ...(request.packageName ? { packageName: request.packageName } : {})
          });
          // eslint-disable-next-line functional/no-throw-statements -- malformed SDR conversion cannot be represented as a success response.
          if (!result.zipBuffer) throw new Error('SDR conversion completed without producing a ZIP buffer.');
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'MetadataZipCreated',
            zip: new Uint8Array(result.zipBuffer),
            zipFileCount: result.zipFileCount ?? 0
          };
        }
        case 'GetPackageXml': {
          const componentSet = this.handles.getComponentSet(request.handle);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'PackageXmlCreated',
            xml: await componentSet.getPackageXml()
          };
        }
        case 'GetComponentSummary': {
          const componentSet = this.handles.getComponentSet(request.handle);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'ComponentSummaryCreated',
            components: componentSet.toArray().map(component => ({
              fullName: component.fullName,
              type: component.type.name,
              isSourceBacked: component instanceof SourceComponent
            }))
          };
        }
        case 'GetSourceTrackingKey':
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'SourceTrackingKeyCreated',
            key: getKeyFromObject({ type: request.type, name: request.name, origin: 'local' })
          };
        case 'CreateSourceTrackingSession': {
          const authInfo = await AuthInfo.create({
            accessTokenOptions: {
              accessToken: request.accessToken,
              loginUrl: request.instanceUrl,
              instanceUrl: request.instanceUrl
            }
          });
          const connection = await Connection.create({
            authInfo,
            ...(request.apiVersion ? { connectionOptions: { version: request.apiVersion } } : {})
          });
          const [org, project] = await Promise.all([
            Org.create({ connection }),
            SfProject.resolve(request.projectDirectory)
          ]);
          const sourceTracking = await SourceTracking.create({
            org,
            project,
            subscribeSDREvents: false,
            ignoreConflicts: request.ignoreConflicts ?? false
          });
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'SourceTrackingSessionCreated',
            handle: this.handles.addSourceTrackingSession(sourceTracking, connection)
          };
        }
        case 'GetLocalChanges': {
          const { sourceTracking } = this.handles.getSourceTrackingSession(request.handle);
          const componentSets = await sourceTracking.localChangesAsComponentSet(request.byPackageDirectory);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'LocalChangesCreated',
            handles: componentSets.map(componentSet => this.handles.addComponentSet(componentSet))
          };
        }
        case 'GetSourceTrackingStatus': {
          const { sourceTracking } = this.handles.getSourceTrackingSession(request.handle);
          await Promise.all([
            ...(request.local ? [sourceTracking.reReadLocalTrackingCache()] : []),
            ...(request.remote ? [sourceTracking.reReadRemoteTracking()] : [])
          ]);
          const status = await sourceTracking.getStatus({ local: request.local, remote: request.remote });
          const remoteChanges = request.remote
            ? (
                await Promise.all([
                  sourceTracking.getChanges({ origin: 'remote', state: 'nondelete', format: 'ChangeResult' }),
                  sourceTracking.getChanges({ origin: 'remote', state: 'delete', format: 'ChangeResult' })
                ])
              )
                .flat()
                .filter(isResolvedRemoteChange)
                .map(change => ({
                  name: change.name,
                  type: change.type,
                  ...(change.revisionCounter !== undefined ? { revisionCounter: change.revisionCounter } : {}),
                  ...(change.lastModifiedDate ? { lastModifiedDate: change.lastModifiedDate } : {}),
                  ...(change.memberIdOrName ? { memberIdOrName: change.memberIdOrName } : {}),
                  ...(change.deleted !== undefined ? { deleted: change.deleted } : {}),
                  ...(change.modified !== undefined ? { modified: change.modified } : {})
                }))
            : [];
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'SourceTrackingStatus',
            status,
            remoteChanges
          };
        }
        case 'DeployLocalChanges': {
          const { sourceTracking, connection } = this.handles.getSourceTrackingSession(request.handle);
          await sourceTracking.reReadLocalTrackingCache();
          const componentSets = await sourceTracking.localChangesAsComponentSet();
          const componentSet = componentSets.find(set => set.getSourceComponents().first() !== undefined);
          if (!componentSet) {
            return {
              protocolVersion: 1,
              requestId: request.requestId,
              _tag: 'LocalChangesDeployed',
              status: 'NoLocalChanges',
              components: [],
              fileResponseCount: 0
            };
          }
          componentSet.projectDirectory = sourceTracking.projectPath;
          const operation = await componentSet.deploy({ usernameOrConnection: connection });
          const result = await operation.pollStatus();
          await sourceTracking.updateTrackingFromDeploy(result);
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            _tag: 'LocalChangesDeployed',
            status: result.response.status,
            components: componentSet.toArray().map(component => ({
              fullName: component.fullName,
              type: component.type.name,
              isSourceBacked: component instanceof SourceComponent
            })),
            fileResponseCount: result.getFileResponses().length
          };
        }
      }
    } catch (error) {
      const cause = isError(error) ? error : new Error(String(error));
      return {
        protocolVersion: 1,
        requestId: request.requestId,
        _tag: 'Failure',
        error: {
          name: cause.name,
          message: cause.message,
          ...(cause.stack ? { stack: cause.stack } : {})
        }
      };
    }
  }
}
