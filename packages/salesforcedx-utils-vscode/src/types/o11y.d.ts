declare module 'o11y_schema/version' {
  export const version: string;
}

declare module 'o11y_schema/sf_a4dInstrumentation' {
  export const a4dInstrumentationSchema: unknown;
}

declare module 'o11y/collectors';
declare module 'o11y/simple_collector';
type Environment = import('o11y/dist/modules/o11y/client/interfaces').Environment;
type Instrumentation = import('o11y/dist/modules/o11y/client/interfaces').Instrumentation;
type InstrumentedAppMethods = import('o11y/dist/modules/o11y/client/interfaces').InstrumentedAppMethods;
type InstrumentedAppOptions = import('o11y/dist/modules/o11y/client/interfaces').InstrumentedAppOptions;
type ConsoleCollector = import('o11y/dist/modules/o11y/client/client').ConsoleCollector;
type SimpleCollector = import('o11y/dist/modules/o11y/collectors/simple_collector').SimpleCollector;
type ProtoEncoderFuncType = (input: unknown) => Uint8Array;
