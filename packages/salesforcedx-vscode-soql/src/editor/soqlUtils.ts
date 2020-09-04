import { ModelDeserializer, ModelSerializer } from '@salesforce/soql-model';
import { Impl, Soql, SoqlModelUtils } from '@salesforce/soql-model/lib';
import { JsonMap } from '@salesforce/ts-types';

export interface ToolingModelJson extends JsonMap {
  sObject: string;
  fields: string[];
}

export function convertSoqlToUiModel(soql: string): ToolingModelJson {
  console.log('converting soql to ui model');
  const queryModel = new ModelDeserializer(soql).deserialize();
  const uimodel = convertSoqlModelToUiModel(queryModel);
  console.log('uimodel: ', JSON.stringify(uimodel));
  return uimodel;
}

function convertSoqlModelToUiModel(
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

export function convertUiModelToSoql(uiModel: ToolingModelJson): string {
  console.log('converting ui model to soql');
  console.log('uiModel: ', uiModel);
  const soqlModel = convertUiModelToSoqlModel(uiModel);
  console.log('soqlModel: ', soqlModel);
  const soql = convertSoqlModelToSoql(soqlModel);
  console.log('soql', soql);
  return soql;
}

function convertUiModelToSoqlModel(uiModel: ToolingModelJson): Soql.Query {
  const selectExprs = uiModel.fields.map(field => new Impl.FieldRefImpl(field));
  const queryModel = new Impl.QueryImpl(
    new Impl.SelectExprsImpl(selectExprs),
    new Impl.FromImpl(uiModel.sObject)
  );
  return queryModel;
}

function convertSoqlModelToSoql(soqlModel: Soql.Query): string {
  const serializer = new ModelSerializer(soqlModel);
  const query = serializer.serialize();
  return query;
}
