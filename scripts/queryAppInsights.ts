/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

type AppInsightsQueryResponse = {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string }>;
    rows: unknown[][];
  }>;
  error?: {
    code: string;
    message: string;
    innererror?: {
      code: string;
      message: string;
    };
  };
};

type QueryResult = {
  success: boolean;
  data?: AppInsightsQueryResponse;
  error?: string;
};

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

    const data = (await response.json()) as AppInsightsQueryResponse;

    if (!response.ok) {
      const errorMsg =
        data.error?.message || data.error?.innererror?.message || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMsg
      };
    }

    if (data.error) {
      return {
        success: false,
        error: data.error.message || data.error.innererror?.message || 'Unknown query error'
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

const testConnection = async (): Promise<QueryResult> => {
  return queryAppInsights('customEvents | take 1');
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const query = args.join(' ');

  if (!query) {
    console.error('Usage: tsx queryAppInsights.ts <kql-query>');
    console.error('Example: tsx queryAppInsights.ts "customEvents | take 5"');
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
