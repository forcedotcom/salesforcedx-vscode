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
}

export class SoqlUtils {
  public static convertSoqlToUiModel(soql: string): ToolingModelJson {
    console.log('converting soql to ui model');
    const queryModel = new ModelDeserializer(soql).deserialize();
    const uimodel = SoqlUtils.convertSoqlModelToUiModel(queryModel);
    console.log('uimodel: ', JSON.stringify(uimodel));
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
    const sObject = queryModel.from ? queryModel.from.sobjectName : undefined;
    const errors = queryModel.errors;
    console.log(`Query:   ${queryModel}`);
    console.log(`SObject: ${sObject}`);
    console.log(`Fields:  ${fields}`);
    console.log(`Errors:  ${JSON.stringify(errors)}`);

    const toolingModelTemplate: ToolingModelJson = {
      sObject: sObject || '',
      fields: fields || []
    };

    return toolingModelTemplate;
  }

  public static convertUiModelToSoql(uiModel: ToolingModelJson): string {
    console.log('converting ui model to soql');
    console.log('uiModel: ', uiModel);
    const soqlModel = SoqlUtils.convertUiModelToSoqlModel(uiModel);
    console.log('soqlModel: ', soqlModel);
    const soql = SoqlUtils.convertSoqlModelToSoql(soqlModel);
    console.log('soql', soql);
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
