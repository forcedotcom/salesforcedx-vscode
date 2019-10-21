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
export type ItBlockWithAncestorTitles = ItBlock & { ancestorTitles?: string[] };
export type IExtendedParseResults = Pick<
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
  node.ancestorTitles = ancestorTitles;
  if (node.type === ParsedNodeTypes.it) {
    itBlocksWithAncestorTitles.push(node as ItBlockWithAncestorTitles);
  }
  if (
    node.type === ParsedNodeTypes.root ||
    node.type === ParsedNodeTypes.describe
  ) {
    if (!node.children) {
      return;
    }
    node.children.forEach(childNode => {
      populateAncestorTitlesRecursive(
        childNode,
        node.name ? [...ancestorTitles, node.name] : ancestorTitles,
        itBlocksWithAncestorTitles
      );
    });
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
