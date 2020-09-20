/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ModelDeserializer, ModelSerializer } from '@salesforce/soql-model';
import { Impl, Soql, SoqlModelUtils } from '@salesforce/soql-model/lib';
import { JsonMap } from '@salesforce/ts-types';

export interface ToolingModelJson extends JsonMap {
  sObject: string;
  fields: string[];
  errors: JsonMap[];
  unsupported: string[];
}

export class SoqlUtils {
  public static convertSoqlToUiModel(soql: string): ToolingModelJson {
    const queryModel = new ModelDeserializer(soql).deserialize();
    const uimodel = SoqlUtils.convertSoqlModelToUiModel(queryModel);
    return uimodel;
  }

  protected static convertSoqlModelToUiModel(
    queryModel: Soql.Query
  ): ToolingModelJson {
    const fields =
      queryModel.select &&
      (queryModel.select as Soql.SelectExprs).selectExpressions
        ? (queryModel.select as Soql.SelectExprs).selectExpressions
            .filter(expr => !SoqlModelUtils.containsUnmodeledSyntax(expr))
            .map(expr => ((expr as unknown) as Soql.FieldRef).fieldName)
        : undefined;
    // eslint-disable-next-line prettier/prettier
    const sObject = queryModel.from?.sobjectName;
    const errors = queryModel.errors as unknown as JsonMap[];
    const unsupported = [];
    for (const key in queryModel) {
      if (queryModel.hasOwnProperty(key)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const prop = queryModel[key];
        if (typeof prop === 'object') {
          if (SoqlModelUtils.containsUnmodeledSyntax(prop)) {
            unsupported.push(prop.unmodeledSyntax);
          }
        }
      }
    }

    const toolingModelTemplate: ToolingModelJson = {
      sObject: sObject || '',
      fields: fields || [],
      errors: errors || [],
      unsupported: unsupported || []
    };

    return toolingModelTemplate;
  }

  public static convertUiModelToSoql(uiModel: ToolingModelJson): string {
    const soqlModel = SoqlUtils.convertUiModelToSoqlModel(uiModel);
    const soql = SoqlUtils.convertSoqlModelToSoql(soqlModel);
    return soql;
  }

  protected static convertUiModelToSoqlModel(
    uiModel: ToolingModelJson
  ): Soql.Query {
    const selectExprs = uiModel.fields.map(
      field => new Impl.FieldRefImpl(field)
    );
    const queryModel = new Impl.QueryImpl(
      new Impl.SelectExprsImpl(selectExprs),
      new Impl.FromImpl(uiModel.sObject)
    );
    return queryModel;
  }

  protected static convertSoqlModelToSoql(soqlModel: Soql.Query): string {
    const serializer = new ModelSerializer(soqlModel);
    const query = serializer.serialize();
    return query;
  }
}
