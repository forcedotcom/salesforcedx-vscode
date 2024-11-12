/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ComponentSet,
  DeployResult,
  FileProperties,
  registry,
  SourceComponent
} from '@salesforce/source-deploy-retrieve-bundle';
import { MetadataApiDeployStatus, RequestStatus } from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import { expect } from 'chai';
import { basename, dirname, join } from 'path';
import { PersistentStorageService } from '../../../src/conflict/persistentStorageService';
import { MockExtensionContext } from '../telemetry/MockExtensionContext';

describe('Persistent Storage Service', () => {
  const props: FileProperties[] = [
    {
      id: '1',
      createdById: '2',
      createdByName: 'Me',
      createdDate: 'Today',
      fileName: join('classes', 'One.cls'),
      fullName: 'One',
      lastModifiedById: '3',
      lastModifiedByName: 'You',
      lastModifiedDate: 'Tomorrow',
      type: 'ApexClass'
    },
    {
      id: '4',
      createdById: '2',
      createdByName: 'Me',
      createdDate: 'Yesterday',
      fileName: join('objects', 'Two.cls'),
      fullName: 'Two',
      lastModifiedById: '2',
      lastModifiedByName: 'Me',
      lastModifiedDate: 'Yesterday',
      type: 'CustomObject'
    }
  ];
  const deployPropsOne = {
    name: 'One',
    fullName: 'One',
    type: registry.types.apexclass,
    content: join('project', 'classes', 'One.cls'),
    xml: join('project', 'classes', 'One.cls-meta.xml')
  };
  const deployComponentOne = SourceComponent.createVirtualComponent(deployPropsOne, [
    {
      dirPath: dirname(deployPropsOne.content),
      children: [basename(deployPropsOne.content), basename(deployPropsOne.xml)]
    }
  ]);
  const deployPropsTwo = {
    name: 'Two',
    fullName: 'Two',
    type: registry.types.customobject,
    content: join('project', 'classes', 'Two.cls'),
    xml: join('project', 'classes', 'Two.cls-meta.xml')
  };
  const deployComponentTwo = SourceComponent.createVirtualComponent(deployPropsTwo, [
    {
      dirPath: dirname(deployPropsTwo.content),
      children: [basename(deployPropsTwo.content), basename(deployPropsTwo.xml)]
    }
  ]);
  const mockDeployResult = new DeployResult(
    {
      status: RequestStatus.Succeeded,
      lastModifiedDate: 'Yesterday'
    } as MetadataApiDeployStatus,
    new ComponentSet([deployComponentOne, deployComponentTwo])
  );

  beforeEach(() => {
    const mockExtensionContext = new MockExtensionContext(false);
    PersistentStorageService.initialize(mockExtensionContext);
  });

  it('Should store and retrieve file properties in Memento cache for Retrieve', () => {
    const cache = PersistentStorageService.getInstance();
    cache.setPropertiesForFilesRetrieve(props);
    expect(cache.getPropertiesForFile(cache.makeKey('ApexClass', 'One'))).to.deep.equal({
      lastModifiedDate: 'Tomorrow'
    });
    expect(cache.getPropertiesForFile(cache.makeKey('CustomObject', 'Two'))).to.deep.equal({
      lastModifiedDate: 'Yesterday'
    });
    cache.setPropertiesForFile(cache.makeKey('ApexClass', 'One'), undefined);
    cache.setPropertiesForFile(cache.makeKey('CustomObject', 'Two'), undefined);
    expect(cache.getPropertiesForFile(cache.makeKey('ApexClass', 'One'))).to.equal(undefined);
    expect(cache.getPropertiesForFile(cache.makeKey('CustomObject', 'Two'))).to.equal(undefined);
  });
});
