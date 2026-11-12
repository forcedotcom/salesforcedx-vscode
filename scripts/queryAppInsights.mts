/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Option, Schema } from 'effect';
import process from 'node:process';

const AppInsightsErrorSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  innererror: Schema.optional(Schema.Struct({ code: Schema.String, message: Schema.String }))
});
const AppInsightsErrorResponseSchema = Schema.Struct({ error: AppInsightsErrorSchema });
const AppInsightsQueryResponseSchema = Schema.Struct({
  tables: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      columns: Schema.Array(Schema.Struct({ name: Schema.String, type: Schema.String })),
      rows: Schema.Array(Schema.Array(Schema.Unknown))
    })
  ),
  error: Schema.optional(AppInsightsErrorSchema)
});

type AppInsightsQueryResponse = Schema.Schema.Type<typeof AppInsightsQueryResponseSchema>;

type QueryResult = {
  success: boolean;
  data?: AppInsightsQueryResponse;
  error?: string;
};

const firstErrorMessage = (...messages: readonly (string | undefined)[]) =>
  messages.find(message => message !== undefined && message.length > 0);

const validateEnvVars = (): { apiKey: string; clientId: string } | undefined => {
  const apiKey = process.env.APP_INSIGHTS_API_KEY;
  const clientId = process.env.APP_INSIGHTS_CLIENT_ID;

  if (!apiKey || !clientId) {
    return undefined;
  }

  return { apiKey, clientId };
};

const queryAppInsights = async (kqlQuery: string): Promise<QueryResult> => {
  const credentials = validateEnvVars();
  if (!credentials) {
    return {
      success: false,
      error: 'Missing required environment variables: APP_INSIGHTS_API_KEY and/or APP_INSIGHTS_CLIENT_ID'
    };
  }

  const { apiKey, clientId } = credentials;
  const url = `https://api.applicationinsights.io/v1/apps/${clientId}/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: kqlQuery })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = Schema.decodeUnknownOption(AppInsightsErrorResponseSchema)(await response.json());
        errorMsg = Option.match(errorData, {
          onNone: () => errorMsg,
          onSome: ({ error }) => firstErrorMessage(error.message, error.innererror?.message) ?? errorMsg
        });
      } catch {
        // If response body is not JSON, use the status text
      }
      return {
        success: false,
        error: errorMsg
      };
    }

    const data = Schema.decodeUnknownSync(AppInsightsQueryResponseSchema)(await response.json());

    if (data.error) {
      return {
        success: false,
        error: firstErrorMessage(data.error.message, data.error.innererror?.message) ?? 'Unknown query error'
      };
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const testConnection = async (): Promise<QueryResult> => queryAppInsights('customEvents | take 1');

if (import.meta.main) {
  const args = process.argv.slice(2);
  const query = args.join(' ');

  if (!query) {
    console.error('Usage: node scripts/queryAppInsights.mts <kql-query>');
    console.error('Example: node scripts/queryAppInsights.mts "customEvents | take 5"');
    process.exit(1);
  }

  queryAppInsights(query)
    .then(result => {
      if (result.success && result.data) {
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.error('Error:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { queryAppInsights, testConnection, validateEnvVars };
export type { QueryResult, AppInsightsQueryResponse };
