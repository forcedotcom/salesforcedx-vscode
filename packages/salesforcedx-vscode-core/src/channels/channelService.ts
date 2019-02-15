/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { channelService } from '.';

export const DEFAULT_SFDX_CHANNEL = vscode.window.createOutputChannel(
  nls.localize('channel_name')
);

const COLUMN_SEPARATOR = '  ';
const COLUMN_FILLER = ' ';
const HEADER_FILLER = '─';

export interface TableRow {
  [column: string]: string;
}

export interface TableColumn {
  key: string;
  label: string;
}

export class ChannelService {
  private readonly channel: vscode.OutputChannel;
  private static instance: ChannelService;

  public constructor(channel?: vscode.OutputChannel) {
    this.channel = channel || DEFAULT_SFDX_CHANNEL;
  }

  public static getInstance(channel?: vscode.OutputChannel) {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService(channel);
    }
    return ChannelService.instance;
  }

  public streamCommandOutput(execution: CommandExecution) {
    this.streamCommandStartStop(execution);
    execution.stderrSubject.subscribe(data =>
      this.channel.append(data.toString())
    );
    execution.stdoutSubject.subscribe(data =>
      this.channel.append(data.toString())
    );
  }

  public streamCommandStartStop(execution: CommandExecution) {
    this.channel.append(nls.localize('channel_starting_message'));
    this.channel.appendLine(execution.command.toString());
    this.channel.appendLine('');

    this.channel.appendLine(
      this.getExecutionTime() + ' ' + execution.command.toCommand()
    );

    execution.processExitSubject.subscribe(data => {
      this.channel.append(
        this.getExecutionTime() + ' ' + execution.command.toCommand()
      );
      this.channel.append(' ');
      if (data !== undefined) {
        this.channel.appendLine(
          nls.localize('channel_end_with_exit_code', data.toString())
        );
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });

    execution.processErrorSubject.subscribe(data => {
      this.channel.append(
        this.getExecutionTime() + ' ' + execution.command.toCommand()
      );
      this.channel.append(' ');
      if (data !== undefined) {
        this.channel.appendLine(
          nls.localize('channel_end_with_error', data.message)
        );

        if (/sfdx.*ENOENT/.test(data.message)) {
          this.channel.appendLine(
            nls.localize('channel_end_with_sfdx_not_found')
          );
        }
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });
  }

  public outputTable(rows: TableRow[], cols: TableColumn[]) {
    const maxColWidths = new Map<string, number>();
    cols.forEach(col => {
      maxColWidths.set(col.key, 0);
      rows.forEach(row => {
        const maxColWidth = maxColWidths.get(col.key);
        const cell = row[col.key];
        if (maxColWidth !== undefined) {
          if (cell.length > maxColWidth) {
            maxColWidths.set(col.key, cell.length);
          }
        } else {
          // throw error
        }
      });
    });

    // TODO: Can improve loops
    let columnHeader = '';
    let headerSeparator = '';
    cols.forEach(col => {
      const width = maxColWidths.get(col.key);
      if (width) {
        columnHeader += fillColumn(col.label, width, COLUMN_FILLER) + COLUMN_SEPARATOR;
        headerSeparator += fillColumn('', width, HEADER_FILLER) + COLUMN_SEPARATOR;
      }
    });
    channelService.appendLine(columnHeader);
    channelService.appendLine(headerSeparator);

    rows.forEach(row => {
      let outputRow = '';
      cols.forEach(col => {
        const width = maxColWidths.get(col.key);
        if (width) {
          outputRow += fillColumn(row[col.key], width, COLUMN_FILLER) + COLUMN_SEPARATOR;
        }
      });
      channelService.appendLine(outputRow);
    });
  }

  private getExecutionTime() {
    const d = new Date();
    const hr = this.ensureDoubleDigits(d.getHours());
    const mins = this.ensureDoubleDigits(d.getMinutes());
    const sec = this.ensureDoubleDigits(d.getSeconds());
    const milli = d.getMilliseconds();
    return `${hr}:${mins}:${sec}.${milli}`;
  }

  private ensureDoubleDigits(num: number) {
    return num < 10 ? `0${num.toString()}` : num.toString();
  }

  public showChannelOutput() {
    this.channel.show();
  }

  public appendLine(text: string) {
    this.channel.appendLine(text);
  }
}

function fillColumn(label: string, width: number, filler: string): string {
  let filled = label;
  for (let i = 0; i < width - label.length; i++) {
    filled += filler;
  }
  return filled;
}
