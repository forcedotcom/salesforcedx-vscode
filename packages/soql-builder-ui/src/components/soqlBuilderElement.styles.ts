/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { css } from 'lit';

export const soqlBuilderElementStyles = css`
  :host {
    display: block;
    max-width: 960px;
  }

  * {
    box-sizing: border-box;
  }

  .content {
    display: grid;
    gap: 24px;
    grid-template-columns: minmax(360px, 1fr) minmax(300px, 1fr);
  }

  .form {
    display: grid;
    gap: 16px;
  }

  .control {
    display: grid;
    gap: 6px;
    grid-template-columns: 72px minmax(0, 1fr);
  }

  label,
  .preview-title {
    font-weight: 600;
    padding-top: 4px;
  }

  vscode-single-select,
  vscode-multi-select {
    width: 100%;
  }

  .preview {
    min-width: 0;
  }

  pre {
    background: var(--vscode-textCodeBlock-background, rgba(10, 10, 10, 0.4));
    border: 1px solid var(--vscode-widget-border, transparent);
    color: var(--vscode-editor-foreground, inherit);
    font-family: var(--vscode-editor-font-family, monospace);
    margin: 6px 0 0;
    min-height: 76px;
    overflow: auto;
    padding: 12px;
    white-space: pre-wrap;
  }

  .warning {
    background: var(--vscode-inputValidation-warningBackground, #352a05);
    border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    color: var(--vscode-inputValidation-warningForeground, inherit);
    padding: 10px;
  }

  @media (max-width: 750px) {
    .content {
      grid-template-columns: 1fr;
    }
  }
`;
