/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DiagnosticLevel } from '@lwc/errors';
import templateCompiler from '@lwc/template-compiler';
import path from 'node:path';
import { Diagnostic, DiagnosticSeverity, Range, TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DIAGNOSTIC_SOURCE } from '../constants';

const LEVEL_MAPPING: Map<DiagnosticLevel, DiagnosticSeverity> = new Map([
    [DiagnosticLevel.Log, DiagnosticSeverity.Information],
    [DiagnosticLevel.Warning, DiagnosticSeverity.Warning],
    [DiagnosticLevel.Error, DiagnosticSeverity.Error],
    [DiagnosticLevel.Fatal, DiagnosticSeverity.Error],
]);

const TYPOS = ['<lighting-', '<lightening-', '<lihgtning-'];

const toRange = (textDocument: TextDocument, start: number, length: number): Range =>
    Range.create(textDocument.positionAt(start), textDocument.positionAt(start + length));

const lintTypos = (document: TextDocument): Diagnostic[] => {
    const source = document.getText();
    const lines = source.split(/\r?\n/g);

    const errors: Diagnostic[] = [];

    lines.forEach((line, idx) => {
        TYPOS.forEach((typo) => {
            const idxTypo = line.indexOf(typo);
            if (idxTypo > -1) {
                errors.push({
                    range: {
                        start: { line: idx, character: idxTypo },
                        end: { line: idx, character: idxTypo + typo.length },
                    },
                    message: `${typo} is not a valid namespace, sure you didn't mean "<lightning-"?`,
                    severity: LEVEL_MAPPING.get(DiagnosticLevel.Error),
                    source: DIAGNOSTIC_SOURCE,
                });
            }
        });
    });

    return errors;
};

export default function lintLwcMarkup(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const file = URI.file(document.uri).fsPath;
    const filePath = path.parse(file);
    const fileName = filePath.base;
    const { warnings } = templateCompiler(source, fileName, {});

    let warningsLwc: Diagnostic[] = warnings.map((warning) => {
        const { start = 0, length = 0 } = warning.location || { start: 0, length: 0 };

        return {
            range: toRange(document, start, length),
            message: warning.message,
            severity: LEVEL_MAPPING.get(warning.level),
            source: DIAGNOSTIC_SOURCE,
        };
    });

    const warningsTypos: Diagnostic[] = lintTypos(document);
    warningsLwc = warningsLwc.concat(warningsTypos);
    return warningsLwc;
}
