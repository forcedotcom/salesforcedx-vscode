/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Maps placeholders to types
type PlaceholderToType<S extends string> = S extends '%s'
  ? string
  : S extends '%d'
    ? number
    : S extends '%i'
      ? number
      : S extends '%f'
        ? number
        : S extends '%j'
          ? any
          : unknown;

// Recursively extracts argument types from a message string
type ExtractArgs<S extends string, Acc extends any[] = []> = S extends `${infer _}%${infer P}${infer Rest}`
  ? P extends 's' | 'd' | 'i' | 'f' | 'j'
    ? ExtractArgs<Rest, [...Acc, PlaceholderToType<`%${P}`>]>
    : ExtractArgs<Rest, Acc>
  : Acc;

// Given a message key, infers the argument types from the message template
export type MessageArgs<K extends keyof T, T extends Record<string, string>> = ExtractArgs<T[K]>;
