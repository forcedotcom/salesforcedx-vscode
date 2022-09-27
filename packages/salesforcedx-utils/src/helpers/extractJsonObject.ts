export function extractJsonObject(str: string): any {
  const jsonString = str.substring(str.indexOf('{'), str.lastIndexOf('}') + 1);

  return JSON.parse(jsonString);
}
