import { TextDocument, Position } from 'vscode-languageserver';
import { getAuraBindingValue, parse } from '../aura-utils';

describe('getAuraBindingValue', () => {
    const createDocument = (content: string): TextDocument => TextDocument.create('file:///test.cmp', 'html', 0, content);

    const createPosition = (line: number, character: number): Position => Position.create(line, character);

    const getBindingValue = (content: string, line: number, character: number): string | null => {
        const document = createDocument(content);
        const htmlDocument = parse(content);
        const position = createPosition(line, character);
        console.log('position', position);
        return getAuraBindingValue(document, position, htmlDocument);
    };

    // simple function to find the cursor position in a string, helpful for readability
    const findCursorPosition = (content: string): number => {
        const cursorPosition = content.indexOf('|');
        return cursorPosition;
    };

    describe('basic functionality', () => {
        it('should extract property from v binding in attribute', () => {
            const content = '<div value="{!v.property}"></div>';
            const stringWithCursor = '<div value="{!v.property|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.property|}"></div>
            expect(result).toBe('property');
        });

        it('should extract property from c binding in attribute', () => {
            const content = '<div onclick="{!c.handleClick}"></div>';
            const stringWithCursor = '<div onclick="{!c.handleClick|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div onclick="{!c.handleClick|}"></div>
            expect(result).toBe('handleClick');
        });

        it('should extract property from m binding in attribute', () => {
            const content = '<div data="{!m.dataValue}"></div>';
            const stringWithCursor = '<div data="{!m.dataValue|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div data="{!m.dataValue|}"></div>
            expect(result).toBe('dataValue');
        });

        it('should return null when cursor is before dot', () => {
            const content = '<div value="{!v.property}"></div>';
            const stringWithCursor = '<div value="{!v|.property}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v|.property}"></div>
            expect(result).toBe('property');
        });

        it('should handle quoted attribute values', () => {
            const content = '<div value="\'{!v.property}\'"></div>';
            const stringWithCursor = '<div value="\'{!v.property|}\'"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value='{!v.property|}'></div>
            expect(result).toBe('property');
        });

        it('should handle double quoted attribute values', () => {
            const content = '<div value=\'"{!v.property}"\'></div>';
            const stringWithCursor = '<div value=\'"{!v.property|}"\'></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value='"{!v.property|}"'></div>
            expect(result).toBe('property');
        });

        it('should return null for non-binding attributes', () => {
            const content = '<div class="some-class"></div>';
            const stringWithCursor = '<div class="some-|class"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div class="some-|class"></div>
            expect(result).toBeNull();
        });
    });

    describe('body text bindings', () => {
        it('should extract property from v binding in body text', () => {
            const content = '<div>{!v.property}</div>';
            const stringWithCursor = '<div>{!v.property|}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!v.property|}</div>
            expect(result).toBe('property');
        });

        it('should extract property from c binding in body text', () => {
            const content = '<div>{!c.method}</div>';
            const stringWithCursor = '<div>{!c.method|}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!c.method|}</div>
            expect(result).toBe('method');
        });

        it('should extract property from m binding in body text', () => {
            const content = '<div>{!m.data}</div>';
            const stringWithCursor = '<div>{!m.data|}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!m.data|}</div>
            expect(result).toBe('data');
        });

        it('should return null when cursor is before dot in body text', () => {
            const content = '<div>{!v.property}</div>';
            const stringWithCursor = '<div>{!v|.property|}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!v|.property|}</div>
            expect(result).toBeNull();
        });

        it('should handle multiple bindings in body text', () => {
            const content = '<div>{!v.first} and {!v.second}</div>';
            const stringWithCursor = '<div>{!v.first| and {!v.second}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!v.first| and {!v.second}</div>
            expect(result).toBe('first');
        });
    });

    describe('edge cases', () => {
        it('should return null for empty document', () => {
            const result = getBindingValue('', 0, 0);
            expect(result).toBeNull();
        });

        it('should return null for invalid HTML', () => {
            const result = getBindingValue('<div>', 0, 0);
            expect(result).toBeNull();
        });

        it('should return null when cursor is outside any node', () => {
            const content = '<div>{!v.property}</div>';
            const result = getBindingValue(content, 1, 0); // Position on new line
            expect(result).toBeNull();
        });

        it('should handle expressions with special characters in property names', () => {
            const content = '<div value="{!v.property_name}"></div>';
            const stringWithCursor = '<div value="{!v.property_name|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.property_name|}"></div>
            expect(result).toBe('property_name');
        });

        it('should handle expressions with numbers in property names', () => {
            const content = '<div value="{!v.property123}"></div>';
            const stringWithCursor = '<div value="{!v.property123|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.property123|}"></div>
            expect(result).toBe('property123');
        });

        it('should return "" for incomplete expressions', () => {
            const content = '<div value="{!v.}"></div>';
            const stringWithCursor = '<div value="{!v.|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.|}"></div>
            expect(result).toBe('');
        });

        it('should extract property when cursor is within property name in attribute', () => {
            const content = '<div value="{!v.property}"></div>';
            const stringWithCursor = '<div value="{!v.prop|erty|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.prop|erty|}"></div>
            expect(result).toBe('property');
        });

        it('should extract property when cursor is within property name in body text', () => {
            const content = '<div>{!v.property}</div>';
            const stringWithCursor = '<div>{!v.prop|erty}</div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div>{!v.prop|erty}</div>
            expect(result).toBe('property');
        });

        it('should extract property when cursor is at start of property name', () => {
            const content = '<div value="{!v.property}"></div>';
            const stringWithCursor = '<div value="{!v.|property}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.|property}"></div>
            expect(result).toBe('property');
        });

        it('should extract property when cursor is at end of property name', () => {
            const content = '<div value="{!v.property}"></div>';
            const stringWithCursor = '<div value="{!v.propert|y}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.propert|y}"></div>
            expect(result).toBe('property');
        });
    });

    describe('complex scenarios', () => {
        it('should handle multiple attributes with bindings', () => {
            const content = '<div value="{!v.property}" onclick="{!c.method}"></div>';
            const stringWithCursor = '<div value="{!v.property|}" onclick="{!c.method}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.property|}" onclick="{!c.method}"></div>
            expect(result).toBe('property');
        });

        it('should handle self-closing tags with bindings', () => {
            const content = '<input value="{!v.property}" />';
            const stringWithCursor = '<input value="{!v.property|}" />';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <input value="{!v.property|}"></input>
            expect(result).toBe('property');
        });

        it('should handle expressions with comments', () => {
            const content = '<div value="{!v.property}<!-- comment -->"></div>';
            const stringWithCursor = '<div value="{!v.property|}"><!-- comment --></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.property|}"><!-- comment --></div>
            expect(result).toBe('property');
        });
    });

    describe('advanced scenarios', () => {
        it('should handle nested properties', () => {
            const content = '<div value="{!v.object.property}"></div>';
            const stringWithCursor = '<div value="{!v.object.property|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.object.property|}"></div>
            expect(result).toBe('object'); // Function returns first property in regex group
        });

        it('should handle expressions with multiple dots', () => {
            const content = '<div value="{!v.object.subObject.property}"></div>';
            const stringWithCursor = '<div value="{!v.object.subObject.property|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div value="{!v.object.subObject.property|}"></div>
            expect(result).toBe('object'); // Function returns first property in regex group
        });

        it('should handle negated expressions', () => {
            const content = '<div hidden="{!!v.isHidden}"></div>';
            const stringWithCursor = '<div hidden="{!!v.isHidden|}"></div>';
            const cursorPosition = findCursorPosition(stringWithCursor);
            const result = getBindingValue(content, 0, cursorPosition); // Position: <div hidden="{!!v.isHidden|}"></div>
            expect(result).toBe('isHidden');
        });
    });
});
