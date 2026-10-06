(function () {
    'use strict';

    /**
     * Copyright (c) 2025 Salesforce, Inc.
     */
    /**
     * Copyright (c) 2025 Salesforce, Inc.
     */
    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     *
     * @param value
     * @param msg
     */
    function invariant(value, msg) {
      if (!value) {
        throw new Error(`Invariant Violation: ${msg}`);
      }
    }
    /**
     *
     * @param value
     * @param msg
     */
    function isTrue$1(value, msg) {
      if (!value) {
        throw new Error(`Assert Violation: ${msg}`);
      }
    }
    /**
     *
     * @param value
     * @param msg
     */
    function isFalse$1(value, msg) {
      if (value) {
        throw new Error(`Assert Violation: ${msg}`);
      }
    }
    /**
     *
     * @param msg
     */
    function fail(msg) {
      throw new Error(msg);
    }
    var assert = /*#__PURE__*/Object.freeze({
      __proto__: null,
      fail: fail,
      invariant: invariant,
      isFalse: isFalse$1,
      isTrue: isTrue$1
    });

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const {
      /** Detached {@linkcode Object.assign}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign MDN Reference}. */
      assign,
      /** Detached {@linkcode Object.create}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create MDN Reference}. */
      create,
      /** Detached {@linkcode Object.defineProperties}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties MDN Reference}. */
      defineProperties,
      /** Detached {@linkcode Object.defineProperty}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty MDN Reference}. */
      defineProperty,
      /** Detached {@linkcode Object.entries}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries MDN Reference}. */
      entries,
      /** Detached {@linkcode Object.freeze}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze MDN Reference}. */
      freeze,
      /** Detached {@linkcode Object.getOwnPropertyDescriptor}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor MDN Reference}. */
      getOwnPropertyDescriptor: getOwnPropertyDescriptor$1,
      /** Detached {@linkcode Object.getOwnPropertyDescriptors}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors MDN Reference}. */
      getOwnPropertyDescriptors,
      /** Detached {@linkcode Object.getOwnPropertyNames}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames MDN Reference}. */
      getOwnPropertyNames: getOwnPropertyNames$1,
      /** Detached {@linkcode Object.getOwnPropertySymbols}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols MDN Reference}. */
      getOwnPropertySymbols: getOwnPropertySymbols$1,
      /** Detached {@linkcode Object.getPrototypeOf}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf MDN Reference}. */
      getPrototypeOf: getPrototypeOf$1,
      /** Detached {@linkcode Object.hasOwnProperty}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty MDN Reference}. */
      hasOwnProperty: hasOwnProperty$1,
      /** Detached {@linkcode Object.isFrozen}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen MDN Reference}. */
      isFrozen,
      /** Detached {@linkcode Object.keys}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys MDN Reference}. */
      keys,
      /** Detached {@linkcode Object.seal}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal MDN Reference}. */
      seal,
      /** Detached {@linkcode Object.setPrototypeOf}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf MDN Reference}. */
      setPrototypeOf
    } = Object;
    const {
      /** Detached {@linkcode Array.isArray}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray MDN Reference}. */
      isArray: isArray$1,
      /** Detached {@linkcode Array.from}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from MDN Reference}. */
      from: ArrayFrom
    } = Array;
    // For some reason, JSDoc don't get picked up for multiple renamed destructured constants (even
    // though it works fine for one, e.g. isArray), so comments for these are added to the export
    // statement, rather than this declaration.
    const {
      copyWithin: ArrayCopyWithin,
      fill: ArrayFill,
      filter: ArrayFilter,
      indexOf: ArrayIndexOf,
      join: ArrayJoin,
      map: ArrayMap,
      pop: ArrayPop,
      push: ArrayPush$1,
      reverse: ArrayReverse,
      shift: ArrayShift,
      slice: ArraySlice,
      some: ArraySome,
      sort: ArraySort,
      splice: ArraySplice,
      unshift: ArrayUnshift,
      forEach // Weird anomaly!
    } = Array.prototype;
    /** Detached {@linkcode String.fromCharCode}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCharCode MDN Reference}. */
    const {
      fromCharCode: StringFromCharCode
    } = String;
    // No JSDocs here - see comment for Array.prototype
    const {
      charAt: StringCharAt,
      charCodeAt: StringCharCodeAt,
      replace: StringReplace,
      split: StringSplit,
      slice: StringSlice,
      toLowerCase: StringToLowerCase,
      trim: StringTrim
    } = String.prototype;
    /**
     * Determines whether the argument is `undefined`.
     * @param obj Value to test
     * @returns `true` if the value is `undefined`.
     */
    function isUndefined$1(obj) {
      return obj === undefined;
    }
    /**
     * Determines whether the argument is `null`.
     * @param obj Value to test
     * @returns `true` if the value is `null`.
     */
    function isNull(obj) {
      return obj === null;
    }
    /**
     * Determines whether the argument is `true`.
     * @param obj Value to test
     * @returns `true` if the value is `true`.
     */
    function isTrue(obj) {
      return obj === true;
    }
    /**
     * Determines whether the argument is `false`.
     * @param obj Value to test
     * @returns `true` if the value is `false`.
     */
    function isFalse(obj) {
      return obj === false;
    }
    /**
     * Determines whether the argument is a function.
     * @param obj Value to test
     * @returns `true` if the value is a function.
     */
    // Replacing `Function` with a narrower type that works for all our use cases is tricky...
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    function isFunction$1(obj) {
      return typeof obj === 'function';
    }
    /**
     * Determines whether the argument is an object or null.
     * @param obj Value to test
     * @returns `true` if the value is an object or null.
     */
    function isObject(obj) {
      return typeof obj === 'object';
    }
    /**
     * Determines whether the argument is a string.
     * @param obj Value to test
     * @returns `true` if the value is a string.
     */
    function isString(obj) {
      return typeof obj === 'string';
    }
    /**
     * Determines whether the argument is a number.
     * @param obj Value to test
     * @returns `true` if the value is a number.
     */
    function isNumber(obj) {
      return typeof obj === 'number';
    }
    /** Does nothing! 🚀 */
    function noop() {
      /* Do nothing */
    }
    const OtS = {}.toString;
    /**
     * Converts the argument to a string, safely accounting for objects with "null" prototype.
     * Note that `toString(null)` returns `"[object Null]"` rather than `"null"`.
     * @param obj Value to convert to a string.
     * @returns String representation of the value.
     */
    function toString(obj) {
      if (obj?.toString) {
        // Arrays might hold objects with "null" prototype So using
        // Array.prototype.toString directly will cause an error Iterate through
        // all the items and handle individually.
        if (isArray$1(obj)) {
          // This behavior is slightly different from Array#toString:
          // 1. Array#toString calls `this.join`, rather than Array#join
          // Ex: arr = []; arr.join = () => 1; arr.toString() === 1; toString(arr) === ''
          // 2. Array#toString delegates to Object#toString if `this.join` is not a function
          // Ex: arr = []; arr.join = 'no'; arr.toString() === '[object Array]; toString(arr) = ''
          // 3. Array#toString converts null/undefined to ''
          // Ex: arr = [null, undefined]; arr.toString() === ','; toString(arr) === '[object Null],undefined'
          // 4. Array#toString converts recursive references to arrays to ''
          // Ex: arr = [1]; arr.push(arr, 2); arr.toString() === '1,,2'; toString(arr) throws
          // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toString
          return ArrayJoin.call(ArrayMap.call(obj, toString), ',');
        }
        return obj.toString();
      } else if (typeof obj === 'object') {
        // This catches null and returns "[object Null]". Weird, but kept for backwards compatibility.
        return OtS.call(obj);
      } else {
        return String(obj);
      }
    }
    /**
     * Gets the property descriptor for the given object and property key. Similar to
     * {@linkcode Object.getOwnPropertyDescriptor}, but looks up the prototype chain.
     * @param o Value to get the property descriptor for
     * @param p Property key to get the descriptor for
     * @returns The property descriptor for the given object and property key.
     */
    function getPropertyDescriptor(o, p) {
      do {
        const d = getOwnPropertyDescriptor$1(o, p);
        if (!isUndefined$1(d)) {
          return d;
        }
        o = getPrototypeOf$1(o);
      } while (o !== null);
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // These must be updated when the enum is updated.
    // It's a bit annoying to do have to do this manually, but this makes the file tree-shakeable,
    // passing the `verify-treeshakeable.js` test.
    const allVersions = [58 /* APIVersion.V58_244_SUMMER_23 */, 59 /* APIVersion.V59_246_WINTER_24 */, 60 /* APIVersion.V60_248_SPRING_24 */, 61 /* APIVersion.V61_250_SUMMER_24 */, 62 /* APIVersion.V62_252_WINTER_25 */, 63 /* APIVersion.V63_254_SPRING_25 */];
    const LOWEST_API_VERSION = allVersions[0];
    /**
     *
     * @param apiVersionFeature
     * @param apiVersion
     */
    function isAPIFeatureEnabled(apiVersionFeature, apiVersion) {
      switch (apiVersionFeature) {
        case 0 /* APIFeature.LOWERCASE_SCOPE_TOKENS */:
        case 1 /* APIFeature.TREAT_ALL_PARSE5_ERRORS_AS_ERRORS */:
          return apiVersion >= 59 /* APIVersion.V59_246_WINTER_24 */;
        case 3 /* APIFeature.DISABLE_OBJECT_REST_SPREAD_TRANSFORMATION */:
        case 4 /* APIFeature.SKIP_UNNECESSARY_REGISTER_DECORATORS */:
        case 5 /* APIFeature.USE_COMMENTS_FOR_FRAGMENT_BOOKENDS */:
        case 2 /* APIFeature.USE_FRAGMENTS_FOR_LIGHT_DOM_SLOTS */:
          return apiVersion >= 60 /* APIVersion.V60_248_SPRING_24 */;
        case 7 /* APIFeature.ENABLE_ELEMENT_INTERNALS_AND_FACE */:
        case 6 /* APIFeature.USE_LIGHT_DOM_SLOT_FORWARDING */:
          return apiVersion >= 61 /* APIVersion.V61_250_SUMMER_24 */;
        case 8 /* APIFeature.ENABLE_THIS_DOT_HOST_ELEMENT */:
        case 9 /* APIFeature.ENABLE_THIS_DOT_STYLE */:
        case 10 /* APIFeature.TEMPLATE_CLASS_NAME_OBJECT_BINDING */:
          return apiVersion >= 62 /* APIVersion.V62_252_WINTER_25 */;
        case 11 /* APIFeature.ENABLE_COMPLEX_TEMPLATE_EXPRESSIONS */:
          return apiVersion >= 63 /* APIVersion.V63_254_SPRING_25 */;
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * According to the following list, there are 48 aria attributes of which two (ariaDropEffect and
     * ariaGrabbed) are deprecated:
     * https://www.w3.org/TR/wai-aria-1.1/#x6-6-definitions-of-states-and-properties-all-aria-attributes
     *
     * The above list of 46 aria attributes is consistent with the following resources:
     * https://github.com/w3c/aria/pull/708/files#diff-eacf331f0ffc35d4b482f1d15a887d3bR11060
     * https://wicg.github.io/aom/spec/aria-reflection.html
     *
     * NOTE: If you update this list, please update test files that implicitly reference this list!
     * Searching the codebase for `aria-flowto` and `ariaFlowTo` should be good enough to find all usages.
     */
    const AriaPropertyNames = ['ariaActiveDescendant', 'ariaAtomic', 'ariaAutoComplete', 'ariaBusy', 'ariaChecked', 'ariaColCount', 'ariaColIndex', 'ariaColIndexText', 'ariaColSpan', 'ariaControls', 'ariaCurrent', 'ariaDescribedBy', 'ariaDescription', 'ariaDetails', 'ariaDisabled', 'ariaErrorMessage', 'ariaExpanded', 'ariaFlowTo', 'ariaHasPopup', 'ariaHidden', 'ariaInvalid', 'ariaKeyShortcuts', 'ariaLabel', 'ariaLabelledBy', 'ariaLevel', 'ariaLive', 'ariaModal', 'ariaMultiLine', 'ariaMultiSelectable', 'ariaOrientation', 'ariaOwns', 'ariaPlaceholder', 'ariaPosInSet', 'ariaPressed', 'ariaReadOnly', 'ariaRelevant', 'ariaRequired', 'ariaRoleDescription', 'ariaRowCount', 'ariaRowIndex', 'ariaRowIndexText', 'ariaRowSpan', 'ariaSelected', 'ariaSetSize', 'ariaSort', 'ariaValueMax', 'ariaValueMin', 'ariaValueNow', 'ariaValueText', 'ariaBrailleLabel', 'ariaBrailleRoleDescription', 'role'];
    const {
      AriaAttrNameToPropNameMap,
      AriaPropNameToAttrNameMap
    } = /*@__PURE__*/(() => {
      const AriaAttrNameToPropNameMap = create(null);
      const AriaPropNameToAttrNameMap = create(null);
      // Synthetic creation of all AOM property descriptors for Custom Elements
      forEach.call(AriaPropertyNames, propName => {
        const attrName = StringToLowerCase.call(StringReplace.call(propName, /^aria/, () => 'aria-'));
        // These type assertions are because the map types are a 1:1 mapping of ariaX to aria-x.
        // TypeScript knows we have one of ariaX | ariaY and one of aria-x | aria-y, and tries to
        // prevent us from doing ariaX: aria-y, but we that it's safe.
        AriaAttrNameToPropNameMap[attrName] = propName;
        AriaPropNameToAttrNameMap[propName] = attrName;
      });
      return {
        AriaAttrNameToPropNameMap,
        AriaPropNameToAttrNameMap
      };
    })();
    // These attributes take either an ID or a list of IDs as values.
    // This includes aria-* attributes as well as the special non-ARIA "for" attribute
    const ID_REFERENCING_ATTRIBUTES_SET = /*@__PURE__*/new Set(['aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details', 'aria-errormessage', 'aria-flowto', 'aria-labelledby', 'aria-owns', 'for']);

    /*
     * Copyright (c) 2023, Salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const KEY__SHADOW_RESOLVER = '$shadowResolver$';
    const KEY__SHADOW_STATIC = '$shadowStaticNode$';
    const KEY__SHADOW_TOKEN = '$shadowToken$';
    const KEY__SYNTHETIC_MODE = '$$lwc-synthetic-mode';
    const KEY__SCOPED_CSS = '$scoped$';
    const KEY__NATIVE_ONLY_CSS = '$nativeOnly$';
    const KEY__NATIVE_GET_ELEMENT_BY_ID = '$nativeGetElementById$';
    const KEY__NATIVE_QUERY_SELECTOR_ALL = '$nativeQuerySelectorAll$';
    const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

    /*
     * Copyright (c) 2020, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const CAMEL_REGEX = /-([a-z])/g;
    // These are HTML standard prop/attribute IDL mappings, but are not predictable based on camel/kebab-case conversion
    const SPECIAL_PROPERTY_ATTRIBUTE_MAPPING = /*@__PURE__@*/new Map([['accessKey', 'accesskey'], ['readOnly', 'readonly'], ['tabIndex', 'tabindex'], ['bgColor', 'bgcolor'], ['colSpan', 'colspan'], ['rowSpan', 'rowspan'], ['contentEditable', 'contenteditable'], ['crossOrigin', 'crossorigin'], ['dateTime', 'datetime'], ['formAction', 'formaction'], ['isMap', 'ismap'], ['maxLength', 'maxlength'], ['minLength', 'minlength'], ['noValidate', 'novalidate'], ['useMap', 'usemap'], ['htmlFor', 'for']]);
    // Global properties that this framework currently reflects. For CSR, the native
    // descriptors for these properties are added from HTMLElement.prototype to
    // LightningElement.prototype. For SSR, in order to match CSR behavior, this
    // list is used to determine which attributes to reflect.
    const REFLECTIVE_GLOBAL_PROPERTY_SET = /*@__PURE__@*/new Set(['accessKey', 'dir', 'draggable', 'hidden', 'id', 'lang', 'spellcheck', 'tabIndex', 'title']);
    /**
     * Map associating previously transformed HTML property into HTML attribute.
     */
    const CACHED_PROPERTY_ATTRIBUTE_MAPPING = /*@__PURE__@*/new Map();
    /**
     *
     * @param propName
     */
    function htmlPropertyToAttribute(propName) {
      const ariaAttributeName = AriaPropNameToAttrNameMap[propName];
      if (!isUndefined$1(ariaAttributeName)) {
        return ariaAttributeName;
      }
      const specialAttributeName = SPECIAL_PROPERTY_ATTRIBUTE_MAPPING.get(propName);
      if (!isUndefined$1(specialAttributeName)) {
        return specialAttributeName;
      }
      const cachedAttributeName = CACHED_PROPERTY_ATTRIBUTE_MAPPING.get(propName);
      if (!isUndefined$1(cachedAttributeName)) {
        return cachedAttributeName;
      }
      let attributeName = '';
      for (let i = 0, len = propName.length; i < len; i++) {
        const code = StringCharCodeAt.call(propName, i);
        if (code >= 65 &&
        // "A"
        code <= 90 // "Z"
        ) {
          attributeName += '-' + StringFromCharCode(code + 32);
        } else {
          attributeName += StringFromCharCode(code);
        }
      }
      CACHED_PROPERTY_ATTRIBUTE_MAPPING.set(propName, attributeName);
      return attributeName;
    }
    /**
     * Map associating previously transformed kabab-case attributes into camel-case props.
     */
    const CACHED_KEBAB_CAMEL_MAPPING = /*@__PURE__@*/new Map();
    /**
     *
     * @param attrName
     */
    function kebabCaseToCamelCase(attrName) {
      let result = CACHED_KEBAB_CAMEL_MAPPING.get(attrName);
      if (isUndefined$1(result)) {
        result = StringReplace.call(attrName, CAMEL_REGEX, g => g[1].toUpperCase());
        CACHED_KEBAB_CAMEL_MAPPING.set(attrName, result);
      }
      return result;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // Increment whenever the LWC template compiler changes
    const LWC_VERSION = "8.16.0";
    const LWC_VERSION_COMMENT_REGEX = /\/\*LWC compiler v([\d.]+)\*\/\s*}/;

    /*
     * Copyright (c) 2020, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * [ncls] - Normalize class name attribute.
     *
     * Transforms the provided class property value from an object/string into a string the diffing algo
     * can operate on.
     *
     * This implementation is borrowed from Vue:
     * https://github.com/vuejs/core/blob/e790e1bdd7df7be39e14780529db86e4da47a3db/packages/shared/src/normalizeProp.ts#L63-L82
     */
    function normalizeClass(value) {
      if (isUndefined$1(value) || isNull(value)) {
        // Returning undefined here improves initial render cost, because the old vnode's class will be considered
        // undefined in the `patchClassAttribute` routine, so `oldClass === newClass` will be true so we return early
        return undefined;
      }
      let res = '';
      if (isString(value)) {
        res = value;
      } else if (isArray$1(value)) {
        for (let i = 0; i < value.length; i++) {
          const normalized = normalizeClass(value[i]);
          if (normalized) {
            res += normalized + ' ';
          }
        }
      } else if (isObject(value) && !isNull(value)) {
        // Iterate own enumerable keys of the object
        const _keys = keys(value);
        for (let i = 0; i < _keys.length; i += 1) {
          const key = _keys[i];
          if (value[key]) {
            res += key + ' ';
          }
        }
      }
      return StringTrim.call(res);
    }
    /**
     * EXPERIMENTAL: This function acts like a hook for Lightning Locker Service and other similar
     * libraries to sanitize HTML content. This hook process the content passed via the template to
     * lwc:inner-html directive.
     * It is meant to be overridden via `setHooks`; it throws an error by default.
     */
    let sanitizeHtmlContent = () => {
      // locker-service patches this function during runtime to sanitize HTML content.
      throw new Error('sanitizeHtmlContent hook must be implemented.');
    };
    function flattenStylesheets(stylesheets) {
      const list = [];
      for (const stylesheet of stylesheets) {
        if (!isArray$1(stylesheet)) {
          list.push(stylesheet);
        } else {
          list.push(...flattenStylesheets(stylesheet));
        }
      }
      return list;
    }
    function isTrustedSignal(target) {
      {
        // The runtime didn't set a trustedSignals set
        // this check should only be performed for runtimes that care about filtering signals to track
        // our default behavior should be to track all signals
        return true;
      }
    }
    if (!globalThis.lwcRuntimeFlags) {
      Object.defineProperty(globalThis, 'lwcRuntimeFlags', {
        value: create(null)
      });
    }
    /**
     * Whether reporting is enabled.
     *
     * Note that this may seem redundant, given you can just check if the currentDispatcher is undefined,
     * but it turns out that Terser only strips out unused code if we use this explicit boolean.
     */
    let enabled$1 = false;
    /**
     * Report to the current dispatcher, if there is one.
     * @param reportingEventId
     * @param payload data to report
     */
    function report(reportingEventId, payload) {
    }
    /**
     * Return true if reporting is enabled
     */
    function isReportingEnabled() {
      return enabled$1;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function getComponentTag(vm) {
      return `<${StringToLowerCase.call(vm.tagName)}>`;
    }
    // TODO [#1695]: Unify getComponentStack and getErrorComponentStack
    function getComponentStack(vm) {
      const stack = [];
      let prefix = '';
      while (!isNull(vm.owner)) {
        ArrayPush$1.call(stack, prefix + getComponentTag(vm));
        vm = vm.owner;
        prefix += '\t';
      }
      return ArrayJoin.call(stack, '\n');
    }
    function getErrorComponentStack(vm) {
      const wcStack = [];
      let currentVm = vm;
      while (!isNull(currentVm)) {
        ArrayPush$1.call(wcStack, getComponentTag(currentVm));
        currentVm = currentVm.owner;
      }
      return wcStack.reverse().join('\n\t');
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function addErrorComponentStack(vm, error) {
      if (!isFrozen(error) && isUndefined$1(error.wcStack)) {
        const wcStack = getErrorComponentStack(vm);
        defineProperty(error, 'wcStack', {
          get() {
            return wcStack;
          }
        });
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const alreadyLoggedMessages = new Set();
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      window.__lwcResetAlreadyLoggedMessages = () => {
        alreadyLoggedMessages.clear();
      };
    }
    function log(method, message, vm, once) {
      let msg = `[LWC ${method}]: ${message}`;
      if (!isUndefined$1(vm)) {
        msg = `${msg}\n${getComponentStack(vm)}`;
      }
      if (once) {
        if (alreadyLoggedMessages.has(msg)) {
          return;
        }
        alreadyLoggedMessages.add(msg);
      }
      // In Vitest tests, reduce the warning and error verbosity by not printing the callstack
      if (process.env.NODE_ENV === 'test') {
        /* eslint-disable-next-line no-console */
        console[method](msg);
        return;
      }
      try {
        throw new Error(msg);
      } catch (e) {
        /* eslint-disable-next-line no-console */
        console[method](e);
      }
    }
    function logError(message, vm) {
      log('error', message, vm, false);
    }
    function logWarn(message, vm) {
      log('warn', message, vm, false);
    }
    function logWarnOnce(message, vm) {
      log('warn', message, vm, true);
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let nextTickCallbackQueue = [];
    const SPACE_CHAR = 32;
    const EmptyObject = seal(create(null));
    const EmptyArray = seal([]);
    function flushCallbackQueue() {
      if (process.env.NODE_ENV !== 'production') {
        if (nextTickCallbackQueue.length === 0) {
          throw new Error(`Internal Error: If callbackQueue is scheduled, it is because there must be at least one callback on this pending queue.`);
        }
      }
      const callbacks = nextTickCallbackQueue;
      nextTickCallbackQueue = []; // reset to a new queue
      for (let i = 0, len = callbacks.length; i < len; i += 1) {
        callbacks[i]();
      }
    }
    function addCallbackToNextTick(callback) {
      if (process.env.NODE_ENV !== 'production') {
        if (!isFunction$1(callback)) {
          throw new Error(`Internal Error: addCallbackToNextTick() can only accept a function callback`);
        }
      }
      if (nextTickCallbackQueue.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.resolve().then(flushCallbackQueue);
      }
      ArrayPush$1.call(nextTickCallbackQueue, callback);
    }
    // Throw an error if we're running in prod mode. Ensures code is truly removed from prod mode.
    function assertNotProd() {
      /* istanbul ignore if */
      if (process.env.NODE_ENV === 'production') {
        // this method should never leak to prod
        throw new ReferenceError();
      }
    }
    function shouldBeFormAssociated(Ctor) {
      const ctorFormAssociated = Boolean(Ctor.formAssociated);
      const apiVersion = getComponentAPIVersion(Ctor);
      const apiFeatureEnabled = isAPIFeatureEnabled(7 /* APIFeature.ENABLE_ELEMENT_INTERNALS_AND_FACE */, apiVersion);
      if (process.env.NODE_ENV !== 'production' && ctorFormAssociated && !apiFeatureEnabled) {
        const tagName = getComponentRegisteredName(Ctor);
        logWarnOnce(`Component <${tagName}> set static formAssociated to true, but form ` + `association is not enabled because the API version is ${apiVersion}. To enable form association, ` + `update the LWC component API version to 61 or above. https://lwc.dev/guide/versioning`);
      }
      return ctorFormAssociated && apiFeatureEnabled;
    }
    // check if a property is in an object, and if the object throws an error merely because we are
    // checking if the property exists, return false
    function safeHasProp(obj, prop) {
      try {
        return prop in obj;
      } catch (_err) {
        return false;
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    //
    // Do additional mutation tracking for DevTools performance profiling, in dev mode only.
    //
    const reactiveObserversToVMs = new WeakMap();
    const targetsToPropertyKeys = new WeakMap();
    let mutationLogs = [];
    // Create a human-readable member access notation like `obj.foo` or `arr[1]`,
    // handling edge cases like `obj[Symbol("bar")]` and `obj["spaces here"]`
    function toPrettyMemberNotation(parent, child) {
      if (isUndefined$1(parent)) {
        // Bare prop, just stringify the child
        return toString(child);
      } else if (!isString(child)) {
        // Symbol/number, e.g. `obj[Symbol("foo")]` or `obj[1234]`
        return `${toString(parent)}[${toString(child)}]`;
      } else if (/^\w+$/.test(child)) {
        // Dot-notation-safe string, e.g. `obj.foo`
        return `${toString(parent)}.${child}`;
      } else {
        // Bracket-notation-requiring string, e.g. `obj["prop with spaces"]`
        return `${toString(parent)}[${JSON.stringify(child)}]`;
      }
    }
    function safelyCallGetter(target, key) {
      // Arbitrary getters can throw. We don't want to throw an error just due to dev-mode-only mutation tracking
      // (which is only used for performance debugging) so ignore errors here.
      try {
        return target[key];
      } catch (_err) {
        /* ignore */
      }
    }
    function isRevokedProxy(target) {
      try {
        // `str in obj` will never throw for normal objects or active proxies,
        // but the operation is not allowed for revoked proxies
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        '' in target;
        return false;
      } catch (_) {
        return true;
      }
    }
    /**
     * Flush all the logs we've written so far and return the current logs.
     */
    function getAndFlushMutationLogs() {
      assertNotProd();
      const result = mutationLogs;
      mutationLogs = [];
      return result;
    }
    /**
     * Log a new mutation for this reactive observer.
     * @param reactiveObserver - relevant ReactiveObserver
     * @param target - target object that is being observed
     * @param key - key (property) that was mutated
     */
    function logMutation(reactiveObserver, target, key) {
      assertNotProd();
      const parentKey = targetsToPropertyKeys.get(target);
      const vm = reactiveObserversToVMs.get(reactiveObserver);
      /* istanbul ignore if */
      if (isUndefined$1(vm)) {
        // VM should only be undefined in Vitest tests, where a reactive observer is not always associated with a VM
        // because the unit tests just create Reactive Observers on-the-fly.
        // Note we could explicitly target Vitest with `process.env.NODE_ENV === 'test'`, but then that would also
        // affect our downstream consumers' Jest/Vitest tests, and we don't want to throw an error just for a logger.
        if (process.env.NODE_ENV === 'test-karma-lwc') {
          throw new Error('The VM should always be defined except possibly in unit tests');
        }
      } else {
        const prop = toPrettyMemberNotation(parentKey, key);
        ArrayPush$1.call(mutationLogs, {
          vm,
          prop
        });
      }
    }
    /**
     * Flush logs associated with a given VM.
     * @param vm - given VM
     */
    function flushMutationLogsForVM(vm) {
      assertNotProd();
      mutationLogs = ArrayFilter.call(mutationLogs, log => log.vm !== vm);
    }
    /**
     * Mark this ReactiveObserver as related to this VM. This is only needed for mutation tracking in dev mode.
     * @param reactiveObserver
     * @param vm
     */
    function associateReactiveObserverWithVM(reactiveObserver, vm) {
      assertNotProd();
      reactiveObserversToVMs.set(reactiveObserver, vm);
    }
    /**
     * Deeply track all objects in a target and associate with a given key.
     * @param key - key associated with the object in the component
     * @param target - tracked target object
     */
    function trackTargetForMutationLogging(key, target) {
      assertNotProd();
      if (targetsToPropertyKeys.has(target)) {
        // Guard against recursive objects - don't traverse forever
        return;
      }
      // Revoked proxies (e.g. window props in LWS sandboxes) throw an error if we try to track them
      if (isObject(target) && !isNull(target) && !isRevokedProxy(target)) {
        // only track non-primitives; others are invalid as WeakMap keys
        targetsToPropertyKeys.set(target, key);
        // Deeply traverse arrays and objects to track every object within
        if (isArray$1(target)) {
          for (let i = 0; i < target.length; i++) {
            trackTargetForMutationLogging(toPrettyMemberNotation(key, i), safelyCallGetter(target, i));
          }
        } else {
          // Track only own property names and symbols (including non-enumerated)
          // This is consistent with what observable-membrane does:
          // https://github.com/salesforce/observable-membrane/blob/b85417f/src/base-handler.ts#L142-L143
          // Note this code path is very hot, hence doing two separate for-loops rather than creating a new array.
          for (const prop of getOwnPropertyNames$1(target)) {
            trackTargetForMutationLogging(toPrettyMemberNotation(key, prop), safelyCallGetter(target, prop));
          }
          for (const prop of getOwnPropertySymbols$1(target)) {
            trackTargetForMutationLogging(toPrettyMemberNotation(key, prop), safelyCallGetter(target, prop));
          }
        }
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const TargetToReactiveRecordMap = new WeakMap();
    function getReactiveRecord(target) {
      let reactiveRecord = TargetToReactiveRecordMap.get(target);
      if (isUndefined$1(reactiveRecord)) {
        const newRecord = create(null);
        reactiveRecord = newRecord;
        TargetToReactiveRecordMap.set(target, newRecord);
      }
      return reactiveRecord;
    }
    let currentReactiveObserver = null;
    function valueMutated(target, key) {
      const reactiveRecord = TargetToReactiveRecordMap.get(target);
      if (!isUndefined$1(reactiveRecord)) {
        const reactiveObservers = reactiveRecord[key];
        if (!isUndefined$1(reactiveObservers)) {
          for (let i = 0, len = reactiveObservers.length; i < len; i += 1) {
            const ro = reactiveObservers[i];
            if (process.env.NODE_ENV !== 'production') {
              logMutation(ro, target, key);
            }
            ro.notify();
          }
        }
      }
    }
    function valueObserved(target, key) {
      // We should determine if an active Observing Record is present to track mutations.
      if (currentReactiveObserver === null) {
        return;
      }
      const ro = currentReactiveObserver;
      const reactiveRecord = getReactiveRecord(target);
      let reactiveObservers = reactiveRecord[key];
      if (isUndefined$1(reactiveObservers)) {
        reactiveObservers = [];
        reactiveRecord[key] = reactiveObservers;
      } else if (reactiveObservers[0] === ro) {
        return; // perf optimization considering that most subscriptions will come from the same record
      }
      if (ArrayIndexOf.call(reactiveObservers, ro) === -1) {
        ro.link(reactiveObservers);
      }
    }
    class ReactiveObserver {
      constructor(callback) {
        this.listeners = [];
        this.callback = callback;
      }
      observe(job) {
        const inceptionReactiveRecord = currentReactiveObserver;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        currentReactiveObserver = this;
        let error;
        try {
          job();
        } catch (e) {
          error = Object(e);
        } finally {
          currentReactiveObserver = inceptionReactiveRecord;
          if (error !== undefined) {
            throw error; // eslint-disable-line no-unsafe-finally
          }
        }
      }
      /**
       * This method is responsible for disconnecting the Reactive Observer
       * from any Reactive Record that has a reference to it, to prevent future
       * notifications about previously recorded access.
       */
      reset() {
        const {
          listeners
        } = this;
        const len = listeners.length;
        if (len > 0) {
          for (let i = 0; i < len; i++) {
            const set = listeners[i];
            const setLength = set.length;
            // The length is usually 1, so avoid doing an indexOf when we know for certain
            // that `this` is the first item in the array.
            if (setLength > 1) {
              // Swap with the last item before removal.
              // (Avoiding splice here is a perf optimization, and the order doesn't matter.)
              const index = ArrayIndexOf.call(set, this);
              set[index] = set[setLength - 1];
            }
            // Remove the last item
            ArrayPop.call(set);
          }
          listeners.length = 0;
        }
      }
      // friend methods
      notify() {
        this.callback.call(undefined, this);
      }
      link(reactiveObservers) {
        ArrayPush$1.call(reactiveObservers, this);
        // we keep track of observing records where the observing record was added to so we can do some clean up later on
        ArrayPush$1.call(this.listeners, reactiveObservers);
      }
      isObserving() {
        return currentReactiveObserver === this;
      }
    }

    /*
     * Copyright (c) 2024, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * This map keeps track of objects to signals. There is an assumption that the signal is strongly referenced
     * on the object which allows the SignalTracker to be garbage collected along with the object.
     */
    const TargetToSignalTrackerMap = new WeakMap();
    function getSignalTracker(target) {
      let signalTracker = TargetToSignalTrackerMap.get(target);
      if (isUndefined$1(signalTracker)) {
        signalTracker = new SignalTracker();
        TargetToSignalTrackerMap.set(target, signalTracker);
      }
      return signalTracker;
    }
    function subscribeToSignal(target, signal, update) {
      const signalTracker = getSignalTracker(target);
      if (isFalse(signalTracker.seen(signal))) {
        signalTracker.subscribeToSignal(signal, update);
      }
    }
    function unsubscribeFromSignals(target) {
      if (TargetToSignalTrackerMap.has(target)) {
        const signalTracker = getSignalTracker(target);
        signalTracker.unsubscribeFromSignals();
        signalTracker.reset();
      }
    }
    /**
     * This class is used to keep track of the signals associated to a given object.
     * It is used to prevent the LWC engine from subscribing duplicate callbacks multiple times
     * to the same signal. Additionally, it keeps track of all signal unsubscribe callbacks, handles invoking
     * them when necessary and discarding them.
     */
    class SignalTracker {
      constructor() {
        this.signalToUnsubscribeMap = new Map();
      }
      seen(signal) {
        return this.signalToUnsubscribeMap.has(signal);
      }
      subscribeToSignal(signal, update) {
        try {
          const unsubscribe = signal.subscribe(update);
          if (isFunction$1(unsubscribe)) {
            // TODO [#3978]: Evaluate how we should handle the case when unsubscribe is not a function.
            // Long term we should throw an error or log a warning.
            this.signalToUnsubscribeMap.set(signal, unsubscribe);
          }
        } catch (err) {
          logWarnOnce(`Attempted to subscribe to an object that has the shape of a signal but received the following error: ${err?.stack ?? err}`);
        }
      }
      unsubscribeFromSignals() {
        try {
          this.signalToUnsubscribeMap.forEach(unsubscribe => unsubscribe());
        } catch (err) {
          logWarnOnce(`Attempted to call a signal's unsubscribe callback but received the following error: ${err?.stack ?? err}`);
        }
      }
      reset() {
        this.signalToUnsubscribeMap.clear();
      }
    }
    function componentValueMutated(vm, key) {
      // On the server side, we don't need mutation tracking. Skipping it improves performance.
      {
        valueMutated(vm.component, key);
      }
    }
    function componentValueObserved(vm, key, target = {}) {
      const {
        component,
        tro
      } = vm;
      // On the server side, we don't need mutation tracking. Skipping it improves performance.
      {
        valueObserved(component, key);
      }
      // The portion of reactivity that's exposed to signals is to subscribe a callback to re-render the VM (templates).
      // We check the following to ensure re-render is subscribed at the correct time.
      //  1. The template is currently being rendered (there is a template reactive observer)
      //  2. There was a call to a getter to access the signal (happens during vnode generation)
      if (lwcRuntimeFlags.ENABLE_EXPERIMENTAL_SIGNALS && isObject(target) && !isNull(target) && safeHasProp(target, 'value') && safeHasProp(target, 'subscribe') && isFunction$1(target.subscribe) && isTrustedSignal() &&
      // Only subscribe if a template is being rendered by the engine
      tro.isObserving()) {
        // Subscribe the template reactive observer's notify method, which will mark the vm as dirty and schedule hydration.
        subscribeToSignal(component, target, tro.notify.bind(tro));
      }
    }
    function createReactiveObserver(callback) {
      // On the server side, we don't need mutation tracking. Skipping it improves performance.
      return new ReactiveObserver(callback);
    }

    /*
     * Copyright (c) 2020, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function resolveCircularModuleDependency(fn) {
      const module = fn();
      return module?.__esModule ? module.default : module;
    }
    function isCircularModuleDependency(obj) {
      return isFunction$1(obj) && hasOwnProperty$1.call(obj, '__circular__');
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const instrumentDef = globalThis.__lwc_instrument_cmp_def ?? noop;
    const instrumentInstance = globalThis.__lwc_instrument_cmp_instance ?? noop;

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // This is a temporary workaround to get the @lwc/engine-server to evaluate in node without having
    // to inject at runtime.
    const HTMLElementConstructor = typeof HTMLElement !== 'undefined' ? HTMLElement : function () {};
    const HTMLElementPrototype = HTMLElementConstructor.prototype;

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // Apply ARIA string reflection behavior to a prototype.
    // This is deliberately kept separate from @lwc/aria-reflection. @lwc/aria-reflection is a global polyfill that is
    // needed for backwards compatibility in LEX, whereas this is designed to only apply to our own
    // LightningElement/BaseBridgeElement prototypes.
    // Note we only need to handle ARIA reflections that aren't already in Element.prototype
    const ariaReflectionPolyfillDescriptors = create(null);
    for (const [propName, attrName] of entries(AriaPropNameToAttrNameMap)) {
      if (isUndefined$1(getPropertyDescriptor(HTMLElementPrototype, propName))) {
        // Note that we need to call this.{get,set,has,remove}Attribute rather than dereferencing
        // from Element.prototype, because these methods are overridden in LightningElement.
        ariaReflectionPolyfillDescriptors[propName] = {
          get() {
            return this.getAttribute(attrName);
          },
          set(newValue) {
            // TODO [#3284]: According to the spec, IDL nullable type values
            // (null and undefined) should remove the attribute; however, we
            // only do so in the case of null for historical reasons.
            // See also https://github.com/w3c/aria/issues/1858
            if (isNull(newValue)) {
              this.removeAttribute(attrName);
            } else {
              this.setAttribute(attrName, newValue);
            }
          },
          // configurable and enumerable to allow it to be overridden – this mimics Safari's/Chrome's behavior
          configurable: true,
          enumerable: true
        };
      }
    }
    // Add descriptors for ARIA attributes
    for (const [attrName, propName] of entries(AriaAttrNameToPropNameMap)) {}

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * This is a descriptor map that contains
     * all standard properties that a Custom Element can support (including AOM properties), which
     * determines what kind of capabilities the Base HTML Element and
     * Base Lightning Element should support.
     */
    const HTMLElementOriginalDescriptors = create(null);
    forEach.call(keys(AriaPropNameToAttrNameMap), propName => {
      // Note: intentionally using our in-house getPropertyDescriptor instead of getOwnPropertyDescriptor here because
      // in IE11, some properties are on Element.prototype instead of HTMLElement, just to be sure.
      const descriptor = getPropertyDescriptor(HTMLElementPrototype, propName);
      if (!isUndefined$1(descriptor)) {
        HTMLElementOriginalDescriptors[propName] = descriptor;
      }
    });
    for (const propName of REFLECTIVE_GLOBAL_PROPERTY_SET) {
      // Note: intentionally using our in-house getPropertyDescriptor instead of getOwnPropertyDescriptor here because
      // in IE11, id property is on Element.prototype instead of HTMLElement, and we suspect that more will fall into
      // this category, so, better to be sure.
      const descriptor = getPropertyDescriptor(HTMLElementPrototype, propName);
      if (!isUndefined$1(descriptor)) {
        HTMLElementOriginalDescriptors[propName] = descriptor;
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function generateDataDescriptor(options) {
      return assign({
        configurable: true,
        enumerable: true,
        writable: true
      }, options);
    }
    function generateAccessorDescriptor(options) {
      return assign({
        configurable: true,
        enumerable: true
      }, options);
    }
    let isDomMutationAllowed = false;
    function unlockDomMutation() {
      assertNotProd(); // this method should never leak to prod
      isDomMutationAllowed = true;
    }
    function lockDomMutation() {
      assertNotProd(); // this method should never leak to prod
      isDomMutationAllowed = false;
    }
    function logMissingPortalWarn(name, type) {
      return logWarn(`The \`${name}\` ${type} is available only on elements that use the \`lwc:dom="manual"\` directive.`);
    }
    function patchElementWithRestrictions(elm, options) {
      assertNotProd(); // this method should never leak to prod
      const originalOuterHTMLDescriptor = getPropertyDescriptor(elm, 'outerHTML');
      const descriptors = {
        outerHTML: generateAccessorDescriptor({
          get() {
            return originalOuterHTMLDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set outerHTML on Element.`);
            return originalOuterHTMLDescriptor.set.call(this, value);
          }
        })
      };
      // Apply extra restriction related to DOM manipulation if the element is not a portal.
      if (!options.isLight && options.isSynthetic && !options.isPortal) {
        const {
          appendChild,
          insertBefore,
          removeChild,
          replaceChild
        } = elm;
        const originalNodeValueDescriptor = getPropertyDescriptor(elm, 'nodeValue');
        const originalInnerHTMLDescriptor = getPropertyDescriptor(elm, 'innerHTML');
        const originalTextContentDescriptor = getPropertyDescriptor(elm, 'textContent');
        assign(descriptors, {
          appendChild: generateDataDescriptor({
            value(aChild) {
              logMissingPortalWarn('appendChild', 'method');
              return appendChild.call(this, aChild);
            }
          }),
          insertBefore: generateDataDescriptor({
            value(newNode, referenceNode) {
              if (!isDomMutationAllowed) {
                logMissingPortalWarn('insertBefore', 'method');
              }
              return insertBefore.call(this, newNode, referenceNode);
            }
          }),
          removeChild: generateDataDescriptor({
            value(aChild) {
              if (!isDomMutationAllowed) {
                logMissingPortalWarn('removeChild', 'method');
              }
              return removeChild.call(this, aChild);
            }
          }),
          replaceChild: generateDataDescriptor({
            value(newChild, oldChild) {
              logMissingPortalWarn('replaceChild', 'method');
              return replaceChild.call(this, newChild, oldChild);
            }
          }),
          nodeValue: generateAccessorDescriptor({
            get() {
              return originalNodeValueDescriptor.get.call(this);
            },
            set(value) {
              if (!isDomMutationAllowed) {
                logMissingPortalWarn('nodeValue', 'property');
              }
              originalNodeValueDescriptor.set.call(this, value);
            }
          }),
          textContent: generateAccessorDescriptor({
            get() {
              return originalTextContentDescriptor.get.call(this);
            },
            set(value) {
              logMissingPortalWarn('textContent', 'property');
              originalTextContentDescriptor.set.call(this, value);
            }
          }),
          innerHTML: generateAccessorDescriptor({
            get() {
              return originalInnerHTMLDescriptor.get.call(this);
            },
            set(value) {
              logMissingPortalWarn('innerHTML', 'property');
              return originalInnerHTMLDescriptor.set.call(this, value);
            }
          })
        });
      }
      defineProperties(elm, descriptors);
    }
    function getShadowRootRestrictionsDescriptors(sr) {
      assertNotProd(); // this method should never leak to prod
      // Disallowing properties in dev mode only to avoid people doing the wrong
      // thing when using the real shadow root, because if that's the case,
      // the component will not work when running with synthetic shadow.
      const originalAddEventListener = sr.addEventListener;
      const originalInnerHTMLDescriptor = getPropertyDescriptor(sr, 'innerHTML');
      const originalTextContentDescriptor = getPropertyDescriptor(sr, 'textContent');
      return {
        innerHTML: generateAccessorDescriptor({
          get() {
            return originalInnerHTMLDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set innerHTML on ShadowRoot.`);
            return originalInnerHTMLDescriptor.set.call(this, value);
          }
        }),
        textContent: generateAccessorDescriptor({
          get() {
            return originalTextContentDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set textContent on ShadowRoot.`);
            return originalTextContentDescriptor.set.call(this, value);
          }
        }),
        addEventListener: generateDataDescriptor({
          value(type, listener, options) {
            // TODO [#1824]: Potentially relax this restriction
            if (!isUndefined$1(options)) {
              logError('The `addEventListener` method on ShadowRoot does not support any options.', getAssociatedVMIfPresent(this));
            }
            // Typescript does not like it when you treat the `arguments` object as an array
            // @ts-expect-error type-mismatch
            return originalAddEventListener.apply(this, arguments);
          }
        })
      };
    }
    // Custom Elements Restrictions:
    // -----------------------------
    function getCustomElementRestrictionsDescriptors(elm) {
      assertNotProd(); // this method should never leak to prod
      const originalAddEventListener = elm.addEventListener;
      const originalInnerHTMLDescriptor = getPropertyDescriptor(elm, 'innerHTML');
      const originalOuterHTMLDescriptor = getPropertyDescriptor(elm, 'outerHTML');
      const originalTextContentDescriptor = getPropertyDescriptor(elm, 'textContent');
      return {
        innerHTML: generateAccessorDescriptor({
          get() {
            return originalInnerHTMLDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set innerHTML on HTMLElement.`);
            return originalInnerHTMLDescriptor.set.call(this, value);
          }
        }),
        outerHTML: generateAccessorDescriptor({
          get() {
            return originalOuterHTMLDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set outerHTML on HTMLElement.`);
            return originalOuterHTMLDescriptor.set.call(this, value);
          }
        }),
        textContent: generateAccessorDescriptor({
          get() {
            return originalTextContentDescriptor.get.call(this);
          },
          set(value) {
            logError(`Invalid attempt to set textContent on HTMLElement.`);
            return originalTextContentDescriptor.set.call(this, value);
          }
        }),
        addEventListener: generateDataDescriptor({
          value(type, listener, options) {
            // TODO [#1824]: Potentially relax this restriction
            if (!isUndefined$1(options)) {
              logError('The `addEventListener` method in `LightningElement` does not support any options.', getAssociatedVMIfPresent(this));
            }
            // Typescript does not like it when you treat the `arguments` object as an array
            // @ts-expect-error type-mismatch
            return originalAddEventListener.apply(this, arguments);
          }
        })
      };
    }
    // This routine will prevent access to certain properties on a shadow root instance to guarantee
    // that all components will work fine in IE11 and other browsers without shadow dom support.
    function patchShadowRootWithRestrictions(sr) {
      defineProperties(sr, getShadowRootRestrictionsDescriptors(sr));
    }
    function patchCustomElementWithRestrictions(elm) {
      const restrictionsDescriptors = getCustomElementRestrictionsDescriptors(elm);
      const elmProto = getPrototypeOf$1(elm);
      setPrototypeOf(elm, create(elmProto, restrictionsDescriptors));
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function updateComponentValue(vm, key, newValue) {
      const {
        cmpFields
      } = vm;
      if (newValue !== cmpFields[key]) {
        cmpFields[key] = newValue;
        componentValueMutated(vm, key);
      }
    }

    /**
     * Copyright (C) 2017 salesforce.com, inc.
     */
    const {
      isArray
    } = Array;
    const {
      prototype: ObjectDotPrototype,
      getPrototypeOf,
      create: ObjectCreate,
      defineProperty: ObjectDefineProperty,
      isExtensible,
      getOwnPropertyDescriptor,
      getOwnPropertyNames,
      getOwnPropertySymbols,
      preventExtensions,
      hasOwnProperty
    } = Object;
    const {
      push: ArrayPush,
      concat: ArrayConcat
    } = Array.prototype;
    function isUndefined(obj) {
      return obj === undefined;
    }
    function isFunction(obj) {
      return typeof obj === 'function';
    }
    const proxyToValueMap = new WeakMap();
    function registerProxy(proxy, value) {
      proxyToValueMap.set(proxy, value);
    }
    const unwrap$1 = replicaOrAny => proxyToValueMap.get(replicaOrAny) || replicaOrAny;
    class BaseProxyHandler {
      constructor(membrane, value) {
        this.originalTarget = value;
        this.membrane = membrane;
      }
      // Shared utility methods
      wrapDescriptor(descriptor) {
        if (hasOwnProperty.call(descriptor, 'value')) {
          descriptor.value = this.wrapValue(descriptor.value);
        } else {
          const {
            set: originalSet,
            get: originalGet
          } = descriptor;
          if (!isUndefined(originalGet)) {
            descriptor.get = this.wrapGetter(originalGet);
          }
          if (!isUndefined(originalSet)) {
            descriptor.set = this.wrapSetter(originalSet);
          }
        }
        return descriptor;
      }
      copyDescriptorIntoShadowTarget(shadowTarget, key) {
        const {
          originalTarget
        } = this;
        // Note: a property might get defined multiple times in the shadowTarget
        //       but it will always be compatible with the previous descriptor
        //       to preserve the object invariants, which makes these lines safe.
        const originalDescriptor = getOwnPropertyDescriptor(originalTarget, key);
        // TODO: it should be impossible for the originalDescriptor to ever be undefined, this `if` can be removed
        /* istanbul ignore else */
        if (!isUndefined(originalDescriptor)) {
          const wrappedDesc = this.wrapDescriptor(originalDescriptor);
          ObjectDefineProperty(shadowTarget, key, wrappedDesc);
        }
      }
      lockShadowTarget(shadowTarget) {
        const {
          originalTarget
        } = this;
        const targetKeys = ArrayConcat.call(getOwnPropertyNames(originalTarget), getOwnPropertySymbols(originalTarget));
        targetKeys.forEach(key => {
          this.copyDescriptorIntoShadowTarget(shadowTarget, key);
        });
        const {
          membrane: {
            tagPropertyKey
          }
        } = this;
        if (!isUndefined(tagPropertyKey) && !hasOwnProperty.call(shadowTarget, tagPropertyKey)) {
          ObjectDefineProperty(shadowTarget, tagPropertyKey, ObjectCreate(null));
        }
        preventExtensions(shadowTarget);
      }
      // Shared Traps
      // TODO: apply() is never called
      /* istanbul ignore next */
      apply(shadowTarget, thisArg, argArray) {
        /* No op */
      }
      // TODO: construct() is never called
      /* istanbul ignore next */
      construct(shadowTarget, argArray, newTarget) {
        /* No op */
      }
      get(shadowTarget, key) {
        const {
          originalTarget,
          membrane: {
            valueObserved
          }
        } = this;
        const value = originalTarget[key];
        valueObserved(originalTarget, key);
        return this.wrapValue(value);
      }
      has(shadowTarget, key) {
        const {
          originalTarget,
          membrane: {
            tagPropertyKey,
            valueObserved
          }
        } = this;
        valueObserved(originalTarget, key);
        // since key is never going to be undefined, and tagPropertyKey might be undefined
        // we can simply compare them as the second part of the condition.
        return key in originalTarget || key === tagPropertyKey;
      }
      ownKeys(shadowTarget) {
        const {
          originalTarget,
          membrane: {
            tagPropertyKey
          }
        } = this;
        // if the membrane tag key exists and it is not in the original target, we add it to the keys.
        const keys = isUndefined(tagPropertyKey) || hasOwnProperty.call(originalTarget, tagPropertyKey) ? [] : [tagPropertyKey];
        // small perf optimization using push instead of concat to avoid creating an extra array
        ArrayPush.apply(keys, getOwnPropertyNames(originalTarget));
        ArrayPush.apply(keys, getOwnPropertySymbols(originalTarget));
        return keys;
      }
      isExtensible(shadowTarget) {
        const {
          originalTarget
        } = this;
        // optimization to avoid attempting to lock down the shadowTarget multiple times
        if (!isExtensible(shadowTarget)) {
          return false; // was already locked down
        }
        if (!isExtensible(originalTarget)) {
          this.lockShadowTarget(shadowTarget);
          return false;
        }
        return true;
      }
      getPrototypeOf(shadowTarget) {
        const {
          originalTarget
        } = this;
        return getPrototypeOf(originalTarget);
      }
      getOwnPropertyDescriptor(shadowTarget, key) {
        const {
          originalTarget,
          membrane: {
            valueObserved,
            tagPropertyKey
          }
        } = this;
        // keys looked up via getOwnPropertyDescriptor need to be reactive
        valueObserved(originalTarget, key);
        let desc = getOwnPropertyDescriptor(originalTarget, key);
        if (isUndefined(desc)) {
          if (key !== tagPropertyKey) {
            return undefined;
          }
          // if the key is the membrane tag key, and is not in the original target,
          // we produce a synthetic descriptor and install it on the shadow target
          desc = {
            value: undefined,
            writable: false,
            configurable: false,
            enumerable: false
          };
          ObjectDefineProperty(shadowTarget, tagPropertyKey, desc);
          return desc;
        }
        if (desc.configurable === false) {
          // updating the descriptor to non-configurable on the shadow
          this.copyDescriptorIntoShadowTarget(shadowTarget, key);
        }
        // Note: by accessing the descriptor, the key is marked as observed
        // but access to the value, setter or getter (if available) cannot observe
        // mutations, just like regular methods, in which case we just do nothing.
        return this.wrapDescriptor(desc);
      }
    }
    const getterMap$1 = new WeakMap();
    const setterMap$1 = new WeakMap();
    const reverseGetterMap = new WeakMap();
    const reverseSetterMap = new WeakMap();
    class ReactiveProxyHandler extends BaseProxyHandler {
      wrapValue(value) {
        return this.membrane.getProxy(value);
      }
      wrapGetter(originalGet) {
        const wrappedGetter = getterMap$1.get(originalGet);
        if (!isUndefined(wrappedGetter)) {
          return wrappedGetter;
        }
        const handler = this;
        const get = function () {
          // invoking the original getter with the original target
          return handler.wrapValue(originalGet.call(unwrap$1(this)));
        };
        getterMap$1.set(originalGet, get);
        reverseGetterMap.set(get, originalGet);
        return get;
      }
      wrapSetter(originalSet) {
        const wrappedSetter = setterMap$1.get(originalSet);
        if (!isUndefined(wrappedSetter)) {
          return wrappedSetter;
        }
        const set = function (v) {
          // invoking the original setter with the original target
          originalSet.call(unwrap$1(this), unwrap$1(v));
        };
        setterMap$1.set(originalSet, set);
        reverseSetterMap.set(set, originalSet);
        return set;
      }
      unwrapDescriptor(descriptor) {
        if (hasOwnProperty.call(descriptor, 'value')) {
          // dealing with a data descriptor
          descriptor.value = unwrap$1(descriptor.value);
        } else {
          const {
            set,
            get
          } = descriptor;
          if (!isUndefined(get)) {
            descriptor.get = this.unwrapGetter(get);
          }
          if (!isUndefined(set)) {
            descriptor.set = this.unwrapSetter(set);
          }
        }
        return descriptor;
      }
      unwrapGetter(redGet) {
        const reverseGetter = reverseGetterMap.get(redGet);
        if (!isUndefined(reverseGetter)) {
          return reverseGetter;
        }
        const handler = this;
        const get = function () {
          // invoking the red getter with the proxy of this
          return unwrap$1(redGet.call(handler.wrapValue(this)));
        };
        getterMap$1.set(get, redGet);
        reverseGetterMap.set(redGet, get);
        return get;
      }
      unwrapSetter(redSet) {
        const reverseSetter = reverseSetterMap.get(redSet);
        if (!isUndefined(reverseSetter)) {
          return reverseSetter;
        }
        const handler = this;
        const set = function (v) {
          // invoking the red setter with the proxy of this
          redSet.call(handler.wrapValue(this), handler.wrapValue(v));
        };
        setterMap$1.set(set, redSet);
        reverseSetterMap.set(redSet, set);
        return set;
      }
      set(shadowTarget, key, value) {
        const {
          originalTarget,
          membrane: {
            valueMutated
          }
        } = this;
        const oldValue = originalTarget[key];
        if (oldValue !== value) {
          originalTarget[key] = value;
          valueMutated(originalTarget, key);
        } else if (key === 'length' && isArray(originalTarget)) {
          // fix for issue #236: push will add the new index, and by the time length
          // is updated, the internal length is already equal to the new length value
          // therefore, the oldValue is equal to the value. This is the forking logic
          // to support this use case.
          valueMutated(originalTarget, key);
        }
        return true;
      }
      deleteProperty(shadowTarget, key) {
        const {
          originalTarget,
          membrane: {
            valueMutated
          }
        } = this;
        delete originalTarget[key];
        valueMutated(originalTarget, key);
        return true;
      }
      setPrototypeOf(shadowTarget, prototype) {}
      preventExtensions(shadowTarget) {
        if (isExtensible(shadowTarget)) {
          const {
            originalTarget
          } = this;
          preventExtensions(originalTarget);
          // if the originalTarget is a proxy itself, it might reject
          // the preventExtension call, in which case we should not attempt to lock down
          // the shadow target.
          // TODO: It should not actually be possible to reach this `if` statement.
          // If a proxy rejects extensions, then calling preventExtensions will throw an error:
          // https://codepen.io/nolanlawson-the-selector/pen/QWMOjbY
          /* istanbul ignore if */
          if (isExtensible(originalTarget)) {
            return false;
          }
          this.lockShadowTarget(shadowTarget);
        }
        return true;
      }
      defineProperty(shadowTarget, key, descriptor) {
        const {
          originalTarget,
          membrane: {
            valueMutated,
            tagPropertyKey
          }
        } = this;
        if (key === tagPropertyKey && !hasOwnProperty.call(originalTarget, key)) {
          // To avoid leaking the membrane tag property into the original target, we must
          // be sure that the original target doesn't have yet.
          // NOTE: we do not return false here because Object.freeze and equivalent operations
          // will attempt to set the descriptor to the same value, and expect no to throw. This
          // is an small compromise for the sake of not having to diff the descriptors.
          return true;
        }
        ObjectDefineProperty(originalTarget, key, this.unwrapDescriptor(descriptor));
        // intentionally testing if false since it could be undefined as well
        if (descriptor.configurable === false) {
          this.copyDescriptorIntoShadowTarget(shadowTarget, key);
        }
        valueMutated(originalTarget, key);
        return true;
      }
      /*LWC compiler v8.16.0*/
    }
    const getterMap = new WeakMap();
    const setterMap = new WeakMap();
    class ReadOnlyHandler extends BaseProxyHandler {
      wrapValue(value) {
        return this.membrane.getReadOnlyProxy(value);
      }
      wrapGetter(originalGet) {
        const wrappedGetter = getterMap.get(originalGet);
        if (!isUndefined(wrappedGetter)) {
          return wrappedGetter;
        }
        const handler = this;
        const get = function () {
          // invoking the original getter with the original target
          return handler.wrapValue(originalGet.call(unwrap$1(this)));
        };
        getterMap.set(originalGet, get);
        return get;
      }
      wrapSetter(originalSet) {
        const wrappedSetter = setterMap.get(originalSet);
        if (!isUndefined(wrappedSetter)) {
          return wrappedSetter;
        }
        const set = function (v) {};
        setterMap.set(originalSet, set);
        return set;
      }
      set(shadowTarget, key, value) {
        /* istanbul ignore next */
        return false;
      }
      deleteProperty(shadowTarget, key) {
        /* istanbul ignore next */
        return false;
      }
      setPrototypeOf(shadowTarget, prototype) {}
      preventExtensions(shadowTarget) {
        /* istanbul ignore next */
        return false;
      }
      defineProperty(shadowTarget, key, descriptor) {
        /* istanbul ignore next */
        return false;
      }
      /*LWC compiler v8.16.0*/
    }
    function defaultValueIsObservable(value) {
      // intentionally checking for null
      if (value === null) {
        return false;
      }
      // treat all non-object types, including undefined, as non-observable values
      if (typeof value !== 'object') {
        return false;
      }
      if (isArray(value)) {
        return true;
      }
      const proto = getPrototypeOf(value);
      return proto === ObjectDotPrototype || proto === null || getPrototypeOf(proto) === null;
    }
    const defaultValueObserved = (obj, key) => {
      /* do nothing */
    };
    const defaultValueMutated = (obj, key) => {
      /* do nothing */
    };
    function createShadowTarget(value) {
      return isArray(value) ? [] : {};
    }
    class ObservableMembrane {
      constructor(options = {}) {
        this.readOnlyObjectGraph = new WeakMap();
        this.reactiveObjectGraph = new WeakMap();
        const {
          valueMutated,
          valueObserved,
          valueIsObservable,
          tagPropertyKey
        } = options;
        this.valueMutated = isFunction(valueMutated) ? valueMutated : defaultValueMutated;
        this.valueObserved = isFunction(valueObserved) ? valueObserved : defaultValueObserved;
        this.valueIsObservable = isFunction(valueIsObservable) ? valueIsObservable : defaultValueIsObservable;
        this.tagPropertyKey = tagPropertyKey;
      }
      getProxy(value) {
        const unwrappedValue = unwrap$1(value);
        if (this.valueIsObservable(unwrappedValue)) {
          // When trying to extract the writable version of a readonly we return the readonly.
          if (this.readOnlyObjectGraph.get(unwrappedValue) === value) {
            return value;
          }
          return this.getReactiveHandler(unwrappedValue);
        }
        return unwrappedValue;
      }
      getReadOnlyProxy(value) {
        value = unwrap$1(value);
        if (this.valueIsObservable(value)) {
          return this.getReadOnlyHandler(value);
        }
        return value;
      }
      unwrapProxy(p) {
        return unwrap$1(p);
      }
      getReactiveHandler(value) {
        let proxy = this.reactiveObjectGraph.get(value);
        if (isUndefined(proxy)) {
          // caching the proxy after the first time it is accessed
          const handler = new ReactiveProxyHandler(this, value);
          proxy = new Proxy(createShadowTarget(value), handler);
          registerProxy(proxy, value);
          this.reactiveObjectGraph.set(value, proxy);
        }
        return proxy;
      }
      getReadOnlyHandler(value) {
        let proxy = this.readOnlyObjectGraph.get(value);
        if (isUndefined(proxy)) {
          // caching the proxy after the first time it is accessed
          const handler = new ReadOnlyHandler(this, value);
          proxy = new Proxy(createShadowTarget(value), handler);
          registerProxy(proxy, value);
          this.readOnlyObjectGraph.set(value, proxy);
        }
        return proxy;
      }
    }
    /** version: 2.0.0 */

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const lockerLivePropertyKey = Symbol.for('@@lockerLiveValue');
    const reactiveMembrane = new ObservableMembrane({
      valueObserved,
      valueMutated,
      tagPropertyKey: lockerLivePropertyKey
    });
    function getReadOnlyProxy(value) {
      // We must return a frozen wrapper around the value, so that child components cannot mutate properties passed to
      // them from their parents. This applies to both the client and server.
      return reactiveMembrane.getReadOnlyProxy(value);
    }
    function getReactiveProxy(value) {
      // On the server side, we don't need mutation tracking. Skipping it improves performance.
      return reactiveMembrane.getProxy(value);
    }
    // Making the component instance a live value when using Locker to support expandos.
    function markLockerLiveObject(obj) {
      // On the server side, we don't need mutation tracking. Skipping it improves performance.
      {
        obj[lockerLivePropertyKey] = undefined;
      }
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let globalStylesheet;
    function isStyleElement(elm) {
      return elm.tagName === 'STYLE';
    }
    async function fetchStylesheet(elm) {
      if (isStyleElement(elm)) {
        return elm.textContent;
      } else {
        // <link>
        const {
          href
        } = elm;
        try {
          return await (await fetch(href)).text();
        } catch (_err) {
          logWarnOnce(`Ignoring cross-origin stylesheet in migrate mode: ${href}`);
          // ignore errors with cross-origin stylesheets - nothing we can do for those
          return '';
        }
      }
    }
    function initGlobalStylesheet() {
      const stylesheet = new CSSStyleSheet();
      const elmsToPromises = new Map();
      let lastSeenLength = 0;
      const copyToGlobalStylesheet = () => {
        const elms = document.head.querySelectorAll('style:not([data-rendered-by-lwc]),link[rel="stylesheet"]');
        if (elms.length === lastSeenLength) {
          return; // nothing to update
        }
        lastSeenLength = elms.length;
        const promises = [...elms].map(elm => {
          let promise = elmsToPromises.get(elm);
          if (!promise) {
            // Cache the promise
            promise = fetchStylesheet(elm);
            elmsToPromises.set(elm, promise);
          }
          return promise;
        });
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.all(promises).then(stylesheetTexts => {
          // When replaceSync() is called, the entire contents of the constructable stylesheet are replaced
          // with the copied+concatenated styles. This means that any shadow root's adoptedStyleSheets that
          // contains this constructable stylesheet will immediately get the new styles.
          stylesheet.replaceSync(stylesheetTexts.join('\n'));
        });
      };
      const headObserver = new MutationObserver(copyToGlobalStylesheet);
      // By observing only the childList, note that we are not covering the case where someone changes an `href`
      // on an existing <link>`, or the textContent on an existing `<style>`. This is assumed to be an uncommon
      // case and not worth covering.
      headObserver.observe(document.head, {
        childList: true
      });
      copyToGlobalStylesheet();
      return stylesheet;
    }
    function applyShadowMigrateMode(shadowRoot) {
      if (!globalStylesheet) {
        globalStylesheet = initGlobalStylesheet();
      }
      shadowRoot.synthetic = true; // pretend to be synthetic mode
      shadowRoot.adoptedStyleSheets.push(globalStylesheet);
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * This module is responsible for producing the ComponentDef object that is always
     * accessible via `vm.def`. This is lazily created during the creation of the first
     * instance of a component class, and shared across all instances.
     *
     * This structure can be used to synthetically create proxies, and understand the
     * shape of a component. It is also used internally to apply extra optimizations.
     */
    /**
     * This operation is called with a descriptor of an standard html property
     * that a Custom Element can support (including AOM properties), which
     * determines what kind of capabilities the Base Lightning Element should support. When producing the new descriptors
     * for the Base Lightning Element, it also include the reactivity bit, so the standard property is reactive.
     * @param propName
     * @param descriptor
     */
    function createBridgeToElementDescriptor(propName, descriptor) {
      const {
        get,
        set,
        enumerable,
        configurable
      } = descriptor;
      if (!isFunction$1(get)) {
        throw new TypeError(`Detected invalid public property descriptor for HTMLElement.prototype.${propName} definition. Missing the standard getter.`);
      }
      if (!isFunction$1(set)) {
        throw new TypeError(`Detected invalid public property descriptor for HTMLElement.prototype.${propName} definition. Missing the standard setter.`);
      }
      return {
        enumerable,
        configurable,
        get() {
          const vm = getAssociatedVM(this);
          if (isBeingConstructed(vm)) {
            if (process.env.NODE_ENV !== 'production') {
              logError(`The value of property \`${propName}\` can't be read from the constructor because the owner component hasn't set the value yet. Instead, use the constructor to set a default value for the property.`, vm);
            }
            return;
          }
          componentValueObserved(vm, propName);
          return get.call(vm.elm);
        },
        set(newValue) {
          const vm = getAssociatedVM(this);
          if (process.env.NODE_ENV !== 'production') {
            const vmBeingRendered = getVMBeingRendered();
            if (isInvokingRender) {
              logError(`${vmBeingRendered}.render() method has side effects on the state of ${vm}.${propName}`);
            }
            if (isUpdatingTemplate) {
              logError(`When updating the template of ${vmBeingRendered}, one of the accessors used by the template has side effects on the state of ${vm}.${propName}`);
            }
            if (isBeingConstructed(vm)) {
              logError(`Failed to construct '${getComponentTag(vm)}': The result must not have attributes.`);
            }
            if (isObject(newValue) && !isNull(newValue)) {
              logError(`Invalid value "${newValue}" for "${propName}" of ${vm}. Value cannot be an object, must be a primitive value.`);
            }
          }
          updateComponentValue(vm, propName, newValue);
          return set.call(vm.elm, newValue);
        }
      };
    }
    const refsCache = new WeakMap();
    /**
     * This class is the base class for any LWC element.
     * Some elements directly extends this class, others implement it via inheritance.
     */
    // @ts-expect-error When exported, it will conform, but we need to build it first!
    const LightningElement = function () {
      // This should be as performant as possible, while any initialization should be done lazily
      if (isNull(vmBeingConstructed)) {
        // Thrown when doing something like `new LightningElement()` or
        // `class Foo extends LightningElement {}; new Foo()`
        throw new TypeError('Illegal constructor');
      }
      // This is a no-op unless Lightning DevTools are enabled.
      instrumentInstance(this, vmBeingConstructed);
      const vm = vmBeingConstructed;
      const {
        def,
        elm
      } = vm;
      const {
        bridge
      } = def;
      if (process.env.NODE_ENV !== 'production') {
        const {
          assertInstanceOfHTMLElement
        } = vm.renderer;
        assertInstanceOfHTMLElement(vm.elm, `Component creation requires a DOM element to be associated to ${vm}.`);
      }
      setPrototypeOf(elm, bridge.prototype);
      vm.component = this;
      // Locker hooks assignment. When the LWC engine run with Locker, Locker intercepts all the new
      // component creation and passes hooks to instrument all the component interactions with the
      // engine. We are intentionally hiding this argument from the formal API of LightningElement
      // because we don't want folks to know about it just yet.
      if (arguments.length === 1) {
        const {
          callHook,
          setHook,
          getHook
        } = arguments[0];
        vm.callHook = callHook;
        vm.setHook = setHook;
        vm.getHook = getHook;
      }
      markLockerLiveObject(this);
      // Linking elm, shadow root and component with the VM.
      associateVM(this, vm);
      associateVM(elm, vm);
      if (vm.renderMode === 1 /* RenderMode.Shadow */) {
        vm.renderRoot = doAttachShadow(vm);
      } else {
        vm.renderRoot = elm;
      }
      // Adding extra guard rails in DEV mode.
      if (process.env.NODE_ENV !== 'production') {
        patchCustomElementWithRestrictions(elm);
      }
      return this;
    };
    function doAttachShadow(vm) {
      const {
        elm,
        mode,
        shadowMode,
        def: {
          ctor
        },
        renderer: {
          attachShadow
        }
      } = vm;
      const shadowRoot = attachShadow(elm, {
        [KEY__SYNTHETIC_MODE]: shadowMode === 1 /* ShadowMode.Synthetic */,
        delegatesFocus: Boolean(ctor.delegatesFocus),
        mode
      });
      vm.shadowRoot = shadowRoot;
      associateVM(shadowRoot, vm);
      if (process.env.NODE_ENV !== 'production') {
        patchShadowRootWithRestrictions(shadowRoot);
      }
      if (lwcRuntimeFlags.ENABLE_FORCE_SHADOW_MIGRATE_MODE && vm.shadowMigrateMode) {
        applyShadowMigrateMode(shadowRoot);
      }
      return shadowRoot;
    }
    function warnIfInvokedDuringConstruction(vm, methodOrPropName) {
      if (isBeingConstructed(vm)) {
        logError(`this.${methodOrPropName} should not be called during the construction of the custom element for ${getComponentTag(vm)} because the element is not yet in the DOM or has no children yet.`);
      }
    }
    // Type assertion because we need to build the prototype before it satisfies the interface.
    LightningElement.prototype = {
      constructor: LightningElement,
      dispatchEvent(event) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            dispatchEvent
          }
        } = vm;
        return dispatchEvent(elm, event);
      },
      addEventListener(type, listener, options) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            addEventListener
          }
        } = vm;
        if (process.env.NODE_ENV !== 'production') {
          const vmBeingRendered = getVMBeingRendered();
          if (isInvokingRender) {
            logError(`${vmBeingRendered}.render() method has side effects on the state of ${vm} by adding an event listener for "${type}".`);
          }
          if (isUpdatingTemplate) {
            logError(`Updating the template of ${vmBeingRendered} has side effects on the state of ${vm} by adding an event listener for "${type}".`);
          }
          if (!isFunction$1(listener)) {
            logError(`Invalid second argument for this.addEventListener() in ${vm} for event "${type}". Expected an EventListener but received ${listener}.`);
          }
        }
        const wrappedListener = getWrappedComponentsListener(vm, listener);
        addEventListener(elm, type, wrappedListener, options);
      },
      removeEventListener(type, listener, options) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            removeEventListener
          }
        } = vm;
        const wrappedListener = getWrappedComponentsListener(vm, listener);
        removeEventListener(elm, type, wrappedListener, options);
      },
      hasAttribute(name) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            getAttribute
          }
        } = vm;
        return !isNull(getAttribute(elm, name));
      },
      hasAttributeNS(namespace, name) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            getAttribute
          }
        } = vm;
        return !isNull(getAttribute(elm, name, namespace));
      },
      removeAttribute(name) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            removeAttribute
          }
        } = vm;
        removeAttribute(elm, name);
      },
      removeAttributeNS(namespace, name) {
        const {
          elm,
          renderer: {
            removeAttribute
          }
        } = getAssociatedVM(this);
        removeAttribute(elm, name, namespace);
      },
      getAttribute(name) {
        const vm = getAssociatedVM(this);
        const {
          elm
        } = vm;
        const {
          getAttribute
        } = vm.renderer;
        return getAttribute(elm, name);
      },
      getAttributeNS(namespace, name) {
        const vm = getAssociatedVM(this);
        const {
          elm
        } = vm;
        const {
          getAttribute
        } = vm.renderer;
        return getAttribute(elm, name, namespace);
      },
      setAttribute(name, value) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            setAttribute
          }
        } = vm;
        if (process.env.NODE_ENV !== 'production') {
          if (isBeingConstructed(vm)) {
            logError(`Failed to construct '${getComponentTag(vm)}': The result must not have attributes.`);
          }
        }
        setAttribute(elm, name, value);
      },
      setAttributeNS(namespace, name, value) {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            setAttribute
          }
        } = vm;
        if (process.env.NODE_ENV !== 'production') {
          if (isBeingConstructed(vm)) {
            logError(`Failed to construct '${getComponentTag(vm)}': The result must not have attributes.`);
          }
        }
        setAttribute(elm, name, value, namespace);
      },
      getBoundingClientRect() {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            getBoundingClientRect
          }
        } = vm;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'getBoundingClientRect()');
        }
        return getBoundingClientRect(elm);
      },
      attachInternals() {
        const vm = getAssociatedVM(this);
        const {
          elm,
          apiVersion,
          renderer: {
            attachInternals
          }
        } = vm;
        if (!isAPIFeatureEnabled(7 /* APIFeature.ENABLE_ELEMENT_INTERNALS_AND_FACE */, apiVersion)) {
          throw new Error(`The attachInternals API is only supported in API version 61 and above. ` + `The current version is ${apiVersion}. ` + `To use this API, update the LWC component API version. https://lwc.dev/guide/versioning`);
        }
        if (vm.shadowMode === 1 /* ShadowMode.Synthetic */) {
          throw new Error('attachInternals API is not supported in synthetic shadow.');
        }
        return attachInternals(elm);
      },
      get isConnected() {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            isConnected
          }
        } = vm;
        return isConnected(elm);
      },
      get classList() {
        const vm = getAssociatedVM(this);
        const {
          elm,
          renderer: {
            getClassList
          }
        } = vm;
        if (process.env.NODE_ENV !== 'production') {
          if (isBeingConstructed(vm)) {
            logError(`Failed to construct ${vm}: The result must not have attributes. Adding or tampering with classname in constructor is not allowed in a web component, use connectedCallback() instead.`);
          }
        }
        return getClassList(elm);
      },
      get template() {
        const vm = getAssociatedVM(this);
        if (process.env.NODE_ENV !== 'production') {
          if (vm.renderMode === 0 /* RenderMode.Light */) {
            logError('`this.template` returns null for light DOM components. Since there is no shadow, the rendered content can be accessed via `this` itself. e.g. instead of `this.template.querySelector`, use `this.querySelector`.');
          }
        }
        return vm.shadowRoot;
      },
      get hostElement() {
        const vm = getAssociatedVM(this);
        const apiVersion = getComponentAPIVersion(vm.def.ctor);
        if (!isAPIFeatureEnabled(8 /* APIFeature.ENABLE_THIS_DOT_HOST_ELEMENT */, apiVersion)) {
          if (process.env.NODE_ENV !== 'production') {
            logWarnOnce('The `this.hostElement` API within LightningElement is ' + 'only supported in API version 62 and above. Increase the API version to use it.');
          }
          // Simulate the old behavior for `this.hostElement` to avoid a breaking change
          return undefined;
        }
        if (process.env.NODE_ENV !== 'production') {
          assert.isTrue(vm.elm instanceof Element, `this.hostElement should be an Element, found: ${vm.elm}`);
        }
        return vm.elm;
      },
      get refs() {
        const vm = getAssociatedVM(this);
        if (isUpdatingTemplate) {
          if (process.env.NODE_ENV !== 'production') {
            logError(`this.refs should not be called while ${getComponentTag(vm)} is rendering. Use this.refs only when the DOM is stable, e.g. in renderedCallback().`);
          }
          // If the template is in the process of being updated, then we don't want to go through the normal
          // process of returning the refs and caching them, because the state of the refs is unstable.
          // This can happen if e.g. a template contains `<div class={foo}></div>` and `foo` is computed
          // based on `this.refs.bar`.
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'refs');
        }
        const {
          refVNodes,
          cmpTemplate
        } = vm;
        // If the `cmpTemplate` is null, that means that the template has not been rendered yet. Most likely this occurs
        // if `this.refs` is called during the `connectedCallback` phase. The DOM elements have not been rendered yet,
        // so log a warning. Note we also check `isBeingConstructed()` to avoid a double warning (due to
        // `warnIfInvokedDuringConstruction` above).
        if (process.env.NODE_ENV !== 'production' && isNull(cmpTemplate) && !isBeingConstructed(vm)) {
          logError(`this.refs is undefined for ${getComponentTag(vm)}. This is either because the attached template has no "lwc:ref" directive, or this.refs was ` + `invoked before renderedCallback(). Use this.refs only when the referenced HTML elements have ` + `been rendered to the DOM, such as within renderedCallback() or disconnectedCallback().`);
        }
        // For backwards compatibility with component written before template refs
        // were introduced, we return undefined if the template has no refs defined
        // anywhere. This fixes components that may want to add an expando called `refs`
        // and are checking if it exists with `if (this.refs)`  before adding it.
        // Note we use a null refVNodes to indicate that the template has no refs defined.
        if (isNull(refVNodes)) {
          return;
        }
        // The refNodes can be cached based on the refVNodes, since the refVNodes
        // are recreated from scratch every time the template is rendered.
        // This happens with `vm.refVNodes = null` in `template.ts` in `@lwc/engine-core`.
        let refs = refsCache.get(refVNodes);
        if (isUndefined$1(refs)) {
          refs = create(null);
          for (const key of keys(refVNodes)) {
            refs[key] = refVNodes[key].elm;
          }
          freeze(refs);
          refsCache.set(refVNodes, refs);
        }
        return refs;
      },
      // For backwards compat, we allow component authors to set `refs` as an expando
      set refs(value) {
        defineProperty(this, 'refs', {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      },
      get shadowRoot() {
        // From within the component instance, the shadowRoot is always reported as "closed".
        // Authors should rely on this.template instead.
        return null;
      },
      get children() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'children');
        }
        return renderer.getChildren(vm.elm);
      },
      get childNodes() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'childNodes');
        }
        // getChildNodes returns a NodeList, which has `item(index: number): Node | null`.
        // NodeListOf<T> extends NodeList, but claims to not return null. That seems inaccurate,
        // but these are built-in types, so ultimately not our problem.
        return renderer.getChildNodes(vm.elm);
      },
      get firstChild() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'firstChild');
        }
        return renderer.getFirstChild(vm.elm);
      },
      get firstElementChild() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'firstElementChild');
        }
        return renderer.getFirstElementChild(vm.elm);
      },
      get lastChild() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'lastChild');
        }
        return renderer.getLastChild(vm.elm);
      },
      get lastElementChild() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'lastElementChild');
        }
        return renderer.getLastElementChild(vm.elm);
      },
      get ownerDocument() {
        const vm = getAssociatedVM(this);
        const renderer = vm.renderer;
        if (process.env.NODE_ENV !== 'production') {
          warnIfInvokedDuringConstruction(vm, 'ownerDocument');
        }
        return renderer.ownerDocument(vm.elm);
      },
      get tagName() {
        const {
          elm,
          renderer
        } = getAssociatedVM(this);
        return renderer.getTagName(elm);
      },
      get style() {
        const {
          elm,
          renderer,
          def
        } = getAssociatedVM(this);
        const apiVersion = getComponentAPIVersion(def.ctor);
        if (!isAPIFeatureEnabled(9 /* APIFeature.ENABLE_THIS_DOT_STYLE */, apiVersion)) {
          if (process.env.NODE_ENV !== 'production') {
            logWarnOnce('The `this.style` API within LightningElement returning the CSSStyleDeclaration is ' + 'only supported in API version 62 and above. Increase the API version to use it.');
          }
          // Simulate the old behavior for `this.style` to avoid a breaking change
          return undefined;
        }
        return renderer.getStyle(elm);
      },
      render() {
        const vm = getAssociatedVM(this);
        return vm.def.template;
      },
      toString() {
        const vm = getAssociatedVM(this);
        return `[object ${vm.def.name}]`;
      }
    };
    const queryAndChildGetterDescriptors = create(null);
    const queryMethods = ['getElementsByClassName', 'getElementsByTagName', 'querySelector', 'querySelectorAll'];
    // Generic passthrough for query APIs on HTMLElement to the relevant Renderer APIs
    for (const queryMethod of queryMethods) {
      queryAndChildGetterDescriptors[queryMethod] = {
        value(arg) {
          const vm = getAssociatedVM(this);
          const {
            elm,
            renderer
          } = vm;
          if (process.env.NODE_ENV !== 'production') {
            warnIfInvokedDuringConstruction(vm, `${queryMethod}()`);
          }
          return renderer[queryMethod](elm, arg);
        },
        configurable: true,
        enumerable: true,
        writable: true
      };
    }
    defineProperties(LightningElement.prototype, queryAndChildGetterDescriptors);
    const lightningBasedDescriptors = create(null);
    for (const propName in HTMLElementOriginalDescriptors) {
      lightningBasedDescriptors[propName] = createBridgeToElementDescriptor(propName, HTMLElementOriginalDescriptors[propName]);
    }
    // Apply ARIA reflection to LightningElement.prototype, on both the browser and server.
    // This allows `this.aria*` property accessors to work from inside a component, and to reflect `aria-*` attrs.
    // Note this works regardless of whether the global ARIA reflection polyfill is applied or not.
    {
      // In the browser, we use createBridgeToElementDescriptor, so we can get the normal reactivity lifecycle for
      // aria* properties
      for (const [propName, descriptor] of entries(ariaReflectionPolyfillDescriptors)) {
        lightningBasedDescriptors[propName] = createBridgeToElementDescriptor(propName, descriptor);
      }
    }
    defineProperties(LightningElement.prototype, lightningBasedDescriptors);
    defineProperty(LightningElement, 'CustomElementConstructor', {
      get() {
        // If required, a runtime-specific implementation must be defined.
        throw new ReferenceError('The current runtime does not support CustomElementConstructor.');
      },
      configurable: true
    });

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function createObservedFieldPropertyDescriptor(key) {
      return {
        get() {
          const vm = getAssociatedVM(this);
          const val = vm.cmpFields[key];
          componentValueObserved(vm, key, val);
          return val;
        },
        set(newValue) {
          const vm = getAssociatedVM(this);
          updateComponentValue(vm, key, newValue);
        },
        enumerable: true,
        configurable: true
      };
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const AdapterToTokenMap = new Map();
    function createContextWatcher(vm, wireDef, callbackWhenContextIsReady) {
      const {
        adapter
      } = wireDef;
      const adapterContextToken = AdapterToTokenMap.get(adapter);
      if (isUndefined$1(adapterContextToken)) {
        return; // no provider found, nothing to be done
      }
      const {
        elm,
        context: {
          wiredConnecting,
          wiredDisconnecting
        },
        renderer: {
          registerContextConsumer
        }
      } = vm;
      // waiting for the component to be connected to formally request the context via the token
      ArrayPush$1.call(wiredConnecting, () => {
        // This will attempt to connect the current element with one of its anscestors
        // that can provide context for the given wire adapter. This relationship is
        // keyed on the secret & internal value of `adapterContextToken`, which is unique
        // to a given wire adapter.
        //
        // Depending on the runtime environment, this connection is made using either DOM
        // events (in the browser) or a custom traversal (on the server).
        registerContextConsumer(elm, adapterContextToken, {
          setNewContext(newContext) {
            // eslint-disable-next-line @lwc/lwc-internal/no-invalid-todo
            // TODO: dev-mode validation of config based on the adapter.contextSchema
            callbackWhenContextIsReady(newContext);
          },
          setDisconnectedCallback(disconnectCallback) {
            // adds this callback into the disconnect bucket so it gets disconnected from parent
            // the the element hosting the wire is disconnected
            ArrayPush$1.call(wiredDisconnecting, disconnectCallback);
          }
        });
      });
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const DeprecatedWiredElementHost = '$$DeprecatedWiredElementHostKey$$';
    const DeprecatedWiredParamsMeta = '$$DeprecatedWiredParamsMetaKey$$';
    const WIRE_DEBUG_ENTRY = '@wire';
    const WireMetaMap = new Map();
    function createFieldDataCallback(vm, name) {
      return value => {
        updateComponentValue(vm, name, value);
      };
    }
    function createMethodDataCallback(vm, method) {
      return value => {
        // dispatching new value into the wired method
        runWithBoundaryProtection(vm, vm.owner, noop, () => {
          // job
          method.call(vm.component, value);
        }, noop);
      };
    }
    function createConfigWatcher(component, configCallback, callbackWhenConfigIsReady) {
      let hasPendingConfig = false;
      // creating the reactive observer for reactive params when needed
      const ro = createReactiveObserver(() => {
        if (hasPendingConfig === false) {
          hasPendingConfig = true;
          // collect new config in the micro-task
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          Promise.resolve().then(() => {
            hasPendingConfig = false;
            // resetting current reactive params
            ro.reset();
            // dispatching a new config due to a change in the configuration
            computeConfigAndUpdate();
          });
        }
      });
      if (process.env.NODE_ENV !== 'production') {
        associateReactiveObserverWithVM(ro, getAssociatedVM(component));
      }
      const computeConfigAndUpdate = () => {
        let config;
        ro.observe(() => config = configCallback(component));
        // eslint-disable-next-line @lwc/lwc-internal/no-invalid-todo
        // TODO: dev-mode validation of config based on the adapter.configSchema
        // @ts-expect-error it is assigned in the observe() callback
        callbackWhenConfigIsReady(config);
      };
      return {
        computeConfigAndUpdate,
        ro
      };
    }
    function createConnector(vm, name, wireDef) {
      const {
        method,
        adapter,
        configCallback,
        dynamic
      } = wireDef;
      let debugInfo;
      if (process.env.NODE_ENV !== 'production') {
        const wiredPropOrMethod = isUndefined$1(method) ? name : method.name;
        debugInfo = create(null);
        debugInfo.wasDataProvisionedForConfig = false;
        vm.debugInfo[WIRE_DEBUG_ENTRY][wiredPropOrMethod] = debugInfo;
      }
      const fieldOrMethodCallback = isUndefined$1(method) ? createFieldDataCallback(vm, name) : createMethodDataCallback(vm, method);
      const dataCallback = value => {
        if (process.env.NODE_ENV !== 'production') {
          debugInfo.data = value;
          // Note: most of the time, the data provided is for the current config, but there may be
          // some conditions in which it does not, ex:
          // race conditions in a poor network while the adapter does not cancel a previous request.
          debugInfo.wasDataProvisionedForConfig = true;
        }
        fieldOrMethodCallback(value);
      };
      let context;
      let connector;
      // Workaround to pass the component element associated to this wire adapter instance.
      defineProperty(dataCallback, DeprecatedWiredElementHost, {
        value: vm.elm
      });
      defineProperty(dataCallback, DeprecatedWiredParamsMeta, {
        value: dynamic
      });
      runWithBoundaryProtection(vm, vm, noop, () => {
        // job
        connector = new adapter(dataCallback, {
          tagName: vm.tagName
        });
      }, noop);
      const updateConnectorConfig = config => {
        // every time the config is recomputed due to tracking,
        // this callback will be invoked with the new computed config
        runWithBoundaryProtection(vm, vm, noop, () => {
          // job
          if (process.env.NODE_ENV !== 'production') {
            debugInfo.config = config;
            debugInfo.context = context;
            debugInfo.wasDataProvisionedForConfig = false;
          }
          connector.update(config, context);
        }, noop);
      };
      // Computes the current wire config and calls the update method on the wire adapter.
      // If it has params, we will need to observe changes in the next tick.
      const {
        computeConfigAndUpdate,
        ro
      } = createConfigWatcher(vm.component, configCallback, updateConnectorConfig);
      // if the adapter needs contextualization, we need to watch for new context and push it alongside the config
      if (!isUndefined$1(adapter.contextSchema)) {
        createContextWatcher(vm, wireDef, newContext => {
          // every time the context is pushed into this component,
          // this callback will be invoked with the new computed context
          if (context !== newContext) {
            context = newContext;
            // Note: when new context arrives, the config will be recomputed and pushed along side the new
            // context, this is to preserve the identity characteristics, config should not have identity
            // (ever), while context can have identity
            if (vm.state === 1 /* VMState.connected */) {
              computeConfigAndUpdate();
            }
          }
        });
      }
      return {
        // @ts-expect-error the boundary protection executes sync, connector is always defined
        connector,
        computeConfigAndUpdate,
        resetConfigWatcher: () => ro.reset()
      };
    }
    function storeWiredMethodMeta(descriptor, adapter, configCallback, dynamic) {
      // support for callable adapters
      if (adapter.adapter) {
        adapter = adapter.adapter;
      }
      const method = descriptor.value;
      const def = {
        adapter,
        method,
        configCallback,
        dynamic
      };
      WireMetaMap.set(descriptor, def);
    }
    function storeWiredFieldMeta(descriptor, adapter, configCallback, dynamic) {
      // support for callable adapters
      if (adapter.adapter) {
        adapter = adapter.adapter;
      }
      const def = {
        adapter,
        configCallback,
        dynamic
      };
      WireMetaMap.set(descriptor, def);
    }
    function installWireAdapters(vm) {
      const {
        context,
        def: {
          wire
        }
      } = vm;
      if (process.env.NODE_ENV !== 'production') {
        vm.debugInfo[WIRE_DEBUG_ENTRY] = create(null);
      }
      const wiredConnecting = context.wiredConnecting = [];
      const wiredDisconnecting = context.wiredDisconnecting = [];
      for (const fieldNameOrMethod in wire) {
        const descriptor = wire[fieldNameOrMethod];
        const wireDef = WireMetaMap.get(descriptor);
        if (process.env.NODE_ENV !== 'production') {
          assert.invariant(wireDef, `Internal Error: invalid wire definition found.`);
        }
        if (!isUndefined$1(wireDef)) {
          const {
            connector,
            computeConfigAndUpdate,
            resetConfigWatcher
          } = createConnector(vm, fieldNameOrMethod, wireDef);
          const hasDynamicParams = wireDef.dynamic.length > 0;
          ArrayPush$1.call(wiredConnecting, () => {
            connector.connect();
            if (!lwcRuntimeFlags.ENABLE_WIRE_SYNC_EMIT) {
              if (hasDynamicParams) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                Promise.resolve().then(computeConfigAndUpdate);
                return;
              }
            }
            computeConfigAndUpdate();
          });
          ArrayPush$1.call(wiredDisconnecting, () => {
            connector.disconnect();
            resetConfigWatcher();
          });
        }
      }
    }
    function connectWireAdapters(vm) {
      const {
        wiredConnecting
      } = vm.context;
      for (let i = 0, len = wiredConnecting.length; i < len; i += 1) {
        wiredConnecting[i]();
      }
    }
    function disconnectWireAdapters(vm) {
      const {
        wiredDisconnecting
      } = vm.context;
      runWithBoundaryProtection(vm, vm, noop, () => {
        // job
        for (let i = 0, len = wiredDisconnecting.length; i < len; i += 1) {
          wiredDisconnecting[i]();
        }
      }, noop);
    }
    function createPublicPropertyDescriptor(key) {
      return {
        get() {
          const vm = getAssociatedVM(this);
          if (isBeingConstructed(vm)) {
            if (process.env.NODE_ENV !== 'production') {
              logError(`Can’t read the value of property \`${toString(key)}\` from the constructor because the owner component hasn’t set the value yet. Instead, use the constructor to set a default value for the property.`, vm);
            }
            return;
          }
          const val = vm.cmpProps[key];
          componentValueObserved(vm, key, val);
          return val;
        },
        set(newValue) {
          const vm = getAssociatedVM(this);
          if (process.env.NODE_ENV !== 'production') {
            const vmBeingRendered = getVMBeingRendered();
            if (isInvokingRender) {
              logError(`render() method has side effects on the state of property "${toString(key)}"`, isNull(vmBeingRendered) ? vm : vmBeingRendered);
            }
            if (isUpdatingTemplate) {
              logError(`Updating the template has side effects on the state of property "${toString(key)}"`, isNull(vmBeingRendered) ? vm : vmBeingRendered);
            }
          }
          vm.cmpProps[key] = newValue;
          componentValueMutated(vm, key);
        },
        enumerable: true,
        configurable: true
      };
    }
    function createPublicAccessorDescriptor(key, descriptor) {
      const {
        get,
        set,
        enumerable,
        configurable
      } = descriptor;
      assert.invariant(isFunction$1(get), `Invalid public accessor ${toString(key)} decorated with @api. The property is missing a getter.`);
      return {
        get() {
          if (process.env.NODE_ENV !== 'production') {
            // Assert that the this value is an actual Component with an associated VM.
            getAssociatedVM(this);
          }
          return get.call(this);
        },
        set(newValue) {
          const vm = getAssociatedVM(this);
          if (process.env.NODE_ENV !== 'production') {
            const vmBeingRendered = getVMBeingRendered();
            if (isInvokingRender) {
              logError(`render() method has side effects on the state of property "${toString(key)}"`, isNull(vmBeingRendered) ? vm : vmBeingRendered);
            }
            if (isUpdatingTemplate) {
              logError(`Updating the template has side effects on the state of property "${toString(key)}"`, isNull(vmBeingRendered) ? vm : vmBeingRendered);
            }
          }
          if (set) {
            set.call(this, newValue);
          } else if (process.env.NODE_ENV !== 'production') {
            logError(`Invalid attempt to set a new value for property "${toString(key)}" that does not has a setter decorated with @api.`, vm);
          }
        },
        enumerable,
        configurable
      };
    }
    function internalTrackDecorator(key) {
      return {
        get() {
          const vm = getAssociatedVM(this);
          const val = vm.cmpFields[key];
          componentValueObserved(vm, key, val);
          return val;
        },
        set(newValue) {
          const vm = getAssociatedVM(this);
          if (process.env.NODE_ENV !== 'production') {
            const vmBeingRendered = getVMBeingRendered();
            if (isInvokingRender) {
              logError(`${vmBeingRendered}.render() method has side effects on the state of ${vm}.${toString(key)}`);
            }
            if (isUpdatingTemplate) {
              logError(`Updating the template of ${vmBeingRendered} has side effects on the state of ${vm}.${toString(key)}`);
            }
          }
          const reactiveOrAnyValue = getReactiveProxy(newValue);
          if (process.env.NODE_ENV !== 'production') {
            trackTargetForMutationLogging(key, newValue);
          }
          updateComponentValue(vm, key, reactiveOrAnyValue);
        },
        enumerable: true,
        configurable: true
      };
    }
    function internalWireFieldDecorator(key) {
      return {
        get() {
          const vm = getAssociatedVM(this);
          componentValueObserved(vm, key);
          return vm.cmpFields[key];
        },
        set(value) {
          const vm = getAssociatedVM(this);
          /**
           * Reactivity for wired fields is provided in wiring.
           * We intentionally add reactivity here since this is just
           * letting the author to do the wrong thing, but it will keep our
           * system to be backward compatible.
           */
          updateComponentValue(vm, key, value);
        },
        enumerable: true,
        configurable: true
      };
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function getClassDescriptorType(descriptor) {
      if (isFunction$1(descriptor.value)) {
        return 'method';
      } else if (isFunction$1(descriptor.set) || isFunction$1(descriptor.get)) {
        return 'accessor';
      } else {
        return 'field';
      }
    }
    function validateObservedField(Ctor, fieldName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (!isUndefined$1(descriptor)) {
        const type = getClassDescriptorType(descriptor);
        const message = `Invalid observed ${fieldName} field. Found a duplicate ${type} with the same name.`;
        // TODO [#3408]: this should throw, not log
        logError(message);
      }
    }
    function validateFieldDecoratedWithTrack(Ctor, fieldName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (!isUndefined$1(descriptor)) {
        const type = getClassDescriptorType(descriptor);
        // TODO [#3408]: this should throw, not log
        logError(`Invalid @track ${fieldName} field. Found a duplicate ${type} with the same name.`);
      }
    }
    function validateFieldDecoratedWithWire(Ctor, fieldName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (!isUndefined$1(descriptor)) {
        const type = getClassDescriptorType(descriptor);
        // TODO [#3408]: this should throw, not log
        logError(`Invalid @wire ${fieldName} field. Found a duplicate ${type} with the same name.`);
      }
    }
    function validateMethodDecoratedWithWire(Ctor, methodName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (isUndefined$1(descriptor) || !isFunction$1(descriptor.value) || isFalse(descriptor.writable)) {
        // TODO [#3441]: This line of code does not seem possible to reach.
        logError(`Invalid @wire ${methodName} field. The field should have a valid writable descriptor.`);
      }
    }
    function validateFieldDecoratedWithApi(Ctor, fieldName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (!isUndefined$1(descriptor)) {
        const type = getClassDescriptorType(descriptor);
        const message = `Invalid @api ${fieldName} field. Found a duplicate ${type} with the same name.`;
        // TODO [#3408]: this should throw, not log
        logError(message);
      }
    }
    function validateAccessorDecoratedWithApi(Ctor, fieldName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (isFunction$1(descriptor.set)) {
        if (!isFunction$1(descriptor.get)) {
          // TODO [#3441]: This line of code does not seem possible to reach.
          logError(`Missing getter for property ${fieldName} decorated with @api in ${Ctor}. You cannot have a setter without the corresponding getter.`);
        }
      } else if (!isFunction$1(descriptor.get)) {
        // TODO [#3441]: This line of code does not seem possible to reach.
        logError(`Missing @api get ${fieldName} accessor.`);
      }
    }
    function validateMethodDecoratedWithApi(Ctor, methodName, descriptor) {
      assertNotProd(); // this method should never leak to prod
      if (isUndefined$1(descriptor) || !isFunction$1(descriptor.value) || isFalse(descriptor.writable)) {
        // TODO [#3441]: This line of code does not seem possible to reach.
        logError(`Invalid @api ${methodName} method.`);
      }
    }
    /**
     * INTERNAL: This function can only be invoked by compiled code. The compiler
     * will prevent this function from being imported by user-land code.
     * @param Ctor
     * @param meta
     */
    function registerDecorators(Ctor, meta) {
      const proto = Ctor.prototype;
      const {
        publicProps,
        publicMethods,
        wire,
        track,
        fields
      } = meta;
      const apiMethods = create(null);
      const apiFields = create(null);
      const wiredMethods = create(null);
      const wiredFields = create(null);
      const observedFields = create(null);
      const apiFieldsConfig = create(null);
      let descriptor;
      if (!isUndefined$1(publicProps)) {
        for (const fieldName in publicProps) {
          const propConfig = publicProps[fieldName];
          apiFieldsConfig[fieldName] = propConfig.config;
          descriptor = getOwnPropertyDescriptor$1(proto, fieldName);
          if (propConfig.config > 0) {
            if (isUndefined$1(descriptor)) {
              // TODO [#3441]: This line of code does not seem possible to reach.
              throw new Error();
            }
            // accessor declaration
            if (process.env.NODE_ENV !== 'production') {
              validateAccessorDecoratedWithApi(Ctor, fieldName, descriptor);
            }
            descriptor = createPublicAccessorDescriptor(fieldName, descriptor);
          } else {
            // field declaration
            if (process.env.NODE_ENV !== 'production') {
              validateFieldDecoratedWithApi(Ctor, fieldName, descriptor);
            }
            // [W-9927596] If a component has both a public property and a private setter/getter
            // with the same name, the property is defined as a public accessor. This branch is
            // only here for backward compatibility reasons.
            if (!isUndefined$1(descriptor) && !isUndefined$1(descriptor.get)) {
              descriptor = createPublicAccessorDescriptor(fieldName, descriptor);
            } else {
              descriptor = createPublicPropertyDescriptor(fieldName);
            }
          }
          apiFields[fieldName] = descriptor;
          defineProperty(proto, fieldName, descriptor);
        }
      }
      if (!isUndefined$1(publicMethods)) {
        forEach.call(publicMethods, methodName => {
          descriptor = getOwnPropertyDescriptor$1(proto, methodName);
          if (process.env.NODE_ENV !== 'production') {
            validateMethodDecoratedWithApi(Ctor, methodName, descriptor);
          }
          if (isUndefined$1(descriptor)) {
            throw new Error();
          }
          apiMethods[methodName] = descriptor;
        });
      }
      if (!isUndefined$1(wire)) {
        for (const fieldOrMethodName in wire) {
          const {
            adapter,
            method,
            config: configCallback,
            dynamic = []
          } = wire[fieldOrMethodName];
          descriptor = getOwnPropertyDescriptor$1(proto, fieldOrMethodName);
          if (method === 1) {
            if (process.env.NODE_ENV !== 'production') {
              if (!adapter) {
                // TODO [#3408]: this should throw, not log
                logError(`@wire on method "${fieldOrMethodName}": adapter id must be truthy.`);
              }
              validateMethodDecoratedWithWire(Ctor, fieldOrMethodName, descriptor);
            }
            if (isUndefined$1(descriptor)) {
              throw new Error();
            }
            wiredMethods[fieldOrMethodName] = descriptor;
            storeWiredMethodMeta(descriptor, adapter, configCallback, dynamic);
          } else {
            if (process.env.NODE_ENV !== 'production') {
              if (!adapter) {
                // TODO [#3408]: this should throw, not log
                logError(`@wire on field "${fieldOrMethodName}": adapter id must be truthy.`);
              }
              validateFieldDecoratedWithWire(Ctor, fieldOrMethodName, descriptor);
            }
            descriptor = internalWireFieldDecorator(fieldOrMethodName);
            wiredFields[fieldOrMethodName] = descriptor;
            storeWiredFieldMeta(descriptor, adapter, configCallback, dynamic);
            defineProperty(proto, fieldOrMethodName, descriptor);
          }
        }
      }
      if (!isUndefined$1(track)) {
        for (const fieldName in track) {
          descriptor = getOwnPropertyDescriptor$1(proto, fieldName);
          if (process.env.NODE_ENV !== 'production') {
            validateFieldDecoratedWithTrack(Ctor, fieldName, descriptor);
          }
          descriptor = internalTrackDecorator(fieldName);
          defineProperty(proto, fieldName, descriptor);
        }
      }
      if (!isUndefined$1(fields)) {
        for (let i = 0, n = fields.length; i < n; i++) {
          const fieldName = fields[i];
          descriptor = getOwnPropertyDescriptor$1(proto, fieldName);
          if (process.env.NODE_ENV !== 'production') {
            validateObservedField(Ctor, fieldName, descriptor);
          }
          // [W-9927596] Only mark a field as observed whenever it isn't a duplicated public nor
          // tracked property. This is only here for backward compatibility purposes.
          const isDuplicatePublicProp = !isUndefined$1(publicProps) && fieldName in publicProps;
          const isDuplicateTrackedProp = !isUndefined$1(track) && fieldName in track;
          if (!isDuplicatePublicProp && !isDuplicateTrackedProp) {
            observedFields[fieldName] = createObservedFieldPropertyDescriptor(fieldName);
          }
        }
      }
      setDecoratorsMeta(Ctor, {
        apiMethods,
        apiFields,
        apiFieldsConfig,
        wiredMethods,
        wiredFields,
        observedFields
      });
      return Ctor;
    }
    const signedDecoratorToMetaMap = new Map();
    function setDecoratorsMeta(Ctor, meta) {
      signedDecoratorToMetaMap.set(Ctor, meta);
    }
    const defaultMeta = {
      apiMethods: EmptyObject,
      apiFields: EmptyObject,
      apiFieldsConfig: EmptyObject,
      wiredMethods: EmptyObject,
      wiredFields: EmptyObject,
      observedFields: EmptyObject
    };
    function getDecoratorsMeta(Ctor) {
      const meta = signedDecoratorToMetaMap.get(Ctor);
      return isUndefined$1(meta) ? defaultMeta : meta;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let warned = false;
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      window.__lwcResetWarnedOnVersionMismatch = () => {
        warned = false;
      };
    }
    function checkVersionMismatch(func, type) {
      const versionMatcher = func.toString().match(LWC_VERSION_COMMENT_REGEX);
      if (!isNull(versionMatcher) && !warned) {
        if (typeof process === 'object' && process.env.SKIP_LWC_VERSION_MISMATCH_CHECK === 'true') {
          warned = true; // skip printing out version mismatch errors when env var is set
          return;
        }
        const version = versionMatcher[1];
        if (version !== LWC_VERSION) {
          warned = true; // only warn once to avoid flooding the console
          // stylesheets and templates do not have user-meaningful names, but components do
          const friendlyName = type === 'component' ? `${type} ${func.name}` : type;
          logError(`LWC WARNING: current engine is v${LWC_VERSION}, but ${friendlyName} was compiled with v${version}.\nPlease update your compiled code or LWC engine so that the versions match.\nNo further warnings will appear.`);
        }
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const signedTemplateSet = new Set();
    function defaultEmptyTemplate() {
      return [];
    }
    signedTemplateSet.add(defaultEmptyTemplate);
    function isTemplateRegistered(tpl) {
      return signedTemplateSet.has(tpl);
    }
    /**
     * INTERNAL: This function can only be invoked by compiled code. The compiler
     * will prevent this function from being imported by userland code.
     * @param tpl
     */
    function registerTemplate(tpl) {
      if (process.env.NODE_ENV !== 'production') {
        checkVersionMismatch(tpl, 'template');
      }
      signedTemplateSet.add(tpl);
      // chaining this method as a way to wrap existing
      // assignment of templates easily, without too much transformation
      return tpl;
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * This module is responsible for creating the base bridge class BaseBridgeElement
     * that represents the HTMLElement extension used for any LWC inserted in the DOM.
     */
    // A bridge descriptor is a descriptor whose job is just to get the component instance
    // from the element instance, and get the value or set a new value on the component.
    // This means that across different elements, similar names can get the exact same
    // descriptor, so we can cache them:
    const cachedGetterByKey = create(null);
    const cachedSetterByKey = create(null);
    function createGetter(key) {
      let fn = cachedGetterByKey[key];
      if (isUndefined$1(fn)) {
        fn = cachedGetterByKey[key] = function () {
          const vm = getAssociatedVM(this);
          const {
            getHook
          } = vm;
          return getHook(vm.component, key);
        };
      }
      return fn;
    }
    function createSetter(key) {
      let fn = cachedSetterByKey[key];
      if (isUndefined$1(fn)) {
        fn = cachedSetterByKey[key] = function (newValue) {
          const vm = getAssociatedVM(this);
          const {
            setHook
          } = vm;
          newValue = getReadOnlyProxy(newValue);
          setHook(vm.component, key, newValue);
        };
      }
      return fn;
    }
    function createMethodCaller(methodName) {
      return function () {
        const vm = getAssociatedVM(this);
        const {
          callHook,
          component
        } = vm;
        const fn = component[methodName];
        return callHook(vm.component, fn, ArraySlice.call(arguments));
      };
    }
    function createAttributeChangedCallback(attributeToPropMap, superAttributeChangedCallback) {
      return function attributeChangedCallback(attrName, oldValue, newValue) {
        if (oldValue === newValue) {
          // Ignore same values.
          return;
        }
        const propName = attributeToPropMap[attrName];
        if (isUndefined$1(propName)) {
          if (!isUndefined$1(superAttributeChangedCallback)) {
            // delegate unknown attributes to the super.
            // Typescript does not like it when you treat the `arguments` object as an array
            // @ts-expect-error type-mismatch
            superAttributeChangedCallback.apply(this, arguments);
          }
          return;
        }
        // Reflect attribute change to the corresponding property when changed from outside.
        this[propName] = newValue;
      };
    }
    function createAccessorThatWarns(propName) {
      let prop;
      return {
        get() {
          logWarn(`The property "${propName}" is not publicly accessible. Add the @api annotation to the property declaration or getter/setter in the component to make it accessible.`);
          return prop;
        },
        set(value) {
          logWarn(`The property "${propName}" is not publicly accessible. Add the @api annotation to the property declaration or getter/setter in the component to make it accessible.`);
          prop = value;
        },
        enumerable: true,
        configurable: true
      };
    }
    function HTMLBridgeElementFactory(SuperClass, publicProperties, methods, observedFields, proto, hasCustomSuperClass) {
      const HTMLBridgeElement = class extends SuperClass {
        /*LWC compiler v8.16.0*/
      };
      // generating the hash table for attributes to avoid duplicate fields and facilitate validation
      // and false positives in case of inheritance.
      const attributeToPropMap = create(null);
      const {
        attributeChangedCallback: superAttributeChangedCallback
      } = SuperClass.prototype;
      const {
        observedAttributes: superObservedAttributes = []
      } = SuperClass;
      const descriptors = create(null);
      // present a hint message so that developers are aware that they have not decorated property with @api
      // Note that we also don't do this in SSR because we cannot sniff for what props are declared on
      // HTMLElementPrototype, and it seems not worth it to have these dev-only warnings there, since
      // an `in` check could mistakenly assume that a prop is declared on a LightningElement prototype.
      if (process.env.NODE_ENV !== 'production' && true) {
        // TODO [#3761]: enable for components that don't extend from LightningElement
        if (!isUndefined$1(proto) && !isNull(proto) && !hasCustomSuperClass) {
          const nonPublicPropertiesToWarnOn = new Set([
          // getters, setters, and methods
          ...keys(getOwnPropertyDescriptors(proto)),
          // class properties
          ...observedFields]
          // we don't want to override HTMLElement props because these are meaningful in other ways,
          // and can break tooling that expects it to be iterable or defined, e.g. Jest:
          // https://github.com/jestjs/jest/blob/b4c9587/packages/pretty-format/src/plugins/DOMElement.ts#L95
          // It also doesn't make sense to override e.g. "constructor".
          .filter(propName => !(propName in HTMLElementPrototype) && !(propName in ariaReflectionPolyfillDescriptors)));
          for (const propName of nonPublicPropertiesToWarnOn) {
            if (ArrayIndexOf.call(publicProperties, propName) === -1) {
              descriptors[propName] = createAccessorThatWarns(propName);
            }
          }
        }
      }
      // expose getters and setters for each public props on the new Element Bridge
      for (let i = 0, len = publicProperties.length; i < len; i += 1) {
        const propName = publicProperties[i];
        attributeToPropMap[htmlPropertyToAttribute(propName)] = propName;
        descriptors[propName] = {
          get: createGetter(propName),
          set: createSetter(propName),
          enumerable: true,
          configurable: true
        };
      }
      // expose public methods as props on the new Element Bridge
      for (let i = 0, len = methods.length; i < len; i += 1) {
        const methodName = methods[i];
        descriptors[methodName] = {
          value: createMethodCaller(methodName),
          writable: true,
          configurable: true
        };
      }
      // creating a new attributeChangedCallback per bridge because they are bound to the corresponding
      // map of attributes to props. We do this after all other props and methods to avoid the possibility
      // of getting overrule by a class declaration in user-land, and we make it non-writable, non-configurable
      // to preserve this definition.
      descriptors.attributeChangedCallback = {
        value: createAttributeChangedCallback(attributeToPropMap, superAttributeChangedCallback)
      };
      // To avoid leaking private component details, accessing internals from outside a component is not allowed.
      descriptors.attachInternals = {
        set() {
          if (process.env.NODE_ENV !== 'production') {
            logWarn('attachInternals cannot be accessed outside of a component. Use this.attachInternals instead.');
          }
        },
        get() {
          if (process.env.NODE_ENV !== 'production') {
            logWarn('attachInternals cannot be accessed outside of a component. Use this.attachInternals instead.');
          }
        }
      };
      descriptors.formAssociated = {
        set() {
          if (process.env.NODE_ENV !== 'production') {
            logWarn('formAssociated cannot be accessed outside of a component. Set the value within the component class.');
          }
        },
        get() {
          if (process.env.NODE_ENV !== 'production') {
            logWarn('formAssociated cannot be accessed outside of a component. Set the value within the component class.');
          }
        }
      };
      // Specify attributes for which we want to reflect changes back to their corresponding
      // properties via attributeChangedCallback.
      defineProperty(HTMLBridgeElement, 'observedAttributes', {
        get() {
          return [...superObservedAttributes, ...keys(attributeToPropMap)];
        }
      });
      defineProperties(HTMLBridgeElement.prototype, descriptors);
      return HTMLBridgeElement;
    }
    // We do some special handling of non-standard ARIA props like ariaLabelledBy as well as props without (as of this
    // writing) broad cross-browser support like ariaBrailleLabel. This is so the reflection works correctly and preserves
    // backwards compatibility with the previous global polyfill approach.
    //
    // The goal here is to expose `elm.aria*` property accessors to work from outside a component, and to reflect `aria-*`
    // attrs. This is especially important because the template compiler compiles aria-* attrs on components to aria* props.
    // Note this works regardless of whether the global ARIA reflection polyfill is applied or not.
    //
    // Also note this ARIA reflection only really makes sense in the browser. On the server, there is no
    // `renderedCallback()`, so you cannot do e.g. `this.template.querySelector('x-child').ariaBusy = 'true'`. So we don't
    // need to expose ARIA props outside the LightningElement
    const basePublicProperties = [...getOwnPropertyNames$1(HTMLElementOriginalDescriptors), ...getOwnPropertyNames$1(ariaReflectionPolyfillDescriptors)];
    const BaseBridgeElement = HTMLBridgeElementFactory(HTMLElementConstructor, basePublicProperties, [], [], null, false);
    freeze(BaseBridgeElement);
    seal(BaseBridgeElement.prototype);

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const VALID_SCOPE_TOKEN_REGEX = /^[a-zA-Z0-9\-_]+$/;
    // These are only used for HMR in dev mode
    // The "pure" annotations are so that Rollup knows for sure it can remove these from prod mode
    let stylesheetsToCssContent = /*@__PURE__@*/new WeakMap();
    let cssContentToAbortControllers = /*@__PURE__@*/new Map();
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      // Used to reset the global state between test runs
      window.__lwcResetStylesheetCache = () => {
        stylesheetsToCssContent = new WeakMap();
        cssContentToAbortControllers = new Map();
      };
    }
    function linkStylesheetToCssContentInDevMode(stylesheet, cssContent) {
      // Should never leak to prod; only used for HMR
      assertNotProd();
      let cssContents = stylesheetsToCssContent.get(stylesheet);
      if (isUndefined$1(cssContents)) {
        cssContents = new Set();
        stylesheetsToCssContent.set(stylesheet, cssContents);
      }
      cssContents.add(cssContent);
    }
    function getOrCreateAbortControllerInDevMode(cssContent) {
      // Should never leak to prod; only used for HMR
      assertNotProd();
      let abortController = cssContentToAbortControllers.get(cssContent);
      if (isUndefined$1(abortController)) {
        abortController = new AbortController();
        cssContentToAbortControllers.set(cssContent, abortController);
      }
      return abortController;
    }
    function getOrCreateAbortSignal(cssContent) {
      // abort controller/signal is only used for HMR in development
      if (process.env.NODE_ENV !== 'production') {
        return getOrCreateAbortControllerInDevMode(cssContent).signal;
      }
      return undefined;
    }
    function makeHostToken(token) {
      // Note: if this ever changes, update the `cssScopeTokens` returned by `@lwc/compiler`
      return `${token}-host`;
    }
    function createInlineStyleVNode(content) {
      return api.h('style', {
        key: 'style',
        // special key
        attrs: {
          type: 'text/css'
        }
      }, [api.t(content)]);
    }
    // TODO [#3733]: remove support for legacy scope tokens
    function updateStylesheetToken(vm, template, legacy) {
      const {
        elm,
        context,
        renderMode,
        shadowMode,
        renderer: {
          getClassList,
          removeAttribute,
          setAttribute
        }
      } = vm;
      const {
        stylesheets: newStylesheets
      } = template;
      const newStylesheetToken = legacy ? template.legacyStylesheetToken : template.stylesheetToken;
      const {
        stylesheets: newVmStylesheets
      } = vm;
      const isSyntheticShadow = renderMode === 1 /* RenderMode.Shadow */ && shadowMode === 1 /* ShadowMode.Synthetic */;
      const {
        hasScopedStyles
      } = context;
      let newToken;
      let newHasTokenInClass;
      let newHasTokenInAttribute;
      // Reset the styling token applied to the host element.
      let oldToken;
      let oldHasTokenInClass;
      let oldHasTokenInAttribute;
      if (legacy) {
        oldToken = context.legacyStylesheetToken;
        oldHasTokenInClass = context.hasLegacyTokenInClass;
        oldHasTokenInAttribute = context.hasLegacyTokenInAttribute;
      } else {
        oldToken = context.stylesheetToken;
        oldHasTokenInClass = context.hasTokenInClass;
        oldHasTokenInAttribute = context.hasTokenInAttribute;
      }
      if (!isUndefined$1(oldToken)) {
        if (oldHasTokenInClass) {
          getClassList(elm).remove(makeHostToken(oldToken));
        }
        if (oldHasTokenInAttribute) {
          removeAttribute(elm, makeHostToken(oldToken));
        }
      }
      // Apply the new template styling token to the host element, if the new template has any
      // associated stylesheets. In the case of light DOM, also ensure there is at least one scoped stylesheet.
      const hasNewStylesheets = hasStyles(newStylesheets);
      const hasNewVmStylesheets = hasStyles(newVmStylesheets);
      if (hasNewStylesheets || hasNewVmStylesheets) {
        newToken = newStylesheetToken;
      }
      // Set the new styling token on the host element
      if (!isUndefined$1(newToken)) {
        if (hasScopedStyles) {
          const hostScopeTokenClass = makeHostToken(newToken);
          getClassList(elm).add(hostScopeTokenClass);
          newHasTokenInClass = true;
        }
        if (isSyntheticShadow) {
          setAttribute(elm, makeHostToken(newToken), '');
          newHasTokenInAttribute = true;
        }
      }
      // Update the styling tokens present on the context object.
      if (legacy) {
        context.legacyStylesheetToken = newToken;
        context.hasLegacyTokenInClass = newHasTokenInClass;
        context.hasLegacyTokenInAttribute = newHasTokenInAttribute;
      } else {
        context.stylesheetToken = newToken;
        context.hasTokenInClass = newHasTokenInClass;
        context.hasTokenInAttribute = newHasTokenInAttribute;
      }
    }
    function evaluateStylesheetsContent(stylesheets, stylesheetToken, vm) {
      const content = [];
      let root;
      for (let i = 0; i < stylesheets.length; i++) {
        let stylesheet = stylesheets[i];
        if (isArray$1(stylesheet)) {
          ArrayPush$1.apply(content, evaluateStylesheetsContent(stylesheet, stylesheetToken, vm));
        } else {
          if (process.env.NODE_ENV !== 'production') {
            // Check for compiler version mismatch in dev mode only
            checkVersionMismatch(stylesheet, 'stylesheet');
            // in dev-mode, we support hot swapping of stylesheet, which means that
            // the component instance might be attempting to use an old version of
            // the stylesheet, while internally, we have a replacement for it.
            stylesheet = getStyleOrSwappedStyle(stylesheet);
          }
          const isScopedCss = isTrue(stylesheet[KEY__SCOPED_CSS]);
          const isNativeOnlyCss = isTrue(stylesheet[KEY__NATIVE_ONLY_CSS]);
          const {
            renderMode,
            shadowMode
          } = vm;
          if (lwcRuntimeFlags.DISABLE_LIGHT_DOM_UNSCOPED_CSS && !isScopedCss && renderMode === 0 /* RenderMode.Light */) {
            logError('Unscoped CSS is not supported in Light DOM in this environment. Please use scoped CSS ' + '(*.scoped.css) instead of unscoped CSS (*.css). See also: https://sfdc.co/scoped-styles-light-dom');
            continue;
          }
          // Apply the scope token only if the stylesheet itself is scoped, or if we're rendering synthetic shadow.
          const scopeToken = isScopedCss || shadowMode === 1 /* ShadowMode.Synthetic */ && renderMode === 1 /* RenderMode.Shadow */ ? stylesheetToken : undefined;
          // Use the actual `:host` selector if we're rendering global CSS for light DOM, or if we're rendering
          // native shadow DOM. Synthetic shadow DOM never uses `:host`.
          const useActualHostSelector = renderMode === 0 /* RenderMode.Light */ ? !isScopedCss : shadowMode === 0 /* ShadowMode.Native */;
          // Use the native :dir() pseudoclass only in native shadow DOM. Otherwise, in synthetic shadow,
          // we use an attribute selector on the host to simulate :dir().
          let useNativeDirPseudoclass;
          if (renderMode === 1 /* RenderMode.Shadow */) {
            useNativeDirPseudoclass = shadowMode === 0 /* ShadowMode.Native */;
          } else {
            // Light DOM components should only render `[dir]` if they're inside of a synthetic shadow root.
            // At the top level (root is null) or inside of a native shadow root, they should use `:dir()`.
            if (isUndefined$1(root)) {
              // Only calculate the root once as necessary
              root = getNearestShadowComponent(vm);
            }
            useNativeDirPseudoclass = isNull(root) || root.shadowMode === 0 /* ShadowMode.Native */;
          }
          let cssContent;
          if (isNativeOnlyCss && renderMode === 1 /* RenderMode.Shadow */ && shadowMode === 1 /* ShadowMode.Synthetic */) {
            // Native-only (i.e. disableSyntheticShadowSupport) CSS should be ignored entirely
            // in synthetic shadow. It's fine to use in either native shadow or light DOM, but in
            // synthetic shadow it wouldn't be scoped properly and so should be ignored.
            cssContent = '/* ignored native-only CSS */';
          } else {
            cssContent = stylesheet(scopeToken, useActualHostSelector, useNativeDirPseudoclass);
          }
          if (process.env.NODE_ENV !== 'production') {
            linkStylesheetToCssContentInDevMode(stylesheet, cssContent);
          }
          ArrayPush$1.call(content, cssContent);
        }
      }
      return content;
    }
    function getStylesheetsContent(vm, template) {
      const {
        stylesheets,
        stylesheetToken
      } = template;
      const {
        stylesheets: vmStylesheets
      } = vm;
      const hasTemplateStyles = hasStyles(stylesheets);
      const hasVmStyles = hasStyles(vmStylesheets);
      if (hasTemplateStyles) {
        const content = evaluateStylesheetsContent(stylesheets, stylesheetToken, vm);
        if (hasVmStyles) {
          // Slow path – merge the template styles and vm styles
          ArrayPush$1.apply(content, evaluateStylesheetsContent(vmStylesheets, stylesheetToken, vm));
        }
        return content;
      }
      if (hasVmStyles) {
        // No template styles, so return vm styles directly
        return evaluateStylesheetsContent(vmStylesheets, stylesheetToken, vm);
      }
      // Fastest path - no styles, so return an empty array
      return EmptyArray;
    }
    // It might be worth caching this to avoid doing the lookup repeatedly, but
    // perf testing has not shown it to be a huge improvement yet:
    // https://github.com/salesforce/lwc/pull/2460#discussion_r691208892
    function getNearestShadowComponent(vm) {
      let owner = vm;
      while (!isNull(owner)) {
        if (owner.renderMode === 1 /* RenderMode.Shadow */) {
          return owner;
        }
        owner = owner.owner;
      }
      return owner;
    }
    /**
     * If the component that is currently being rendered uses scoped styles,
     * this returns the unique token for that scoped stylesheet. Otherwise
     * it returns null.
     * @param owner
     * @param legacy
     */
    // TODO [#3733]: remove support for legacy scope tokens
    function getScopeTokenClass(owner, legacy) {
      const {
        cmpTemplate,
        context
      } = owner;
      return context.hasScopedStyles && (legacy ? cmpTemplate?.legacyStylesheetToken : cmpTemplate?.stylesheetToken) || null;
    }
    function getNearestNativeShadowComponent(vm) {
      const owner = getNearestShadowComponent(vm);
      if (!isNull(owner) && owner.shadowMode === 1 /* ShadowMode.Synthetic */) {
        // Synthetic-within-native is impossible. So if the nearest shadow component is
        // synthetic, we know we won't find a native component if we go any further.
        return null;
      }
      return owner;
    }
    function createStylesheet(vm, stylesheets) {
      const {
        renderMode,
        shadowMode,
        renderer: {
          insertStylesheet
        }
      } = vm;
      if (renderMode === 1 /* RenderMode.Shadow */ && shadowMode === 1 /* ShadowMode.Synthetic */) {
        for (let i = 0; i < stylesheets.length; i++) {
          const stylesheet = stylesheets[i];
          insertStylesheet(stylesheet, undefined, getOrCreateAbortSignal(stylesheet));
        }
      } else if (vm.hydrated) {
        // Note: We need to ensure that during hydration, the stylesheets method is the same as those in ssr.
        //       This works in the client, because the stylesheets are created, and cached in the VM
        //       the first time the VM renders.
        // native shadow or light DOM, SSR
        return ArrayMap.call(stylesheets, createInlineStyleVNode);
      } else {
        // native shadow or light DOM, DOM renderer
        const root = getNearestNativeShadowComponent(vm);
        // null root means a global style
        const target = isNull(root) ? undefined : root.shadowRoot;
        for (let i = 0; i < stylesheets.length; i++) {
          const stylesheet = stylesheets[i];
          insertStylesheet(stylesheet, target, getOrCreateAbortSignal(stylesheet));
        }
      }
      return null;
    }
    function isValidScopeToken(token) {
      if (!isString(token)) {
        return false;
      }
      // See W-16614556
      return lwcRuntimeFlags.DISABLE_SCOPE_TOKEN_VALIDATION || VALID_SCOPE_TOKEN_REGEX.test(token);
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const supportsWeakRefs = typeof WeakRef === 'function' && typeof FinalizationRegistry === 'function';
    // In browsers that doesn't support WeakRefs, the values will still leak, but at least the keys won't
    class LegacyWeakMultiMap {
      constructor() {
        this._map = new WeakMap();
      }
      _getValues(key) {
        let values = this._map.get(key);
        if (isUndefined$1(values)) {
          values = new Set();
          this._map.set(key, values);
        }
        return values;
      }
      get(key) {
        return this._getValues(key);
      }
      add(key, vm) {
        const set = this._getValues(key);
        set.add(vm);
      }
      delete(key) {
        this._map.delete(key);
      }
    }
    // This implementation relies on the WeakRef/FinalizationRegistry proposal.
    // For some background, see: https://github.com/tc39/proposal-weakrefs
    class ModernWeakMultiMap {
      constructor() {
        this._map = new WeakMap();
        this._registry = new FinalizationRegistry(weakRefs => {
          // This should be considered an optional cleanup method to remove GC'ed values from their respective arrays.
          // JS VMs are not obligated to call FinalizationRegistry callbacks.
          // Work backwards, removing stale VMs
          for (let i = weakRefs.length - 1; i >= 0; i--) {
            const vm = weakRefs[i].deref();
            if (isUndefined$1(vm)) {
              ArraySplice.call(weakRefs, i, 1); // remove
            }
          }
        });
      }
      _getWeakRefs(key) {
        let weakRefs = this._map.get(key);
        if (isUndefined$1(weakRefs)) {
          weakRefs = [];
          this._map.set(key, weakRefs);
        }
        return weakRefs;
      }
      get(key) {
        const weakRefs = this._getWeakRefs(key);
        const result = new Set();
        for (const weakRef of weakRefs) {
          const vm = weakRef.deref();
          if (!isUndefined$1(vm)) {
            result.add(vm);
          }
        }
        return result;
      }
      add(key, value) {
        const weakRefs = this._getWeakRefs(key);
        // We could check for duplicate values here, but it doesn't seem worth it.
        // We transform the output into a Set anyway
        ArrayPush$1.call(weakRefs, new WeakRef(value));
        // It's important here not to leak the second argument, which is the "held value." The FinalizationRegistry
        // effectively creates a strong reference between the first argument (the "target") and the held value. When
        // the target is GC'ed, the callback is called, and then the held value is GC'ed.
        // Putting the key here would mean the key is not GC'ed until the value is GC'ed, which defeats the purpose
        // of the WeakMap. Whereas putting the weakRefs array here is fine, because it doesn't have a strong reference
        // to anything. See also this example:
        // https://gist.github.com/nolanlawson/79a3d36e8e6cc25c5048bb17c1795aea
        this._registry.register(value, weakRefs);
      }
      delete(key) {
        this._map.delete(key);
      }
    }
    const WeakMultiMap = supportsWeakRefs ? ModernWeakMultiMap : LegacyWeakMultiMap;

    /*
     * Copyright (c) 2020, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let swappedTemplateMap = /*@__PURE__@*/new WeakMap();
    let swappedComponentMap = /*@__PURE__@*/new WeakMap();
    let swappedStyleMap = /*@__PURE__@*/new WeakMap();
    // The important thing here is the weak values – VMs are transient (one per component instance) and should be GC'ed,
    // so we don't want to create strong references to them.
    // The weak keys are kind of useless, because Templates, LightningElementConstructors, and Stylesheets are
    // never GC'ed. But maybe they will be someday, so we may as well use weak keys too.
    // The "pure" annotations are so that Rollup knows for sure it can remove these from prod mode
    let activeTemplates = /*@__PURE__@*/new WeakMultiMap();
    let activeComponents = /*@__PURE__@*/new WeakMultiMap();
    let activeStyles = /*@__PURE__@*/new WeakMultiMap();
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      // Used to reset the global state between test runs
      window.__lwcResetHotSwaps = () => {
        swappedTemplateMap = new WeakMap();
        swappedComponentMap = new WeakMap();
        swappedStyleMap = new WeakMap();
        activeTemplates = new WeakMultiMap();
        activeComponents = new WeakMultiMap();
        activeStyles = new WeakMultiMap();
      };
    }
    function getTemplateOrSwappedTemplate(tpl) {
      assertNotProd(); // this method should never leak to prod
      // TODO [#4154]: shows stale content when swapping content back and forth multiple times
      const visited = new Set();
      while (swappedTemplateMap.has(tpl) && !visited.has(tpl)) {
        visited.add(tpl);
        tpl = swappedTemplateMap.get(tpl);
      }
      return tpl;
    }
    function getComponentOrSwappedComponent(Ctor) {
      assertNotProd(); // this method should never leak to prod
      // TODO [#4154]: shows stale content when swapping content back and forth multiple times
      const visited = new Set();
      while (swappedComponentMap.has(Ctor) && !visited.has(Ctor)) {
        visited.add(Ctor);
        Ctor = swappedComponentMap.get(Ctor);
      }
      return Ctor;
    }
    function getStyleOrSwappedStyle(style) {
      assertNotProd(); // this method should never leak to prod
      // TODO [#4154]: shows stale content when swapping content back and forth multiple times
      const visited = new Set();
      while (swappedStyleMap.has(style) && !visited.has(style)) {
        visited.add(style);
        style = swappedStyleMap.get(style);
      }
      return style;
    }
    function addActiveStylesheets(stylesheets, vm) {
      if (isUndefined$1(stylesheets) || isNull(stylesheets)) {
        // Ignore non-existent stylesheets
        return;
      }
      for (const stylesheet of flattenStylesheets(stylesheets)) {
        // this is necessary because we don't hold the list of styles
        // in the vm, we only hold the selected (already swapped template)
        // but the styles attached to the template might not be the actual
        // active ones, but the swapped versions of those.
        const swappedStylesheet = getStyleOrSwappedStyle(stylesheet);
        // this will allow us to keep track of the stylesheet that are
        // being used by a hot component
        activeStyles.add(swappedStylesheet, vm);
      }
    }
    function setActiveVM(vm) {
      assertNotProd(); // this method should never leak to prod
      // tracking active component
      const Ctor = vm.def.ctor;
      // this will allow us to keep track of the hot components
      activeComponents.add(Ctor, vm);
      // tracking active template
      const template = vm.cmpTemplate;
      if (!isNull(template)) {
        // this will allow us to keep track of the templates that are
        // being used by a hot component
        activeTemplates.add(template, vm);
        // Tracking active styles from the template or the VM. `template.stylesheets` are implicitly associated
        // (e.g. `foo.css` associated with `foo.html`), whereas `vm.stylesheets` are from `static stylesheets`.
        addActiveStylesheets(template.stylesheets, vm);
        addActiveStylesheets(vm.stylesheets, vm);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * This module is responsible for producing the ComponentDef object that is always
     * accessible via `vm.def`. This is lazily created during the creation of the first
     * instance of a component class, and shared across all instances.
     *
     * This structure can be used to synthetically create proxies, and understand the
     * shape of a component. It is also used internally to apply extra optimizations.
     */
    const CtorToDefMap = new WeakMap();
    function getCtorProto(Ctor) {
      let proto = getPrototypeOf$1(Ctor);
      if (isNull(proto)) {
        throw new ReferenceError(`Invalid prototype chain for ${Ctor.name}, you must extend LightningElement.`);
      }
      // covering the cases where the ref is circular in AMD
      if (isCircularModuleDependency(proto)) {
        const p = resolveCircularModuleDependency(proto);
        if (process.env.NODE_ENV !== 'production') {
          if (isNull(p)) {
            throw new ReferenceError(`Circular module dependency for ${Ctor.name}, must resolve to a constructor that extends LightningElement.`);
          }
        }
        // escape hatch for Locker and other abstractions to provide their own base class instead
        // of our Base class without having to leak it to user-land. If the circular function returns
        // itself, that's the signal that we have hit the end of the proto chain, which must always
        // be base.
        proto = p === proto ? LightningElement : p;
      }
      return proto;
    }
    function createComponentDef(Ctor) {
      const {
        shadowSupportMode: ctorShadowSupportMode,
        renderMode: ctorRenderMode,
        formAssociated: ctorFormAssociated
      } = Ctor;
      if (process.env.NODE_ENV !== 'production') {
        const ctorName = Ctor.name;
        // Removing the following assert until https://bugs.webkit.org/show_bug.cgi?id=190140 is fixed.
        // assert.isTrue(ctorName && isString(ctorName), `${toString(Ctor)} should have a "name" property with string value, but found ${ctorName}.`);
        if (!Ctor.constructor) {
          // This error seems impossible to hit, due to an earlier check in `isComponentConstructor()`.
          // But we keep it here just in case.
          logError(`Missing ${ctorName}.constructor, ${ctorName} should have a "constructor" property.`);
        }
        if (!isUndefined$1(ctorShadowSupportMode) && ctorShadowSupportMode !== 'any' && ctorShadowSupportMode !== 'reset' && ctorShadowSupportMode !== 'native') {
          logError(`Invalid value for static property shadowSupportMode: '${ctorShadowSupportMode}'`);
        }
        // TODO [#3971]: Completely remove shadowSupportMode "any"
        if (ctorShadowSupportMode === 'any') {
          logWarn(`Invalid value 'any' for static property shadowSupportMode. 'any' is deprecated and will be removed in a future release--use 'native' instead.`);
        }
        if (!isUndefined$1(ctorRenderMode) && ctorRenderMode !== 'light' && ctorRenderMode !== 'shadow') {
          logError(`Invalid value for static property renderMode: '${ctorRenderMode}'. renderMode must be either 'light' or 'shadow'.`);
        }
      }
      const decoratorsMeta = getDecoratorsMeta(Ctor);
      const {
        apiFields,
        apiFieldsConfig,
        apiMethods,
        wiredFields,
        wiredMethods,
        observedFields
      } = decoratorsMeta;
      const proto = Ctor.prototype;
      let {
        connectedCallback,
        disconnectedCallback,
        renderedCallback,
        errorCallback,
        formAssociatedCallback,
        formResetCallback,
        formDisabledCallback,
        formStateRestoreCallback,
        render
      } = proto;
      const superProto = getCtorProto(Ctor);
      const hasCustomSuperClass = superProto !== LightningElement;
      const superDef = hasCustomSuperClass ? getComponentInternalDef(superProto) : lightingElementDef;
      const bridge = HTMLBridgeElementFactory(superDef.bridge, keys(apiFields), keys(apiMethods), keys(observedFields), proto, hasCustomSuperClass);
      const props = assign(create(null), superDef.props, apiFields);
      const propsConfig = assign(create(null), superDef.propsConfig, apiFieldsConfig);
      const methods = assign(create(null), superDef.methods, apiMethods);
      const wire = assign(create(null), superDef.wire, wiredFields, wiredMethods);
      connectedCallback = connectedCallback || superDef.connectedCallback;
      disconnectedCallback = disconnectedCallback || superDef.disconnectedCallback;
      renderedCallback = renderedCallback || superDef.renderedCallback;
      errorCallback = errorCallback || superDef.errorCallback;
      formAssociatedCallback = formAssociatedCallback || superDef.formAssociatedCallback;
      formResetCallback = formResetCallback || superDef.formResetCallback;
      formDisabledCallback = formDisabledCallback || superDef.formDisabledCallback;
      formStateRestoreCallback = formStateRestoreCallback || superDef.formStateRestoreCallback;
      render = render || superDef.render;
      let shadowSupportMode = superDef.shadowSupportMode;
      if (!isUndefined$1(ctorShadowSupportMode)) {
        shadowSupportMode = ctorShadowSupportMode;
      }
      let renderMode = superDef.renderMode;
      if (!isUndefined$1(ctorRenderMode)) {
        renderMode = ctorRenderMode === 'light' ? 0 /* RenderMode.Light */ : 1 /* RenderMode.Shadow */;
      }
      let formAssociated = superDef.formAssociated;
      if (!isUndefined$1(ctorFormAssociated)) {
        formAssociated = ctorFormAssociated;
      }
      const template = getComponentRegisteredTemplate(Ctor) || superDef.template;
      const name = Ctor.name || superDef.name;
      // installing observed fields into the prototype.
      defineProperties(proto, observedFields);
      const def = {
        ctor: Ctor,
        name,
        wire,
        props,
        propsConfig,
        methods,
        bridge,
        template,
        renderMode,
        shadowSupportMode,
        formAssociated,
        connectedCallback,
        disconnectedCallback,
        errorCallback,
        formAssociatedCallback,
        formDisabledCallback,
        formResetCallback,
        formStateRestoreCallback,
        renderedCallback,
        render
      };
      // This is a no-op unless Lightning DevTools are enabled.
      instrumentDef(def);
      if (process.env.NODE_ENV !== 'production') {
        freeze(Ctor.prototype);
      }
      return def;
    }
    /**
     * EXPERIMENTAL: This function allows for the identification of LWC constructors. This API is
     * subject to change or being removed.
     * @param ctor
     */
    function isComponentConstructor(ctor) {
      if (!isFunction$1(ctor)) {
        return false;
      }
      // Fast path: LightningElement is part of the prototype chain of the constructor.
      if (ctor.prototype instanceof LightningElement) {
        return true;
      }
      // Slow path: LightningElement is not part of the prototype chain of the constructor, we need
      // climb up the constructor prototype chain to check in case there are circular dependencies
      // to resolve.
      let current = ctor;
      do {
        if (isCircularModuleDependency(current)) {
          const circularResolved = resolveCircularModuleDependency(current);
          // If the circular function returns itself, that's the signal that we have hit the end
          // of the proto chain, which must always be a valid base constructor.
          if (circularResolved === current) {
            return true;
          }
          current = circularResolved;
        }
        if (current === LightningElement) {
          return true;
        }
      } while (!isNull(current) && (current = getPrototypeOf$1(current)));
      // Finally return false if the LightningElement is not part of the prototype chain.
      return false;
    }
    function getComponentInternalDef(Ctor) {
      if (process.env.NODE_ENV !== 'production') {
        Ctor = getComponentOrSwappedComponent(Ctor);
      }
      let def = CtorToDefMap.get(Ctor);
      if (isUndefined$1(def)) {
        if (isCircularModuleDependency(Ctor)) {
          const resolvedCtor = resolveCircularModuleDependency(Ctor);
          def = getComponentInternalDef(resolvedCtor);
          // Cache the unresolved component ctor too. The next time if the same unresolved ctor is used,
          // look up the definition in cache instead of re-resolving and recreating the def.
          CtorToDefMap.set(Ctor, def);
          return def;
        }
        if (!isComponentConstructor(Ctor)) {
          throw new TypeError(`${Ctor} is not a valid component, or does not extends LightningElement from "lwc". You probably forgot to add the extend clause on the class declaration.`);
        }
        def = createComponentDef(Ctor);
        CtorToDefMap.set(Ctor, def);
      }
      return def;
    }
    function getComponentHtmlPrototype(Ctor) {
      const def = getComponentInternalDef(Ctor);
      return def.bridge;
    }
    const lightingElementDef = {
      name: LightningElement.name,
      props: lightningBasedDescriptors,
      propsConfig: EmptyObject,
      methods: EmptyObject,
      renderMode: 1 /* RenderMode.Shadow */,
      shadowSupportMode: 'reset',
      formAssociated: undefined,
      wire: EmptyObject,
      bridge: BaseBridgeElement,
      template: defaultEmptyTemplate,
      render: LightningElement.prototype.render
    };

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function isVBaseElement(vnode) {
      const {
        type
      } = vnode;
      return type === 2 /* VNodeType.Element */ || type === 3 /* VNodeType.CustomElement */;
    }
    function isSameVnode(vnode1, vnode2) {
      return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
    }
    function isVCustomElement(vnode) {
      return vnode.type === 3 /* VNodeType.CustomElement */;
    }
    function isVFragment(vnode) {
      return vnode.type === 5 /* VNodeType.Fragment */;
    }
    function isVScopedSlotFragment(vnode) {
      return vnode.type === 6 /* VNodeType.ScopedSlotFragment */;
    }
    function isVStatic(vnode) {
      return vnode.type === 4 /* VNodeType.Static */;
    }
    function isVStaticPartElement(vnode) {
      return vnode.type === 1 /* VStaticPartType.Element */;
    }
    function isVStaticPartText(vnode) {
      return vnode.type === 0 /* VStaticPartType.Text */;
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const sanitizedHtmlContentSymbol = Symbol('lwc-get-sanitized-html-content');
    function isSanitizedHtmlContent(object) {
      return isObject(object) && !isNull(object) && sanitizedHtmlContentSymbol in object;
    }
    /**
     * Wrap a pre-sanitized string designated for `.innerHTML` via `lwc:inner-html`
     * as an object with a Symbol that only we have access to.
     * @param sanitizedString
     * @returns SanitizedHtmlContent
     */
    function createSanitizedHtmlContent(sanitizedString) {
      return create(null, {
        [sanitizedHtmlContentSymbol]: {
          value: sanitizedString,
          configurable: false,
          writable: false
        }
      });
    }
    /**
     * Safely call setProperty on an Element while handling any SanitizedHtmlContent objects correctly
     *
     * @param setProperty - renderer.setProperty
     * @param elm - Element
     * @param key - key to set
     * @param value -  value to set
     */
    function safelySetProperty(setProperty, elm, key, value) {
      // See W-16614337
      // we support setting innerHTML to `undefined` because it's inherently safe
      if ((key === 'innerHTML' || key === 'outerHTML') && !isUndefined$1(value)) {
        if (isSanitizedHtmlContent(value)) {
          // it's a SanitizedHtmlContent object
          setProperty(elm, key, value[sanitizedHtmlContentSymbol]);
        } else {
          // not a SanitizedHtmlContent object
          if (process.env.NODE_ENV !== 'production') {
            logWarn(`Cannot set property "${key}". Instead, use lwc:inner-html or lwc:dom-manual.`);
          }
        }
      } else {
        setProperty(elm, key, value);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const ColonCharCode = 58;
    function patchAttributes(oldVnode, vnode, renderer) {
      const {
        data,
        elm
      } = vnode;
      const {
        attrs
      } = data;
      if (isUndefined$1(attrs)) {
        return;
      }
      const oldAttrs = isNull(oldVnode) ? EmptyObject : oldVnode.data.attrs;
      // Attrs may be the same due to the static content optimization, so we can skip diffing
      if (oldAttrs === attrs) {
        return;
      }
      // Note VStaticPartData does not contain the external property so it will always default to false.
      const external = 'external' in data ? data.external : false;
      const {
        setAttribute,
        removeAttribute,
        setProperty
      } = renderer;
      for (const key in attrs) {
        const cur = attrs[key];
        const old = oldAttrs[key];
        if (old !== cur) {
          let propName;
          // For external custom elements, sniff to see if the attr should be considered a prop.
          // Use kebabCaseToCamelCase directly because we don't want to set props like `ariaLabel` or `tabIndex`
          // on a custom element versus just using the more reliable attribute format.
          if (external && (propName = kebabCaseToCamelCase(key)) in elm) {
            safelySetProperty(setProperty, elm, propName, cur);
          } else if (StringCharCodeAt.call(key, 3) === ColonCharCode) {
            // Assume xml namespace
            setAttribute(elm, key, cur, XML_NAMESPACE);
          } else if (StringCharCodeAt.call(key, 5) === ColonCharCode) {
            // Assume xlink namespace
            setAttribute(elm, key, cur, XLINK_NAMESPACE);
          } else if (isNull(cur) || isUndefined$1(cur)) {
            removeAttribute(elm, key);
          } else {
            setAttribute(elm, key, cur);
          }
        }
      }
    }
    function patchSlotAssignment(oldVnode, vnode, renderer) {
      const {
        slotAssignment
      } = vnode;
      if (oldVnode?.slotAssignment === slotAssignment) {
        return;
      }
      const {
        elm
      } = vnode;
      const {
        setAttribute,
        removeAttribute
      } = renderer;
      if (isUndefined$1(slotAssignment) || isNull(slotAssignment)) {
        removeAttribute(elm, 'slot');
      } else {
        setAttribute(elm, 'slot', slotAssignment);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function isLiveBindingProp(sel, key) {
      // For properties with live bindings, we read values from the DOM element
      // instead of relying on internally tracked values.
      return sel === 'input' && (key === 'value' || key === 'checked');
    }
    function patchProps(oldVnode, vnode, renderer) {
      const {
        props
      } = vnode.data;
      if (isUndefined$1(props)) {
        return;
      }
      let oldProps;
      if (!isNull(oldVnode)) {
        oldProps = oldVnode.data.props;
        // Props may be the same due to the static content optimization, so we can skip diffing
        if (oldProps === props) {
          return;
        }
        if (isUndefined$1(oldProps)) {
          oldProps = EmptyObject;
        }
      }
      const isFirstPatch = isNull(oldVnode);
      const {
        elm,
        sel
      } = vnode;
      const {
        getProperty,
        setProperty
      } = renderer;
      for (const key in props) {
        const cur = props[key];
        // Set the property if it's the first time is is patched or if the previous property is
        // different than the one previously set.
        if (isFirstPatch || cur !== (isLiveBindingProp(sel, key) ? getProperty(elm, key) : oldProps[key]) || !(key in oldProps) // this is required because the above case will pass when `cur` is `undefined` and key is missing in `oldProps`
        ) {
          // Additional verification if properties are supported by the element
          // Validation relies on html properties and public properties being defined on the element,
          // SSR has its own custom validation.
          if (process.env.NODE_ENV !== 'production') {
            if (!(key in elm)) {
              logWarn(`Unknown public property "${key}" of element <${elm.tagName.toLowerCase()}>. This is either a typo on the corresponding attribute "${htmlPropertyToAttribute(key)}", or the attribute does not exist in this browser or DOM implementation.`);
            }
          }
          safelySetProperty(setProperty, elm, key, cur);
        }
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const classNameToClassMap = create(null);
    function getMapFromClassName(className) {
      if (isUndefined$1(className) || isNull(className) || className === '') {
        return EmptyObject;
      }
      // computed class names must be string
      // This will throw if className is a symbol or null-prototype object
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      className = isString(className) ? className : className + '';
      let map = classNameToClassMap[className];
      if (map) {
        return map;
      }
      map = create(null);
      let start = 0;
      let o;
      const len = className.length;
      for (o = 0; o < len; o++) {
        if (StringCharCodeAt.call(className, o) === SPACE_CHAR) {
          if (o > start) {
            map[StringSlice.call(className, start, o)] = true;
          }
          start = o + 1;
        }
      }
      if (o > start) {
        map[StringSlice.call(className, start, o)] = true;
      }
      classNameToClassMap[className] = map;
      if (process.env.NODE_ENV !== 'production') {
        // just to make sure that this object never changes as part of the diffing algo
        freeze(map);
      }
      return map;
    }
    function patchClassAttribute(oldVnode, vnode, renderer) {
      const {
        elm,
        data: {
          className: newClass
        }
      } = vnode;
      const oldClass = isNull(oldVnode) ? undefined : oldVnode.data.className;
      if (oldClass === newClass) {
        return;
      }
      const newClassMap = getMapFromClassName(newClass);
      const oldClassMap = getMapFromClassName(oldClass);
      if (oldClassMap === newClassMap) {
        // These objects are cached by className string (`classNameToClassMap`), so we can only get here if there is
        // a key collision due to types, e.g. oldClass is `undefined` and newClass is `""` (empty string), or oldClass
        // is `1` (number) and newClass is `"1"` (string).
        return;
      }
      const {
        getClassList
      } = renderer;
      const classList = getClassList(elm);
      let name;
      for (name in oldClassMap) {
        // remove only if it is not in the new class collection and it is not set from within the instance
        if (isUndefined$1(newClassMap[name])) {
          classList.remove(name);
        }
      }
      for (name in newClassMap) {
        if (isUndefined$1(oldClassMap[name])) {
          classList.add(name);
        }
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // The style property is a string when defined via an expression in the template.
    function patchStyleAttribute(oldVnode, vnode, renderer, owner) {
      const {
        elm,
        data: {
          style: newStyle
        }
      } = vnode;
      if (process.env.NODE_ENV !== 'production') {
        if (!isNull(newStyle) && !isUndefined$1(newStyle) && !isString(newStyle)) {
          logError(`Invalid 'style' attribute passed to <${elm.tagName.toLowerCase()}> is ignored. This attribute must be a string value.`, owner);
        }
      }
      const oldStyle = isNull(oldVnode) ? undefined : oldVnode.data.style;
      if (oldStyle === newStyle) {
        return;
      }
      const {
        setAttribute,
        removeAttribute
      } = renderer;
      if (!isString(newStyle) || newStyle === '') {
        removeAttribute(elm, 'style');
      } else {
        setAttribute(elm, 'style', newStyle);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function applyEventListeners(vnode, renderer) {
      const {
        elm,
        data
      } = vnode;
      const {
        on
      } = data;
      if (isUndefined$1(on)) {
        return;
      }
      const {
        addEventListener
      } = renderer;
      for (const name in on) {
        const handler = on[name];
        addEventListener(elm, name, handler);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // The HTML class property becomes the vnode.data.classMap object when defined as a string in the template.
    // The compiler takes care of transforming the inline classnames into an object. It's faster to set the
    // different classnames properties individually instead of via a string.
    function applyStaticClassAttribute(vnode, renderer) {
      const {
        elm,
        data: {
          classMap
        }
      } = vnode;
      if (isUndefined$1(classMap)) {
        return;
      }
      const {
        getClassList
      } = renderer;
      const classList = getClassList(elm);
      for (const name in classMap) {
        classList.add(name);
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // The HTML style property becomes the vnode.data.styleDecls object when defined as a string in the template.
    // The compiler takes care of transforming the inline style into an object. It's faster to set the
    // different style properties individually instead of via a string.
    function applyStaticStyleAttribute(vnode, renderer) {
      const {
        elm,
        data: {
          styleDecls
        }
      } = vnode;
      if (isUndefined$1(styleDecls)) {
        return;
      }
      const {
        setCSSStyleProperty
      } = renderer;
      for (let i = 0; i < styleDecls.length; i++) {
        const [prop, value, important] = styleDecls[i];
        setCSSStyleProperty(elm, prop, value, important);
      }
    }

    /*
     * Copyright (c) 2023, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // Set a ref (lwc:ref) on a VM, from a template API
    function applyRefs(vnode, owner) {
      const {
        data
      } = vnode;
      const {
        ref
      } = data;
      if (isUndefined$1(ref)) {
        return;
      }
      if (process.env.NODE_ENV !== 'production' && isUndefined$1(owner.refVNodes)) {
        throw new Error('refVNodes must be defined when setting a ref');
      }
      // If this method is called, then vm.refVNodes is set as the template has refs.
      // If not, then something went wrong and we threw an error above.
      const refVNodes = owner.refVNodes;
      // In cases of conflict (two elements with the same ref), prefer the last one,
      // in depth-first traversal order. This happens automatically due to how we render
      refVNodes[ref] = vnode;
    }

    /*
     * Copyright (c) 2024, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function patchTextVNode(n1, n2, renderer) {
      n2.elm = n1.elm;
      if (n2.text !== n1.text) {
        updateTextContent$1(n2, renderer);
      }
    }
    function patchTextVStaticPart(n1, n2, renderer) {
      if (isNull(n1) || n2.text !== n1.text) {
        updateTextContent$1(n2, renderer);
      }
    }
    function updateTextContent$1(vnode, renderer) {
      const {
        elm,
        text
      } = vnode;
      const {
        setText
      } = renderer;
      if (process.env.NODE_ENV !== 'production') {
        unlockDomMutation();
      }
      setText(elm, text);
      if (process.env.NODE_ENV !== 'production') {
        lockDomMutation();
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * Given an array of static parts, mounts the DOM element to the part based on the staticPartId
     * @param root the root element
     * @param parts an array of VStaticParts
     * @param renderer the renderer to use
     */
    function traverseAndSetElements(root, parts, renderer) {
      const numParts = parts.length;
      // Optimization given that, in most cases, there will be one part, and it's just the root
      if (numParts === 1) {
        const firstPart = parts[0];
        if (firstPart.partId === 0) {
          // 0 means the root node
          firstPart.elm = root;
          return;
        }
      }
      const partIdsToParts = new Map();
      for (const staticPart of parts) {
        partIdsToParts.set(staticPart.partId, staticPart);
      }
      // Note that we traverse using `*Child`/`*Sibling` rather than `children` because the browser uses a linked
      // list under the hood to represent the DOM tree, so it's faster to do this than to create an underlying array
      // by calling `children`.
      const {
        nextSibling,
        getFirstChild,
        getParentNode
      } = renderer;
      let numFoundParts = 0;
      let partId = -1;
      // We should never traverse up to the root. We should exit early due to numFoundParts === numParts.
      // This is just a sanity check, in case the static parts generated by @lwc/template-compiler are wrong.
      function assertNotRoot(node) {
        if (process.env.NODE_ENV !== 'production') {
          assert.isFalse(node === root, `Reached the root without finding all parts. Found ${numFoundParts}, needed ${numParts}.`);
        }
      }
      // Depth-first traversal. We assign a partId to each element, which is an integer based on traversal order.
      // This function is very hot, which is why it's micro-optimized. Note we don't use a stack at all; we traverse
      // using an algorithm that relies on the parentNode getter: https://stackoverflow.com/a/5285417
      // This is very slightly faster than a TreeWalker (~0.5% on js-framework-benchmark create-10k), but basically
      // the same idea.
      let node = root;
      while (!isNull(node)) {
        // visit node
        partId++;
        const part = partIdsToParts.get(partId);
        if (!isUndefined$1(part)) {
          part.elm = node;
          numFoundParts++;
          if (numFoundParts === numParts) {
            return; // perf optimization - stop traversing once we've found everything we need
          }
        }
        const child = getFirstChild(node);
        if (!isNull(child)) {
          // walk down
          node = child;
        } else {
          let sibling;
          while (isNull(sibling = nextSibling(node))) {
            // we never want to walk up from the root
            assertNotRoot(node);
            // walk up
            node = getParentNode(node);
          }
          // we never want to walk right from the root
          assertNotRoot(node);
          // walk right
          node = sibling;
        }
      }
      /* istanbul ignore next */
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(numFoundParts === numParts, `Should have found all parts by now. Found ${numFoundParts}, needed ${numParts}.`);
      }
    }
    /**
     * Given an array of static parts, do all the mounting required for these parts.
     * @param root the root element
     * @param vnode the parent VStatic
     * @param renderer the renderer to use
     */
    function mountStaticParts(root, vnode, renderer) {
      const {
        parts,
        owner
      } = vnode;
      if (isUndefined$1(parts)) {
        return;
      }
      // This adds `part.elm` to each `part`. We have to do this on every mount because the `parts`
      // array is recreated from scratch every time, so each `part.elm` is now undefined.
      traverseAndSetElements(root, parts, renderer);
      // Currently only event listeners and refs are supported for static vnodes
      for (const part of parts) {
        if (isVStaticPartElement(part)) {
          // Event listeners only need to be applied once when mounting
          applyEventListeners(part, renderer);
          // Refs must be updated after every render due to refVNodes getting reset before every render
          applyRefs(part, owner);
          patchAttributes(null, part, renderer);
          patchClassAttribute(null, part, renderer);
          patchStyleAttribute(null, part, renderer, owner);
        } else {
          if (process.env.NODE_ENV !== 'production' && !isVStaticPartText(part)) {
            throw new Error(`LWC internal error, encountered unknown static part type: ${part.type}`);
          }
          patchTextVStaticPart(null, part, renderer);
        }
      }
    }
    /**
     * Updates the static elements based on the content of the VStaticParts
     * @param n1 the previous VStatic vnode
     * @param n2 the current VStatic vnode
     * @param renderer the renderer to use
     */
    function patchStaticParts(n1, n2, renderer) {
      const {
        parts: currParts,
        owner: currPartsOwner
      } = n2;
      if (isUndefined$1(currParts)) {
        return;
      }
      const {
        parts: prevParts
      } = n1;
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(currParts.length === prevParts?.length, 'Expected static parts to be the same for the same element. This is an error with the LWC framework itself.');
      }
      for (let i = 0; i < currParts.length; i++) {
        const prevPart = prevParts[i];
        const part = currParts[i];
        // Patch only occurs if the vnode is newly generated, which means the part.elm is always undefined
        // Since the vnode and elements are the same we can safely assume that prevParts[i].elm is defined.
        part.elm = prevPart.elm;
        if (process.env.NODE_ENV !== 'production' && prevPart.type !== part.type) {
          throw new Error(`LWC internal error, static part types do not match. Previous type was ${prevPart.type} and current type is ${part.type}`);
        }
        if (isVStaticPartElement(part)) {
          // Refs must be updated after every render due to refVNodes getting reset before every render
          applyRefs(part, currPartsOwner);
          patchAttributes(prevPart, part, renderer);
          patchClassAttribute(prevPart, part, renderer);
          patchStyleAttribute(prevPart, part, renderer, currPartsOwner);
        } else {
          patchTextVStaticPart(null, part, renderer);
        }
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function patchChildren(c1, c2, parent, renderer) {
      if (hasDynamicChildren(c2)) {
        updateDynamicChildren(c1, c2, parent, renderer);
      } else {
        updateStaticChildren(c1, c2, parent, renderer);
      }
    }
    function patch(n1, n2, parent, renderer) {
      if (n1 === n2) {
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        if (!isSameVnode(n1, n2) &&
        // Currently the only scenario when patch does not receive the same vnodes are for
        // dynamic components. When a dynamic component's constructor changes, the value of its
        // tag name (sel) will be different. The engine will unmount the previous element
        // and mount the new one using the new constructor in patchCustomElement.
        !(isVCustomElement(n1) && isVCustomElement(n2))) {
          throw new Error('Expected these VNodes to be the same: ' + JSON.stringify({
            sel: n1.sel,
            key: n1.key
          }) + ', ' + JSON.stringify({
            sel: n2.sel,
            key: n2.key
          }));
        }
      }
      switch (n2.type) {
        case 0 /* VNodeType.Text */:
          // VText has no special capability, fallback to the owner's renderer
          patchTextVNode(n1, n2, renderer);
          break;
        case 1 /* VNodeType.Comment */:
          // VComment has no special capability, fallback to the owner's renderer
          patchComment(n1, n2, renderer);
          break;
        case 4 /* VNodeType.Static */:
          patchStatic(n1, n2, renderer);
          break;
        case 5 /* VNodeType.Fragment */:
          patchFragment(n1, n2, parent, renderer);
          break;
        case 2 /* VNodeType.Element */:
          patchElement(n1, n2, n2.data.renderer ?? renderer);
          break;
        case 3 /* VNodeType.CustomElement */:
          patchCustomElement(n1, n2, parent, n2.data.renderer ?? renderer);
          break;
      }
    }
    function mount(node, parent, renderer, anchor) {
      switch (node.type) {
        case 0 /* VNodeType.Text */:
          // VText has no special capability, fallback to the owner's renderer
          mountText(node, parent, anchor, renderer);
          break;
        case 1 /* VNodeType.Comment */:
          // VComment has no special capability, fallback to the owner's renderer
          mountComment(node, parent, anchor, renderer);
          break;
        case 4 /* VNodeType.Static */:
          // VStatic cannot have a custom renderer associated to them, using owner's renderer
          mountStatic(node, parent, anchor, renderer);
          break;
        case 5 /* VNodeType.Fragment */:
          mountFragment(node, parent, anchor, renderer);
          break;
        case 2 /* VNodeType.Element */:
          // If the vnode data has a renderer override use it, else fallback to owner's renderer
          mountElement(node, parent, anchor, node.data.renderer ?? renderer);
          break;
        case 3 /* VNodeType.CustomElement */:
          // If the vnode data has a renderer override use it, else fallback to owner's renderer
          mountCustomElement(node, parent, anchor, node.data.renderer ?? renderer);
          break;
      }
    }
    function mountText(vnode, parent, anchor, renderer) {
      const {
        owner
      } = vnode;
      const {
        createText
      } = renderer;
      const textNode = vnode.elm = createText(vnode.text);
      linkNodeToShadow(textNode, owner, renderer);
      insertNode(textNode, parent, anchor, renderer);
    }
    function patchComment(n1, n2, renderer) {
      n2.elm = n1.elm;
      // FIXME: Comment nodes should be static, we shouldn't need to diff them together. However
      // it is the case today.
      if (n2.text !== n1.text) {
        updateTextContent$1(n2, renderer);
      }
    }
    function mountComment(vnode, parent, anchor, renderer) {
      const {
        owner
      } = vnode;
      const {
        createComment
      } = renderer;
      const commentNode = vnode.elm = createComment(vnode.text);
      linkNodeToShadow(commentNode, owner, renderer);
      insertNode(commentNode, parent, anchor, renderer);
    }
    function mountFragment(vnode, parent, anchor, renderer) {
      const {
        children
      } = vnode;
      mountVNodes(children, parent, renderer, anchor);
      vnode.elm = vnode.leading.elm;
    }
    function patchFragment(n1, n2, parent, renderer) {
      const {
        children,
        stable
      } = n2;
      if (stable) {
        updateStaticChildren(n1.children, children, parent, renderer);
      } else {
        updateDynamicChildren(n1.children, children, parent, renderer);
      }
      // Note: not reusing n1.elm, because during patching, it may be patched with another text node.
      n2.elm = n2.leading.elm;
    }
    function mountElement(vnode, parent, anchor, renderer) {
      const {
        sel,
        owner,
        data: {
          svg
        }
      } = vnode;
      const {
        createElement
      } = renderer;
      const namespace = isTrue(svg) ? SVG_NAMESPACE : undefined;
      const elm = vnode.elm = createElement(sel, namespace);
      linkNodeToShadow(elm, owner, renderer);
      applyStyleScoping(elm, owner, renderer);
      applyDomManual(elm, vnode);
      applyElementRestrictions(elm, vnode);
      patchElementPropsAndAttrsAndRefs$1(null, vnode, renderer);
      insertNode(elm, parent, anchor, renderer);
      mountVNodes(vnode.children, elm, renderer, null);
    }
    function patchStatic(n1, n2, renderer) {
      n2.elm = n1.elm;
      // slotAssignments can only apply to the top level element, never to a static part.
      patchSlotAssignment(n1, n2, renderer);
      // The `refs` object is blown away in every re-render, so we always need to re-apply them
      patchStaticParts(n1, n2, renderer);
    }
    function patchElement(n1, n2, renderer) {
      const elm = n2.elm = n1.elm;
      patchElementPropsAndAttrsAndRefs$1(n1, n2, renderer);
      patchChildren(n1.children, n2.children, elm, renderer);
    }
    function mountStatic(vnode, parent, anchor, renderer) {
      const {
        owner
      } = vnode;
      const {
        cloneNode,
        isSyntheticShadowDefined
      } = renderer;
      const elm = vnode.elm = cloneNode(vnode.fragment, true);
      // Define the root node shadow resolver
      linkNodeToShadow(elm, owner, renderer);
      applyElementRestrictions(elm, vnode);
      const {
        renderMode,
        shadowMode
      } = owner;
      if (isSyntheticShadowDefined) {
        // Marks this node as Static to propagate the shadow resolver. must happen after elm is assigned to the proper shadow
        if (shadowMode === 1 /* ShadowMode.Synthetic */ || renderMode === 0 /* RenderMode.Light */) {
          elm[KEY__SHADOW_STATIC] = true;
        }
      }
      // slotAssignments can only apply to the top level element, never to a static part.
      patchSlotAssignment(null, vnode, renderer);
      mountStaticParts(elm, vnode, renderer);
      insertNode(elm, parent, anchor, renderer);
    }
    function mountCustomElement(vnode, parent, anchor, renderer) {
      const {
        sel,
        owner,
        ctor
      } = vnode;
      const {
        createCustomElement
      } = renderer;
      /**
       * Note: if the upgradable constructor does not expect, or throw when we new it
       * with a callback as the first argument, we could implement a more advanced
       * mechanism that only passes that argument if the constructor is known to be
       * an upgradable custom element.
       */
      let vm;
      const upgradeCallback = elm => {
        // the custom element from the registry is expecting an upgrade callback
        vm = createViewModelHook(elm, vnode, renderer);
      };
      // Should never get a tag with upper case letter at this point; the compiler
      // should produce only tags with lowercase letters. However, the Java
      // compiler may generate tagnames with uppercase letters so - for backwards
      // compatibility, we lower case the tagname here.
      const normalizedTagname = sel.toLowerCase();
      const useNativeLifecycle = !lwcRuntimeFlags.DISABLE_NATIVE_CUSTOM_ELEMENT_LIFECYCLE;
      const isFormAssociated = shouldBeFormAssociated(ctor);
      const elm = createCustomElement(normalizedTagname, upgradeCallback, useNativeLifecycle, isFormAssociated);
      vnode.elm = elm;
      vnode.vm = vm;
      linkNodeToShadow(elm, owner, renderer);
      applyStyleScoping(elm, owner, renderer);
      if (vm) {
        allocateChildren(vnode, vm);
      }
      patchElementPropsAndAttrsAndRefs$1(null, vnode, renderer);
      insertNode(elm, parent, anchor, renderer);
      if (vm) {
        {
          if (!useNativeLifecycle) {
            if (process.env.NODE_ENV !== 'production') {
              // With synthetic lifecycle callbacks, it's possible for elements to be removed without the engine
              // noticing it (e.g. `appendChild` the same host element twice). This test ensures we don't regress.
              assert.isTrue(vm.state === 0 /* VMState.created */, `${vm} cannot be recycled.`);
            }
            runConnectedCallback(vm);
          }
        }
      }
      mountVNodes(vnode.children, elm, renderer, null);
      if (vm) {
        appendVM(vm);
      }
    }
    function patchCustomElement(n1, n2, parent, renderer) {
      // TODO [#3331]: This if branch should be removed in 246 with lwc:dynamic
      if (n1.ctor !== n2.ctor) {
        // If the constructor differs, unmount the current component and mount a new one using the new
        // constructor.
        const anchor = renderer.nextSibling(n1.elm);
        unmount(n1, parent, renderer, true);
        mountCustomElement(n2, parent, anchor, renderer);
      } else {
        // Otherwise patch the existing component with new props/attrs/etc.
        const elm = n2.elm = n1.elm;
        const vm = n2.vm = n1.vm;
        patchElementPropsAndAttrsAndRefs$1(n1, n2, renderer);
        if (!isUndefined$1(vm)) {
          // in fallback mode, the allocation will always set children to
          // empty and delegate the real allocation to the slot elements
          allocateChildren(n2, vm);
          // Solves an edge case with slotted VFragments in native shadow mode.
          //
          // During allocation, in native shadow, slotted VFragment nodes are flattened and their text delimiters are removed
          // to avoid interfering with native slot behavior. When this happens, if any of the fragments
          // were not stable, the children must go through the dynamic diffing algo.
          //
          // If the new children (n2.children) contain no VFragments, but the previous children (n1.children) were dynamic,
          // the new nodes must be marked dynamic so that all nodes are properly updated. The only indicator that the new
          // nodes need to be dynamic comes from the previous children, so we check that to determine whether we need to
          // mark the new children dynamic.
          //
          // Example:
          // n1.children: [div, VFragment('', div, null, ''), div] => [div, div, null, div]; // marked dynamic
          // n2.children: [div, null, div] => [div, null, div] // marked ???
          const {
            shadowMode,
            renderMode
          } = vm;
          if (shadowMode == 0 /* ShadowMode.Native */ && renderMode !== 0 /* RenderMode.Light */ && hasDynamicChildren(n1.children)) {
            // No-op if children has already been marked dynamic by 'allocateChildren()'.
            markAsDynamicChildren(n2.children);
          }
        }
        // in fallback mode, the children will be always empty, so, nothing
        // will happen, but in native, it does allocate the light dom
        patchChildren(n1.children, n2.children, elm, renderer);
        if (!isUndefined$1(vm)) {
          // this will probably update the shadowRoot, but only if the vm is in a dirty state
          // this is important to preserve the top to bottom synchronous rendering phase.
          rerenderVM(vm);
        }
      }
    }
    function mountVNodes(vnodes, parent, renderer, anchor, start = 0, end = vnodes.length) {
      for (; start < end; ++start) {
        const vnode = vnodes[start];
        if (isVNode(vnode)) {
          mount(vnode, parent, renderer, anchor);
        }
      }
    }
    function unmount(vnode, parent, renderer, doRemove = false) {
      const {
        type,
        elm,
        sel
      } = vnode;
      // When unmounting a VNode subtree not all the elements have to removed from the DOM. The
      // subtree root, is the only element worth unmounting from the subtree.
      if (doRemove && type !== 5 /* VNodeType.Fragment */) {
        // The vnode might or might not have a data.renderer associated to it
        // but the removal used here is from the owner instead.
        removeNode(elm, parent, renderer);
      }
      switch (type) {
        case 5 /* VNodeType.Fragment */:
          {
            unmountVNodes(vnode.children, parent, renderer, doRemove);
            break;
          }
        case 2 /* VNodeType.Element */:
          {
            // Slot content is removed to trigger slotchange event when removing slot.
            // Only required for synthetic shadow.
            const shouldRemoveChildren = sel === 'slot' && vnode.owner.shadowMode === 1 /* ShadowMode.Synthetic */;
            unmountVNodes(vnode.children, elm, renderer, shouldRemoveChildren);
            break;
          }
        case 3 /* VNodeType.CustomElement */:
          {
            const {
              vm
            } = vnode;
            // No need to unmount the children here, `removeVM` will take care of removing the
            // children.
            if (!isUndefined$1(vm)) {
              removeVM(vm);
            }
          }
      }
    }
    function unmountVNodes(vnodes, parent, renderer, doRemove = false, start = 0, end = vnodes.length) {
      for (; start < end; ++start) {
        const ch = vnodes[start];
        if (isVNode(ch)) {
          unmount(ch, parent, renderer, doRemove);
        }
      }
    }
    function isVNode(vnode) {
      return vnode != null;
    }
    function linkNodeToShadow(elm, owner, renderer) {
      const {
        renderRoot,
        renderMode,
        shadowMode
      } = owner;
      const {
        isSyntheticShadowDefined
      } = renderer;
      // TODO [#1164]: this should eventually be done by the polyfill directly
      if (isSyntheticShadowDefined) {
        if (shadowMode === 1 /* ShadowMode.Synthetic */ || renderMode === 0 /* RenderMode.Light */) {
          elm[KEY__SHADOW_RESOLVER] = renderRoot[KEY__SHADOW_RESOLVER];
        }
      }
    }
    function insertFragmentOrNode(vnode, parent, anchor, renderer) {
      if (process.env.NODE_ENV !== 'production') {
        unlockDomMutation();
      }
      if (isVFragment(vnode)) {
        const children = vnode.children;
        for (let i = 0; i < children.length; i += 1) {
          const child = children[i];
          if (!isNull(child)) {
            renderer.insert(child.elm, parent, anchor);
          }
        }
      } else {
        renderer.insert(vnode.elm, parent, anchor);
      }
      if (process.env.NODE_ENV !== 'production') {
        lockDomMutation();
      }
    }
    function insertNode(node, parent, anchor, renderer) {
      if (process.env.NODE_ENV !== 'production') {
        unlockDomMutation();
      }
      renderer.insert(node, parent, anchor);
      if (process.env.NODE_ENV !== 'production') {
        lockDomMutation();
      }
    }
    function removeNode(node, parent, renderer) {
      if (process.env.NODE_ENV !== 'production') {
        unlockDomMutation();
      }
      renderer.remove(node, parent);
      if (process.env.NODE_ENV !== 'production') {
        lockDomMutation();
      }
    }
    function patchElementPropsAndAttrsAndRefs$1(oldVnode, vnode, renderer) {
      if (isNull(oldVnode)) {
        applyEventListeners(vnode, renderer);
        applyStaticClassAttribute(vnode, renderer);
        applyStaticStyleAttribute(vnode, renderer);
      }
      const {
        owner
      } = vnode;
      // Attrs need to be applied to element before props IE11 will wipe out value on radio inputs if
      // value is set before type=radio.
      patchClassAttribute(oldVnode, vnode, renderer);
      patchStyleAttribute(oldVnode, vnode, renderer, owner);
      patchAttributes(oldVnode, vnode, renderer);
      patchProps(oldVnode, vnode, renderer);
      patchSlotAssignment(oldVnode, vnode, renderer);
      // The `refs` object is blown away in every re-render, so we always need to re-apply them
      applyRefs(vnode, owner);
    }
    function applyStyleScoping(elm, owner, renderer) {
      const {
        getClassList
      } = renderer;
      // Set the class name for `*.scoped.css` style scoping.
      const scopeToken = getScopeTokenClass(owner, /* legacy */false);
      if (!isNull(scopeToken)) {
        if (!isValidScopeToken(scopeToken)) {
          // See W-16614556
          throw new Error('stylesheet token must be a valid string');
        }
        // TODO [#2762]: this dot notation with add is probably problematic
        // probably we should have a renderer api for just the add operation
        getClassList(elm).add(scopeToken);
      }
      // TODO [#3733]: remove support for legacy scope tokens
      if (lwcRuntimeFlags.ENABLE_LEGACY_SCOPE_TOKENS) {
        const legacyScopeToken = getScopeTokenClass(owner, /* legacy */true);
        if (!isNull(legacyScopeToken)) {
          if (!isValidScopeToken(legacyScopeToken)) {
            // See W-16614556
            throw new Error('stylesheet token must be a valid string');
          }
          // TODO [#2762]: this dot notation with add is probably problematic
          // probably we should have a renderer api for just the add operation
          getClassList(elm).add(legacyScopeToken);
        }
      }
      // Set property element for synthetic shadow DOM style scoping.
      const {
        stylesheetToken: syntheticToken
      } = owner.context;
      if (owner.shadowMode === 1 /* ShadowMode.Synthetic */) {
        if (!isUndefined$1(syntheticToken)) {
          elm.$shadowToken$ = syntheticToken;
        }
        if (lwcRuntimeFlags.ENABLE_LEGACY_SCOPE_TOKENS) {
          const legacyToken = owner.context.legacyStylesheetToken;
          if (!isUndefined$1(legacyToken)) {
            elm.$legacyShadowToken$ = legacyToken;
          }
        }
      }
    }
    function applyDomManual(elm, vnode) {
      const {
        owner,
        data: {
          context
        }
      } = vnode;
      if (owner.shadowMode === 1 /* ShadowMode.Synthetic */ && context?.lwc?.dom === 'manual') {
        elm.$domManual$ = true;
      }
    }
    function applyElementRestrictions(elm, vnode) {
      if (process.env.NODE_ENV !== 'production') {
        const isSynthetic = vnode.owner.shadowMode === 1 /* ShadowMode.Synthetic */;
        const isPortal = vnode.type === 2 /* VNodeType.Element */ && vnode.data.context?.lwc?.dom === 'manual';
        const isLight = vnode.owner.renderMode === 0 /* RenderMode.Light */;
        patchElementWithRestrictions(elm, {
          isPortal,
          isLight,
          isSynthetic
        });
      }
    }
    function allocateChildren(vnode, vm) {
      // A component with slots will re-render because:
      // 1- There is a change of the internal state.
      // 2- There is a change on the external api (ex: slots)
      //
      // In case #1, the vnodes in the cmpSlots will be reused since they didn't changed. This routine emptied the
      // slotted children when those VCustomElement were rendered and therefore in subsequent calls to allocate children
      // in a reused VCustomElement, there won't be any slotted children.
      // For those cases, we will use the reference for allocated children stored when rendering the fresh VCustomElement.
      //
      // In case #2, we will always get a fresh VCustomElement.
      const children = vnode.aChildren || vnode.children;
      const {
        renderMode,
        shadowMode
      } = vm;
      if (process.env.NODE_ENV !== 'production') {
        // If any of the children being allocated is a scoped slot fragment, make sure the receiving
        // component is a light DOM component. This is mainly to validate light dom parent running
        // in native shadow mode.
        if (renderMode !== 0 /* RenderMode.Light */ && ArraySome.call(children, child => !isNull(child) && isVScopedSlotFragment(child))) {
          logError(`Invalid usage of 'lwc:slot-data' on ${getComponentTag(vm)} tag. Scoped slot content can only be passed to a light dom child.`);
        }
      }
      // If any of the children being allocated are VFragments, we remove the text delimiters and flatten all immediate
      // children VFragments to avoid them interfering with default slot behavior.
      const allocatedChildren = flattenFragmentsInChildren(children);
      vnode.children = allocatedChildren;
      vm.aChildren = allocatedChildren;
      if (shadowMode === 1 /* ShadowMode.Synthetic */ || renderMode === 0 /* RenderMode.Light */) {
        // slow path
        allocateInSlot(vm, allocatedChildren, vnode.owner);
        // save the allocated children in case this vnode is reused.
        vnode.aChildren = allocatedChildren;
        // every child vnode is now allocated, and the host should receive none directly, it receives them via the shadow!
        vnode.children = EmptyArray;
      }
    }
    /**
     * Flattens the contents of all VFragments in an array of VNodes, removes the text delimiters on those VFragments, and
     * marks the resulting children array as dynamic. Uses a stack (array) to iteratively traverse the nested VFragments
     * and avoid the perf overhead of creating/destroying throwaway arrays/objects in a recursive approach.
     *
     * With the delimiters removed, the contents are marked dynamic so they are diffed correctly.
     *
     * This function is used for slotted VFragments to avoid the text delimiters interfering with slotting functionality.
     * @param children
     */
    function flattenFragmentsInChildren(children) {
      const flattenedChildren = [];
      // Initialize our stack with the direct children of the custom component and check whether we have a VFragment.
      // If no VFragment is found in children, we don't need to traverse anything or mark the children dynamic and can return early.
      const nodeStack = [];
      let fragmentFound = false;
      for (let i = children.length - 1; i > -1; i -= 1) {
        const child = children[i];
        ArrayPush$1.call(nodeStack, child);
        fragmentFound = fragmentFound || !!(child && isVFragment(child));
      }
      if (!fragmentFound) {
        return children;
      }
      let currentNode;
      while (!isUndefined$1(currentNode = ArrayPop.call(nodeStack))) {
        if (!isNull(currentNode) && isVFragment(currentNode)) {
          const fChildren = currentNode.children;
          // Ignore the start and end text node delimiters
          for (let i = fChildren.length - 2; i > 0; i -= 1) {
            ArrayPush$1.call(nodeStack, fChildren[i]);
          }
        } else {
          ArrayPush$1.call(flattenedChildren, currentNode);
        }
      }
      // We always mark the children as dynamic because nothing generates stable VFragments yet.
      // If/when stable VFragments are generated by the compiler, this code should be updated to
      // not mark dynamic if all flattened VFragments were stable.
      markAsDynamicChildren(flattenedChildren);
      return flattenedChildren;
    }
    function createViewModelHook(elm, vnode, renderer) {
      let vm = getAssociatedVMIfPresent(elm);
      // There is a possibility that a custom element is registered under tagName, in which case, the
      // initialization is already carry on, and there is nothing else to do here since this hook is
      // called right after invoking `document.createElement`.
      if (!isUndefined$1(vm)) {
        return vm;
      }
      const {
        sel,
        mode,
        ctor,
        owner
      } = vnode;
      vm = createVM(elm, ctor, renderer, {
        mode,
        owner,
        tagName: sel
      });
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isArray$1(vnode.children), `Invalid vnode for a custom element, it must have children defined.`);
      }
      return vm;
    }
    function allocateInSlot(vm, children, owner) {
      const {
        cmpSlots: {
          slotAssignments: oldSlotsMapping
        }
      } = vm;
      const cmpSlotsMapping = create(null);
      // Collect all slots into cmpSlotsMapping
      for (let i = 0, len = children.length; i < len; i += 1) {
        const vnode = children[i];
        if (isNull(vnode)) {
          continue;
        }
        let slotName = '';
        if (isVBaseElement(vnode) || isVStatic(vnode)) {
          slotName = vnode.slotAssignment ?? '';
        } else if (isVScopedSlotFragment(vnode)) {
          slotName = vnode.slotName;
        }
        // Can't use toString here because Symbol(1).toString() is 'Symbol(1)'
        // but elm.setAttribute('slot', Symbol(1)) is an error.
        // the following line also throws same error for symbols
        // Similar for Object.create(null)
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const normalizedSlotName = '' + slotName;
        const vnodes = cmpSlotsMapping[normalizedSlotName] = cmpSlotsMapping[normalizedSlotName] || [];
        ArrayPush$1.call(vnodes, vnode);
      }
      vm.cmpSlots = {
        owner,
        slotAssignments: cmpSlotsMapping
      };
      if (isFalse(vm.isDirty)) {
        // We need to determine if the old allocation is really different from the new one
        // and mark the vm as dirty
        const oldKeys = keys(oldSlotsMapping);
        if (oldKeys.length !== keys(cmpSlotsMapping).length) {
          markComponentAsDirty(vm);
          return;
        }
        for (let i = 0, len = oldKeys.length; i < len; i += 1) {
          const key = oldKeys[i];
          if (isUndefined$1(cmpSlotsMapping[key]) || oldSlotsMapping[key].length !== cmpSlotsMapping[key].length) {
            markComponentAsDirty(vm);
            return;
          }
          const oldVNodes = oldSlotsMapping[key];
          const vnodes = cmpSlotsMapping[key];
          for (let j = 0, a = cmpSlotsMapping[key].length; j < a; j += 1) {
            if (oldVNodes[j] !== vnodes[j]) {
              markComponentAsDirty(vm);
              return;
            }
          }
        }
      }
    }
    const DynamicChildren = new WeakSet();
    // dynamic children means it was either generated by an iteration in a template
    // or part of an unstable fragment, and will require a more complex diffing algo.
    function markAsDynamicChildren(children) {
      DynamicChildren.add(children);
    }
    function hasDynamicChildren(children) {
      return DynamicChildren.has(children);
    }
    function createKeyToOldIdx(children, beginIdx, endIdx) {
      const map = {};
      // TODO [#1637]: simplify this by assuming that all vnodes has keys
      for (let j = beginIdx; j <= endIdx; ++j) {
        const ch = children[j];
        if (isVNode(ch)) {
          const {
            key
          } = ch;
          if (key !== undefined) {
            map[key] = j;
          }
        }
      }
      return map;
    }
    function updateDynamicChildren(oldCh, newCh, parent, renderer) {
      let oldStartIdx = 0;
      let newStartIdx = 0;
      let oldEndIdx = oldCh.length - 1;
      let oldStartVnode = oldCh[0];
      let oldEndVnode = oldCh[oldEndIdx];
      const newChEnd = newCh.length - 1;
      let newEndIdx = newChEnd;
      let newStartVnode = newCh[0];
      let newEndVnode = newCh[newEndIdx];
      let oldKeyToIdx;
      let idxInOld;
      let elmToMove;
      let before;
      let clonedOldCh = false;
      while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (!isVNode(oldStartVnode)) {
          oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
        } else if (!isVNode(oldEndVnode)) {
          oldEndVnode = oldCh[--oldEndIdx];
        } else if (!isVNode(newStartVnode)) {
          newStartVnode = newCh[++newStartIdx];
        } else if (!isVNode(newEndVnode)) {
          newEndVnode = newCh[--newEndIdx];
        } else if (isSameVnode(oldStartVnode, newStartVnode)) {
          patch(oldStartVnode, newStartVnode, parent, renderer);
          oldStartVnode = oldCh[++oldStartIdx];
          newStartVnode = newCh[++newStartIdx];
        } else if (isSameVnode(oldEndVnode, newEndVnode)) {
          patch(oldEndVnode, newEndVnode, parent, renderer);
          oldEndVnode = oldCh[--oldEndIdx];
          newEndVnode = newCh[--newEndIdx];
        } else if (isSameVnode(oldStartVnode, newEndVnode)) {
          // Vnode moved right
          patch(oldStartVnode, newEndVnode, parent, renderer);
          // In the case of fragments, the `elm` property of a vfragment points to the leading
          // anchor. To determine the next sibling of the whole fragment, we need to use the
          // trailing anchor as the argument to nextSibling():
          // [..., [leading, ...content, trailing], nextSibling, ...]
          let anchor;
          if (isVFragment(oldEndVnode)) {
            anchor = renderer.nextSibling(oldEndVnode.trailing.elm);
          } else {
            anchor = renderer.nextSibling(oldEndVnode.elm);
          }
          insertFragmentOrNode(oldStartVnode, parent, anchor, renderer);
          oldStartVnode = oldCh[++oldStartIdx];
          newEndVnode = newCh[--newEndIdx];
        } else if (isSameVnode(oldEndVnode, newStartVnode)) {
          // Vnode moved left
          patch(oldEndVnode, newStartVnode, parent, renderer);
          insertFragmentOrNode(newStartVnode, parent, oldStartVnode.elm, renderer);
          oldEndVnode = oldCh[--oldEndIdx];
          newStartVnode = newCh[++newStartIdx];
        } else {
          if (oldKeyToIdx === undefined) {
            oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
          }
          idxInOld = oldKeyToIdx[newStartVnode.key];
          if (isUndefined$1(idxInOld)) {
            // New element
            mount(newStartVnode, parent, renderer, oldStartVnode.elm);
            newStartVnode = newCh[++newStartIdx];
          } else {
            elmToMove = oldCh[idxInOld];
            if (isVNode(elmToMove)) {
              if (elmToMove.sel !== newStartVnode.sel) {
                // New element
                mount(newStartVnode, parent, renderer, oldStartVnode.elm);
              } else {
                patch(elmToMove, newStartVnode, parent, renderer);
                // Delete the old child, but copy the array since it is read-only.
                // The `oldCh` will be GC'ed after `updateDynamicChildren` is complete,
                // so we only care about the `oldCh` object inside this function.
                // To avoid cloning over and over again, we check `clonedOldCh`
                // and only clone once.
                if (!clonedOldCh) {
                  clonedOldCh = true;
                  oldCh = [...oldCh];
                }
                // We've already cloned at least once, so it's no longer read-only
                oldCh[idxInOld] = undefined;
                insertFragmentOrNode(elmToMove, parent, oldStartVnode.elm, renderer);
              }
            }
            newStartVnode = newCh[++newStartIdx];
          }
        }
      }
      if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
        if (oldStartIdx > oldEndIdx) {
          // There's some cases in which the sub array of vnodes to be inserted is followed by null(s) and an
          // already processed vnode, in such cases the vnodes to be inserted should be before that processed vnode.
          let i = newEndIdx;
          let n;
          do {
            n = newCh[++i];
          } while (!isVNode(n) && i < newChEnd);
          before = isVNode(n) ? n.elm : null;
          mountVNodes(newCh, parent, renderer, before, newStartIdx, newEndIdx + 1);
        } else {
          unmountVNodes(oldCh, parent, renderer, true, oldStartIdx, oldEndIdx + 1);
        }
      }
    }
    function updateStaticChildren(c1, c2, parent, renderer) {
      const c1Length = c1.length;
      const c2Length = c2.length;
      if (c1Length === 0) {
        // the old list is empty, we can directly insert anything new
        mountVNodes(c2, parent, renderer, null);
        return;
      }
      if (c2Length === 0) {
        // the old list is nonempty and the new list is empty so we can directly remove all old nodes
        // this is the case in which the dynamic children of an if-directive should be removed
        unmountVNodes(c1, parent, renderer, true);
        return;
      }
      // if the old list is not empty, the new list MUST have the same
      // amount of nodes, that's why we call this static children
      let anchor = null;
      for (let i = c2Length - 1; i >= 0; i -= 1) {
        const n1 = c1[i];
        const n2 = c2[i];
        if (n2 !== n1) {
          if (isVNode(n1)) {
            if (isVNode(n2)) {
              if (isSameVnode(n1, n2)) {
                // both vnodes are equivalent, and we just need to patch them
                patch(n1, n2, parent, renderer);
                anchor = n2.elm;
              } else {
                // removing the old vnode since the new one is different
                unmount(n1, parent, renderer, true);
                mount(n2, parent, renderer, anchor);
                anchor = n2.elm;
              }
            } else {
              // removing the old vnode since the new one is null
              unmount(n1, parent, renderer, true);
            }
          } else if (isVNode(n2)) {
            mount(n2, parent, renderer, anchor);
            anchor = n2.elm;
          }
        }
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const SymbolIterator = Symbol.iterator;
    function addVNodeToChildLWC(vnode) {
      ArrayPush$1.call(getVMBeingRendered().velements, vnode);
    }
    // [s]tatic [p]art
    function sp(partId, data, text) {
      // Static part will always have either text or data, it's guaranteed by the compiler.
      const type = isNull(text) ? 1 /* VStaticPartType.Element */ : 0 /* VStaticPartType.Text */;
      return {
        type,
        partId,
        data,
        text,
        elm: undefined // elm is defined later
      };
    }
    // [s]coped [s]lot [f]actory
    function ssf(slotName, factory) {
      return {
        type: 6 /* VNodeType.ScopedSlotFragment */,
        factory,
        owner: getVMBeingRendered(),
        elm: undefined,
        sel: '__scoped_slot_fragment__',
        key: undefined,
        slotName
      };
    }
    // [st]atic node
    function st(fragmentFactory, key, parts) {
      const owner = getVMBeingRendered();
      const fragment = fragmentFactory(parts);
      const vnode = {
        type: 4 /* VNodeType.Static */,
        sel: '__static__',
        key,
        elm: undefined,
        fragment,
        owner,
        parts,
        slotAssignment: undefined
      };
      return vnode;
    }
    // [fr]agment node
    function fr(key, children, stable) {
      const owner = getVMBeingRendered();
      const useCommentNodes = isAPIFeatureEnabled(5 /* APIFeature.USE_COMMENTS_FOR_FRAGMENT_BOOKENDS */, owner.apiVersion);
      const leading = useCommentNodes ? co('') : t('');
      const trailing = useCommentNodes ? co('') : t('');
      return {
        type: 5 /* VNodeType.Fragment */,
        sel: '__fragment__',
        key,
        elm: undefined,
        children: [leading, ...children, trailing],
        stable,
        owner,
        leading,
        trailing
      };
    }
    // [h]tml node
    function h(sel, data, children = EmptyArray) {
      const vmBeingRendered = getVMBeingRendered();
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isString(sel), `h() 1st argument sel must be a string.`);
        assert.isTrue(isObject(data), `h() 2nd argument data must be an object.`);
        assert.isTrue(isArray$1(children), `h() 3rd argument children must be an array.`);
        assert.isTrue('key' in data, ` <${sel}> "key" attribute is invalid or missing for ${vmBeingRendered}. Key inside iterator is either undefined or null.`);
        // checking reserved internal data properties
        assert.isFalse(data.className && data.classMap, `vnode.data.className and vnode.data.classMap ambiguous declaration.`);
        assert.isFalse(data.styleDecls && data.style, `vnode.data.styleDecls and vnode.data.style ambiguous declaration.`);
        forEach.call(children, childVnode => {
          if (childVnode != null) {
            assert.isTrue('type' in childVnode && 'sel' in childVnode && 'elm' in childVnode && 'key' in childVnode, `${childVnode} is not a vnode.`);
          }
        });
      }
      const {
        key,
        slotAssignment
      } = data;
      const vnode = {
        type: 2 /* VNodeType.Element */,
        sel,
        data,
        children,
        elm: undefined,
        key,
        owner: vmBeingRendered,
        slotAssignment
      };
      return vnode;
    }
    // [t]ab[i]ndex function
    function ti(value) {
      // if value is greater than 0, we normalize to 0
      // If value is an invalid tabIndex value (null, undefined, string, etc), we let that value pass through
      // If value is less than -1, we don't care
      const shouldNormalize = value > 0 && !(isTrue(value) || isFalse(value));
      if (process.env.NODE_ENV !== 'production') {
        const vmBeingRendered = getVMBeingRendered();
        if (shouldNormalize) {
          logError(`Invalid tabindex value \`${toString(value)}\` in template for ${vmBeingRendered}. This attribute must be set to 0 or -1.`, vmBeingRendered);
        }
      }
      return shouldNormalize ? 0 : value;
    }
    // [s]lot element node
    function s(slotName, data, children, slotset) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isString(slotName), `s() 1st argument slotName must be a string.`);
        assert.isTrue(isObject(data), `s() 2nd argument data must be an object.`);
        assert.isTrue(isArray$1(children), `h() 3rd argument children must be an array.`);
      }
      const vmBeingRendered = getVMBeingRendered();
      const {
        renderMode,
        apiVersion
      } = vmBeingRendered;
      if (!isUndefined$1(slotset) && !isUndefined$1(slotset.slotAssignments) && !isUndefined$1(slotset.slotAssignments[slotName]) && slotset.slotAssignments[slotName].length !== 0) {
        const newChildren = [];
        const slotAssignments = slotset.slotAssignments[slotName];
        for (let i = 0; i < slotAssignments.length; i++) {
          const vnode = slotAssignments[i];
          if (!isNull(vnode)) {
            const assignedNodeIsScopedSlot = isVScopedSlotFragment(vnode);
            // The only sniff test for a scoped <slot> element is the presence of `slotData`
            const isScopedSlotElement = !isUndefined$1(data.slotData);
            // Check if slot types of parent and child are matching
            if (assignedNodeIsScopedSlot !== isScopedSlotElement) {
              if (process.env.NODE_ENV !== 'production') {
                logError(`Mismatched slot types for ${slotName === '' ? '(default)' : slotName} slot. Both parent and child component must use standard type or scoped type for a given slot.`, slotset.owner);
              }
              // Ignore slot content from parent
              continue;
            }
            // If the passed slot content is factory, evaluate it and add the produced vnodes
            if (assignedNodeIsScopedSlot) {
              // Evaluate in the scope of the slot content's owner
              // if a slotset is provided, there will always be an owner. The only case where owner is
              // undefined is for root components, but root components cannot accept slotted content
              setVMBeingRendered(slotset.owner);
              try {
                // The factory function is a template snippet from the slot set owner's template,
                // hence switch over to the slot set owner's template reactive observer
                const {
                  tro
                } = slotset.owner;
                tro.observe(() => {
                  ArrayPush$1.call(newChildren, vnode.factory(data.slotData, data.key));
                });
              } finally {
                setVMBeingRendered(vmBeingRendered);
              }
            } else {
              // This block is for standard slots (non-scoped slots)
              let clonedVNode;
              if (renderMode === 0 /* RenderMode.Light */ && isAPIFeatureEnabled(6 /* APIFeature.USE_LIGHT_DOM_SLOT_FORWARDING */, apiVersion) && (isVBaseElement(vnode) || isVStatic(vnode)) && vnode.slotAssignment !== data.slotAssignment) {
                // When the light DOM slot assignment (slot attribute) changes, we can't use the same reference
                // to the vnode because the current way the diffing algo works, it will replace the original
                // reference to the host element with a new one. This means the new element will be mounted and
                // immediately unmounted. Creating a copy of the vnode preserves a reference to the previous
                // host element.
                clonedVNode = {
                  ...vnode,
                  slotAssignment: data.slotAssignment
                };
                // For disconnectedCallback to work correctly in synthetic lifecycle mode, we need to link the
                // current VM's velements to the clone, so that when the VM unmounts, the clone also unmounts.
                // Note this only applies to VCustomElements, since those are the elements that we manually need
                // to call disconnectedCallback for, when running in synthetic lifecycle mode.
                //
                // You might think it would make more sense to add the clonedVNode to the same velements array
                // as the original vnode's VM (i.e. `vnode.owner.velements`) rather than the current VM (i.e.
                // `vmBeingRendered.velements`), but this actually might not trigger disconnectedCallback
                // in synthetic lifecycle mode. The reason for this is that a reactivity change may cause
                // the slottable component to unmount, but _not_ the slotter component (see issue #4446).
                //
                // If this occurs, then the slottable component (i.e .this component we are rendering right
                // now) is the one that needs to own the clone. Whereas if a reactivity change higher in the
                // tree causes the slotter to unmount, then the slottable will also unmount. So using the
                // current VM works either way.
                if (isVCustomElement(vnode)) {
                  addVNodeToChildLWC(clonedVNode);
                }
              }
              // If the slot content is standard type, the content is static, no additional
              // processing needed on the vnode
              ArrayPush$1.call(newChildren, clonedVNode ?? vnode);
            }
          }
        }
        children = newChildren;
      }
      const {
        shadowMode
      } = vmBeingRendered;
      if (renderMode === 0 /* RenderMode.Light */) {
        // light DOM slots - backwards-compatible behavior uses flattening, new behavior uses fragments
        if (isAPIFeatureEnabled(2 /* APIFeature.USE_FRAGMENTS_FOR_LIGHT_DOM_SLOTS */, apiVersion)) {
          return fr(data.key, children, 0);
        } else {
          sc(children);
          return children;
        }
      }
      if (shadowMode === 1 /* ShadowMode.Synthetic */) {
        // TODO [#1276]: compiler should give us some sort of indicator when a vnodes collection is dynamic
        sc(children);
      }
      return h('slot', data, children);
    }
    // [c]ustom element node
    function c(sel, Ctor, data, children = EmptyArray) {
      const vmBeingRendered = getVMBeingRendered();
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isString(sel), `c() 1st argument sel must be a string.`);
        assert.isTrue(isFunction$1(Ctor), `c() 2nd argument Ctor must be a function.`);
        assert.isTrue(isObject(data), `c() 3nd argument data must be an object.`);
        assert.isTrue(arguments.length === 3 || isArray$1(children), `c() 4nd argument data must be an array.`);
        // checking reserved internal data properties
        assert.isFalse(data.className && data.classMap, `vnode.data.className and vnode.data.classMap ambiguous declaration.`);
        assert.isFalse(data.styleDecls && data.style, `vnode.data.styleDecls and vnode.data.style ambiguous declaration.`);
        if (data.style && !isString(data.style)) {
          logError(`Invalid 'style' attribute passed to <${sel}> is ignored. This attribute must be a string value.`, vmBeingRendered);
        }
        if (arguments.length === 4) {
          forEach.call(children, childVnode => {
            if (childVnode != null) {
              assert.isTrue('type' in childVnode && 'sel' in childVnode && 'elm' in childVnode && 'key' in childVnode, `${childVnode} is not a vnode.`);
            }
          });
        }
      }
      const {
        key,
        slotAssignment
      } = data;
      let elm, aChildren, vm;
      const vnode = {
        type: 3 /* VNodeType.CustomElement */,
        sel,
        data,
        children,
        elm,
        key,
        slotAssignment,
        ctor: Ctor,
        owner: vmBeingRendered,
        mode: 'open',
        // TODO [#1294]: this should be defined in Ctor
        aChildren,
        vm
      };
      addVNodeToChildLWC(vnode);
      return vnode;
    }
    // [i]terable node
    function i(iterable, factory) {
      const list = [];
      // TODO [#1276]: compiler should give us some sort of indicator when a vnodes collection is dynamic
      sc(list);
      const vmBeingRendered = getVMBeingRendered();
      if (isUndefined$1(iterable) || isNull(iterable)) {
        if (process.env.NODE_ENV !== 'production') {
          logError(`Invalid template iteration for value \`${toString(iterable)}\` in ${vmBeingRendered}. It must be an array-like object.`, vmBeingRendered);
        }
        return list;
      }
      if (process.env.NODE_ENV !== 'production') {
        assert.isFalse(isUndefined$1(iterable[SymbolIterator]), `Invalid template iteration for value \`${toString(iterable)}\` in ${vmBeingRendered}. It must be an array-like object.`);
      }
      const iterator = iterable[SymbolIterator]();
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(iterator && isFunction$1(iterator.next), `Invalid iterator function for "${toString(iterable)}" in ${vmBeingRendered}.`);
      }
      let next = iterator.next();
      let j = 0;
      let {
        value,
        done: last
      } = next;
      let keyMap;
      let iterationError;
      if (process.env.NODE_ENV !== 'production') {
        keyMap = create(null);
      }
      while (last === false) {
        // implementing a look-back-approach because we need to know if the element is the last
        next = iterator.next();
        last = next.done;
        // template factory logic based on the previous collected value
        const vnode = factory(value, j, j === 0, last === true);
        if (isArray$1(vnode)) {
          ArrayPush$1.apply(list, vnode);
        } else {
          // `isArray` doesn't narrow this block properly...
          ArrayPush$1.call(list, vnode);
        }
        if (process.env.NODE_ENV !== 'production') {
          const vnodes = isArray$1(vnode) ? vnode : [vnode];
          forEach.call(vnodes, childVnode => {
            // Check that the child vnode is either an element or VStatic
            if (!isNull(childVnode) && (isVBaseElement(childVnode) || isVStatic(childVnode))) {
              const {
                key
              } = childVnode;
              // In @lwc/engine-server the fragment doesn't have a tagName, default to the VM's tagName.
              const {
                tagName
              } = vmBeingRendered;
              if (isString(key) || isNumber(key)) {
                if (keyMap[key] === 1 && isUndefined$1(iterationError)) {
                  iterationError = `Duplicated "key" attribute value in "<${tagName}>" for item number ${j}. A key with value "${key}" appears more than once in the iteration. Key values must be unique numbers or strings.`;
                }
                keyMap[key] = 1;
              } else if (isUndefined$1(iterationError)) {
                iterationError = `Invalid "key" attribute value in "<${tagName}>" for item number ${j}. Set a unique "key" value on all iterated child elements.`;
              }
            }
          });
        }
        // preparing next value
        j += 1;
        value = next.value;
      }
      if (process.env.NODE_ENV !== 'production') {
        if (!isUndefined$1(iterationError)) {
          logError(iterationError, vmBeingRendered);
        }
      }
      return list;
    }
    /**
     * [f]lattening
     * @param items
     */
    function f(items) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isArray$1(items), 'flattening api can only work with arrays.');
      }
      const len = items.length;
      const flattened = [];
      // TODO [#1276]: compiler should give us some sort of indicator when a vnodes collection is dynamic
      sc(flattened);
      for (let j = 0; j < len; j += 1) {
        const item = items[j];
        if (isArray$1(item)) {
          ArrayPush$1.apply(flattened, item);
        } else {
          // `isArray` doesn't narrow this block properly...
          ArrayPush$1.call(flattened, item);
        }
      }
      return flattened;
    }
    // [t]ext node
    function t(text) {
      let key, elm;
      return {
        type: 0 /* VNodeType.Text */,
        sel: '__text__',
        text,
        elm,
        key,
        owner: getVMBeingRendered()
      };
    }
    // [co]mment node
    function co(text) {
      let elm, key;
      return {
        type: 1 /* VNodeType.Comment */,
        sel: '__comment__',
        text,
        elm,
        key,
        owner: getVMBeingRendered()
      };
    }
    // [d]ynamic text
    function d(value) {
      return value == null ? '' : String(value);
    }
    // [b]ind function
    function b(fn) {
      const vmBeingRendered = getVMBeingRendered();
      if (isNull(vmBeingRendered)) {
        throw new Error();
      }
      const vm = vmBeingRendered;
      return function (event) {
        invokeEventListener(vm, fn, vm.component, event);
      };
    }
    // [k]ey function
    function k(compilerKey, obj) {
      switch (typeof obj) {
        case 'number':
        case 'string':
          return compilerKey + ':' + obj;
        case 'object':
          if (process.env.NODE_ENV !== 'production') {
            logError(`Invalid key value "${obj}" in ${getVMBeingRendered()}. Key must be a string or number.`);
          }
      }
    }
    // [g]lobal [id] function
    function gid(id) {
      const vmBeingRendered = getVMBeingRendered();
      if (isUndefined$1(id) || id === '') {
        return id;
      }
      // We remove attributes when they are assigned a value of null
      if (isNull(id)) {
        return null;
      }
      const {
        idx,
        shadowMode
      } = vmBeingRendered;
      if (shadowMode === 1 /* ShadowMode.Synthetic */) {
        return StringReplace.call(id, /\S+/g, id => `${id}-${idx}`);
      }
      return id;
    }
    // [f]ragment [id] function
    function fid(url) {
      const vmBeingRendered = getVMBeingRendered();
      if (isUndefined$1(url) || url === '') {
        return url;
      }
      // We remove attributes when they are assigned a value of null
      if (isNull(url)) {
        return null;
      }
      const {
        idx,
        shadowMode
      } = vmBeingRendered;
      // Apply transformation only for fragment-only-urls, and only in shadow DOM
      if (shadowMode === 1 /* ShadowMode.Synthetic */ && /^#/.test(url)) {
        return `${url}-${idx}`;
      }
      return url;
    }
    /**
     * [ddc] - create a (deprecated) dynamic component via `<x-foo lwc:dynamic={Ctor}>`
     *
     * TODO [#3331]: remove usage of lwc:dynamic in 246
     * @param sel
     * @param Ctor
     * @param data
     * @param children
     */
    function ddc(sel, Ctor, data, children = EmptyArray) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isString(sel), `dc() 1st argument sel must be a string.`);
        assert.isTrue(isObject(data), `dc() 3nd argument data must be an object.`);
        assert.isTrue(arguments.length === 3 || isArray$1(children), `dc() 4nd argument data must be an array.`);
      }
      // null or undefined values should produce a null value in the VNodes
      if (isNull(Ctor) || isUndefined$1(Ctor)) {
        return null;
      }
      if (!isComponentConstructor(Ctor)) {
        throw new Error(`Invalid LWC Constructor ${toString(Ctor)} for custom element <${sel}>.`);
      }
      return c(sel, Ctor, data, children);
    }
    /**
     * [dc] - create a dynamic component via `<lwc:component lwc:is={Ctor}>`
     * @param Ctor
     * @param data
     * @param children
     */
    function dc(Ctor, data, children = EmptyArray) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isObject(data), `dc() 2nd argument data must be an object.`);
        assert.isTrue(arguments.length === 3 || isArray$1(children), `dc() 3rd argument data must be an array.`);
      }
      // Null or undefined values should produce a null value in the VNodes.
      // This is the only value at compile time as the constructor will not be known.
      if (isNull(Ctor) || isUndefined$1(Ctor)) {
        return null;
      }
      if (!isComponentConstructor(Ctor)) {
        throw new Error(`Invalid constructor: "${toString(Ctor)}" is not a LightningElement constructor.`);
      }
      // Look up the dynamic component's name at runtime once the constructor is available.
      // This information is only known at runtime and is stored as part of registerComponent.
      const sel = getComponentRegisteredName(Ctor);
      if (isUndefined$1(sel) || sel === '') {
        throw new Error(`Invalid LWC constructor ${toString(Ctor)} does not have a registered name`);
      }
      return c(sel, Ctor, data, children);
    }
    /**
     * slow children collection marking mechanism. this API allows the compiler to signal
     * to the engine that a particular collection of children must be diffed using the slow
     * algo based on keys due to the nature of the list. E.g.:
     *
     * - slot element's children: the content of the slot has to be dynamic when in synthetic
     * shadow mode because the `vnode.children` might be the slotted
     * content vs default content, in which case the size and the
     * keys are not matching.
     * - children that contain dynamic components
     * - children that are produced by iteration
     * @param vnodes
     */
    function sc(vnodes) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(isArray$1(vnodes), 'sc() api can only work with arrays.');
      }
      // We have to mark the vnodes collection as dynamic so we can later on
      // choose to use the snabbdom virtual dom diffing algo instead of our
      // static dummy algo.
      markAsDynamicChildren(vnodes);
      return vnodes;
    }
    // [s]anitize [h]tml [c]ontent
    function shc(content) {
      const sanitizedString = sanitizeHtmlContent();
      return createSanitizedHtmlContent(sanitizedString);
    }
    const ncls = normalizeClass;
    const api = freeze({
      s,
      h,
      c,
      i,
      f,
      t,
      d,
      b,
      k,
      co,
      dc,
      fr,
      ti,
      st,
      gid,
      fid,
      shc,
      ssf,
      ddc,
      sp,
      ncls
    });

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const operationIdNameMapping = ['constructor', 'render', 'patch', 'connectedCallback', 'renderedCallback', 'disconnectedCallback', 'errorCallback', 'lwc-render', 'lwc-rerender', 'lwc-ssr-hydrate'];
    const operationTooltipMapping = [
    // constructor
    'component constructor()',
    // render
    'component render() and virtual DOM rendered',
    // patch
    'component DOM rendered',
    // connectedCallback
    'component connectedCallback()',
    // renderedCallback
    'component renderedCallback()',
    // disconnectedCallback
    'component disconnectedCallback()',
    // errorCallback
    'component errorCallback()',
    // lwc-render
    'component first rendered',
    // lwc-rerender
    'component re-rendered',
    // lwc-ssr-hydrate
    'component hydrated from server-rendered HTML'];
    // Even if all the browser the engine supports implements the UserTiming API, we need to guard the measure APIs.
    // JSDom (used in Jest) for example doesn't implement the UserTiming APIs.
    const isUserTimingSupported = typeof performance !== 'undefined' && typeof performance.mark === 'function' && typeof performance.clearMarks === 'function' && typeof performance.measure === 'function' && typeof performance.clearMeasures === 'function';
    const start = !isUserTimingSupported ? noop : markName => {
      performance.mark(markName);
    };
    const end = !isUserTimingSupported ? noop : (measureName, markName, devtools) => {
      performance.measure(measureName, {
        start: markName,
        detail: {
          devtools: {
            dataType: 'track-entry',
            track: '⚡️ Lightning Web Components',
            ...devtools
          }
        }
      });
      // Clear the created marks and measure to avoid filling the performance entries buffer.
      // Note: Even if the entries get deleted, existing PerformanceObservers preserve a copy of those entries.
      performance.clearMarks(markName);
      performance.clearMeasures(measureName);
    };
    function getOperationName(opId) {
      return operationIdNameMapping[opId];
    }
    function getMeasureName(opId, vm) {
      return `${getComponentTag(vm)} - ${getOperationName(opId)}`;
    }
    function getMarkName(opId, vm) {
      // Adding the VM idx to the mark name creates a unique mark name component instance. This is necessary to produce
      // the right measures for components that are recursive.
      return `${getMeasureName(opId, vm)} - ${vm.idx}`;
    }
    function getProperties(vm) {
      return [['Tag Name', vm.tagName], ['Component ID', String(vm.idx)], ['Render Mode', vm.renderMode === 0 /* RenderMode.Light */ ? 'light DOM' : 'shadow DOM'], ['Shadow Mode', vm.shadowMode === 0 /* ShadowMode.Native */ ? 'native' : 'synthetic']];
    }
    function getColor(opId) {
      // As of Sept 2024: primary (dark blue), secondary (light blue), tertiary (green)
      switch (opId) {
        // GlobalSsrHydrate, GlobalRender, and Constructor tend to occur at the top level
        case 7 /* OperationId.GlobalRender */:
        case 9 /* OperationId.GlobalSsrHydrate */:
        case 0 /* OperationId.Constructor */:
          return 'primary';
        // GlobalRerender also occurs at the top level, but we want to use tertiary (green) because it's easier to
        // distinguish from primary, and at a glance you should be able to easily tell re-renders from first renders.
        case 8 /* OperationId.GlobalRerender */:
          return 'tertiary';
        // Everything else (patch/render/callbacks)
        default:
          return 'secondary';
      }
    }
    // Create a list of tag names to the properties that were mutated, to help answer the question of
    // "why did this component re-render?"
    function getMutationProperties(mutationLogs) {
      // `mutationLogs` should never have length 0, but bail out if it does for whatever reason
      if (isUndefined$1(mutationLogs)) {
        return EmptyArray;
      }
      if (!mutationLogs.length) {
        // Currently this only occurs for experimental signals, because those mutations are not triggered by accessors
        // TODO [#4546]: support signals in mutation logging
        return EmptyArray;
      }
      // Keep track of unique IDs per tag name so we can just report a raw count at the end, e.g.
      // `<x-foo> (x2)` to indicate that two instances of `<x-foo>` were rendered.
      const tagNamesToIdsAndProps = new Map();
      for (const {
        vm: {
          tagName,
          idx
        },
        prop
      } of mutationLogs) {
        let idsAndProps = tagNamesToIdsAndProps.get(tagName);
        if (isUndefined$1(idsAndProps)) {
          idsAndProps = {
            ids: new Set(),
            keys: new Set()
          };
          tagNamesToIdsAndProps.set(tagName, idsAndProps);
        }
        idsAndProps.ids.add(idx);
        idsAndProps.keys.add(prop);
      }
      // Sort by tag name
      const entries = ArraySort.call([...tagNamesToIdsAndProps], (a, b) => a[0].localeCompare(b[0]));
      const tagNames = ArrayMap.call(entries, item => item[0]);
      // Show e.g. `<x-foo>` for one instance, or `<x-foo> (x2)` for two instances. (\u00D7 is multiplication symbol)
      const tagNamesToDisplayTagNames = new Map();
      for (const tagName of tagNames) {
        const {
          ids
        } = tagNamesToIdsAndProps.get(tagName);
        const displayTagName = `<${tagName}>${ids.size > 1 ? ` (\u00D7${ids.size})` : ''}`;
        tagNamesToDisplayTagNames.set(tagName, displayTagName);
      }
      // Summary row
      const usePlural = tagNames.length > 1 || tagNamesToIdsAndProps.get(tagNames[0]).ids.size > 1;
      const result = [[`Component${usePlural ? 's' : ''}`, ArrayJoin.call(ArrayMap.call(tagNames, _ => tagNamesToDisplayTagNames.get(_)), ', ')]];
      // Detail rows
      for (const [prettyTagName, {
        keys
      }] of entries) {
        const displayTagName = tagNamesToDisplayTagNames.get(prettyTagName);
        ArrayPush$1.call(result, [displayTagName, ArrayJoin.call(ArraySort.call([...keys]), ', ')]);
      }
      return result;
    }
    function getTooltipText(measureName, opId) {
      return `${measureName} - ${operationTooltipMapping[opId]}`;
    }
    /** Indicates if operations should be logged via the User Timing API. */
    const isMeasureEnabled = process.env.NODE_ENV !== 'production';
    function logOperationStart(opId, vm) {
      if (isMeasureEnabled) {
        const markName = getMarkName(opId, vm);
        start(markName);
      }
    }
    function logOperationEnd(opId, vm) {
      if (isMeasureEnabled) {
        const markName = getMarkName(opId, vm);
        const measureName = getMeasureName(opId, vm);
        end(measureName, markName, {
          color: getColor(opId),
          tooltipText: getTooltipText(measureName, opId),
          properties: getProperties(vm)
        });
      }
    }
    function logGlobalOperationStart(opId) {
      if (isMeasureEnabled) {
        const markName = getOperationName(opId);
        start(markName);
      }
    }
    function logGlobalOperationStartWithVM(opId, vm) {
      if (isMeasureEnabled) {
        const markName = getMarkName(opId, vm);
        start(markName);
      }
    }
    function logGlobalOperationEnd(opId, mutationLogs) {
      if (isMeasureEnabled) {
        const opName = getOperationName(opId);
        const markName = opName;
        end(opName, markName, {
          color: getColor(opId),
          tooltipText: getTooltipText(opName, opId),
          properties: getMutationProperties(mutationLogs)
        });
      }
    }
    function logGlobalOperationEndWithVM(opId, vm) {
      if (isMeasureEnabled) {
        const opName = getOperationName(opId);
        const markName = getMarkName(opId, vm);
        end(opName, markName, {
          color: getColor(opId),
          tooltipText: getTooltipText(opName, opId),
          properties: getProperties(vm)
        });
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // HAS_SCOPED_STYLE | SHADOW_MODE_SYNTHETIC = 3
    const MAX_CACHE_KEY = 3;
    // Mapping of cacheKeys to `string[]` (assumed to come from a tagged template literal) to an Element.
    // Note that every unique tagged template literal will have a unique `string[]`. So by using `string[]`
    // as the WeakMap key, we effectively associate each Element with a unique tagged template literal.
    // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates
    // Also note that this array only needs to be large enough to account for the maximum possible cache key
    const fragmentCache = ArrayFrom({
      length: MAX_CACHE_KEY + 1
    }, () => new WeakMap());
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      window.__lwcResetFragmentCache = () => {
        for (let i = 0; i < fragmentCache.length; i++) {
          fragmentCache[i] = new WeakMap();
        }
      };
    }
    function getFromFragmentCache(cacheKey, strings) {
      return fragmentCache[cacheKey].get(strings);
    }
    function setInFragmentCache(cacheKey, strings, element) {
      fragmentCache[cacheKey].set(strings, element);
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let isUpdatingTemplate = false;
    let vmBeingRendered = null;
    function getVMBeingRendered() {
      return vmBeingRendered;
    }
    function setVMBeingRendered(vm) {
      vmBeingRendered = vm;
    }
    function validateSlots(vm) {
      assertNotProd(); // this method should never leak to prod
      const {
        cmpSlots
      } = vm;
      for (const slotName in cmpSlots.slotAssignments) {
        assert.isTrue(isArray$1(cmpSlots.slotAssignments[slotName]), `Slots can only be set to an array, instead received ${toString(cmpSlots.slotAssignments[slotName])} for slot "${slotName}" in ${vm}.`);
      }
    }
    function checkHasMatchingRenderMode(template, vm) {
      // don't validate in prod environments where reporting is disabled
      if (process.env.NODE_ENV === 'production' && true) {
        return;
      }
      // don't validate the default empty template - it is not inherently light or shadow
      if (template === defaultEmptyTemplate) {
        return;
      }
      // TODO [#4663]: `renderMode` mismatch between template and component causes `console.error` but no error
      // Note that `undefined` means shadow in this case, because shadow is the default.
      const vmIsLight = vm.renderMode === 0 /* RenderMode.Light */;
      const templateIsLight = template.renderMode === 'light';
      if (vmIsLight !== templateIsLight) {
        report("RenderModeMismatch" /* ReportingEventId.RenderModeMismatch */, {
          tagName: vm.tagName,
          mode: vm.renderMode
        });
        if (process.env.NODE_ENV !== 'production') {
          const tagName = getComponentTag(vm);
          const message = vmIsLight ? `Light DOM components can't render shadow DOM templates. Add an 'lwc:render-mode="light"' directive to the root template tag of ${tagName}.` : `Shadow DOM components template can't render light DOM templates. Either remove the 'lwc:render-mode' directive from ${tagName} or set it to 'lwc:render-mode="shadow"`;
          logError(message);
        }
      }
    }
    const browserExpressionSerializer = (partToken, classAttrToken) => {
      // This will insert the scoped style token as a static class attribute in the fragment
      // bypassing the need to call applyStyleScoping when mounting static parts.
      const type = StringCharAt.call(partToken, 0);
      switch (type) {
        case "c" /* STATIC_PART_TOKEN_ID.CLASS */:
          return classAttrToken;
        case "t" /* STATIC_PART_TOKEN_ID.TEXT */:
          // Using a single space here gives us a single empty text node
          return ' ';
        default:
          return '';
      }
    };
    // This function serializes the expressions generated by static content optimization.
    // Currently this is only needed for SSR.
    // TODO [#4078]: Split the implementation between @lwc/engine-dom and @lwc/engine-server
    function buildSerializeExpressionFn(parts) {
      {
        return browserExpressionSerializer;
      }
    }
    function buildParseFragmentFn(createFragmentFn) {
      return function parseFragment(strings, ...keys) {
        return function applyFragmentParts(parts) {
          const {
            context: {
              hasScopedStyles,
              stylesheetToken,
              legacyStylesheetToken
            },
            shadowMode,
            renderer
          } = getVMBeingRendered();
          const hasStyleToken = !isUndefined$1(stylesheetToken);
          const isSyntheticShadow = shadowMode === 1 /* ShadowMode.Synthetic */;
          const hasLegacyToken = lwcRuntimeFlags.ENABLE_LEGACY_SCOPE_TOKENS && !isUndefined$1(legacyStylesheetToken);
          let cacheKey = 0;
          if (hasStyleToken && hasScopedStyles) {
            cacheKey |= 1 /* FragmentCacheKey.HAS_SCOPED_STYLE */;
          }
          if (hasStyleToken && isSyntheticShadow) {
            cacheKey |= 2 /* FragmentCacheKey.SHADOW_MODE_SYNTHETIC */;
          }
          // Cache is only here to prevent calling innerHTML multiple times which doesn't happen on the server.
          {
            // Disable this on the server to prevent cache poisoning when expressions are used.
            const cached = getFromFragmentCache(cacheKey, strings);
            if (!isUndefined$1(cached)) {
              return cached;
            }
          }
          // See W-16614556
          // TODO [#2826]: freeze the template object
          if (hasStyleToken && !isValidScopeToken(stylesheetToken) || hasLegacyToken && !isValidScopeToken(legacyStylesheetToken)) {
            throw new Error('stylesheet token must be a valid string');
          }
          // If legacy stylesheet tokens are required, then add them to the rendered string
          const stylesheetTokenToRender = stylesheetToken + (hasLegacyToken ? ` ${legacyStylesheetToken}` : '');
          const classToken = hasScopedStyles && hasStyleToken ? ' ' + stylesheetTokenToRender : '';
          const classAttrToken = hasScopedStyles && hasStyleToken ? ` class="${stylesheetTokenToRender}"` : '';
          const attrToken = hasStyleToken && isSyntheticShadow ? ' ' + stylesheetTokenToRender : '';
          // In the browser, we provide the entire class attribute as a perf optimization to avoid applying it on mount.
          // The remaining class expression will be applied when the static parts are mounted.
          // In SSR, the entire class attribute (expression included) is assembled along with the fragment.
          // This is why in the browser we provide the entire class attribute and in SSR we only provide the class token.
          const exprClassToken = classAttrToken;
          // TODO [#3624]: The implementation of this function should be specific to @lwc/engine-dom and @lwc/engine-server.
          // Find a way to split this in a future refactor.
          const serializeExpression = buildSerializeExpressionFn();
          let htmlFragment = '';
          for (let i = 0, n = keys.length; i < n; i++) {
            switch (keys[i]) {
              case 0:
                // styleToken in existing class attr
                htmlFragment += strings[i] + classToken;
                break;
              case 1:
                // styleToken for added class attr
                htmlFragment += strings[i] + classAttrToken;
                break;
              case 2:
                // styleToken as attr
                htmlFragment += strings[i] + attrToken;
                break;
              case 3:
                // ${1}${2}
                htmlFragment += strings[i] + classAttrToken + attrToken;
                break;
              default:
                // expressions ${partId:attributeName/textId}
                htmlFragment += strings[i] + serializeExpression(keys[i], exprClassToken);
                break;
            }
          }
          htmlFragment += strings[strings.length - 1];
          const element = createFragmentFn(htmlFragment, renderer);
          // Cache is only here to prevent calling innerHTML multiple times which doesn't happen on the server.
          {
            setInFragmentCache(cacheKey, strings, element);
          }
          return element;
        };
      };
    }
    // Note: at the moment this code executes, we don't have a renderer yet.
    const parseFragment = buildParseFragmentFn((html, renderer) => {
      const {
        createFragment
      } = renderer;
      return createFragment(html);
    });
    function evaluateTemplate(vm, html) {
      if (process.env.NODE_ENV !== 'production') {
        // in dev-mode, we support hot swapping of templates, which means that
        // the component instance might be attempting to use an old version of
        // the template, while internally, we have a replacement for it.
        html = getTemplateOrSwappedTemplate(html);
      }
      const isUpdatingTemplateInception = isUpdatingTemplate;
      const vmOfTemplateBeingUpdatedInception = vmBeingRendered;
      let vnodes = [];
      runWithBoundaryProtection(vm, vm.owner, () => {
        // pre
        vmBeingRendered = vm;
        logOperationStart(1 /* OperationId.Render */, vm);
      }, () => {
        // job
        const {
          component,
          context,
          cmpSlots,
          cmpTemplate,
          tro
        } = vm;
        tro.observe(() => {
          // Reset the cache memoizer for template when needed.
          if (html !== cmpTemplate) {
            // Check that the template was built by the compiler.
            if (!isTemplateRegistered(html)) {
              throw new TypeError(`Invalid template returned by the render() method on ${vm.tagName}. It must return an imported template (e.g.: \`import html from "./${vm.def.name}.html"\`), instead, it has returned: ${toString(html)}.`);
            }
            checkHasMatchingRenderMode(html, vm);
            // Perf opt: do not reset the shadow root during the first rendering (there is
            // nothing to reset).
            if (!isNull(cmpTemplate)) {
              // It is important to reset the content to avoid reusing similar elements
              // generated from a different template, because they could have similar IDs,
              // and snabbdom just rely on the IDs.
              resetComponentRoot(vm);
            }
            vm.cmpTemplate = html;
            // Create a brand new template cache for the swapped templated.
            context.tplCache = create(null);
            // Set the computeHasScopedStyles property in the context, to avoid recomputing it repeatedly.
            context.hasScopedStyles = computeHasScopedStyles(html, vm);
            // Update the scoping token on the host element.
            updateStylesheetToken(vm, html, /* legacy */false);
            if (lwcRuntimeFlags.ENABLE_LEGACY_SCOPE_TOKENS) {
              updateStylesheetToken(vm, html, /* legacy */true);
            }
            // Evaluate, create stylesheet and cache the produced VNode for future
            // re-rendering.
            const stylesheetsContent = getStylesheetsContent(vm, html);
            context.styleVNodes = stylesheetsContent.length === 0 ? null : createStylesheet(vm, stylesheetsContent);
          }
          if (process.env.NODE_ENV !== 'production') {
            // validating slots in every rendering since the allocated content might change over time
            validateSlots(vm);
            // add the VM to the list of host VMs that can be re-rendered if html is swapped
            setActiveVM(vm);
          }
          // right before producing the vnodes, we clear up all internal references
          // to custom elements from the template.
          vm.velements = [];
          // Set the global flag that template is being updated
          isUpdatingTemplate = true;
          vnodes = html.call(undefined, api, component, cmpSlots, context.tplCache);
          const {
            styleVNodes
          } = context;
          if (!isNull(styleVNodes)) {
            // It's important here not to mutate the underlying `vnodes` returned from `html.call()`.
            // The reason for this is because, due to the static content optimization, the vnodes array
            // may be a static array shared across multiple component instances. E.g. this occurs in the
            // case of an empty `<template></template>` in a `component.html` file, due to the underlying
            // children being `[]` (no children). If we append the `<style>` vnode to this array, then the same
            // array will be reused for every component instance, i.e. whenever `tmpl()` is called.
            vnodes = [...styleVNodes, ...vnodes];
          }
        });
      }, () => {
        // post
        isUpdatingTemplate = isUpdatingTemplateInception;
        vmBeingRendered = vmOfTemplateBeingUpdatedInception;
        logOperationEnd(1 /* OperationId.Render */, vm);
      });
      if (process.env.NODE_ENV !== 'production') {
        if (!isArray$1(vnodes)) {
          logError(`Compiler should produce html functions that always return an array.`);
        }
      }
      return vnodes;
    }
    function computeHasScopedStylesInStylesheets(stylesheets) {
      if (hasStyles(stylesheets)) {
        for (let i = 0; i < stylesheets.length; i++) {
          if (isTrue(stylesheets[i][KEY__SCOPED_CSS])) {
            return true;
          }
        }
      }
      return false;
    }
    function computeHasScopedStyles(template, vm) {
      const {
        stylesheets
      } = template;
      const vmStylesheets = !isUndefined$1(vm) ? vm.stylesheets : null;
      return computeHasScopedStylesInStylesheets(stylesheets) || computeHasScopedStylesInStylesheets(vmStylesheets);
    }
    function hasStyles(stylesheets) {
      return !isUndefined$1(stylesheets) && !isNull(stylesheets) && stylesheets.length > 0;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let isInvokingRender = false;
    let vmBeingConstructed = null;
    function isBeingConstructed(vm) {
      return vmBeingConstructed === vm;
    }
    function invokeComponentCallback(vm, fn, args) {
      const {
        component,
        callHook,
        owner
      } = vm;
      runWithBoundaryProtection(vm, owner, noop, () => {
        callHook(component, fn, args);
      }, noop);
    }
    function invokeComponentConstructor(vm, Ctor) {
      const vmBeingConstructedInception = vmBeingConstructed;
      let error;
      logOperationStart(0 /* OperationId.Constructor */, vm);
      vmBeingConstructed = vm;
      /**
       * Constructors don't need to be wrapped with a boundary because for root elements
       * it should throw, while elements from template are already wrapped by a boundary
       * associated to the diffing algo.
       */
      try {
        // job
        const result = new Ctor();
        // Check indirectly if the constructor result is an instance of LightningElement. Using
        // the "instanceof" operator would not work here since Locker Service provides its own
        // implementation of LightningElement, so we indirectly check if the base constructor is
        // invoked by accessing the component on the vm.
        // TODO [W-17769475]: Restore this fix when we can reliably detect Locker enabled
        // const isInvalidConstructor = lwcRuntimeFlags.LEGACY_LOCKER_ENABLED
        //     ? vmBeingConstructed.component !== result
        //     : !(result instanceof LightningElement);
        const isInvalidConstructor = vmBeingConstructed.component !== result;
        if (isInvalidConstructor) {
          throw new TypeError('Invalid component constructor, the class should extend LightningElement.');
        }
      } catch (e) {
        error = Object(e);
      } finally {
        logOperationEnd(0 /* OperationId.Constructor */, vm);
        vmBeingConstructed = vmBeingConstructedInception;
        if (!isUndefined$1(error)) {
          addErrorComponentStack(vm, error);
          // re-throwing the original error annotated after restoring the context
          throw error; // eslint-disable-line no-unsafe-finally
        }
      }
    }
    function invokeComponentRenderMethod(vm) {
      const {
        def: {
          render
        },
        callHook,
        component,
        owner
      } = vm;
      const isRenderBeingInvokedInception = isInvokingRender;
      const vmBeingRenderedInception = getVMBeingRendered();
      let html;
      let renderInvocationSuccessful = false;
      runWithBoundaryProtection(vm, owner, () => {
        // pre
        isInvokingRender = true;
        setVMBeingRendered(vm);
      }, () => {
        // job
        vm.tro.observe(() => {
          html = callHook(component, render);
          renderInvocationSuccessful = true;
        });
      }, () => {
        // post
        isInvokingRender = isRenderBeingInvokedInception;
        setVMBeingRendered(vmBeingRenderedInception);
      });
      // If render() invocation failed, process errorCallback in boundary and return an empty template
      return renderInvocationSuccessful ? evaluateTemplate(vm, html) : [];
    }
    function invokeEventListener(vm, fn, thisValue, event) {
      const {
        callHook,
        owner
      } = vm;
      runWithBoundaryProtection(vm, owner, noop, () => {
        // job
        if (process.env.NODE_ENV !== 'production') {
          assert.isTrue(isFunction$1(fn), `Invalid event handler for event '${event.type}' on ${vm}.`);
        }
        callHook(thisValue, fn, [event]);
      }, noop);
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const registeredComponentMap = new Map();
    /**
     * INTERNAL: This function can only be invoked by compiled code. The compiler
     * will prevent this function from being imported by userland code.
     * @param Ctor
     * @param metadata
     */
    function registerComponent(
    // We typically expect a LightningElementConstructor, but technically you can call this with anything
    Ctor, metadata) {
      if (isFunction$1(Ctor)) {
        if (process.env.NODE_ENV !== 'production') {
          // There is no point in running this in production, because the version mismatch check relies
          // on code comments which are stripped out in production by minifiers
          checkVersionMismatch(Ctor, 'component');
        }
        // TODO [#3331]: add validation to check the value of metadata.sel is not an empty string.
        registeredComponentMap.set(Ctor, metadata);
      }
      // chaining this method as a way to wrap existing assignment of component constructor easily,
      // without too much transformation
      return Ctor;
    }
    function getComponentRegisteredTemplate(Ctor) {
      return registeredComponentMap.get(Ctor)?.tmpl;
    }
    function getComponentRegisteredName(Ctor) {
      return registeredComponentMap.get(Ctor)?.sel;
    }
    function getComponentAPIVersion(Ctor) {
      const metadata = registeredComponentMap.get(Ctor);
      const apiVersion = metadata?.apiVersion;
      if (isUndefined$1(apiVersion)) {
        // This should only occur in our Karma tests; in practice every component
        // is registered, and so this code path should not get hit. But to be safe,
        // return the lowest possible version.
        return LOWEST_API_VERSION;
      }
      return apiVersion;
    }
    function getTemplateReactiveObserver(vm) {
      const reactiveObserver = createReactiveObserver(() => {
        const {
          isDirty
        } = vm;
        if (isFalse(isDirty)) {
          markComponentAsDirty(vm);
          scheduleRehydration(vm);
        }
      });
      if (process.env.NODE_ENV !== 'production') {
        associateReactiveObserverWithVM(reactiveObserver, vm);
      }
      return reactiveObserver;
    }
    function resetTemplateObserverAndUnsubscribe(vm) {
      const {
        tro,
        component
      } = vm;
      tro.reset();
      // Unsubscribe every time the template reactive observer is reset.
      if (lwcRuntimeFlags.ENABLE_EXPERIMENTAL_SIGNALS) {
        unsubscribeFromSignals(component);
      }
    }
    function renderComponent(vm) {
      if (process.env.NODE_ENV !== 'production') {
        assert.invariant(vm.isDirty, `${vm} is not dirty.`);
      }
      // The engine should only hold a subscription to a signal if it is rendered in the template.
      // Because of the potential presence of conditional rendering logic, we unsubscribe on each render
      // in the scenario where it is present in one condition but not the other.
      // For example:
      // 1. There is an lwc:if=true conditional where the signal is present on the template.
      // 2. The lwc:if changes to false and the signal is no longer present on the template.
      // If the signal is still subscribed to, the template will re-render when it receives a notification
      // from the signal, even though we won't be using the new value.
      resetTemplateObserverAndUnsubscribe(vm);
      const vnodes = invokeComponentRenderMethod(vm);
      vm.isDirty = false;
      vm.isScheduled = false;
      return vnodes;
    }
    function markComponentAsDirty(vm) {
      if (process.env.NODE_ENV !== 'production') {
        const vmBeingRendered = getVMBeingRendered();
        assert.isFalse(vm.isDirty, `markComponentAsDirty() for ${vm} should not be called when the component is already dirty.`);
        assert.isFalse(isInvokingRender, `markComponentAsDirty() for ${vm} cannot be called during rendering of ${vmBeingRendered}.`);
        assert.isFalse(isUpdatingTemplate, `markComponentAsDirty() for ${vm} cannot be called while updating template of ${vmBeingRendered}.`);
      }
      vm.isDirty = true;
    }
    const cmpEventListenerMap = new WeakMap();
    function getWrappedComponentsListener(vm, listener) {
      if (!isFunction$1(listener)) {
        throw new TypeError('Expected an EventListener but received ' + typeof listener); // avoiding problems with non-valid listeners
      }
      let wrappedListener = cmpEventListenerMap.get(listener);
      if (isUndefined$1(wrappedListener)) {
        wrappedListener = function (event) {
          invokeEventListener(vm, listener, undefined, event);
        };
        cmpEventListenerMap.set(listener, wrappedListener);
      }
      return wrappedListener;
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    let idx = 0;
    /** The internal slot used to associate different objects the engine manipulates with the VM */
    const ViewModelReflection = new WeakMap();
    function callHook(cmp, fn, args = []) {
      return fn.apply(cmp, args);
    }
    function setHook(cmp, prop, newValue) {
      cmp[prop] = newValue;
    }
    function getHook(cmp, prop) {
      return cmp[prop];
    }
    function rerenderVM(vm) {
      rehydrate(vm);
    }
    function connectRootElement(elm) {
      const vm = getAssociatedVM(elm);
      if (process.env.NODE_ENV !== 'production') {
        // Flush any logs for this VM so that the initial properties from the constructor don't "count"
        // in subsequent re-renders (lwc-rerender). Right now we're at the first render (lwc-hydrate).
        flushMutationLogsForVM(vm);
      }
      logGlobalOperationStartWithVM(7 /* OperationId.GlobalRender */, vm);
      // Usually means moving the element from one place to another, which is observable via
      // life-cycle hooks.
      if (vm.state === 1 /* VMState.connected */) {
        disconnectRootElement(elm);
      }
      runConnectedCallback(vm);
      rehydrate(vm);
      logGlobalOperationEndWithVM(7 /* OperationId.GlobalRender */, vm);
    }
    function disconnectRootElement(elm) {
      const vm = getAssociatedVM(elm);
      resetComponentStateWhenRemoved(vm);
    }
    function appendVM(vm) {
      rehydrate(vm);
    }
    // just in case the component comes back, with this we guarantee re-rendering it
    // while preventing any attempt to rehydration until after reinsertion.
    function resetComponentStateWhenRemoved(vm) {
      const {
        state
      } = vm;
      if (state !== 2 /* VMState.disconnected */) {
        // Making sure that any observing record will not trigger the rehydrated on this vm
        resetTemplateObserverAndUnsubscribe(vm);
        runDisconnectedCallback(vm);
        // Spec: https://dom.spec.whatwg.org/#concept-node-remove (step 14-15)
        runChildNodesDisconnectedCallback(vm);
        runLightChildNodesDisconnectedCallback(vm);
      }
    }
    // this method is triggered by the diffing algo only when a vnode from the
    // old vnode.children is removed from the DOM.
    function removeVM(vm) {
      if (process.env.NODE_ENV !== 'production') {
        if (lwcRuntimeFlags.DISABLE_NATIVE_CUSTOM_ELEMENT_LIFECYCLE) {
          // With native lifecycle, we cannot be certain that connectedCallback was called before a component
          // was removed from the VDOM. If the component is disconnected, then connectedCallback will not fire
          // in native mode, although it will fire in synthetic mode due to appendChild triggering it.
          // See: W-14037619 for details
          assert.isTrue(vm.state === 1 /* VMState.connected */ || vm.state === 2 /* VMState.disconnected */, `${vm} must have been connected.`);
        }
      }
      resetComponentStateWhenRemoved(vm);
    }
    function getNearestShadowAncestor(owner) {
      let ancestor = owner;
      while (!isNull(ancestor) && ancestor.renderMode === 0 /* RenderMode.Light */) {
        ancestor = ancestor.owner;
      }
      return ancestor;
    }
    function createVM(elm, ctor, renderer, options) {
      const {
        mode,
        owner,
        tagName,
        hydrated
      } = options;
      const def = getComponentInternalDef(ctor);
      const apiVersion = getComponentAPIVersion(ctor);
      const vm = {
        elm,
        def,
        idx: idx++,
        state: 0 /* VMState.created */,
        isScheduled: false,
        isDirty: true,
        tagName,
        mode,
        owner,
        refVNodes: null,
        children: EmptyArray,
        aChildren: EmptyArray,
        velements: EmptyArray,
        cmpProps: create(null),
        cmpFields: create(null),
        cmpSlots: {
          slotAssignments: create(null)
        },
        cmpTemplate: null,
        hydrated: Boolean(hydrated),
        renderMode: def.renderMode,
        context: {
          stylesheetToken: undefined,
          hasTokenInClass: undefined,
          hasTokenInAttribute: undefined,
          legacyStylesheetToken: undefined,
          hasLegacyTokenInClass: undefined,
          hasLegacyTokenInAttribute: undefined,
          hasScopedStyles: undefined,
          styleVNodes: null,
          tplCache: EmptyObject,
          wiredConnecting: EmptyArray,
          wiredDisconnecting: EmptyArray
        },
        // Properties set right after VM creation.
        tro: null,
        shadowMode: null,
        shadowMigrateMode: false,
        stylesheets: null,
        // Properties set by the LightningElement constructor.
        component: null,
        shadowRoot: null,
        renderRoot: null,
        callHook,
        setHook,
        getHook,
        renderer,
        apiVersion
      };
      if (process.env.NODE_ENV !== 'production') {
        vm.debugInfo = create(null);
      }
      vm.stylesheets = computeStylesheets(vm, def.ctor);
      const computedShadowMode = computeShadowMode(def, vm.owner, renderer, hydrated);
      if (lwcRuntimeFlags.ENABLE_FORCE_SHADOW_MIGRATE_MODE) {
        vm.shadowMode = 0 /* ShadowMode.Native */;
        vm.shadowMigrateMode = computedShadowMode === 1 /* ShadowMode.Synthetic */;
      } else {
        vm.shadowMode = computedShadowMode;
      }
      vm.tro = getTemplateReactiveObserver(vm);
      if (process.env.NODE_ENV !== 'production') {
        vm.toString = () => {
          return `[object:vm ${def.name} (${vm.idx})]`;
        };
      }
      // Create component instance associated to the vm and the element.
      invokeComponentConstructor(vm, def.ctor);
      // Initializing the wire decorator per instance only when really needed
      if (hasWireAdapters(vm)) {
        installWireAdapters(vm);
      }
      return vm;
    }
    function validateComponentStylesheets(vm, stylesheets) {
      let valid = true;
      const validate = arrayOrStylesheet => {
        if (isArray$1(arrayOrStylesheet)) {
          for (let i = 0; i < arrayOrStylesheet.length; i++) {
            validate(arrayOrStylesheet[i]);
          }
        } else if (!isFunction$1(arrayOrStylesheet)) {
          // function assumed to be a stylesheet factory
          valid = false;
        }
      };
      if (!isArray$1(stylesheets)) {
        valid = false;
      } else {
        validate(stylesheets);
      }
      return valid;
    }
    // Validate and flatten any stylesheets defined as `static stylesheets`
    function computeStylesheets(vm, ctor) {
      warnOnStylesheetsMutation(ctor);
      const {
        stylesheets
      } = ctor;
      if (!isUndefined$1(stylesheets)) {
        const valid = validateComponentStylesheets(vm, stylesheets);
        if (valid) {
          return flattenStylesheets(stylesheets);
        } else if (process.env.NODE_ENV !== 'production') {
          logError(`static stylesheets must be an array of CSS stylesheets. Found invalid stylesheets on <${vm.tagName}>`, vm);
        }
      }
      return null;
    }
    function warnOnStylesheetsMutation(ctor) {
      if (process.env.NODE_ENV !== 'production') {
        let {
          stylesheets
        } = ctor;
        defineProperty(ctor, 'stylesheets', {
          enumerable: true,
          configurable: true,
          get() {
            return stylesheets;
          },
          set(newValue) {
            logWarnOnce(`Dynamically setting the "stylesheets" static property on ${ctor.name} ` + 'will not affect the stylesheets injected.');
            stylesheets = newValue;
          }
        });
      }
    }
    // Compute the shadowMode/renderMode without creating a VM. This is used in some scenarios like hydration.
    function computeShadowAndRenderMode(Ctor, renderer) {
      const def = getComponentInternalDef(Ctor);
      const {
        renderMode
      } = def;
      // Assume null `owner` - this is what happens in hydration cases anyway
      // Also assume we are not in hydration mode for this exported API
      const shadowMode = computeShadowMode(def, /* owner */null, renderer, false);
      return {
        renderMode,
        shadowMode
      };
    }
    function computeShadowMode(def, owner, renderer, hydrated) {
      if (
      // Force the shadow mode to always be native. Used for running tests with synthetic shadow patches
      // on, but components running in actual native shadow mode
      process.env.NODE_ENV === 'test-karma-lwc' && process.env.FORCE_NATIVE_SHADOW_MODE_FOR_TEST ||
      // If synthetic shadow is explicitly disabled, use pure-native
      lwcRuntimeFlags.DISABLE_SYNTHETIC_SHADOW ||
      // hydration only supports native shadow
      isTrue(hydrated)) {
        return 0 /* ShadowMode.Native */;
      }
      const {
        isSyntheticShadowDefined
      } = renderer;
      let shadowMode;
      if (isSyntheticShadowDefined || lwcRuntimeFlags.ENABLE_FORCE_SHADOW_MIGRATE_MODE) {
        if (def.renderMode === 0 /* RenderMode.Light */) {
          // ShadowMode.Native implies "not synthetic shadow" which is consistent with how
          // everything defaults to native when the synthetic shadow polyfill is unavailable.
          shadowMode = 0 /* ShadowMode.Native */;
        } else if (def.shadowSupportMode === 'native') {
          shadowMode = 0 /* ShadowMode.Native */;
        } else {
          const shadowAncestor = getNearestShadowAncestor(owner);
          if (!isNull(shadowAncestor) && shadowAncestor.shadowMode === 0 /* ShadowMode.Native */) {
            // Transitive support for native Shadow DOM. A component in native mode
            // transitively opts all of its descendants into native.
            shadowMode = 0 /* ShadowMode.Native */;
          } else {
            // Synthetic if neither this component nor any of its ancestors are configured
            // to be native.
            shadowMode = 1 /* ShadowMode.Synthetic */;
          }
        }
      } else {
        // Native if the synthetic shadow polyfill is unavailable.
        shadowMode = 0 /* ShadowMode.Native */;
      }
      return shadowMode;
    }
    function assertIsVM(obj) {
      if (!isObject(obj) || isNull(obj) || !('renderRoot' in obj)) {
        throw new TypeError(`${obj} is not a VM.`);
      }
    }
    function associateVM(obj, vm) {
      ViewModelReflection.set(obj, vm);
    }
    function getAssociatedVM(obj) {
      const vm = ViewModelReflection.get(obj);
      if (process.env.NODE_ENV !== 'production') {
        assertIsVM(vm);
      }
      return vm;
    }
    function getAssociatedVMIfPresent(obj) {
      const maybeVm = ViewModelReflection.get(obj);
      if (process.env.NODE_ENV !== 'production') {
        if (!isUndefined$1(maybeVm)) {
          assertIsVM(maybeVm);
        }
      }
      return maybeVm;
    }
    function rehydrate(vm) {
      if (isTrue(vm.isDirty)) {
        const children = renderComponent(vm);
        patchShadowRoot(vm, children);
      }
    }
    function patchShadowRoot(vm, newCh) {
      const {
        renderRoot,
        children: oldCh,
        renderer
      } = vm;
      // reset the refs; they will be set during `patchChildren`
      resetRefVNodes(vm);
      // caching the new children collection
      vm.children = newCh;
      if (newCh.length > 0 || oldCh.length > 0) {
        // patch function mutates vnodes by adding the element reference,
        // however, if patching fails it contains partial changes.
        if (oldCh !== newCh) {
          runWithBoundaryProtection(vm, vm, () => {
            // pre
            logOperationStart(2 /* OperationId.Patch */, vm);
          }, () => {
            // job
            patchChildren(oldCh, newCh, renderRoot, renderer);
          }, () => {
            // post
            logOperationEnd(2 /* OperationId.Patch */, vm);
          });
        }
      }
      if (vm.state === 1 /* VMState.connected */) {
        // If the element is connected, that means connectedCallback was already issued, and
        // any successive rendering should finish with the call to renderedCallback, otherwise
        // the connectedCallback will take care of calling it in the right order at the end of
        // the current rehydration process.
        runRenderedCallback(vm);
      }
    }
    function runRenderedCallback(vm) {
      const {
        def: {
          renderedCallback
        }
      } = vm;
      if (!isUndefined$1(renderedCallback)) {
        logOperationStart(4 /* OperationId.RenderedCallback */, vm);
        invokeComponentCallback(vm, renderedCallback);
        logOperationEnd(4 /* OperationId.RenderedCallback */, vm);
      }
    }
    let rehydrateQueue = [];
    function flushRehydrationQueue() {
      // Gather the logs before rehydration starts so they can be reported at the end of rehydration.
      // Note that we also clear all existing logs at this point so that subsequent re-renders start from a clean slate.
      const mutationLogs = process.env.NODE_ENV === 'production' ? undefined : getAndFlushMutationLogs();
      logGlobalOperationStart(8 /* OperationId.GlobalRerender */);
      if (process.env.NODE_ENV !== 'production') {
        assert.invariant(rehydrateQueue.length, `If rehydrateQueue was scheduled, it is because there must be at least one VM on this pending queue instead of ${rehydrateQueue}.`);
      }
      const vms = rehydrateQueue.sort((a, b) => a.idx - b.idx);
      rehydrateQueue = []; // reset to a new queue
      for (let i = 0, len = vms.length; i < len; i += 1) {
        const vm = vms[i];
        try {
          rehydrate(vm);
        } catch (error) {
          if (i + 1 < len) {
            // pieces of the queue are still pending to be rehydrated, those should have priority
            if (rehydrateQueue.length === 0) {
              addCallbackToNextTick(flushRehydrationQueue);
            }
            ArrayUnshift.apply(rehydrateQueue, ArraySlice.call(vms, i + 1));
          }
          // we need to end the measure before throwing.
          logGlobalOperationEnd(8 /* OperationId.GlobalRerender */, mutationLogs);
          // re-throwing the original error will break the current tick, but since the next tick is
          // already scheduled, it should continue patching the rest.
          throw error;
        }
      }
      logGlobalOperationEnd(8 /* OperationId.GlobalRerender */, mutationLogs);
    }
    function runConnectedCallback(vm) {
      const {
        state
      } = vm;
      if (state === 1 /* VMState.connected */) {
        return; // nothing to do since it was already connected
      }
      vm.state = 1 /* VMState.connected */;
      if (hasWireAdapters(vm)) {
        connectWireAdapters(vm);
      }
      const {
        connectedCallback
      } = vm.def;
      if (!isUndefined$1(connectedCallback)) {
        logOperationStart(3 /* OperationId.ConnectedCallback */, vm);
        invokeComponentCallback(vm, connectedCallback);
        logOperationEnd(3 /* OperationId.ConnectedCallback */, vm);
      }
      // This test only makes sense in the browser, with synthetic lifecycle, and when reporting is enabled or
      // we're in dev mode. This is to detect a particular issue with synthetic lifecycle.
      if (lwcRuntimeFlags.DISABLE_NATIVE_CUSTOM_ELEMENT_LIFECYCLE && (process.env.NODE_ENV !== 'production' || isReportingEnabled())) {
        if (!vm.renderer.isConnected(vm.elm)) {
          if (process.env.NODE_ENV !== 'production') {
            logWarnOnce(`Element <${vm.tagName}> ` + `fired a \`connectedCallback\` and rendered, but was not connected to the DOM. ` + `Please ensure all components are actually connected to the DOM, e.g. using ` + `\`document.body.appendChild(element)\`. This will not be supported in future versions of ` + `LWC and could cause component errors. For details, see: https://sfdc.co/synthetic-lifecycle`);
          }
          report("ConnectedCallbackWhileDisconnected" /* ReportingEventId.ConnectedCallbackWhileDisconnected */, {
            tagName: vm.tagName
          });
        }
      }
    }
    function hasWireAdapters(vm) {
      return getOwnPropertyNames$1(vm.def.wire).length > 0;
    }
    function runDisconnectedCallback(vm) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(vm.state !== 2 /* VMState.disconnected */, `${vm} must be inserted.`);
      }
      if (isFalse(vm.isDirty)) {
        // this guarantees that if the component is reused/reinserted,
        // it will be re-rendered because we are disconnecting the reactivity
        // linking, so mutations are not automatically reflected on the state
        // of disconnected components.
        vm.isDirty = true;
      }
      vm.state = 2 /* VMState.disconnected */;
      if (hasWireAdapters(vm)) {
        disconnectWireAdapters(vm);
      }
      const {
        disconnectedCallback
      } = vm.def;
      if (!isUndefined$1(disconnectedCallback)) {
        logOperationStart(5 /* OperationId.DisconnectedCallback */, vm);
        invokeComponentCallback(vm, disconnectedCallback);
        logOperationEnd(5 /* OperationId.DisconnectedCallback */, vm);
      }
    }
    function runChildNodesDisconnectedCallback(vm) {
      const {
        velements: vCustomElementCollection
      } = vm;
      // Reporting disconnection for every child in inverse order since they are
      // inserted in reserved order.
      for (let i = vCustomElementCollection.length - 1; i >= 0; i -= 1) {
        const {
          elm
        } = vCustomElementCollection[i];
        // There are two cases where the element could be undefined:
        // * when there is an error during the construction phase, and an error
        //   boundary picks it, there is a possibility that the VCustomElement
        //   is not properly initialized, and therefore is should be ignored.
        // * when slotted custom element is not used by the element where it is
        //   slotted into it, as  a result, the custom element was never
        //   initialized.
        if (!isUndefined$1(elm)) {
          const childVM = getAssociatedVMIfPresent(elm);
          // The VM associated with the element might be associated undefined
          // in the case where the VM failed in the middle of its creation,
          // eg: constructor throwing before invoking super().
          if (!isUndefined$1(childVM)) {
            resetComponentStateWhenRemoved(childVM);
          }
        }
      }
    }
    function runLightChildNodesDisconnectedCallback(vm) {
      const {
        aChildren: adoptedChildren
      } = vm;
      recursivelyDisconnectChildren(adoptedChildren);
    }
    /**
     * The recursion doesn't need to be a complete traversal of the vnode graph,
     * instead it can be partial, when a custom element vnode is found, we don't
     * need to continue into its children because by attempting to disconnect the
     * custom element itself will trigger the removal of anything slotted or anything
     * defined on its shadow.
     * @param vnodes
     */
    function recursivelyDisconnectChildren(vnodes) {
      for (let i = 0, len = vnodes.length; i < len; i += 1) {
        const vnode = vnodes[i];
        if (!isNull(vnode) && !isUndefined$1(vnode.elm)) {
          switch (vnode.type) {
            case 2 /* VNodeType.Element */:
              recursivelyDisconnectChildren(vnode.children);
              break;
            case 3 /* VNodeType.CustomElement */:
              {
                const vm = getAssociatedVM(vnode.elm);
                resetComponentStateWhenRemoved(vm);
                break;
              }
          }
        }
      }
    }
    // This is a super optimized mechanism to remove the content of the root node (shadow root
    // for shadow DOM components and the root element itself for light DOM) without having to go
    // into snabbdom. Especially useful when the reset is a consequence of an error, in which case the
    // children VNodes might not be representing the current state of the DOM.
    function resetComponentRoot(vm) {
      recursivelyRemoveChildren(vm.children, vm);
      vm.children = EmptyArray;
      runChildNodesDisconnectedCallback(vm);
      vm.velements = EmptyArray;
    }
    // Helper function to remove all children of the root node.
    // If the set of children includes VFragment nodes, we need to remove the children of those nodes too.
    // Since VFragments can contain other VFragments, we need to traverse the entire of tree of VFragments.
    // If the set contains no VFragment nodes, no traversal is needed.
    function recursivelyRemoveChildren(vnodes, vm) {
      const {
        renderRoot,
        renderer: {
          remove
        }
      } = vm;
      for (let i = 0, len = vnodes.length; i < len; i += 1) {
        const vnode = vnodes[i];
        if (!isNull(vnode)) {
          // VFragments are special; their .elm property does not point to the root element since they have no single root.
          if (isVFragment(vnode)) {
            recursivelyRemoveChildren(vnode.children, vm);
          } else if (!isUndefined$1(vnode.elm)) {
            remove(vnode.elm, renderRoot);
          }
        }
      }
    }
    function scheduleRehydration(vm) {
      if (isTrue(vm.isScheduled)) {
        return;
      }
      vm.isScheduled = true;
      if (rehydrateQueue.length === 0) {
        addCallbackToNextTick(flushRehydrationQueue);
      }
      ArrayPush$1.call(rehydrateQueue, vm);
    }
    function getErrorBoundaryVM(vm) {
      let currentVm = vm;
      while (!isNull(currentVm)) {
        if (!isUndefined$1(currentVm.def.errorCallback)) {
          return currentVm;
        }
        currentVm = currentVm.owner;
      }
    }
    function runWithBoundaryProtection(vm, owner, pre, job, post) {
      let error;
      pre();
      try {
        job();
      } catch (e) {
        error = Object(e);
      } finally {
        post();
        if (!isUndefined$1(error)) {
          addErrorComponentStack(vm, error);
          const errorBoundaryVm = isNull(owner) ? undefined : getErrorBoundaryVM(owner);
          // Error boundaries are not in effect when server-side rendering. `errorCallback`
          // is intended to allow recovery from errors - changing the state of a component
          // and instigating a re-render. That is at odds with the single-pass, synchronous
          // nature of SSR. For that reason, all errors bubble up to the `renderComponent`
          // call site.
          if (isUndefined$1(errorBoundaryVm)) {
            throw error; // eslint-disable-line no-unsafe-finally
          }
          resetComponentRoot(vm); // remove offenders
          logOperationStart(6 /* OperationId.ErrorCallback */, vm);
          // error boundaries must have an ErrorCallback
          const errorCallback = errorBoundaryVm.def.errorCallback;
          invokeComponentCallback(errorBoundaryVm, errorCallback, [error, error.wcStack]);
          logOperationEnd(6 /* OperationId.ErrorCallback */, vm);
        }
      }
    }
    function runFormAssociatedCustomElementCallback(vm, faceCb, args) {
      const {
        renderMode,
        shadowMode
      } = vm;
      if (shadowMode === 1 /* ShadowMode.Synthetic */ && renderMode !== 0 /* RenderMode.Light */) {
        throw new Error('Form associated lifecycle methods are not available in synthetic shadow. Please use native shadow or light DOM.');
      }
      invokeComponentCallback(vm, faceCb, args);
    }
    function runFormAssociatedCallback(elm, form) {
      const vm = getAssociatedVM(elm);
      const {
        formAssociatedCallback
      } = vm.def;
      if (!isUndefined$1(formAssociatedCallback)) {
        runFormAssociatedCustomElementCallback(vm, formAssociatedCallback, [form]);
      }
    }
    function runFormDisabledCallback(elm, disabled) {
      const vm = getAssociatedVM(elm);
      const {
        formDisabledCallback
      } = vm.def;
      if (!isUndefined$1(formDisabledCallback)) {
        runFormAssociatedCustomElementCallback(vm, formDisabledCallback, [disabled]);
      }
    }
    function runFormResetCallback(elm) {
      const vm = getAssociatedVM(elm);
      const {
        formResetCallback
      } = vm.def;
      if (!isUndefined$1(formResetCallback)) {
        runFormAssociatedCustomElementCallback(vm, formResetCallback);
      }
    }
    function runFormStateRestoreCallback(elm, state, reason) {
      const vm = getAssociatedVM(elm);
      const {
        formStateRestoreCallback
      } = vm.def;
      if (!isUndefined$1(formStateRestoreCallback)) {
        runFormAssociatedCustomElementCallback(vm, formStateRestoreCallback, [state, reason]);
      }
    }
    function resetRefVNodes(vm) {
      const {
        cmpTemplate
      } = vm;
      vm.refVNodes = !isNull(cmpTemplate) && cmpTemplate.hasRefs ? create(null) : null;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    //
    // The goal of this code is to detect invalid cross-root ARIA references in synthetic shadow DOM.
    // These invalid references should be fixed before the offending components can be migrated to native shadow DOM.
    // When invalid usage is detected, we warn in dev mode and call the reporting API if enabled.
    // See: https://sfdc.co/synthetic-aria
    //
    // Use the unpatched native getElementById/querySelectorAll rather than the synthetic one
    const getElementById = globalThis[KEY__NATIVE_GET_ELEMENT_BY_ID];
    const querySelectorAll = globalThis[KEY__NATIVE_QUERY_SELECTOR_ALL];
    // This is a "handoff" from synthetic-shadow to engine-core – we want to clean up after ourselves
    // so nobody else can misuse these global APIs.
    delete globalThis[KEY__NATIVE_GET_ELEMENT_BY_ID];
    delete globalThis[KEY__NATIVE_QUERY_SELECTOR_ALL];
    function isSyntheticShadowRootInstance(rootNode) {
      return rootNode !== document && isTrue(rootNode.synthetic);
    }
    function reportViolation$1(source, target, attrName) {
      // The vm is either for the source, the target, or both. Either one or both must be using synthetic
      // shadow for a violation to be detected.
      let vm = getAssociatedVMIfPresent(source.getRootNode().host);
      if (isUndefined$1(vm)) {
        vm = getAssociatedVMIfPresent(target.getRootNode().host);
      }
      if (isUndefined$1(vm)) {
        // vm should never be undefined here, but just to be safe, bail out and don't report
        return;
      }
      report("CrossRootAriaInSyntheticShadow" /* ReportingEventId.CrossRootAriaInSyntheticShadow */, {
        tagName: vm.tagName});
      if (process.env.NODE_ENV !== 'production') {
        // Avoid excessively logging to the console in the case of duplicates.
        logWarnOnce(`Element <${source.tagName.toLowerCase()}> uses attribute "${attrName}" to reference element ` + `<${target.tagName.toLowerCase()}>, which is not in the same shadow root. This will break in native shadow DOM. ` + `For details, see: https://sfdc.co/synthetic-aria`, vm);
      }
    }
    function parseIdRefAttributeValue(attrValue) {
      // split on whitespace and skip empty strings after splitting
      return isString(attrValue) ? ArrayFilter.call(StringSplit.call(attrValue, /\s+/), Boolean) : [];
    }
    function detectSyntheticCrossRootAria(elm, attrName, attrValue) {
      const root = elm.getRootNode();
      if (!isSyntheticShadowRootInstance(root)) {
        return;
      }
      if (attrName === 'id') {
        // elm is the target, find the source
        if (!isString(attrValue) || attrValue.length === 0) {
          // if our id is null or empty, nobody can reference us
          return;
        }
        for (const idRefAttrName of ID_REFERENCING_ATTRIBUTES_SET) {
          // Query all global elements with this attribute. The attribute selector syntax `~=` is for values
          // that reference multiple IDs, separated by whitespace.
          const query = `[${idRefAttrName}~="${CSS.escape(attrValue)}"]`;
          const sourceElements = querySelectorAll.call(document, query);
          for (let i = 0; i < sourceElements.length; i++) {
            const sourceElement = sourceElements[i];
            const sourceRoot = sourceElement.getRootNode();
            if (sourceRoot !== root) {
              reportViolation$1(sourceElement, elm, idRefAttrName);
              break;
            }
          }
        }
      } else {
        // elm is the source, find the target
        const ids = parseIdRefAttributeValue(attrValue);
        for (const id of ids) {
          const target = getElementById.call(document, id);
          if (!isNull(target)) {
            const targetRoot = target.getRootNode();
            if (targetRoot !== root) {
              // target element's shadow root is not the same as ours
              reportViolation$1(elm, target, attrName);
            }
          }
        }
      }
    }
    let enabled = false;
    // We want to avoid patching globals whenever possible, so this should be tree-shaken out in prod-mode and if
    // reporting is not enabled. It should also only run once
    function enableDetection$1() {
      if (enabled) {
        return; // don't double-apply the patches
      }
      enabled = true;
      const {
        setAttribute
      } = Element.prototype;
      // Detect calling `setAttribute` to set an idref or an id
      assign(Element.prototype, {
        setAttribute(attrName, attrValue) {
          setAttribute.call(this, attrName, attrValue);
          if (attrName === 'id' || ID_REFERENCING_ATTRIBUTES_SET.has(attrName)) {
            detectSyntheticCrossRootAria(this, attrName, attrValue);
          }
        }
      });
      // Detect `elm.id = 'foo'`
      const idDescriptor = getOwnPropertyDescriptor$1(Element.prototype, 'id');
      if (!isUndefined$1(idDescriptor)) {
        const {
          get,
          set
        } = idDescriptor;
        // These should always be a getter and a setter, but if someone is monkeying with the global descriptor, ignore it
        if (isFunction$1(get) && isFunction$1(set)) {
          defineProperty(Element.prototype, 'id', {
            get() {
              return get.call(this);
            },
            set(value) {
              set.call(this, value);
              detectSyntheticCrossRootAria(this, 'id', value);
            },
            // On the default descriptor for 'id', enumerable and configurable are true
            enumerable: true,
            configurable: true
          });
        }
      }
    }
    // Our detection logic relies on some modern browser features. We can just skip reporting the data
    // for unsupported browsers
    function supportsCssEscape() {
      return typeof CSS !== 'undefined' && isFunction$1(CSS.escape);
    }
    // If this page is not using synthetic shadow, then we don't need to install detection. Note
    // that we are assuming synthetic shadow is loaded before LWC.
    function isSyntheticShadowLoaded() {
      // We should probably be calling `renderer.isSyntheticShadowDefined`, but 1) we don't have access to the renderer,
      // and 2) this code needs to run in @lwc/engine-core, so it can access `logWarn()` and `report()`.
      return hasOwnProperty$1.call(Element.prototype, KEY__SHADOW_TOKEN);
    }
    // Detecting cross-root ARIA in synthetic shadow only makes sense for the browser
    if (supportsCssEscape() && isSyntheticShadowLoaded()) {
      // Always run detection in dev mode, so we can at least print to the console
      if (process.env.NODE_ENV !== 'production') {
        enableDetection$1();
      }
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    //
    // The goal of this code is to detect usages of non-standard reflected ARIA properties. These are caused by
    // legacy non-standard Element.prototype extensions added by the @lwc/aria-reflection package.
    //
    // See the README for @lwc/aria-reflection
    const NON_STANDARD_ARIA_PROPS = ['ariaActiveDescendant', 'ariaControls', 'ariaDescribedBy', 'ariaDetails', 'ariaErrorMessage', 'ariaFlowTo', 'ariaLabelledBy', 'ariaOwns'];
    function isGlobalAriaPolyfillLoaded() {
      // Sniff for the legacy polyfill being loaded. The reason this works is because ariaActiveDescendant is a
      // non-standard ARIA property reflection that is only supported in our legacy polyfill. See
      // @lwc/aria-reflection/README.md for details.
      return !isUndefined$1(getOwnPropertyDescriptor$1(Element.prototype, 'ariaActiveDescendant'));
    }
    function findVM(elm) {
      // If it's a shadow DOM component, then it has a host
      const {
        host
      } = elm.getRootNode();
      const vm = isUndefined$1(host) ? undefined : getAssociatedVMIfPresent(host);
      if (!isUndefined$1(vm)) {
        return vm;
      }
      // Else it might be a light DOM component. Walk up the tree trying to find the owner
      let parentElement = elm;
      while (!isNull(parentElement = parentElement.parentElement)) {
        if (parentElement instanceof BaseBridgeElement) {
          // parentElement is an LWC component
          const vm = getAssociatedVMIfPresent(parentElement);
          if (!isUndefined$1(vm)) {
            return vm;
          }
        }
      }
      // If we return undefined, it's because the element was rendered wholly outside a LightningElement
    }
    function checkAndReportViolation(elm, prop, isSetter, setValue) {
      const vm = findVM(elm);
      if (process.env.NODE_ENV !== 'production') {
        logWarnOnce(`Element <${elm.tagName.toLowerCase()}> ` + (isUndefined$1(vm) ? '' : `owned by <${vm.elm.tagName.toLowerCase()}> `) + `uses non-standard property "${prop}". This will be removed in a future version of LWC. ` + `See https://sfdc.co/deprecated-aria`);
      }
      report("NonStandardAriaReflection" /* ReportingEventId.NonStandardAriaReflection */, {
        tagName: vm?.tagName});
    }
    function enableDetection() {
      const {
        prototype
      } = Element;
      for (const prop of NON_STANDARD_ARIA_PROPS) {
        const descriptor = getOwnPropertyDescriptor$1(prototype, prop);
        // The descriptor should exist because the @lwc/aria-reflection polyfill has run by now.
        // This happens automatically because of the ordering of imports.
        if (process.env.NODE_ENV !== 'production') {
          /* istanbul ignore if */
          if (isUndefined$1(descriptor) || isUndefined$1(descriptor.get) || isUndefined$1(descriptor.set)) {
            // should never happen
            throw new Error('detect-non-standard-aria.ts loaded before @lwc/aria-reflection');
          }
        }
        const {
          get,
          set
        } = descriptor;
        // It's important for this defineProperty call to happen _after_ ARIA accessors are applied to the
        // BaseBridgeElement and LightningElement prototypes. Otherwise, we will log/report for access of non-standard
        // props on these prototypes, which we actually don't want. We only care about access on generic HTMLElements.
        defineProperty(prototype, prop, {
          get() {
            checkAndReportViolation(this, prop);
            return get.call(this);
          },
          set(val) {
            checkAndReportViolation(this, prop);
            return set.call(this, val);
          },
          configurable: true,
          enumerable: true
        });
      }
    }
    // No point in running this code if we're not in a browser, or if the global polyfill is not loaded
    if (isGlobalAriaPolyfillLoaded()) {
      // Always run detection in dev mode, so we can at least print to the console
      if (process.env.NODE_ENV !== 'production') {
        enableDetection();
      }
    }

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // See @lwc/engine-core/src/framework/template.ts
    const TEMPLATE_PROPS = ['slots', 'stylesheetToken', 'stylesheets', 'renderMode', 'legacyStylesheetToken'];
    // Expandos that may be placed on a stylesheet factory function, and which are meaningful to LWC at runtime
    const STYLESHEET_PROPS = [KEY__SCOPED_CSS, KEY__NATIVE_ONLY_CSS];
    // Via https://www.npmjs.com/package/object-observer
    const ARRAY_MUTATION_METHODS = ['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'fill', 'splice', 'copyWithin'];
    let mutationTrackingDisabled = false;
    function getOriginalArrayMethod(prop) {
      switch (prop) {
        case 'pop':
          return ArrayPop;
        case 'push':
          return ArrayPush$1;
        case 'shift':
          return ArrayShift;
        case 'unshift':
          return ArrayUnshift;
        case 'reverse':
          return ArrayReverse;
        case 'sort':
          return ArraySort;
        case 'fill':
          return ArrayFill;
        case 'splice':
          return ArraySplice;
        case 'copyWithin':
          return ArrayCopyWithin;
      }
    }
    function reportViolation(type, eventId, prop) {
      if (process.env.NODE_ENV !== 'production') {
        logWarnOnce(`Mutating the "${prop}" property on a ${type} ` + `is deprecated and will be removed in a future version of LWC. ` + `See: https://sfdc.co/template-mutation`);
      }
    }
    function reportTemplateViolation(prop) {
      reportViolation('template', "TemplateMutation" /* ReportingEventId.TemplateMutation */, prop);
    }
    function reportStylesheetViolation(prop) {
      reportViolation('stylesheet', "StylesheetMutation" /* ReportingEventId.StylesheetMutation */, prop);
    }
    // Warn if the user tries to mutate a stylesheets array, e.g.:
    // `tmpl.stylesheets.push(someStylesheetFunction)`
    function warnOnArrayMutation(stylesheets) {
      // We can't handle users calling Array.prototype.slice.call(tmpl.stylesheets), but
      // we can at least warn when they use the most common mutation methods.
      for (const prop of ARRAY_MUTATION_METHODS) {
        const originalArrayMethod = getOriginalArrayMethod(prop);
        // Assertions used here because TypeScript can't handle mapping over our types
        stylesheets[prop] = function arrayMutationWarningWrapper() {
          reportTemplateViolation('stylesheets');
          return originalArrayMethod.apply(this, arguments);
        };
      }
    }
    // Warn if the user tries to mutate a stylesheet factory function, e.g.:
    // `stylesheet.$scoped$ = true`
    function warnOnStylesheetFunctionMutation(stylesheet) {
      for (const prop of STYLESHEET_PROPS) {
        let value = stylesheet[prop];
        defineProperty(stylesheet, prop, {
          enumerable: true,
          configurable: true,
          get() {
            return value;
          },
          set(newValue) {
            reportStylesheetViolation(prop);
            value = newValue;
          }
        });
      }
    }
    // Warn on either array or stylesheet (function) mutation, in a deeply-nested array
    function trackStylesheetsMutation(stylesheets) {
      traverseStylesheets(stylesheets, subStylesheets => {
        if (isArray$1(subStylesheets)) {
          warnOnArrayMutation(subStylesheets);
        } else {
          warnOnStylesheetFunctionMutation(subStylesheets);
        }
      });
    }
    // Deeply freeze the entire array (of arrays) of stylesheet factory functions
    function deepFreeze(stylesheets) {
      traverseStylesheets(stylesheets, subStylesheets => {
        freeze(subStylesheets);
      });
    }
    // Deep-traverse an array (of arrays) of stylesheet factory functions, and call the callback for every array/function
    function traverseStylesheets(stylesheets, callback) {
      callback(stylesheets);
      for (let i = 0; i < stylesheets.length; i++) {
        const stylesheet = stylesheets[i];
        if (isArray$1(stylesheet)) {
          traverseStylesheets(stylesheet, callback);
        } else {
          callback(stylesheet);
        }
      }
    }
    function trackMutations(tmpl) {
      if (!isUndefined$1(tmpl.stylesheets)) {
        trackStylesheetsMutation(tmpl.stylesheets);
      }
      for (const prop of TEMPLATE_PROPS) {
        let value = tmpl[prop];
        defineProperty(tmpl, prop, {
          enumerable: true,
          configurable: true,
          get() {
            return value;
          },
          set(newValue) {
            if (!mutationTrackingDisabled) {
              reportTemplateViolation(prop);
            }
            value = newValue;
          }
        });
      }
      const originalDescriptor = getOwnPropertyDescriptor$1(tmpl, 'stylesheetTokens');
      defineProperty(tmpl, 'stylesheetTokens', {
        enumerable: true,
        configurable: true,
        get: originalDescriptor.get,
        set(value) {
          reportTemplateViolation('stylesheetTokens');
          // Avoid logging/reporting twice (for both stylesheetToken and stylesheetTokens)
          mutationTrackingDisabled = true;
          originalDescriptor.set.call(this, value);
          mutationTrackingDisabled = false;
        }
      });
    }
    function addLegacyStylesheetTokensShim(tmpl) {
      // When ENABLE_FROZEN_TEMPLATE is false, then we shim stylesheetTokens on top of stylesheetToken for anyone who
      // is accessing the old internal API (backwards compat). Details: W-14210169
      defineProperty(tmpl, 'stylesheetTokens', {
        enumerable: true,
        configurable: true,
        get() {
          const {
            stylesheetToken
          } = this;
          if (isUndefined$1(stylesheetToken)) {
            return stylesheetToken;
          }
          // Shim for the old `stylesheetTokens` property
          // See https://github.com/salesforce/lwc/pull/2332/files#diff-7901555acef29969adaa6583185b3e9bce475cdc6f23e799a54e0018cb18abaa
          return {
            hostAttribute: `${stylesheetToken}-host`,
            shadowAttribute: stylesheetToken
          };
        },
        set(value) {
          // If the value is null or some other exotic object, you would be broken anyway in the past
          // because the engine would try to access hostAttribute/shadowAttribute, which would throw an error.
          // However it may be undefined in newer versions of LWC, so we need to guard against that case.
          this.stylesheetToken = isUndefined$1(value) ? undefined : value.shadowAttribute;
        }
      });
    }
    function freezeTemplate(tmpl) {
      // TODO [#2782]: remove this flag and delete the legacy behavior
      if (lwcRuntimeFlags.ENABLE_FROZEN_TEMPLATE) {
        // Deep freeze the template
        freeze(tmpl);
        if (!isUndefined$1(tmpl.stylesheets)) {
          deepFreeze(tmpl.stylesheets);
        }
      } else {
        // template is not frozen - shim, report, and warn
        // this shim should be applied in both dev and prod
        addLegacyStylesheetTokensShim(tmpl);
        // When ENABLE_FROZEN_TEMPLATE is false, we want to warn in dev mode whenever someone is mutating the template
        if (process.env.NODE_ENV !== 'production') {
          trackMutations(tmpl);
        }
      }
    }
    /** version: 8.16.0 */

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * Displays the header for a custom element.
     * @param ce The custom element to get the header for.
     * @param componentInstance component instance associated with the custom element.
     */
    function getHeaderForCustomElement(ce, componentInstance) {
      // [element]
      // LWC component instance: [vm.component]
      return ['div', {}, ['object', {
        object: ce,
        config: {
          skip: true
        }
      }], ['div', {}, ['span', {
        style: 'margin: 0 5px; color: red'
      }, 'LWC:'], ['object', {
        object: componentInstance
      }]]];
    }
    function getHeaderForComponentInstance(componentInstance, debugInfo) {
      if (keys(debugInfo).length === 0) {
        // there is no debug information, no need to customize this component instance
        return null;
      }
      // [component]
      // Debug information: [vm.debugInfo]
      return ['div', {}, ['object', {
        object: componentInstance,
        config: {
          skip: true
        }
      }], ['div', {}, ['span', {
        style: 'margin: 0 5px; color: red'
      }, 'Debug:'], ['object', {
        object: debugInfo
      }]]];
    }
    const LightningElementFormatter = {
      name: 'LightningElementFormatter',
      header(obj, config) {
        const vm = getAssociatedVMIfPresent(obj);
        if (!isUndefined$1(vm) && (isUndefined$1(config) || !config.skip)) {
          if (obj instanceof HTMLElement) {
            return getHeaderForCustomElement(obj, vm.component);
          } else {
            return getHeaderForComponentInstance(obj, vm.debugInfo);
          }
        }
        return null;
      },
      hasBody() {
        return false;
      }
    };

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    function init() {
      const devtoolsFormatters = globalThis.devtoolsFormatters || [];
      ArrayPush$1.call(devtoolsFormatters, LightningElementFormatter);
      globalThis.devtoolsFormatters = devtoolsFormatters;
    }
    if (process.env.NODE_ENV !== 'production') {
      init();
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    //
    // Feature detection
    //
    // This check for constructable style sheets is similar to Fast's:
    // https://github.com/microsoft/fast/blob/d49d1ec/packages/web-components/fast-element/src/dom.ts#L51-L53
    // See also: https://github.com/whatwg/webidl/issues/1027#issuecomment-934510070
    const supportsConstructableStylesheets = isFunction$1(CSSStyleSheet.prototype.replaceSync) && isArray$1(document.adoptedStyleSheets);
    const stylesheetCache = new Map();
    //
    // Test utilities
    //
    // Only used in LWC's Karma tests
    if (process.env.NODE_ENV === 'test-karma-lwc') {
      window.__lwcResetGlobalStylesheets = () => {
        stylesheetCache.clear();
      };
    }
    function createFreshStyleElement(content) {
      const elm = document.createElement('style');
      elm.type = 'text/css';
      elm.textContent = content;
      // Add an attribute to distinguish global styles added by LWC as opposed to other frameworks/libraries on the page
      elm.setAttribute('data-rendered-by-lwc', '');
      return elm;
    }
    function createStyleElement(content, cacheData) {
      const {
        element,
        usedElement
      } = cacheData;
      // If the <style> was already used, then we should clone it. We cannot insert
      // the same <style> in two places in the DOM.
      if (usedElement) {
        // This `<style>` may be repeated multiple times in the DOM, so cache it. It's a bit
        // faster to call `cloneNode()` on an existing node than to recreate it every time.
        return element.cloneNode(true);
      }
      // We don't clone every time, because that would be a perf tax on the first time
      cacheData.usedElement = true;
      return element;
    }
    function createConstructableStylesheet(content) {
      const stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(content);
      return stylesheet;
    }
    function insertConstructableStylesheet(content, target, cacheData, signal) {
      const {
        adoptedStyleSheets
      } = target;
      const {
        stylesheet
      } = cacheData;
      // The reason we prefer .push() rather than reassignment is for perf: https://github.com/salesforce/lwc/pull/2683
      adoptedStyleSheets.push(stylesheet);
      if (process.env.NODE_ENV !== 'production') {
        /* istanbul ignore if */
        if (isUndefined$1(signal)) {
          throw new Error('Expected AbortSignal to be defined in dev mode');
        }
        // TODO [#4155]: unrendering should account for stylesheet content collisions
        signal.addEventListener('abort', () => {
          adoptedStyleSheets.splice(adoptedStyleSheets.indexOf(stylesheet), 1);
          stylesheetCache.delete(content);
        });
      }
    }
    function insertStyleElement(content, target, cacheData, signal) {
      const elm = createStyleElement(content, cacheData);
      target.appendChild(elm);
      if (process.env.NODE_ENV !== 'production') {
        /* istanbul ignore if */
        if (isUndefined$1(signal)) {
          throw new Error('Expected AbortSignal to be defined in dev mode');
        }
        // TODO [#4155]: unrendering should account for stylesheet content collisions
        signal.addEventListener('abort', () => {
          target.removeChild(elm);
          stylesheetCache.delete(content);
        });
      }
    }
    function getCacheData(content, useConstructableStylesheet) {
      let cacheData = stylesheetCache.get(content);
      if (isUndefined$1(cacheData)) {
        cacheData = {
          stylesheet: undefined,
          element: undefined,
          roots: undefined,
          global: false,
          usedElement: false
        };
        stylesheetCache.set(content, cacheData);
      }
      // Create <style> elements or CSSStyleSheets on-demand, as needed
      if (useConstructableStylesheet && isUndefined$1(cacheData.stylesheet)) {
        cacheData.stylesheet = createConstructableStylesheet(content);
      } else if (!useConstructableStylesheet && isUndefined$1(cacheData.element)) {
        cacheData.element = createFreshStyleElement(content);
      }
      return cacheData;
    }
    function insertGlobalStylesheet(content, signal) {
      // Force a <style> element for global stylesheets. See comment below.
      const cacheData = getCacheData(content, false);
      if (cacheData.global) {
        // already inserted
        return;
      }
      cacheData.global = true; // mark inserted
      // TODO [#2922]: use document.adoptedStyleSheets in supported browsers. Currently we can't, due to backwards compat.
      insertStyleElement(content, document.head, cacheData, signal);
    }
    function insertLocalStylesheet(content, target, signal) {
      const cacheData = getCacheData(content, supportsConstructableStylesheets);
      let {
        roots
      } = cacheData;
      if (isUndefined$1(roots)) {
        roots = cacheData.roots = new WeakSet(); // lazily initialize (not needed for global styles)
      } else if (roots.has(target)) {
        // already inserted
        return;
      }
      roots.add(target); // mark inserted
      // Constructable stylesheets are only supported in certain browsers:
      // https://caniuse.com/mdn-api_document_adoptedstylesheets
      // The reason we use it is for perf: https://github.com/salesforce/lwc/pull/2460
      if (supportsConstructableStylesheets) {
        insertConstructableStylesheet(content, target, cacheData, signal);
      } else {
        // Fall back to <style> element
        insertStyleElement(content, target, cacheData, signal);
      }
    }
    /**
     * Injects a stylesheet into the global (document) level or inside a shadow root.
     * @param content CSS content to insert
     * @param target ShadowRoot to insert into, or undefined if global (document) level
     * @param signal AbortSignal for aborting the stylesheet render. Used in dev mode for HMR to unrender stylesheets.
     */
    function insertStylesheet(content, target, signal) {
      if (isUndefined$1(target)) {
        // global
        insertGlobalStylesheet(content, signal);
      } else {
        // local
        insertLocalStylesheet(content, target, signal);
      }
    }

    /*
     * Copyright (c) 2023, Salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const cachedConstructors = new Map();
    const nativeLifecycleElementsToUpgradedByLWC = new WeakMap();
    let elementBeingUpgradedByLWC = false;
    let BaseUpgradableConstructor;
    let BaseHTMLElement;
    function createBaseUpgradableConstructor() {
      // Creates a constructor that is intended to be used directly as a custom element, except that the upgradeCallback is
      // passed in to the constructor so LWC can reuse the same custom element constructor for multiple components.
      // Another benefit is that only LWC can create components that actually do anything – if you do
      // `customElements.define('x-foo')`, then you don't have access to the upgradeCallback, so it's a dummy custom element.
      // This class should be created once per tag name.
      // TODO [#2972]: this class should expose observedAttributes as necessary
      BaseUpgradableConstructor = class TheBaseUpgradableConstructor extends HTMLElement {
        constructor(upgradeCallback, useNativeLifecycle) {
          super();
          if (useNativeLifecycle) {
            // When in native lifecycle mode, we need to keep track of instances that were created outside LWC
            // (i.e. not created by `lwc.createElement()`). If the element uses synthetic lifecycle, then we don't
            // need to track this.
            nativeLifecycleElementsToUpgradedByLWC.set(this, elementBeingUpgradedByLWC);
          }
          // If the element is not created using lwc.createElement(), e.g. `document.createElement('x-foo')`,
          // then elementBeingUpgradedByLWC will be false
          if (elementBeingUpgradedByLWC) {
            upgradeCallback(this);
          }
          // TODO [#2970]: LWC elements cannot be upgraded via new Ctor()
          // Do we want to support this? Throw an error? Currently for backwards compat it's a no-op.
        }
        connectedCallback() {
          // native `connectedCallback`/`disconnectedCallback` are only enabled in native lifecycle mode
          if (isTrue(nativeLifecycleElementsToUpgradedByLWC.get(this))) {
            connectRootElement(this);
          }
        }
        disconnectedCallback() {
          // native `connectedCallback`/`disconnectedCallback` are only enabled in native lifecycle mode
          if (isTrue(nativeLifecycleElementsToUpgradedByLWC.get(this))) {
            disconnectRootElement(this);
          }
        }
        formAssociatedCallback(form) {
          runFormAssociatedCallback(this, form);
        }
        formDisabledCallback(disabled) {
          runFormDisabledCallback(this, disabled);
        }
        formResetCallback() {
          runFormResetCallback(this);
        }
        formStateRestoreCallback(state, reason) {
          runFormStateRestoreCallback(this, state, reason);
        }
        /*LWC compiler v8.16.0*/
      };
      BaseHTMLElement = HTMLElement; // cache to track if it changes
    }
    const createUpgradableConstructor = isFormAssociated => {
      if (HTMLElement !== BaseHTMLElement) {
        // If the global HTMLElement changes out from under our feet, then we need to create a new
        // BaseUpgradableConstructor from scratch (since it extends from HTMLElement). This can occur if
        // polyfills are in play, e.g. a polyfill for scoped custom element registries.
        // This workaround can potentially be removed when W-15361244 is resolved.
        createBaseUpgradableConstructor();
      }
      // Using a BaseUpgradableConstructor superclass here is a perf optimization to avoid
      // re-defining the same logic (connectedCallback, disconnectedCallback, etc.) over and over.
      class UpgradableConstructor extends BaseUpgradableConstructor {
        /*LWC compiler v8.16.0*/
      }
      if (isFormAssociated) {
        // Perf optimization - the vast majority of components have formAssociated=false,
        // so we can skip the setter in those cases, since undefined works the same as false.
        UpgradableConstructor.formAssociated = isFormAssociated;
      }
      return UpgradableConstructor;
    };
    function getUpgradableConstructor(tagName, isFormAssociated) {
      let UpgradableConstructor = cachedConstructors.get(tagName);
      if (isUndefined$1(UpgradableConstructor)) {
        if (!isUndefined$1(customElements.get(tagName))) {
          throw new Error(`Unexpected tag name "${tagName}". This name is a registered custom element, preventing LWC to upgrade the element.`);
        }
        UpgradableConstructor = createUpgradableConstructor(isFormAssociated);
        customElements.define(tagName, UpgradableConstructor);
        cachedConstructors.set(tagName, UpgradableConstructor);
      }
      return UpgradableConstructor;
    }
    const createCustomElement = (tagName, upgradeCallback, useNativeLifecycle, isFormAssociated) => {
      const UpgradableConstructor = getUpgradableConstructor(tagName, isFormAssociated);
      if (Boolean(UpgradableConstructor.formAssociated) !== isFormAssociated) {
        throw new Error(`<${tagName}> was already registered with formAssociated=${UpgradableConstructor.formAssociated}. It cannot be re-registered with formAssociated=${isFormAssociated}. Please rename your component to have a different name than <${tagName}>`);
      }
      elementBeingUpgradedByLWC = true;
      try {
        return new UpgradableConstructor(upgradeCallback, useNativeLifecycle);
      } finally {
        elementBeingUpgradedByLWC = false;
      }
    };

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    /**
     * A factory function that produces a renderer.
     * Renderer encapsulates operations that are required to render an LWC component into the underlying
     * runtime environment. In the case of @lwc/enigne-dom, it is meant to be used in a DOM environment.
     * @param baseRenderer Either null or the base renderer imported from 'lwc'.
     * @returns The created renderer
     * @example
     * import { renderer, rendererFactory } from 'lwc';
     * const customRenderer = rendererFactory(renderer);
     */
    function rendererFactory(baseRenderer) {
      // Type assertion because this is replaced by rollup with an object, not a string.
      // See `injectInlineRenderer` in /scripts/rollup/rollup.config.js
      const renderer = function (exports) {
        /**
         * Copyright (c) 2025 Salesforce, Inc.
         */
        /*
         * Copyright (c) 2018, salesforce.com, inc.
         * All rights reserved.
         * SPDX-License-Identifier: MIT
         * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
         */
        /**
         *
         * @param value
         * @param msg
         */
        function invariant(value, msg) {
          if (!value) {
            throw new Error(`Invariant Violation: ${msg}`);
          }
        }
        /**
         *
         * @param value
         * @param msg
         */
        function isTrue$1(value, msg) {
          if (!value) {
            throw new Error(`Assert Violation: ${msg}`);
          }
        }
        /**
         *
         * @param value
         * @param msg
         */
        function isFalse$1(value, msg) {
          if (value) {
            throw new Error(`Assert Violation: ${msg}`);
          }
        }
        /**
         *
         * @param msg
         */
        function fail(msg) {
          throw new Error(msg);
        }
        var assert = /*#__PURE__*/Object.freeze({
          __proto__: null,
          fail: fail,
          invariant: invariant,
          isFalse: isFalse$1,
          isTrue: isTrue$1
        });

        /*
         * Copyright (c) 2024, Salesforce, Inc.
         * All rights reserved.
         * SPDX-License-Identifier: MIT
         * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
         */
        const {
          /** Detached {@linkcode Object.getOwnPropertyDescriptors}; see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors MDN Reference}. */
          getOwnPropertyDescriptors
        } = Object;
        /**
         * Determines whether the argument is `undefined`.
         * @param obj Value to test
         * @returns `true` if the value is `undefined`.
         */
        function isUndefined(obj) {
          return obj === undefined;
        }
        /**
         * Determines whether the argument is `null`.
         * @param obj Value to test
         * @returns `true` if the value is `null`.
         */
        function isNull(obj) {
          return obj === null;
        }
        /** version: 8.16.0 */

        /*
         * Copyright (c) 2024, Salesforce, Inc.
         * All rights reserved.
         * SPDX-License-Identifier: MIT
         * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
         */
        // Like @lwc/shared, but for DOM APIs
        const ElementDescriptors = getOwnPropertyDescriptors(Element.prototype);
        const ElementAttachShadow = ElementDescriptors.attachShadow.value;
        const ElementShadowRootGetter = ElementDescriptors.shadowRoot.get;

        /*
         * Copyright (c) 2023, salesforce.com, inc.
         * All rights reserved.
         * SPDX-License-Identifier: MIT
         * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
         */
        class WireContextSubscriptionEvent extends CustomEvent {
          constructor(adapterToken, {
            setNewContext,
            setDisconnectedCallback
          }) {
            super(adapterToken, {
              bubbles: true,
              composed: true
            });
            this.setNewContext = setNewContext;
            this.setDisconnectedCallback = setDisconnectedCallback;
          }
          /*LWC compiler v8.16.0*/
        }
        function registerContextConsumer(elm, adapterContextToken, subscriptionPayload) {
          dispatchEvent(elm, new WireContextSubscriptionEvent(adapterContextToken, subscriptionPayload));
        }
        function registerContextProvider(elm, adapterContextToken, onContextSubscription) {
          addEventListener(elm, adapterContextToken, evt => {
            evt.stopImmediatePropagation();
            const {
              setNewContext,
              setDisconnectedCallback
            } = evt;
            onContextSubscription({
              setNewContext,
              setDisconnectedCallback
            });
          });
        }

        /*
         * Copyright (c) 2018, salesforce.com, inc.
         * All rights reserved.
         * SPDX-License-Identifier: MIT
         * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
         */
        function cloneNode(node, deep) {
          return node.cloneNode(deep);
        }
        function createElement(tagName, namespace) {
          return isUndefined(namespace) ? document.createElement(tagName) : document.createElementNS(namespace, tagName);
        }
        function createText(content) {
          return document.createTextNode(content);
        }
        function createComment(content) {
          return document.createComment(content);
        }
        // Parse the fragment HTML string into DOM
        function createFragment(html) {
          const template = document.createElement('template');
          template.innerHTML = html;
          return template.content.firstChild;
        }
        function insert(node, parent, anchor) {
          parent.insertBefore(node, anchor);
        }
        function remove(node, parent) {
          parent.removeChild(node);
        }
        function nextSibling(node) {
          return node.nextSibling;
        }
        function previousSibling(node) {
          return node.previousSibling;
        }
        function getParentNode(node) {
          return node.parentNode;
        }
        function attachShadow(element, options) {
          // `shadowRoot` will be non-null in two cases:
          //   1. upon initial load with an SSR-generated DOM, while in Shadow render mode
          //   2. when a webapp author places <c-app> in their static HTML and mounts their
          //      root component with customElement.define('c-app', Ctor)
          // see W-17441501
          const shadowRoot = ElementShadowRootGetter.call(element);
          if (!isNull(shadowRoot)) {
            return shadowRoot;
          }
          return ElementAttachShadow.call(element, options);
        }
        function setText(node, content) {
          node.nodeValue = content;
        }
        function getProperty(node, key) {
          return node[key];
        }
        function setProperty(node, key, value) {
          node[key] = value;
        }
        function getAttribute(element, name, namespace) {
          return isUndefined(namespace) ? element.getAttribute(name) : element.getAttributeNS(namespace, name);
        }
        function setAttribute(element, name, value, namespace) {
          return isUndefined(namespace) ? element.setAttribute(name, value) : element.setAttributeNS(namespace, name, value);
        }
        function removeAttribute(element, name, namespace) {
          if (isUndefined(namespace)) {
            element.removeAttribute(name);
          } else {
            element.removeAttributeNS(namespace, name);
          }
        }
        function addEventListener(target, type, callback, options) {
          target.addEventListener(type, callback, options);
        }
        function removeEventListener(target, type, callback, options) {
          target.removeEventListener(type, callback, options);
        }
        function dispatchEvent(target, event) {
          return target.dispatchEvent(event);
        }
        function getClassList(element) {
          return element.classList;
        }
        function setCSSStyleProperty(element, name, value, important) {
          // TODO [#0]: How to avoid this type casting? Shall we use a different type interface to
          // represent elements in the engine?
          element.style.setProperty(name, value, important ? 'important' : '');
        }
        function getBoundingClientRect(element) {
          return element.getBoundingClientRect();
        }
        function querySelector(element, selectors) {
          return element.querySelector(selectors);
        }
        function querySelectorAll(element, selectors) {
          return element.querySelectorAll(selectors);
        }
        function getElementsByTagName(element, tagNameOrWildCard) {
          return element.getElementsByTagName(tagNameOrWildCard);
        }
        function getElementsByClassName(element, names) {
          return element.getElementsByClassName(names);
        }
        function getChildren(element) {
          return element.children;
        }
        function getChildNodes(element) {
          return element.childNodes;
        }
        function getFirstChild(element) {
          return element.firstChild;
        }
        function getFirstElementChild(element) {
          return element.firstElementChild;
        }
        function getLastChild(element) {
          return element.lastChild;
        }
        function getLastElementChild(element) {
          return element.lastElementChild;
        }
        function isConnected(node) {
          return node.isConnected;
        }
        function assertInstanceOfHTMLElement(elm, msg) {
          assert.invariant(elm instanceof HTMLElement, msg);
        }
        function ownerDocument(element) {
          return element.ownerDocument;
        }
        function getTagName(elm) {
          return elm.tagName;
        }
        function getStyle(elm) {
          return elm.style;
        }
        function attachInternals(elm) {
          return attachInternalsFunc.call(elm);
        }
        // Use the attachInternals method from HTMLElement.prototype because access to it is removed
        // in HTMLBridgeElement, ie: elm.attachInternals is undefined.
        // Additionally, cache the attachInternals method to protect against 3rd party monkey-patching.
        const attachInternalsFunc = typeof ElementInternals !== 'undefined' ? HTMLElement.prototype.attachInternals : () => {
          throw new Error('attachInternals API is not supported in this browser environment.');
        };
        exports.addEventListener = addEventListener;
        exports.assertInstanceOfHTMLElement = assertInstanceOfHTMLElement;
        exports.attachInternals = attachInternals;
        exports.attachShadow = attachShadow;
        exports.cloneNode = cloneNode;
        exports.createComment = createComment;
        exports.createElement = createElement;
        exports.createFragment = createFragment;
        exports.createText = createText;
        exports.dispatchEvent = dispatchEvent;
        exports.getAttribute = getAttribute;
        exports.getBoundingClientRect = getBoundingClientRect;
        exports.getChildNodes = getChildNodes;
        exports.getChildren = getChildren;
        exports.getClassList = getClassList;
        exports.getElementsByClassName = getElementsByClassName;
        exports.getElementsByTagName = getElementsByTagName;
        exports.getFirstChild = getFirstChild;
        exports.getFirstElementChild = getFirstElementChild;
        exports.getLastChild = getLastChild;
        exports.getLastElementChild = getLastElementChild;
        exports.getParentNode = getParentNode;
        exports.getProperty = getProperty;
        exports.getStyle = getStyle;
        exports.getTagName = getTagName;
        exports.insert = insert;
        exports.isConnected = isConnected;
        exports.nextSibling = nextSibling;
        exports.ownerDocument = ownerDocument;
        exports.previousSibling = previousSibling;
        exports.querySelector = querySelector;
        exports.querySelectorAll = querySelectorAll;
        exports.registerContextConsumer = registerContextConsumer;
        exports.registerContextProvider = registerContextProvider;
        exports.remove = remove;
        exports.removeAttribute = removeAttribute;
        exports.removeEventListener = removeEventListener;
        exports.setAttribute = setAttribute;
        exports.setCSSStyleProperty = setCSSStyleProperty;
        exports.setProperty = setProperty;
        exports.setText = setText;
        return exports;
      }({});
      // Meant to inherit any properties passed via the base renderer as the argument to the factory.
      Object.setPrototypeOf(renderer, baseRenderer);
      return renderer;
    }

    /*
     * Copyright (c) 2023, Salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // Host element mutation tracking is for SSR only
    const startTrackingMutations = noop;
    const stopTrackingMutations = noop;
    /**
     * The base renderer that will be used by engine-core.
     * This will be used for DOM operations when lwc is running in a browser environment.
     */
    const renderer = assign(
    // The base renderer will invoke the factory with null and assign additional properties that are
    // shared across renderers
    rendererFactory(null),
    // Properties that are either not required to be sandboxed or rely on a globally shared information
    {
      // insertStyleSheet implementation shares a global cache of stylesheet data
      insertStylesheet,
      // relies on a shared global cache
      createCustomElement,
      defineCustomElement: getUpgradableConstructor,
      isSyntheticShadowDefined: hasOwnProperty$1.call(Element.prototype, KEY__SHADOW_TOKEN),
      startTrackingMutations,
      stopTrackingMutations
    });
    function clearNode(node) {
      const childNodes = renderer.getChildNodes(node);
      for (let i = childNodes.length - 1; i >= 0; i--) {
        renderer.remove(childNodes[i], node);
      }
    }
    /**
     * The real `buildCustomElementConstructor`. Should not be accessible to external users!
     * @internal
     * @param Ctor LWC constructor to build
     * @returns A Web Component class
     * @see {@linkcode deprecatedBuildCustomElementConstructor}
     */
    function buildCustomElementConstructor(Ctor) {
      var _a;
      const HtmlPrototype = getComponentHtmlPrototype(Ctor);
      const {
        observedAttributes
      } = HtmlPrototype;
      const {
        attributeChangedCallback
      } = HtmlPrototype.prototype;
      return _a = class extends HTMLElement {
        constructor() {
          super();
          if (!isNull(this.shadowRoot)) {
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.warn(`Found an existing shadow root for the custom element "${Ctor.name}". Call \`hydrateComponent\` instead.`);
            }
            clearNode(this.shadowRoot);
          }
          // Compute renderMode/shadowMode in advance. This must be done before `createVM` because `createVM` may
          // mutate the element.
          const {
            shadowMode,
            renderMode
          } = computeShadowAndRenderMode(Ctor, renderer);
          // Native shadow components are allowed to have pre-existing `childNodes` before upgrade. This supports
          // use cases where a custom element has declaratively-defined slotted content, e.g.:
          // https://github.com/salesforce/lwc/issues/3639
          const isNativeShadow = renderMode === 1 /* RenderMode.Shadow */ && shadowMode === 0 /* ShadowMode.Native */;
          if (!isNativeShadow && this.childNodes.length > 0) {
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.warn(`Light DOM and synthetic shadow custom elements cannot have child nodes. ` + `Ensure the element is empty, including whitespace.`);
            }
            clearNode(this);
          }
          createVM(this, Ctor, renderer, {
            mode: 'open',
            owner: null,
            tagName: this.tagName
          });
        }
        connectedCallback() {
          connectRootElement(this);
        }
        disconnectedCallback() {
          disconnectRootElement(this);
        }
        attributeChangedCallback(name, oldValue, newValue) {
          if (this instanceof BaseBridgeElement) {
            // W-17420330
            attributeChangedCallback.call(this, name, oldValue, newValue);
          }
        }
        formAssociatedCallback(form) {
          runFormAssociatedCallback(this, form);
        }
        formDisabledCallback(disabled) {
          runFormDisabledCallback(this, disabled);
        }
        formResetCallback() {
          runFormResetCallback(this);
        }
        formStateRestoreCallback(state, reason) {
          runFormStateRestoreCallback(this, state, reason);
        }
        /*LWC compiler v8.16.0*/
      }, _a.observedAttributes = observedAttributes,
      // Note CustomElementConstructor is not upgraded by LWC and inherits directly from HTMLElement which means it calls the native
      // attachInternals API.
      _a.formAssociated = Boolean(Ctor.formAssociated), _a;
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // TODO [#2472]: Remove this workaround when appropriate.
    // eslint-disable-next-line @lwc/lwc-internal/no-global-node
    const _Node$1 = Node;
    const ConnectingSlot = new WeakMap();
    const DisconnectingSlot = new WeakMap();
    function callNodeSlot(node, slot) {
      if (process.env.NODE_ENV !== 'production') {
        assert.isTrue(node, `callNodeSlot() should not be called for a non-object`);
      }
      const fn = slot.get(node);
      if (!isUndefined$1(fn)) {
        fn(node);
      }
      return node; // for convenience
    }
    let monkeyPatched = false;
    function monkeyPatchDomAPIs() {
      if (monkeyPatched) {
        // don't double-patch
        return;
      }
      monkeyPatched = true;
      // Monkey patching Node methods to be able to detect the insertions and removal of root elements
      // created via createElement.
      const {
        appendChild,
        insertBefore,
        removeChild,
        replaceChild
      } = _Node$1.prototype;
      assign(_Node$1.prototype, {
        appendChild(newChild) {
          const appendedNode = appendChild.call(this, newChild);
          return callNodeSlot(appendedNode, ConnectingSlot);
        },
        insertBefore(newChild, referenceNode) {
          if (process.env.NODE_ENV !== 'production' && arguments.length < 2) {
            // eslint-disable-next-line no-console
            console.warn('insertBefore should be called with 2 arguments. Calling with only 1 argument is not supported.');
          }
          const insertedNode = insertBefore.call(this, newChild, referenceNode);
          return callNodeSlot(insertedNode, ConnectingSlot);
        },
        removeChild(oldChild) {
          const removedNode = removeChild.call(this, oldChild);
          return callNodeSlot(removedNode, DisconnectingSlot);
        },
        replaceChild(newChild, oldChild) {
          const replacedNode = replaceChild.call(this, newChild, oldChild);
          callNodeSlot(replacedNode, DisconnectingSlot);
          callNodeSlot(newChild, ConnectingSlot);
          return replacedNode;
        }
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      // In dev mode, we must eagerly patch these DOM APIs because `restrictions.ts` in `@lwc/engine-core` does
      // its own monkey-patching, and the assumption is that its monkey patches will apply on top of our own.
      // If we _don't_ eagerly monkey-patch, then APIs like `element.appendChild` could end up calling through
      // directly to the native DOM APIs instead, which would bypass synthetic custom element lifecycle
      // and cause rendering/`connectedCallback`/`disconnectedCallback` not to fire.
      // In prod mode, we avoid global patching as a slight perf optimization and because it's good practice
      // in general to avoid global patching.
      // See issue #4242 for details.
      monkeyPatchDomAPIs();
    }
    /**
     * EXPERIMENTAL: This function is almost identical to document.createElement with the slightly
     * difference that in the options, you can pass the `is` property set to a Constructor instead of
     * just a string value. The intent is to allow the creation of an element controlled by LWC without
     * having to register the element as a custom element.
     *
     * NOTE: The returned type incorrectly includes _all_ properties defined on the component class,
     * even though the runtime object only uses those decorated with `@api`. This is due to a
     * limitation of TypeScript. To avoid inferring incorrect properties, provide an explicit generic
     * parameter, e.g. `createElement<typeof LightningElement>('x-foo', { is: FooCtor })`.
     * @param sel The tagname of the element to create
     * @param options Control the behavior of the created element
     * @param options.is The LWC component that the element should be
     * @param options.mode What kind of shadow root to use
     * @returns The created HTML element
     * @throws Throws when called with invalid parameters.
     * @example
     * const el = createElement('x-foo', { is: FooCtor });
     */
    function createElement(sel, options) {
      if (!isObject(options) || isNull(options)) {
        throw new TypeError(`"createElement" function expects an object as second parameter but received "${toString(options)}".`);
      }
      const Ctor = options.is;
      if (!isFunction$1(Ctor)) {
        throw new TypeError(`"createElement" function expects an "is" option with a valid component constructor.`);
      }
      const {
        createCustomElement
      } = renderer;
      // tagName must be all lowercase, unfortunately, we have legacy code that is
      // passing `sel` as a camel-case, which makes them invalid custom elements name
      // the following line guarantees that this does not leaks beyond this point.
      const tagName = StringToLowerCase.call(sel);
      const useNativeCustomElementLifecycle = !lwcRuntimeFlags.DISABLE_NATIVE_CUSTOM_ELEMENT_LIFECYCLE;
      const isFormAssociated = shouldBeFormAssociated(Ctor);
      // the custom element from the registry is expecting an upgrade callback
      /*
       * Note: if the upgradable constructor does not expect, or throw when we new it
       * with a callback as the first argument, we could implement a more advanced
       * mechanism that only passes that argument if the constructor is known to be
       * an upgradable custom element.
       */
      const upgradeCallback = elm => {
        createVM(elm, Ctor, renderer, {
          tagName,
          mode: options.mode !== 'closed' ? 'open' : 'closed',
          owner: null
        });
        if (!useNativeCustomElementLifecycle) {
          // Monkey-patch on-demand, because `lwcRuntimeFlags.DISABLE_NATIVE_CUSTOM_ELEMENT_LIFECYCLE` may be set to
          // `true` lazily, after `@lwc/engine-dom` has finished initializing but before a component has rendered.
          monkeyPatchDomAPIs();
          ConnectingSlot.set(elm, connectRootElement);
          DisconnectingSlot.set(elm, disconnectRootElement);
        }
      };
      return createCustomElement(tagName, upgradeCallback, useNativeCustomElementLifecycle, isFormAssociated);
    }

    /*
     * Copyright (c) 2018, salesforce.com, inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    const ComponentConstructorToCustomElementConstructorMap = new Map();
    function getCustomElementConstructor(Ctor) {
      if (Ctor === LightningElement) {
        throw new TypeError(`Invalid Constructor. LightningElement base class can't be claimed as a custom element.`);
      }
      let ce = ComponentConstructorToCustomElementConstructorMap.get(Ctor);
      if (isUndefined$1(ce)) {
        ce = buildCustomElementConstructor(Ctor);
        ComponentConstructorToCustomElementConstructorMap.set(Ctor, ce);
      }
      return ce;
    }
    /**
     * This static getter builds a Web Component class from a LWC constructor so it can be registered
     * as a new element via customElements.define() at any given time.
     * @example
     * import Foo from 'ns/foo';
     * customElements.define('x-foo', Foo.CustomElementConstructor);
     * const elm = document.createElement('x-foo');
     */
    defineProperty(LightningElement, 'CustomElementConstructor', {
      get() {
        return getCustomElementConstructor(this);
      }
    });
    freeze(LightningElement);
    seal(LightningElement.prototype);

    /*
     * Copyright (c) 2024, Salesforce, Inc.
     * All rights reserved.
     * SPDX-License-Identifier: MIT
     * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
     */
    // Like @lwc/shared, but for DOM APIs
    const ElementDescriptors = getOwnPropertyDescriptors(Element.prototype);
    ElementDescriptors.attachShadow.value;
    ElementDescriptors.shadowRoot.get;
    /** version: 8.16.0 */

    const $fragment1$1 = parseFragment`<p${"a0:title"}${3}>${"t1"}</p>`;
    function tmpl$1($api, $cmp, $slotset, $ctx) {
      const {d: api_dynamic_text, sp: api_static_part, st: api_static_fragment} = $api;
      return [api_static_fragment($fragment1$1, 1, [api_static_part(0, {
        attrs: {
          "title": $cmp.hover
        }
      }, null), api_static_part(1, null, api_dynamic_text($cmp.text))])];
      /*LWC compiler v8.16.0*/
    }
    var _tmpl$1 = registerTemplate(tmpl$1);
    tmpl$1.stylesheets = [];
    tmpl$1.stylesheetToken = "lwc-26qk5tjqap0";
    tmpl$1.legacyStylesheetToken = "example-line_line";
    freezeTemplate(tmpl$1);

    class Line extends LightningElement {
      constructor(...args) {
        super(...args);
        this.hover = void 0;
        this.internalText = void 0;
      }
      set text(value) {
        this.internalText = value;
      }
      get text() {
        return this.internalText;
      }
      focus() {
        this.root.querySelector('p').focus();
      }
      /*LWC compiler v8.16.0*/
    }
    registerDecorators(Line, {
      publicProps: {
        hover: {
          config: 0
        },
        text: {
          config: 3
        }
      },
      publicMethods: ["focus"],
      fields: ["internalText"]
    });
    const __lwc_component_class_internal$1 = registerComponent(Line, {
      tmpl: _tmpl$1,
      sel: "example-line",
      apiVersion: 63
    });

    const $fragment1 = parseFragment`<h1${"a0:title"}${3}>${"t1"}</h1>`;
    const $fragment2 = parseFragment`<p${3}>paragraph controlled by if:true</p>`;
    const $fragment3 = parseFragment`<li${3}>${"t1"}</li>`;
    const $fragment4 = parseFragment`<span${3}>${"t1"}</span>`;
    const $fragment5 = parseFragment`<button${3}>Reverse</button>`;
    const stc0 = {
      key: 4
    };
    const stc1 = {
      props: {
        "text": "line 1",
        "hover": "hover 1"
      },
      key: 11
    };
    const stc2 = {
      props: {
        "text": "line 2",
        "hover": "hover 2"
      },
      key: 12
    };
    const stc3 = {
      "text": "green line"
    };
    function tmpl($api, $cmp, $slotset, $ctx) {
      const {d: api_dynamic_text, sp: api_static_part, st: api_static_fragment, k: api_key, i: api_iterator, h: api_element, b: api_bind, c: api_custom_element} = $api;
      const {_m0, _m1} = $ctx;
      return [api_static_fragment($fragment1, 1, [api_static_part(0, {
        attrs: {
          "title": $cmp.state.titleHover
        }
      }, null), api_static_part(1, null, api_dynamic_text($cmp.state.title))]), $cmp.state.pIfTrue ? api_static_fragment($fragment2, 3) : null, api_element("ol", stc0, api_iterator($cmp.state.todos, function (todo) {
        return api_static_fragment($fragment3, api_key(6, todo.text), [api_static_part(1, null, api_dynamic_text(todo.text))]);
      })), api_static_fragment($fragment4, 8, [api_static_part(1, null, "message: " + api_dynamic_text($cmp.state.message))]), api_static_fragment($fragment5, 10, [api_static_part(0, {
        on: _m1 || ($ctx._m1 = {
          "click": api_bind($cmp.reverseMessage)
        })
      }, null)]), api_custom_element("example-line", __lwc_component_class_internal$1, stc1), api_custom_element("example-line", __lwc_component_class_internal$1, stc2), api_custom_element("example-line", __lwc_component_class_internal$1, {
        props: {
          "text": $cmp.computedMessage
        },
        key: 13
      }), api_custom_element("example-line", __lwc_component_class_internal$1, {
        style: $cmp.lineStyle,
        props: stc3,
        key: 14
      })];
      /*LWC compiler v8.16.0*/
    }
    var _tmpl = registerTemplate(tmpl);
    tmpl.stylesheets = [];
    tmpl.stylesheetToken = "lwc-5la2ic78dit";
    tmpl.legacyStylesheetToken = "example-app_app";
    freezeTemplate(tmpl);

    class App extends LightningElement {
      // state = 4;  // example type error if checkJs is enabled

      reverseMessage(event) {
        this.state.message = this.state.message.split('').reverse().join('');
      }
      get computedMessage() {
        return 'hello ' + this.state.name;
      }
      get lineStyle() {
        return 'color: green';
      }

      // lifecycle hooks

      constructor() {
        super();
        this.state = {
          title: 'Example App',
          titleHover: 'title hover',
          pIfTrue: true,
          todos: [{
            text: 'todo-1'
          }, {
            text: 'todo-2'
          }, {
            text: 'todo-3'
          }],
          message: 'the message',
          name: 'John'
        };
        console.log('App.constructor');
      }
      connectedCallback() {
        console.log('App.connectedCallback');
      }
      disconnectedCallback() {
        console.log('App.disconnectedCallback');
      }
      /*LWC compiler v8.16.0*/
    }
    registerDecorators(App, {
      fields: ["state"]
    });
    const __lwc_component_class_internal = registerComponent(App, {
      tmpl: _tmpl,
      sel: "example-app",
      apiVersion: 63
    });

    const container = document.getElementById('main');
    const element = createElement('example-app', {
      is: __lwc_component_class_internal
    });
    container.appendChild(element);

})();
