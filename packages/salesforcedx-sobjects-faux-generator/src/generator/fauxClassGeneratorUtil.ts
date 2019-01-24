import * as fs from 'fs';
import * as path from 'path';
import { rm } from 'shelljs';
import {
  CUSTOMOBJECTS_DIR,
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from '../constants';
import { ChildRelationship, Field, SObjectCategory } from '../describe';
import { FauxClassGenerator } from './fauxClassGenerator';

export class GeneratorUtil {
  public static getFieldsFromFauxClass(
    fauxClassPath: string,
    filter: (line: string) => any
  ) {
    const fields: Field[] = [];
    const classContent = fs.readFileSync(fauxClassPath).toString();
    classContent
      .split('\n')
      .filter(filter)
      .map(line =>
        line
          .trimLeft()
          .replace(';', '')
          .split(' ')
      )
      .forEach(lineParts => {
        fields.push({ name: lineParts[2], type: lineParts[1] });
      });
    return fields;
  }

  public static getSObjectsFolder(
    projectPath: string,
    type?: SObjectCategory
  ): string {
    let sobjectFolder = path.join(
      projectPath,
      SFDX_DIR,
      TOOLS_DIR,
      SOBJECTS_DIR
    );
    if (type === SObjectCategory.CUSTOM) {
      sobjectFolder = path.join(sobjectFolder, CUSTOMOBJECTS_DIR);
    } else if (type === SObjectCategory.STANDARD) {
      sobjectFolder = path.join(sobjectFolder, STANDARDOBJECTS_DIR);
    }
    return sobjectFolder;
  }

  public static getTargetType(describeType: string): string {
    const gentype = FauxClassGenerator.typeMapping.get(
      describeType.toLowerCase()
    ) as string;
    return gentype ? gentype : this.capitalize(describeType);
  }

  public static getReferenceName(
    relationshipName: string,
    name: string
  ): string {
    return relationshipName ? relationshipName : this.stripId(name);
  }

  public static generateChildRelationship(rel: ChildRelationship): string {
    const nameToUse = this.getReferenceName(rel.relationshipName, rel.field);
    return `List<${rel.childSObject}> ${nameToUse}`;
  }

  public static cleanupSObjectFolders(baseSObjectsFolder: string) {
    if (fs.existsSync(baseSObjectsFolder)) {
      rm('-rf', baseSObjectsFolder);
    }
  }

  private static stripId(name: string): string {
    if (name.endsWith('Id')) {
      return name.slice(0, name.length - 2);
    } else {
      return name;
    }
  }

  private static capitalize(input: string): string {
    return input.charAt(0).toUpperCase() + input.slice(1);
  }
}
