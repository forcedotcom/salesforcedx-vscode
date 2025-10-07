import { Range, TextDocument } from 'vscode-languageserver';
import { HTMLDocument, TokenType, getLanguageService } from 'vscode-html-languageservice';
import { join } from 'path';
import { createScanner } from 'vscode-html-languageservice/lib/umd/parser/htmlScanner';
import { Position, Location } from 'vscode-languageserver-types';

const AURA_STANDARD = 'aura-standard.json';
const AURA_SYSTEM = 'transformed-aura-system.json';

const RESOURCES_DIR = 'resources';

/**
 * Regex pattern to match Aura expression syntax in HTML templates.
 *
 * This pattern identifies Aura expressions that follow the format:
 * - {!v.property} - View/Component properties
 * - {!m.data} - Model data
 * - {!c.method} - Controller methods/properties
 * - {!#v.booleanValue} - Boolean expressions
 * - {!!v.negatedValue} - Negated expressions
 *
 * Pattern breakdown:
 * - ['"]? - Optional quotes at start/end
 * - \s* - Optional whitespace
 * - { - Opening brace
 * - [!#] - Either ! or # (expression operators)
 * - \s* - Optional whitespace
 * - [!]? - Optional ! (negation)
 * - [vmc] - One of v, m, or c (expression types)
 * - \. - Literal dot
 * - (\w*) - One or more word characters (first part)
 * - (\.?\w*)* - Zero or more optional dots + word characters
 * - \s* - Optional whitespace
 * - } - Closing brace
 *
 * Examples matched:
 * - {!v.account.Name}
 * - {!m.data.value}
 * - {!c.controllerMethod}
 * - {!#v.booleanValue}
 * - {!!v.negatedValue}
 * - "{!v.property}"
 * - '{!v.property}'
 */
const AURA_EXPRESSION_REGEX = /['"]?\s*{[!#]\s*[!]?[vmc]\.(\w*)(\.?\w*)*\s*}\s*['"]?/;

export const getAuraStandardResourcePath = (): string => join(__dirname, RESOURCES_DIR, AURA_STANDARD);

export const getAuraSystemResourcePath = (): string => join(__dirname, RESOURCES_DIR, AURA_SYSTEM);

// Create a parse function that works with the new API
export const parse = (input: string): HTMLDocument => {
    const languageService = getLanguageService();
    const mockDocument = TextDocument.create('file:///mock.html', 'html', 0, input);
    return languageService.parseHTMLDocument(mockDocument);
};

const stripQuotes = (str: string | null): string | null => {
    if (!str) {
        return str;
    }
    if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
        return str.substring(1, str.length - 1);
    }
    if (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'") {
        return str.substring(1, str.length - 1);
    }
    return str;
};

const hasQuotes = (str: string): boolean => (str.at(0) === '"' && str.at(-1) === '"') || (str.at(0) === "'" && str.at(-1) === "'");

const getTagNameRange = (document: TextDocument, offset: number, tokenType: TokenType, startOffset: number): Range | null => {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (token !== TokenType.EOS && (scanner.getTokenEnd() < offset || (scanner.getTokenEnd() === offset && token !== tokenType))) {
        token = scanner.scan();
    }
    if (token === tokenType && offset <= scanner.getTokenEnd()) {
        return { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
    }
    return null;
};

const getAttributeRange = (document: TextDocument, attributeName: string, startOffset: number, endOffset: number): Range | null => {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (token !== TokenType.EOS && scanner.getTokenEnd() < endOffset) {
        if (token === TokenType.AttributeName) {
            const curAttributeName = document.getText({
                start: document.positionAt(scanner.getTokenOffset()),
                end: document.positionAt(scanner.getTokenEnd()),
            });
            if (curAttributeName === attributeName) {
                let token = scanner.scan();
                while (token !== TokenType.EOS) {
                    if (token === TokenType.AttributeValue) {
                        const range = { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
                        const value = document.getText(range);
                        if (hasQuotes(value)) {
                            range.start.character = range.start.character + 1;
                            range.end.character = range.end.character - 1;
                        }
                        return range;
                    }
                    token = scanner.scan();
                }
            }
        }
        token = scanner.scan();
        if (token === TokenType.StartTagClose || token === TokenType.StartTagSelfClose) {
            break;
        }
    }
    return null;
};

const findAuraDeclaration = (document: TextDocument, attributeValue: string, htmlDocument: HTMLDocument): Location | null => {
    for (const root of htmlDocument.roots) {
        const attributes = root.children.filter((n) => n.tag === 'aura:attribute');
        for (const attribute of attributes) {
            const attrs = attribute.attributes || {};
            if (stripQuotes(attrs.name) === attributeValue) {
                const range = getAttributeRange(document, 'name', attribute.start, attribute.end);
                if (range) {
                    return {
                        uri: document.uri,
                        range,
                    };
                }
            }
        }
    }
    return null;
};

/**
 * Looks for property bindings {PROPERTY.something} within attribute values, or body content, and returns a location
 * within the same template that corresponds to iterator:PROPERTY or for:item="PROPERTY".
 */
export const getAuraBindingTemplateDeclaration = (document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null => {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    const propertyValue = getAuraBindingValue(document, position, htmlDocument);
    if (propertyValue) {
        return findAuraDeclaration(document, propertyValue, htmlDocument);
    }
    return null;
};

/**
 * Extracts the Aura binding value at the given position in an HTML document.
 *
 * This function looks for Aura expressions like {!v.property} or {!c.method}
 * and returns the property/method name if the cursor is positioned within it.
 * Examples:
 * - Attribute: "<div value="{!v.account|.Name}"></div>" → returns "account"
 * - Attribute: "<div value="{!v.account.Name|}"></div>" → returns "account" (cursor within property)
 * - Attribute: "<div value="{!v.account.Name}"></div>" → returns "account" (first property only)
 * - Attribute: "<div value="{!v.property}"></div>" → returns "property"
 * - Attribute: "<div value="{!v.pr|operty}"></div>" → returns "property" (cursor within property)
 * - Attribute: "<div value="{!v|.property}"></div>" → returns null
 * - Content: "Hello {!v.account|.Name} world" → returns "account"
 * - Content: "Hello {!v.accou|nt.Name} world" → returns "account" (cursor within property)
 * - Content: "Hello {!v.account.Name|} world" → returns "account" (first property only)
 * - Content: "Hello {!v.property|} world" → returns "property"
 * - Content: "Hello {!v.pr|operty} world" → returns "property" (cursor within property)
 * - Content: "Hello {!v|.property} world" → returns null
 *
 * @param document - The text document containing the Aura markup
 * @param position - The cursor position to check
 * @param htmlDocument - The parsed HTML document
 * @returns The property/method name from the Aura expression, or null if not found
 */
export const getAuraBindingValue = (document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null => {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);

    // Early return if we're not in a valid HTML tag
    if (!node?.tag) {
        return null;
    }

    // First, check if we're inside an attribute value
    const attributeValue = extractAuraExpressionFromAttribute(document, offset, node);
    if (attributeValue !== null) {
        return attributeValue;
    }

    // If not in an attribute, check if we're in the body text content
    return extractAuraExpressionFromContent(document, offset, node);
};

/**
 * Extracts Aura expression from HTML attribute values.
 *
 * This function extracts the property name from an Aura expression in an attribute value.
 * It handles both simple properties and nested properties with multiple dots.
 *
 * Examples:
 * - Attribute: "<div value="{!v.account|.Name}"></div>" → returns "account"
 * - Attribute: "<div value="{!v.account.Name|}"></div>" → returns "account" (cursor within property)
 * - Attribute: "<div value="{!v.account.Name}"></div>" → returns "account" (first property only)
 * - Attribute: "<div value="{!v.property}"></div>" → returns "property"
 * - Attribute: "<div value="{!v.pr|operty}"></div>" → returns "property" (cursor within property)
 * - Attribute: "<div value="{!v|.property}"></div>" → returns null
 *
 * @param document - The text document
 * @param offset - The cursor offset
 * @param node - The HTML node to check
 * @returns The property name from the Aura expression, or null if not found
 */
const extractAuraExpressionFromAttribute = (document: TextDocument, offset: number, node: any): string | null => {
    const attributeRange = getTagNameRange(document, offset, TokenType.AttributeValue, node.start);
    if (!attributeRange) {
        return null;
    }

    const attributeValue = document.getText(attributeRange);
    const valueRelativeOffset = offset - document.offsetAt(attributeRange.start);

    // Check if cursor is positioned after the first dot in the expression
    // This ensures we're in the property part, not the expression type (v, m, c)
    const firstDotIndex = attributeValue.indexOf('.');
    if (firstDotIndex !== -1 && valueRelativeOffset < firstDotIndex) {
        return null;
    }

    // Extract the property name from the Aura expression
    const expressionMatch = AURA_EXPRESSION_REGEX.exec(attributeValue.trim());
    return expressionMatch?.[1] ?? null;
};

/**
 * Extracts Aura expression from HTML body text content.
 *
 * This function extracts the property name from an Aura expression in the body text content.
 * It handles both simple properties and nested properties with multiple dots.
 *
 * Examples:
 * - Content: "Hello {!v.account|.Name} world" → returns "account"
 * - Content: "Hello {!v.accou|nt.Name} world" → returns "account" (cursor within property)
 * - Content: "Hello {!v.account.Name|} world" → returns "account" (first property only)
 * - Content: "Hello {!v.property|} world" → returns "property"
 * - Content: "Hello {!v.pr|operty} world" → returns "property" (cursor within property)
 * - Content: "Hello {!v|.property} world" → returns null
 *
 * @param document - The text document
 * @param offset - The cursor offset
 * @param node - The HTML node to check
 * @returns The property name from the Aura expression, or null if not found
 */
const extractAuraExpressionFromContent = (document: TextDocument, offset: number, node: any): string | null => {
    const scanner = createScanner(document.getText(), node.start);
    let token = scanner.scan();

    while (token !== TokenType.EOS && scanner.getTokenEnd() <= node.end) {
        if (token === TokenType.Content) {
            const contentRange = {
                start: document.positionAt(scanner.getTokenOffset()),
                end: document.positionAt(scanner.getTokenEnd()),
            };

            const content = document.getText(contentRange);
            const relativeOffset = offset - scanner.getTokenOffset();

            const expressionMatch = AURA_EXPRESSION_REGEX.exec(content);
            if (!expressionMatch) {
                token = scanner.scan();
                continue;
            }

            // Check if cursor is within the matched Aura expression
            const expressionStart = expressionMatch.index;
            // expressionMatch[0] is the full expression, so we need to subtract 1 to account for the closing brace
            const expressionEnd = expressionMatch.index + expressionMatch[0].length - 1;

            if (relativeOffset < expressionStart || relativeOffset > expressionEnd) {
                token = scanner.scan();
                continue;
            }

            // Extract property name based on cursor position relative to dots
            return extractPropertyNameFromExpression(content, relativeOffset, expressionStart, expressionEnd);
        }
        token = scanner.scan();
    }

    return null;
};

/**
 * Extracts the property name from an Aura expression based on cursor position.
 *
 * This function determines which property name to return based on where the cursor
 * is positioned within the Aura expression. It handles both simple properties and
 * nested properties with multiple dots.
 *
 * Examples:
 * - Content: "Hello {!v.account|.Name} world" → returns "account"
 * - Content: "Hello {!v.accou|nt.Name} world" → returns "account" (cursor within property)
 * - Content: "Hello {!v.account.Name|} world" → returns "account" (first property only)
 * - Content: "Hello {!v.property|} world" → returns "property"
 * - Content: "Hello {!v.pr|operty} world" → returns "property" (cursor within property)
 * - Content: "Hello {!v|.property} world" → returns null
 *
 * @param content - The text content containing the expression
 * @param relativeOffset - The cursor offset relative to the content start
 * @param expressionStart - The start index of the Aura expression
 * @param expressionEnd - The end index of the Aura expression
 * @returns The property name, or null if cursor is not in a valid position
 */
const extractPropertyNameFromExpression = (content: string, relativeOffset: number, expressionStart: number, expressionEnd: number): string | null => {
    const firstDotIndex = content.indexOf('.', expressionStart);

    // If no dot found, return null
    if (firstDotIndex === -1) {
        return null;
    }

    const secondDotIndex = content.indexOf('.', firstDotIndex + 1);

    // Check if cursor is positioned after the first dot
    if (relativeOffset > firstDotIndex) {
        // If there's a second dot, cursor must be between first and second dot
        if (secondDotIndex !== -1 && secondDotIndex <= expressionEnd) {
            if (relativeOffset < secondDotIndex) {
                // Extract just the first property name (before the second dot)
                const propertyStart = firstDotIndex + 1;
                return content.substring(propertyStart, secondDotIndex);
            }
        } else {
            // No second dot, cursor is after first dot - extract everything after first dot
            // but stop at the closing brace
            const propertyStart = firstDotIndex + 1;
            const closingBraceIndex = content.indexOf('}', propertyStart);
            const propertyEnd = closingBraceIndex !== -1 ? closingBraceIndex : expressionEnd;
            return content.substring(propertyStart, propertyEnd);
        }
    }

    return null;
};
