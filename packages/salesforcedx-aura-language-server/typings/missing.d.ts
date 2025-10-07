declare module 'properties';

// Augment tern types
declare module 'acorn' {
    interface ObjectExpression {
        objType?: any;
    }
    interface Property {
        value: any;
    }
}
