import * as vscode from 'vscode';
import { nls } from '../../messages';

export class MaxLengthValidator {
  private maxLength: number;

  constructor(maxLength: number) {
    this.maxLength = maxLength;
  }

  public validate(text: string): string | null {
    return text.length > this.maxLength
      ? nls
          .localize('input_validation_max_length_error_message')
          .replace('{0}', this.maxLength.toString())
      : null;
  }
}
