/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type * as Stream from 'effect/Stream';

export class FileOutputError extends Schema.TaggedError<FileOutputError>()('FileOutputError', {
  operation: Schema.String,
  path: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/** File operations needed by Apex result writers. Hosts provide the implementation for their filesystem. */
export class FileOutput extends Context.Tag('Apex.FileOutput')<
  FileOutput,
  {
    createDirectory: (path: string) => Effect.Effect<void, FileOutputError>;
    writeFile: (
      directory: string,
      fileName: string,
      content: Stream.Stream<string, never, never>
    ) => Effect.Effect<string, FileOutputError>;
  }
>() {}
