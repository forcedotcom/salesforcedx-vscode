/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { NamespaceInfo, TestItem } from '../tests/types';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { ApexClassId } from '../schemas/salesforceId';
import {
  AmbiguousApexSelectionSchema,
  AmbiguousFlowSelectionSchema,
  ApexClassIdSelectionSchema,
  ApexClassSelectionSchema,
  ApexMethodSelectionSchema,
  type DottedName,
  FlowClassSelectionSchema,
  FlowMethodSelectionSchema,
  type ResolvedTestSelection,
  type TestSelection,
  QualifiedNameSchema,
  UnqualifiedNameSchema
} from './schema/testSelection';

const flowTestingPrefix = 'FlowTesting.';

/** Splits a fully-qualified name once, preserving any suffix such as a method name. */
export const parseDottedName = (value: string): DottedName => {
  const dot = value.indexOf('.');
  if (dot === -1) return UnqualifiedNameSchema.make({ name: value });
  const [name, ...suffix] = value.slice(dot + 1).split('.');
  return QualifiedNameSchema.make({ namespace: value.slice(0, dot), name, suffix });
};

const ambiguousApexSelection = (namespace: string, name: string, className: string) =>
  AmbiguousApexSelectionSchema.make({
    namespace,
    classCandidate: ApexClassSelectionSchema.make({ className, namespace }),
    methodCandidate: ApexMethodSelectionSchema.make({ className: namespace, method: name })
  });

const parseApexSelection = (test: string): TestSelection =>
  Match.value(parseDottedName(test)).pipe(
    Match.tag('UnqualifiedName', ({ name }) =>
      Schema.is(ApexClassId)(name)
        ? ApexClassIdSelectionSchema.make({ classId: name })
        : ApexClassSelectionSchema.make({ className: name })
    ),
    Match.tag('QualifiedName', ({ namespace, name, suffix }) =>
      Match.value({ namespace, suffix }).pipe(
        Match.when(
          ({ namespace: candidate }) => candidate.length === 0,
          () => ApexClassSelectionSchema.make({ className: test })
        ),
        Match.when(
          ({ suffix: methods }) => methods.length === 1,
          () =>
            ApexMethodSelectionSchema.make({
              className: `${namespace}.${name}`,
              method: suffix[0],
              namespace
            })
        ),
        Match.orElse(() => ambiguousApexSelection(namespace, name, test))
      )
    ),
    Match.exhaustive
  );

const parseFlowSelection = (test: string): TestSelection =>
  Match.value(parseDottedName(test.slice(flowTestingPrefix.length))).pipe(
    Match.tag('UnqualifiedName', ({ name }) =>
      FlowClassSelectionSchema.make({ className: `${flowTestingPrefix}${name}` })
    ),
    Match.tag('QualifiedName', ({ namespace, name, suffix }) =>
      Match.value(suffix.length).pipe(
        Match.when(1, () =>
          FlowMethodSelectionSchema.make({
            className: `${flowTestingPrefix}${namespace}.${name}`,
            method: suffix[0],
            namespace: `${flowTestingPrefix}${namespace}`
          })
        ),
        Match.orElse(() =>
          AmbiguousFlowSelectionSchema.make({
            namespace,
            classCandidate: FlowClassSelectionSchema.make({ className: test }),
            methodCandidate: FlowMethodSelectionSchema.make({
              className: `${flowTestingPrefix}${namespace}`,
              method: name
            })
          })
        )
      )
    ),
    Match.exhaustive
  );

/** Parses selection syntax without guessing whether a two-part name is a namespace or method. */
export const parseTestSelection = (test: string): TestSelection =>
  test.startsWith(flowTestingPrefix) ? parseFlowSelection(test) : parseApexSelection(test);

/** Resolves namespace-versus-method candidates using the org's namespace records. */
export const resolveTestSelection = (
  selection: TestSelection,
  namespaceInfos: readonly NamespaceInfo[]
): ResolvedTestSelection =>
  Match.value(selection).pipe(
    Match.tag('AmbiguousApex', ({ namespace, classCandidate, methodCandidate }) =>
      namespaceInfos.some(info => info.namespace === namespace) ? classCandidate : methodCandidate
    ),
    Match.tag('AmbiguousFlow', ({ namespace, classCandidate, methodCandidate }) =>
      Option.match(Option.fromNullable(namespaceInfos.find(info => info.namespace === namespace)), {
        onNone: () => methodCandidate,
        onSome: namespaceInfo =>
          FlowClassSelectionSchema.make({
            className: classCandidate.className,
            ...(!namespaceInfo.installedNs && { namespace: `${flowTestingPrefix}${namespace}` })
          })
      })
    ),
    Match.tag('ApexClassId', selection => selection),
    Match.tag('ApexClass', selection => selection),
    Match.tag('ApexMethod', selection => selection),
    Match.tag('FlowClass', selection => selection),
    Match.tag('FlowMethod', selection => selection),
    Match.exhaustive
  );

/** Converts a resolved selection to the shape consumed by the Apex test runner. */
export const testItemFromSelection = (selection: ResolvedTestSelection): TestItem =>
  Match.value(selection).pipe(
    Match.tag('ApexClassId', ({ classId }) => ({ classId })),
    Match.tag('ApexClass', ({ className }) => ({ className })),
    Match.tag('ApexMethod', ({ className, method }) => ({ className, testMethods: [method] })),
    Match.tag('FlowClass', ({ className, namespace }) => ({ className, ...(namespace && { namespace }) })),
    Match.tag('FlowMethod', ({ className, method, namespace }) => ({
      className,
      testMethods: [method],
      ...(namespace && { namespace })
    })),
    Match.exhaustive
  );
