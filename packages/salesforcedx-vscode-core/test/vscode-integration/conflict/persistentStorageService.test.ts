/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, DeployResult, FileProperties } from '@salesforce/source-deploy-retrieve';
import { MetadataApiDeployStatus, RequestStatus} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import { PersistentStorageService } from '../../../src/conflict/persistentStorageService';
import {
  decomposed,
  matchingContentFile,
  mockRegistry,
  mockRegistryData
} from '../mock/registry';
import { MockContext } from '../telemetry/MockContext';

describe('Persistent Storage Service', () => {
  const deployComponentOne = matchingContentFile.COMPONENT;
  const deployComponentTwo = decomposed.DECOMPOSED_COMPONENT;
  const props: FileProperties[] = [
    {
      fullName: deployComponentOne.name,
      lastModifiedDate: 'Tomorrow',
      type: mockRegistryData.types.matchingcontentfile.name
    },
    {
      fullName: deployComponentTwo.name,
      lastModifiedDate: 'Yesterday',
      type: mockRegistryData.types.decomposed.name
    }
  ] as FileProperties[];
  const mockDeployResult = new DeployResult(
    {
      status: RequestStatus.Succeeded,
      lastModifiedDate: 'Yesterday'
    } as MetadataApiDeployStatus,
    new ComponentSet([
      deployComponentOne,
      deployComponentTwo
    ], mockRegistry)
  );
  const cache = PersistentStorageService.getInstance();
  const keyOne = cache.makeKey(mockRegistryData.types.matchingcontentfile.name, deployComponentOne.name);
  const keyTwo = cache.makeKey(mockRegistryData.types.decomposed.name, deployComponentTwo.name);

  beforeEach(() => {
    const mockContext = new MockContext(false);
    PersistentStorageService.initialize(mockContext);
  });

  it('Should store and retrieve file properties in Memento cache for Retrieve', () => {
    cache.setPropertiesForFilesRetrieve(props);
    expect(cache.getPropertiesForFile(keyOne)).to.deep.equal({lastModifiedDate: 'Tomorrow'});
    expect(cache.getPropertiesForFile(keyTwo)).to.deep.equal({lastModifiedDate: 'Yesterday'});
    cache.setPropertiesForFile(keyOne, undefined);
    cache.setPropertiesForFile(keyTwo, undefined);
    expect(cache.getPropertiesForFile(keyOne)).to.equal(undefined);
    expect(cache.getPropertiesForFile(keyTwo)).to.equal(undefined);
  });

  it('Should set and get ConflictFileProperties in Memento cache for Deploy', () => {
    cache.setPropertiesForFilesDeploy(mockDeployResult.components, mockDeployResult.response);
    expect(cache.getPropertiesForFile(keyOne)).to.deep.equal({lastModifiedDate: 'Yesterday'});
    expect(cache.getPropertiesForFile(keyTwo)).to.deep.equal({lastModifiedDate: 'Yesterday'});
    cache.setPropertiesForFile(keyOne, undefined);
    cache.setPropertiesForFile(keyTwo, undefined);
    expect(cache.getPropertiesForFile(keyOne)).to.equal(undefined);
    expect(cache.getPropertiesForFile(keyTwo)).to.equal(undefined);
  });

});
