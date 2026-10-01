declare module 'color-convert' {
  namespace convert {
    namespace rgb {
      function hex(r: number, g: number, b: number): any;
      function hsl(r: number, g: number, b: number): any;
      function hvs(r: number, g: number, b: number): any;
    }
  }

  export = convert;
}
