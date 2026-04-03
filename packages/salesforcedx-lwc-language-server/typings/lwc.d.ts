// CJS compatibility shims for @lwc/* v9.x ESM packages.
// These packages ship "type": "module" but include index.cjs for runtime compatibility.
// These declarations allow TypeScript (module: node16) to resolve their types.

declare module '@lwc/errors' {
    export const DiagnosticLevel: {
        readonly Fatal: 0;
        readonly Error: 1;
        readonly Warning: 2;
        readonly Log: 3;
    };
    export type DiagnosticLevel = (typeof DiagnosticLevel)[keyof typeof DiagnosticLevel];

    export interface LWCErrorInfo {
        code: number;
        message: string;
        level: DiagnosticLevel;
        url?: string;
        strictLevel?: DiagnosticLevel;
    }

    export interface Location {
        line: number;
        column: number;
        start?: number;
        length?: number;
    }

    export interface CompilerDiagnostic {
        message: string;
        code: number;
        filename?: string;
        location?: Location;
        level: DiagnosticLevel;
        url?: string;
    }

    export class CompilerError extends Error implements CompilerDiagnostic {
        code: number;
        filename?: string;
        location?: Location;
        level: DiagnosticLevel;
        url?: string;
    }

    export class CompilerAggregateError extends Error {
        errors: CompilerError[];
    }
}

declare module '@lwc/template-compiler' {
    import type { CompilerDiagnostic } from '@lwc/errors';

    export interface TemplateParseResult {
        root?: any;
        warnings: CompilerDiagnostic[];
    }
    export interface TemplateCompileResult extends TemplateParseResult {
        code: string;
        cssScopeTokens: string[];
    }
    export interface Config {
        [key: string]: any;
    }
    export default function compile(source: string, filename: string, config: Config): TemplateCompileResult;
}

declare module '@lwc/compiler' {
    export interface TransformOptions {
        name: string;
        namespace: string;
        [key: string]: any;
    }
    export interface TransformResult {
        code: string;
        map: any;
    }
    export function transformSync(source: string, filename: string, options: TransformOptions): TransformResult;
    export function transform(source: string, filename: string, options: TransformOptions): Promise<TransformResult>;
    export const version: string;
}
