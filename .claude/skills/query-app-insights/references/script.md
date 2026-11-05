# Query Script Implementation

Location: `scripts/queryAppInsights.ts`

## Usage

```bash
tsx scripts/queryAppInsights.ts "<kql-query>"
```

## Implementation

```typescript
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

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = (await response.json()) as AppInsightsQueryResponse;
        errorMsg =
          errorData.error?.message || errorData.error?.innererror?.message || errorMsg;
      } catch {
        // If response body is not JSON, use the status text
      }
      return {
        success: false,
        error: errorMsg
      };
    }

    const data = (await response.json()) as AppInsightsQueryResponse;

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

export { queryAppInsights, testConnection, validateEnvVars };
export type { QueryResult, AppInsightsQueryResponse };
```

## Exports

- `queryAppInsights(kqlQuery: string)` - Execute KQL query
- `testConnection()` - Test API connectivity
- `validateEnvVars()` - Check env vars
- Types: `QueryResult`, `AppInsightsQueryResponse`