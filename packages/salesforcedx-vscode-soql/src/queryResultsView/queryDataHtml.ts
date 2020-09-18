import { Uri } from 'vscode';

export function html(styleUris: Uri[]): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link href="${styleUris[0]}" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SOQL Query</title>
  </head>
  <body>
  <div>
      <h3>Query Results</h3>
    <table>
      <tr>
        <th>Name</th>
        <th>ID</th>
      </tr>
      <tr>
        <td>BTC-upsert.csv</td>
        <td>0011U00000pB8WjQAK</td>
      </tr>
      <tr>
        <td>Tom</td>
        <td>0011U00000pB8WjQAK</td>
      </tr>
      <tr>
        <td>Tom</td>
        <td>0011U00000pB8V7QAK</td>
      </tr>
      <tr>
        <td>Jimmy</td>
        <td>0011U00000pBLPzQAO</td>
      </tr>
      <tr>
        <td>jim-bob</td>
        <td>0011U00000pBLQ0QAO</td>
      </tr>
      <tr>
        <td>GenePoint</td>
        <td>0011U00000pBLQ1QAO</td>
      </tr>
      <tr>
        <td>United Oil & Gas, UK</td>
        <td>0011U0000063FLLQA2</td>
      </tr>
    </table>
  </div>
  </body>
</html>
`;
}
