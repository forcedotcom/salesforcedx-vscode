export type SalesforceClient = object;

export type SalesforceClientConfig = {
  readonly instanceUrl: URL;
  readonly accessToken: string;
};

export type WhereClause =
  | { readonly soql: string }
  | { readonly and: ReadonlyArray<WhereClause> }
  | { readonly or: ReadonlyArray<WhereClause> }
  | { readonly not: WhereClause }
  | {
      readonly field: string;
      readonly op:
        | 'equals'
        | 'notEquals'
        | 'lessThan'
        | 'lessThanOrEqual'
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'like'
        | 'notLike';
      readonly value: unknown;
    }
  | {
      readonly field: string;
      readonly op: 'in' | 'notIn' | 'includes' | 'excludes';
      readonly value: ReadonlyArray<unknown>;
    }
  | { readonly field: string; readonly op: 'isNull' | 'isNotNull' };

export type Query = {
  readonly from: string;
  readonly fields: ReadonlyArray<string>;
  readonly where?: ReadonlyArray<WhereClause>;
  readonly orderBy?: ReadonlyArray<{
    readonly field: string;
    readonly direction: 'ascending' | 'descending';
    readonly nulls?: 'nullsFirst' | 'nullsLast';
  }>;
  readonly limit?: number;
  readonly offset?: number;
};

export type QueryOptions = {
  readonly client: SalesforceClient;
  readonly scanAll?: boolean;
  readonly tooling?: boolean;
} & ({ readonly soql: string } | Query);

type TaggedSdkError<Tag extends string> = Error & {
  readonly _tag: Tag;
  readonly message: string;
};

export type QueryError =
  | TaggedSdkError<'SessionExpired'>
  | TaggedSdkError<'TerminalAuthError'>
  | TaggedSdkError<'OrgUnreachable'>
  | TaggedSdkError<'MultipleChoices'>
  | (TaggedSdkError<'SalesforceApiError'> & {
      readonly statusCode: number;
      readonly errorCode: string;
    })
  | (TaggedSdkError<'SoqlError'> & {
      readonly statusCode: number;
      readonly errorCode: string;
      readonly soql: string;
    })
  | (TaggedSdkError<'FieldError'> & {
      readonly statusCode: number;
      readonly errorCode: string;
      readonly soql: string;
      readonly fields: ReadonlyArray<string>;
    })
  | TaggedSdkError<'SchemaError'>;

export const createSalesforceClient: (config: SalesforceClientConfig) => Promise<SalesforceClient>;

export const query: (
  options: QueryOptions,
  recordFieldPaths: ReadonlyArray<string>
) => Promise<{ readonly totalSize: number; readonly records: AsyncIterable<unknown> }>;

export const restRequest: (options: {
  readonly client: SalesforceClient;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
}) => Promise<unknown>;
