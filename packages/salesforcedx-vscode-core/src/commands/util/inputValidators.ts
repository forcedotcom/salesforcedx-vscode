import * as vscode from 'vscode';

export class MaxLengthValidator {
  private maxLength: number;

  constructor(maxLength: number) {
    this.maxLength = maxLength;
  }

  public validate(text: string): string | null {
    return text.length > this.maxLength
      ? `Input can not exceed ${this.maxLength} characters`
      : null;
  }
}
