declare module 'properties';
declare module 'line-column';

// Augment tern types
declare module 'acorn' {
  interface ObjectExpression {
    objType?: any;
  }
  interface Property {
    value: any;
  }
}
