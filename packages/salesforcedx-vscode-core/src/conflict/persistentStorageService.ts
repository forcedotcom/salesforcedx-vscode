/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileProperties } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import {
  ExtensionContext,
  Memento
} from 'vscode';

interface ConflictFileProperties {
  lastModifiedByName: string;
  lastModifiedDate: string;
}
export interface LabelledConflictFileProperties {
  fileName: string;
  properties: ConflictFileProperties | undefined;
}

export class PersistentStorageService {
  private storage: Memento;
  private static instance?: PersistentStorageService;

  private constructor(context: ExtensionContext) {
    this.storage = context.globalState;
  }

  public static initialize(context: ExtensionContext) {
    PersistentStorageService.instance = new PersistentStorageService(context);
  }

  public static getInstance(): PersistentStorageService {
    if (!PersistentStorageService.instance) {
      throw new Error('Storage should have been initialized upon extension activation');
    }
    return PersistentStorageService.instance;
  }

  private getPropertiesForFile(fileName: string): ConflictFileProperties | undefined {
    return this.storage.get<ConflictFileProperties>(fileName);
  }

  private setPropertiesForFile(fileName: string, value: ConflictFileProperties) {
    this.storage.update(fileName, value);
  }

  public getPropertiesForFiles(fileProperties: FileProperties[]): LabelledConflictFileProperties[] {
    const conflictFileProperties = new Array<LabelledConflictFileProperties>(fileProperties.length);
    for (let i = 0; i < conflictFileProperties.length; i++) {
      const propertiesForFile = this.getPropertiesForFile(fileProperties[i].fileName);
      conflictFileProperties[i] = {
        fileName: fileProperties[i].fileName,
        properties: propertiesForFile
      };
    }
    return conflictFileProperties;
  }

  public setPropertiesForFiles(fileProperties: FileProperties[]) {
    for (const fileProperty of fileProperties) {
      this.setPropertiesForFile(
        fileProperty.fileName,
        {
          lastModifiedByName: fileProperty.lastModifiedByName,
          lastModifiedDate: fileProperty.lastModifiedDate
        });
    }
  }
}
