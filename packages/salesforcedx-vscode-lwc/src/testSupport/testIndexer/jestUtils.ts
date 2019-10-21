import {
  IParseResults,
  ItBlock,
  ParsedNode,
  ParsedNodeTypes
} from 'jest-editor-support';

type ParsedNodeWithAncestorTitles = Pick<
  ParsedNode,
  Exclude<keyof ParsedNode, 'children'>
> & {
  name?: string;
  ancestorTitles?: string[];
  children?: ParsedNodeWithAncestorTitles[];
};
type ItBlockWithAncestorTitles = ItBlock & { ancestorTitles?: string[] };
type IExtendedParseResults = Pick<
  IParseResults,
  Exclude<keyof IParseResults, 'root'>
> & {
  root: ParsedNodeWithAncestorTitles;
  itBlocksWithAncestorTitles?: ItBlockWithAncestorTitles[];
};

function populateAncestorTitlesRecursive(
  node: ParsedNodeWithAncestorTitles,
  ancestorTitles: string[],
  itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[]
) {
  if (!node.children) {
    return;
  }
  node.ancestorTitles = ancestorTitles;
  if (node.type === ParsedNodeTypes.it) {
    itBlocksWithAncestorTitles.push(node as ItBlockWithAncestorTitles);
  }
  if (
    node.type === ParsedNodeTypes.root ||
    node.type === ParsedNodeTypes.describe
  ) {
    if (node.name) {
      ancestorTitles.push(node.name);
    }
    node.children.forEach(childNode => {
      populateAncestorTitlesRecursive(
        childNode,
        ancestorTitles,
        itBlocksWithAncestorTitles
      );
    });
    if (node.name) {
      ancestorTitles.pop();
    }
  }
}

export function populateAncestorTitles(parsedResult: IExtendedParseResults) {
  try {
    const itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[] = [];
    populateAncestorTitlesRecursive(
      parsedResult.root,
      [],
      itBlocksWithAncestorTitles
    );
    parsedResult.itBlocksWithAncestorTitles = itBlocksWithAncestorTitles;
    return parsedResult;
  } catch (error) {
    console.error(error);
  }
}
