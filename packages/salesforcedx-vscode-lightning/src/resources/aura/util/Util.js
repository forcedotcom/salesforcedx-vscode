
/*
 * Copyright (C) 2013 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @description
 * Util methods provide utility functions for browsers in addition to
 * functions for retrieving, manipulating, or checking DOM elements.
 * @constructor
 * @platform
 * @export
 */
Aura.Utils.Util = function Util() {
    this.trashcan = document.createDocumentFragment();
    this.trash = [];
    this.json = new Json();
    this["json"] = this.json;
    this.style = new Aura.Utils.Style();
    this["style"] = this.style;
    this["Bitset"] = Aura.Utils.Bitset;
    this["NumberFormat"] = Aura.Utils.NumberFormat;
    this.objToString = Object.prototype.toString;
    this.trashedComponentQueue = [];
    this.dataAttributeCache = {};
    this.debugToolWindow = undefined;
    this.sizeEstimator = new Aura.Utils.SizeEstimator();
    this.Mutex = new Aura.Utils.Mutex();
    this["Mutex"] = this.Mutex;
};

/**
 * Browser check for all supported versions of Internet Explorer, does the validation using the userAgent.
 *
 * @returns {Boolean} true if Internet Explorer detected
 * @export
 */
Aura.Utils.Util.prototype.isIE = (navigator.userAgent.indexOf("MSIE") !== -1) || (navigator.userAgent.indexOf("Trident/") !== -1);

Promise.prototype.then = Promise.prototype['then'];

/**
 * Browser check for localStorage enablement.
 * @returns {Boolean} true if LocalStorage is available
 * @private
 */
Aura.Utils.Util.prototype.isLocalStorageEnabled = function () {
    if (this.localStorageEnabled === undefined) {
        this.localStorageEnabled = false;
        try {
            if (window.localStorage) {
                window.localStorage.setItem("__AURA_LOCAL_STORAGE_ENABLED_TEST", "");
                window.localStorage.removeItem("__AURA_LOCAL_STORAGE_ENABLED_TEST");
                this.localStorageEnabled = true;
            }
        } catch (ignore) {
            // do nothing
        }
    }

    return this.localStorageEnabled;
};

/**
 * Browser check for sessionStorage enablement.
 * @returns {Boolean} true if SessionStorage is available
 * @private
 */
Aura.Utils.Util.prototype.isSessionStorageEnabled = function () {
    if (this.sessionStorageEnabled === undefined) {
        this.sessionStorageEnabled = false;
        try {
            if (window.sessionStorage) {

                    window.sessionStorage.setItem("__AURA_SESSION_STORAGE_ENABLED_TEST", "");
                    window.sessionStorage.removeItem("__AURA_SESSION_STORAGE_ENABLED_TEST");
                    this.sessionStorageEnabled = true;
            }
        } catch (ignore) {
            // do nothing
        }
    }

    return this.sessionStorageEnabled;
};



/**
 * Sets a cookie.
 * @param {String} key The name of the cookie.
 * @param {String} value The value of the cookie.
 * @param {Number} duration The duration of the cookie (milliseconds)
 * @private
 */
Aura.Utils.Util.prototype.setCookie = function(key, value, duration) {
    $A.assert(typeof key === "string", "key must be a string");
    $A.assert(typeof value === "string", "value must be a string");
    $A.assert(duration === undefined || typeof duration === "number", "duration must be a number");

    duration = duration || 1000*60*60*24*7; // + 1 week
    var expiration = new Date(new Date().getTime() + duration);
    document.cookie = key + "=" + value + "; expires=" + expiration.toUTCString();
};

/**
 * Gets a cookie.
 * @param {String} key The name of the cookie.
 * @return {String} the value of the cookie if it exists, undefined otherwise.
 * @export
 */
Aura.Utils.Util.prototype.getCookie = function(key) {
    $A.assert(typeof key === "string", "key must be a string");

    var cookies = "; " + document.cookie + ";";
    key = "; " + key + "=";
    var begin = cookies.indexOf(key);
    if (begin === -1) {
        return undefined;
    }
    var end = cookies.indexOf(";", begin + key.length);
    var value = cookies.substring(begin + key.length, end);
    return value;
};

/**
 * Clears a cookie.
 * @param {String} key The name of the cookie.
 */
Aura.Utils.Util.prototype.clearCookie = function(key) {
    $A.assert(typeof key === "string", "key must be a string");
    document.cookie = key + "=true; expires=Thu, 01 Jan 1970 00:00:00 GMT";
};

/**
 * Whether IOS7 UIWebView
 * @returns {boolean} true if IOS UIWebView
 * @export
 */
Aura.Utils.Util.prototype.isIOSWebView = function() {
    if (this._isIOSWebView === undefined) {
        var ua = window.navigator.userAgent;
        this._isIOSWebView = /(iPad|iPhone|iPod);.*CPU.*OS 7_\d.*AppleWebKit/i.test(ua) && ua.indexOf("Safari") === -1;
    }
    return this._isIOSWebView;
};

/**
 * evals code globally, without enclosing the current scope
 *
 * @private
 */
Aura.Utils.Util.prototype.globalEval = function(src, sourceURL) {

    // Force an indirect eval so it uses the global context.
    sourceURL = sourceURL ? '\n//# sourceURL=' + sourceURL : '';
    return (0,eval)("(function(){ return (\n"+ src +"\n)})();" + sourceURL);
};

/**
 * Checks whether the specified object is an array.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is an array, or false otherwise.
 * @function
 * @platform
 * @export
 */
Aura.Utils.Util.prototype.isArray = typeof Array.isArray === "function" ? Array.isArray : function(arg) {
  return Object.prototype.toString.call(arg) === '[object Array]';
};

/**
 * Checks whether the specified object is a valid object.
 * A valid object: Is not a DOM element, is not a native browser class (XMLHttpRequest)
 * is not falsey, and is not an array, error, function string or number.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is a valid object, or false otherwise.
 * @function
 * @platform
 * @export
 */
Aura.Utils.Util.prototype.isObject = function(obj){
    return typeof obj === "object" && obj !== null && !Array.isArray(obj);
};

/**
 * Checks whether the specified object is a plain object or literal.
 * A plain object is created using "{}" or "new Object()".
 *
 * @param {Object} o The object to check for.
 * @returns {Boolean} True if the object is a plain object, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isPlainObject = function(o){

    function isObjectObject(x) {
        return (typeof x === 'object' && x !== null)
            && Object.prototype.toString.call(x) === '[object Object]';
    }

    if (isObjectObject(o) === false) { return false; }

    // If has modified constructor
    if (typeof o.constructor !== 'function') { return false; }


    // @dval: Added temporal try/catch until we figure out a better way
    // to guarantee proxification in intrinsic/primordials:
    // https://git.soma.salesforce.com/raptor/raptor/issues/406
    try {
        // If has modified prototype
        var p = o.constructor.prototype;
        if (isObjectObject(p) === false) { return false; }

        // If constructor does not have an Object-specific method
        if (p.hasOwnProperty('isPrototypeOf') === false) {
            return false;
        }
    } catch (e) { /* Assume is  object when throws */}

    // Most likely a plain Object
    return true;
};

/**
 * Checks whether the specified object is a valid error.
 * A valid error: Is not a DOM element, native browser class (XMLHttpRequest), falsey,
 * array, function string or number.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is a valid error, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isError = function(obj){
    return !!obj && this.objToString.apply(obj) === '[object Error]';
};

/**
 * Checks whether the specified object is a valid function.
 * A valid function: Is not a DOM element, native browser class (XMLHttpRequest), falsey,
 * array, error, or number.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is a valid function, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isFunction = function(obj){
    return !!obj && this.objToString.apply(obj) === '[object Function]';
};

/**
 * Checks if the object is of type string.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is of type string, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isString = function(obj){
    return typeof obj === 'string';
};

/**
 * Checks if the object is of type number.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is of type number, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isNumber = function(obj){
    return typeof obj === 'number';
};

/**
 * Checks if the object is a finite number (not NaN or Infinity or -Infinity)
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is a finite number, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isFiniteNumber = function(obj){
    return this.isNumber(obj) && isFinite(obj);
};

/**
 * Checks if the object is of type boolean.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is of type boolean, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isBoolean = function(obj){
    return typeof obj === 'boolean';
};

/**
 * Checks if the object is undefined.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is undefined, or false otherwise.
 * @export
 * @platform
 */
Aura.Utils.Util.prototype.isUndefined = function(obj){
    return obj === undefined;
};

/**
 * Checks if the object is undefined or null.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is undefined or null, or return false otherwise.
 * @export
 * @platform
 */
Aura.Utils.Util.prototype.isUndefinedOrNull = function(obj){
    return obj === undefined || obj === null;
};

/**
 * Checks if the object is empty.
 * An empty object's value is undefined, null, an empty array, or empty string. An object with no native
 * properties is not considered empty.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object is empty, or false otherwise.
 * @platform
 * @export
 */
Aura.Utils.Util.prototype.isEmpty = function(obj){
    if (obj === undefined || obj === null || obj === '') {
        return true;
    }
    if (Array.isArray(obj)) {
        return obj.length === 0;
    } else if (typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Object]') {
        return Object.keys(obj).length === 0;
    }
    return false;
};

/**
 * Coerces truthy and falsy values into native booleans
 *
 * @param {Object} val The object to check.
 * @returns {Boolean} True if the object is truthy, or false otherwise.
 * @platform
 * @function
 * @export
 */
Aura.Utils.Util.prototype.getBooleanValue = function (val) {
    return val !== undefined && val !== null && val !== false && val !== 0 && val !== "false" && val !== "" && val !== "f";
};

/**
 * Creates and returns an HTML element of the specified tag name and map of attributes.
 *
 * @param {String} tagName Tag name of the html element to create (e.g. 'a', 'img', 'div').
 * @param {Map} attributes A map of attributes that the element will have
 *   (e.g. {src: 'foo.img', alt: 'Some text'}
 * @returns (HTMLElement) the newly created element
 * @export
 */
Aura.Utils.Util.prototype.createHtmlElement = function (tagName, attributes) {
    var node = document.createElement(tagName);

    for (var attributeName in attributes) {
        var value = attributes[attributeName];
        if (!this.isUndefinedOrNull(value)) {
            if (this.isString(value) && value.indexOf("/auraFW") === 0) {
                // prepend any Aura resource urls with servlet context path
                value = $A.getContext().getContextPath() + value;
            }
            node.setAttribute(attributeName, value);
        }
    }
    return node;
};

/**
 * Removes all children of a node, effectively clearing its body.
 *
 * @param {HTMLElement} node The node to be cleared.
 * @export
 */
Aura.Utils.Util.prototype.clearNode = function (node) {
    var last = node.lastChild;
    while (last) {
        node.removeChild(last);
        last = node.lastChild;
    }
};

/**
 * Sanitize
 * Public method providing core sanitation functionality
 *
 * @param {String} dirty string
 * @param {Object} configuration object
 * @return {String} sanitized string
 * @export
*/

Aura.Utils.Util.prototype.sanitizeDOM = function (dirty, config) {
    return $A.lockerService.sanitize(dirty, config);
};

// -- Sanitize Facade (secure-filters) -----------------------------------------------

/**
 * Encodes values for safe embedding in HTML tags and attributes.
 *
 * @param {*} val will be converted to a String prior to encoding
 * @return {string} the encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeHtml = Aura.Utils.SecureFilters.html;

/**
 * Encodes values for safe embedding in JavaScript string contexts.
 *
 * @param {*} val will be converted to a String prior to encoding
 * @return {string} the encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeJs = Aura.Utils.SecureFilters.js;


/**
 * Encodes values embedded in HTML scripting attributes.
 *
 * @param {*} val will be converted to a String prior to encoding
 * @return {string} the encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeJsAttr = Aura.Utils.SecureFilters.jsAttr;

/**
 * Percent-encodes unsafe characters in URIs.
 *
 * @param {*} val will be converted to a String prior to encoding
 * @return {string} the percent-encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeUri = Aura.Utils.SecureFilters.uri;


/**
 * Encodes an object as JSON, but with unsafe characters in string literals
 * backslash-escaped.
 *
 * @param {any} val
 * @return {string} the JSON and backslash-encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeJsObj = Aura.Utils.SecureFilters.jsObj;


/**
 * Encodes values for safe embedding in CSS context.
 *
 * @param {any} val
 * @return {string} the backslash-encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeCSS = Aura.Utils.SecureFilters.css;


/**
 * Encodes values for safe embedding in HTML style attribute context.
 *
 * @param {any} val
 * @return {string} the entity and backslash-encoded string
 * @export
*/
Aura.Utils.Util.prototype.sanitizeStyle = Aura.Utils.SecureFilters.style;


// -----------------------------------------------------------------------------------

/**
 * Gets a DOM element by its id without any leading characters (e.g. #) unless the ID contains them.
 *
 * @param {String} id The corresponding id of the DOM element.
 * @returns {Object} The element with the matching id, or null if none is found.
 * @export
 */
Aura.Utils.Util.prototype.getElement = function(id){
    return document.getElementById(id);
};

/**
 * Gets a copy of an object. In the case of an Array or Object, returns a shallow copy. In the case of a literal,
 * returns the literal value.
 *
 * @param {Object} value The value for which to return a comparable copy.
 * @returns {Object} The comparable copy of the value supplied.
 */
Aura.Utils.Util.prototype.copy = function(value){
    if(this.isArray(value)){
        return value.slice();
    }
    if(this.isObject(value)){
        var copy={};
        this.apply(copy,value,true);
        return copy;
    }
    return value;
};

/**
 * Compares value equality of two variables. Returns true if primitive values match,
 * or if Object or Array members contain the same values. Checks Objects and Arrays recursively.
 * Fails fast. Note that objects stop comparing after satisfying 'likeness' against 'expected' -- i.e.,
 * 'actual' is allowed to exhibit members that 'expected' does not, as long as all members of 'expected' are matched.
 *
 * @param {Object} expected The baseline value to use in the comparison against 'actual'.
 * @param {Object} actual The value to compare against 'expected'.
 * @returns {Boolean} Returns true if the values match, and false if they do not.
 */
Aura.Utils.Util.prototype.equals = function(expected,actual){
    if(expected===actual){
        return true; // primitive similarity, reference equality.
    }
    if(!expected||!actual){
        return false; // no === match, but one value is falsey (null, undefined, 0, false, '', ...)
    }
    if(this.isObject(expected)){
        if(!this.isObject(actual)){
            return false;
        }
        for(var x in expected){
            if(expected.hasOwnProperty(x)){
                if(!actual.hasOwnProperty(x)){
                    return false;
                }
                if(!this.equals(expected[x],actual[x])){
                    return false;
                }
            }
        }
        return true;
    }
    if(this.isArray(expected)){
        if(!this.isArray(actual)||expected.length!==actual.length){
            return false;
        }
        for(var i=0;i<expected.length;i++){
            if(!this.equals(expected[i],actual[i])){
                return false;
            }
        }
        return true;
    }
    return false;
};

/**
 * Compares values. In the case of an Array or Object, compares first level references only.
 * In the case of a literal, directly compares value and type equality.
 * USE IN TESTS ONLY. HAS NON-TRIVIAL PERFORMANCE IMPLICATIONS.
 *
 * @param {Object} expected The source value to compare.
 * @param {Object} actual The target value to compare.
 * @returns {Object} The result of the comparison, with reasons.
 */
Aura.Utils.Util.prototype.compareValues = function(expected, actual){
    var result={
        "match":true,
        "reasons":[]
    };
    if(this.isArray(expected)){
        if(!this.isArray(actual)){
            result["reasons"].push({index:-1,reason:"Actual was not an Array."});
            result["match"]=false;
        }else {
            var length = Math.max(expected.length, actual.length);
            for (var i = 0; i < length; i++) {
                if (expected[i] !== actual[i]) {
                    result["reasons"].push({index: i, reason: "Mismatch at position " + i + "."});
                    result["match"] = false;
                }
            }
        }
    }else if(this.isObject(expected)){
        if(!this.isObject(actual)){
            result["reasons"].push({index:-1,reason:"Actual was not an Object."});
            result["match"]=false;
        }
        var keyMap={};
        for(var expectedKey in expected){
            keyMap[expectedKey]=true;
            if(expected[expectedKey]!==actual[expectedKey]){
                result["reasons"].push({index: expectedKey, reason: "Mismatch at key " + expectedKey + "."});
                result["match"] = false;
            }
        }
        for(var actualKey in actual){
            if(keyMap[actualKey]){
                continue;
            }
            result["reasons"].push({index: actualKey, reason: "Found new key " + actualKey + "."});
            result["match"] = false;
        }
    }else{
        if(expected!==actual){
            result["reasons"].push({index:-1,reason:"Literal value mismatch."});
            result["match"] = false;
        }
    }
    return result;
};


/**
 * Checks whether the component has the specified CSS class.
 *
 * @example
 * //find a component with aura:id="myCmp" in markup
 * var myCmp = component.find("myCmp");
 * $A.util.hasClass(myCmp, "myClass");
 *
 * @param {Object} element The component to check.
 * @param {String} className The CSS class name to check for.
 * @returns {Boolean} True if the specified class is found for the component, or false otherwise.
 * @export
 * @platform
 *
 */
Aura.Utils.Util.prototype.hasClass = function(element, className){
    var oldClass='';
    if(this.isComponent(element)){
        if(element.isInstanceOf("ui:elementInterface") || element.isInstanceOf("ui:visible")) {
            oldClass=element.get("v.class");
        }else if(element.isInstanceOf("aura:html")){
            oldClass=element.get("v.HTMLAttributes.class");
        }else{
            element=element.getElement();
        }
    }
    if(element && element.tagName){
        oldClass=element["className"];
    }
    return (' '+oldClass+' ').indexOf(' '+className+' ')>-1;
};

/**
 * Adds a CSS class to a component.
 *
 * @example
 * //find a component with aura:id="myCmp" in markup
 * var myCmp = component.find("myCmp");
 * $A.util.addClass(myCmp, "myClass");
 *
 * @param {Object} element The component to apply the class on.
 * @param {String} newClass The CSS class to be applied.
 * @export
 * @platform
 */
Aura.Utils.Util.prototype.addClass = function(element, newClass){
    this.setClass(element,newClass,false);
};

/**
 * Removes a CSS class from a component.
 *
 * @example
 * //find a component with aura:id="myCmp" in markup
 * var myCmp = component.find("myCmp");
 * $A.util.removeClass(myCmp, "myClass");
 *
 * @param {Object} element The component to remove the class from.
 * @param {String} newClass The CSS class to be removed from the element.
 * @export
 * @platform
 *
 */
Aura.Utils.Util.prototype.removeClass = function(element, newClass){
    this.setClass(element,newClass,true);
};

/**
 * Toggles (adds or removes) a CSS class from a component.
 *
 * @example
 * //find a component with aura:id="toggleMe" in markup
 * var toggleText = component.find("toggleMe");
 * $A.util.toggleClass(toggleText, "toggle");
 *
 * @param {Object} element The component to add or remove the class from.
 * @param {String} className The CSS class to be added or removed.
 * @export
 * @platform
 *
 */
Aura.Utils.Util.prototype.toggleClass = function(element, className, condition){
    if(condition===undefined){
        condition=!this.hasClass(element, className);
    }
    if(condition){
        this.addClass(element,className);
        return true;
    }else{
        this.removeClass(element, className);
        return false;
    }
};

/**
 * Swaps an element's class by removing the selected class and adding another in its place.
 *
 * @param {Object} element The element to be processed.
 * @param {String} oldClass The class to remove from the element.
 * @param {String} newClass The class to add to the element.
 * @export
 */
Aura.Utils.Util.prototype.swapClass = function(element, oldClass, newClass){
    oldClass = this.isArray(oldClass)?oldClass:[oldClass];
    newClass = this.isArray(newClass)?newClass:[newClass];
    for(var i=0;i<oldClass.length;i++){
        this.removeClass(element, oldClass[i]);
    }
    for(i=0;i<newClass.length;i++){
        this.addClass(element, newClass[i]);
    }
};

/**
 * @private
 */
Aura.Utils.Util.prototype.setClass=function(element,newClass,remove){
    var constructedClass='';
    if(this.isComponent(element)){
        var attribute=null;
        if(element.isInstanceOf("ui:elementInterface") || element.isInstanceOf("ui:visible")) {
            attribute="v.class";
        }else if(element.isInstanceOf("aura:html")){
            attribute="v.HTMLAttributes.class";
        }else{
            element=element.getElement();
        }
        if(attribute){
            var useShadowClass=false;
            var oldClass=element.getShadowAttribute(attribute);
            if(oldClass!=undefined){//eslint-disable-line eqeqeq
                useShadowClass=true;
            }else{
                oldClass=element.get(attribute)||'';
            }
            constructedClass=this.buildClass(oldClass,newClass,remove);
            if(oldClass!==constructedClass){
                if(useShadowClass){
                    element.setShadowAttribute(attribute,constructedClass?' '+constructedClass:'');
                }else{
                    element.set(attribute,constructedClass);
                }
            }
        }
    }
    if(element && element.tagName){
        if (element.tagName === "svg") {
            constructedClass=this.buildClass(element.getAttribute("class")||"",newClass,remove);
            if(element.getAttribute("class")!==constructedClass) {
                element.setAttribute("class", constructedClass);
            }
        } else {
            constructedClass=this.buildClass(element["className"]||"",newClass,remove);
            if(element["className"]!==constructedClass) {
                element["className"]=constructedClass;
            }
        }
    }
};

/**
 * @private
 */
Aura.Utils.Util.prototype.buildClass=function(oldClass, newClass, remove){
    if(this.isUndefinedOrNull(oldClass)) {
        oldClass='';
    }
    if(this.isUndefinedOrNull(newClass)){
        return oldClass;
    }
    newClass = this.trim(newClass);
    oldClass = this.trim(oldClass);
    var found=(' '+oldClass+' ').indexOf(' '+newClass+' ')>-1;
    if(remove){
        if(!found){
            return oldClass;
        }
        return this.trim((' '+oldClass+' ').split(' '+newClass+' ').join(' '));
    }else{
        if(oldClass){
            if(!found){
                return  oldClass + ' ' + newClass;
            } else {
                return oldClass;
            }
        }else{
            return newClass;
        }
    }
};

/**
 * Builds the appropriate css class name for a flavor.
 *
 * @param {Object} cmp The DefDescriptor of the component being flavored.
 * @returns {String} flavor The flavor name.
 * @export
 */
Aura.Utils.Util.prototype.buildFlavorClass = function(cmp, flavor) {
    if ($A.util.isFunction(cmp.getDef)) {
        cmp = cmp.getDef();
    }

    $A.assert(!this.isUndefinedOrNull(cmp.getStyleDef()), "Missing StyleDef for component " + cmp.getDescriptor() + " (required for flavors)");

    if (this.isEmpty(flavor)) {
        return "";
    }

    var base = cmp.getStyleDef().getClassName();
    var split = flavor.split(",");
    var clz = "";
    for (var i = 0, len = split.length; i < len; i++) {
        if (i !== 0) {
            clz += " ";
        }

        clz += base + "--" + this.trim(split[i]);
    }
    return clz;
};

/**
 * Generates dom nodes from string markup
 *
 * @param {String} markup The markup from which to generate dom nodes
 * @returns {Array} An array of the elements that were generated.
 * @export
 */
Aura.Utils.Util.prototype.createElementsFromMarkup=function(markup){
    if(!this.isUndefinedOrNull(markup)) {
        var tmpNode = document.createElement("span");
        tmpNode.innerHTML = markup;
        return this.toArray(tmpNode.childNodes);
    }
    return [];
};

/**
 * Inserts element(s) as the first child of the parent element.
 *
 * @param {Object} newE1 The new element to insert.
 * @param {Object} referenceE1 The reference element
 * @returns {Object} The element that was inserted.
 * @export
 */
 Aura.Utils.Util.prototype.insertFirst = function(newEl, referenceEl){
    if (this.isArray(newEl)) {
        // Don't create a fragment for just one item.
        if(newEl.length === 1) {
            this.insertFirst(newEl[0], referenceEl);
            return;
        }
        var frag = document.createDocumentFragment();
        this.appendChild(newEl, frag);
        this.insertFirst(frag, referenceEl);
        return;
    }
    var firstChild = referenceEl.firstChild;
    if (firstChild) {
        referenceEl.insertBefore(newEl, firstChild);
    } else {
        referenceEl.appendChild(newEl);
    }
};

/**
 * Inserts a new element, newEl, directly before the reference element, referenceEl.
 * If the reference element is a parent node, insert the new element directly before the parent node.
 *
 * @param {Object} newE1 The new element to insert.
 * @param {Object} referenceE1 The reference element
 * @returns {Object} The element that was inserted.
 * @export
 */
Aura.Utils.Util.prototype.insertBefore = function(newEl, referenceEl) {
    if (this.isArray(newEl)) {
        if(newEl.length === 1) {
            this.insertBefore(newEl[0], referenceEl);
            return;
        }
        var frag = document.createDocumentFragment();
        this.appendChild(newEl, frag);
        this.insertBefore(frag, referenceEl);
        return;
    }

    var parent = referenceEl.parentNode;
    if (parent) {
        parent.insertBefore(newEl, referenceEl);
    }
};

/**
 * Inserts a new element, newEl, directly after the reference element, referenceEl.
 * If the reference element is a parent node, insert the new element directly after the parent node.
 *
 * @param {Object} newE1 The new element to insert.
 * @param {Object} referenceE1 The reference element
 * @returns {Object} The element that was inserted.
 * @export
 */
Aura.Utils.Util.prototype.insertAfter = function(newEl, referenceEl) {
    if (this.isArray(newEl)) {
        if(newEl.length === 1) {
            this.insertAfter(newEl[0], referenceEl);
            return;
        }
        var frag = document.createDocumentFragment();
        this.appendChild(newEl, frag);
        this.insertAfter(frag, referenceEl);
        return;
    }

    var parent = referenceEl.parentNode;
    if (parent) {
        // if the parents lastchild is the targetElement...
        if (parent.lastChild === referenceEl) {
            //add the newElement after the target element.
            parent.appendChild(newEl);
        } else {
            // else the target has siblings, insert the new element between the target and it's next sibling.
            parent.insertBefore(newEl, referenceEl.nextSibling);
        }
    }
};

/**
 * Adds a new element to the end of the reference element. Does not work if the canHaveChildren property on the reference element is false.
 *
 * @param {Object} newE1 The element to append as a child of the reference element.
 * @param {Object} referenceE1 The existing element
 * @returns {Object} The new element that was added
 */
Aura.Utils.Util.prototype.appendChild = function(newEl, referenceEl) {
    if (referenceEl.canHaveChildren===false){
        return;
    }
    if (this.isArray(newEl)) {
        if(newEl.length === 1) {
            referenceEl.appendChild(newEl[0]);
            return;
        }
        var frag = document.createDocumentFragment();
        var len = newEl.length;
        for(var i=0;i<len;i++){
            if(newEl[i]) {
                frag.appendChild(newEl[i]);
            }
        }
        newEl = frag;

    }

    referenceEl.appendChild(newEl);
};

/**
 * Removes the specified element from the DOM.
 *
 * Use this method with caution. Since we hijack the normal delete
 * functionality, we need to be careful of odd event processing. Specifically
 * we end up sending off some events that would not otherwise be sent.
 *
 * Also note that we currently remove nodes children first, which means we
 * deconstruct our tree from the bottom up. If we reverse this, we might be
 * able to add optimizations.
 *
 * @param {Object} element The element to be removed.
 * @export
 */
Aura.Utils.Util.prototype.removeElement = function(element) {
    if (!element) {
        return;
    }

    // Out early for custom elements
    if (element.__customElement && element.parentElement) {
        element.parentElement.removeChild(element);
        return;
    }

    if (!(element.parentNode === this.trashcan)) {
        if (element.parentNode) {
            //
            // We do a check to ensure that we don't try to add the element
            // to the trashcan more than once. Though the check above _should_
            // catch all cases, there are odd boundary conditions where people
            // holding references could re-re-parent elements. That is very
            // bad, so we yell early here. Note that long lived references
            // might get past this as well, but they are likely to blow up
            // on use. Not having this code allows things to break much later
            // in an inobvious way. See W-1462733
            //
            // Note that we carefully protect aura_deleted from the compiler, so
            // that we don't accidentally conflict with the element namespace,
            // the property should never live longer than the delay between this
            // reparenting and the gc below.
            //
            if (element.nodeType !== 3 && element.nodeType !== 8) {
                $A.assert(this.isUndefined(element["aura_deleted"]), "Element was reused after delete");
                element["aura_deleted"] = true;
            }

            this.trashcan.appendChild(element);
        } else{
            this.trash.push(element);
        }

        if (!this.gcPending) {
            this.gcPending = true;
            var that = this;
            setTimeout(function() {
                var trashcan = that.trashcan;
                while (trashcan.hasChildNodes()) {
                    var node = trashcan.lastChild;

                    if (node.nodeType !== 3 && node.nodeType !== 8) {
                        try{
                            delete node["aura_deleted"];
                        } catch(e) {
                            //IE7 having issue with delete
                            node.removeAttribute("aura_deleted");
                        }
                    }

                    trashcan.removeChild(node);
                }

                for (var i = 0, len = that.trash.length; i < len; i++){
                    that.trash[i] = null;
                }

                that.trash = [];
                that.gcPending = false;
            }, 1000);
        }
    }
};

/**
 * Manipulate the properties of the querystring portion of a url.
 * @param {String} url Any url to manipulate, if it doesn't have a question mark in it. Any hash remains not affected.
 * @param {Object} params Map of key->value's to set in the url. Set key to null to remove it from the url.
 * @param {Boolean} encoded True if params are alredy encoded and prevent re-encoding.
 * @export
 */
Aura.Utils.Util.prototype.generateUrl = function(url, params, encoded) {
    if (this.isString(url) && this.isObject(params)) {
        var hashPairs;
        var map = {};
        var pieces = url.split("?");
        var query = pieces[1] || "";

        if (query.length > 1) {
            hashPairs = query.split("#");
            if (hashPairs.length > 1) {
                // Reset the query not to include hashtags
                query = hashPairs[0];
            }
        } else {
            // Check the url since it can still contain hashtags
            hashPairs = pieces[0].split("#");
            if (hashPairs.length > 1) {
                // Reset the baseUrl not to include hashtags
                pieces[0] = hashPairs[0];
            }
        }

        var pairs = query.split('&');
        for (var i = 0; i < pairs.length; i++) {
            if (pairs[i] > "") {
                var pair = pairs[i].split('=');
                map[pair[0]] = pair[1];
            }
        }
        for (var k1 in params) {
            if (params.hasOwnProperty(k1)) {
                var v1 = params[k1];
                if (v1 > "") {
                    map[k1] = encoded ? params[k1] : encodeURIComponent(params[k1]);
                } else {
                    delete map[k1];
                }
            }
        }

        pairs = [];
        for (var k2 in map) {
            if (map.hasOwnProperty(k2)) {
                var v2 = map[k2];
                pairs.push(k2 + "=" + v2);
            }
        }

        query = pairs.join("&");
        pieces[1] = query;

        if(hashPairs.length > 1) {
            // Pop the base URL or Query string off the stack
            hashPairs.shift();

            return pieces.join("?") + "#" + hashPairs.join("#");
        } else {
            return pieces.join("?");
        }

    }
    return url;
 };

/**
 * Trims a string by removing newlines, spaces, and tabs from the beginning and end of the string.
 *
 * @param {String} value The string to be trimmed.
 * @returns {String}
 * @export
 */
Aura.Utils.Util.prototype.trim = function(value){
    return (value || "").replace(/^\s+|\s+$/g, '');
};

/**
 * Formats an arbitrary number of arguments into a string by replacing {0}, {1}, ... {n} with the corresponding argument supplied after 'formatString'.
 *
 * @param {String} formatString The string to be formatted.
 * @param {String} arg1...argN The list of arguments to splice into formatString.
 * @returns {String}
 * @export
 */
Aura.Utils.Util.prototype.format=function(formatString,arg1,arg2,argN){//eslint-disable-line no-unused-vars
    $A.assert($A.util.isString(formatString),"$A.util.format(): 'formatString' must be a String.");
    var formatArguments = Array.prototype.slice.call(arguments,1);
    return formatString.replace(/\{(\d+)\}/gm, function(match, index) {
        var substitution = formatArguments[index];
        if (substitution === undefined) {
            //#if {"modes" : ["PRODUCTION"]}
            match = '';
            //#end
            return match;
        }
        return substitution + '';
    });
};

/**
 * Truncates a string to the given length.
 *
 * @param {String} st The string to be truncated.
 * @param {Number} len The length of characters. Includes the ellipsis if ellipsis is set to true.
 * @param {Boolean} ellipsis If set to true, an ellipsis is added to the truncated string.
 * @param {Boolean} truncateByWord If set to true, checks that no truncation occurs in the middle of a word.
 * @returns {String} The truncated string.
 * @export
 */
Aura.Utils.Util.prototype.truncate = function(st, len, ellipsis, truncateByWord){
    ellipsis = !!ellipsis;
    truncateByWord = !!truncateByWord;

    if (!st || !len) {
        return "";
    }

    st=st.toString();

    if (len > 0 && st.length > len) {
        if (ellipsis) {
            len = (len - 3) < 1 ? 1 : len - 3;
        }

        if (truncateByWord === false) {
            return (this.trim(st.substring(0, len)) + (ellipsis ? '...' : ''));
        } else {
            /* Truncate the content of the string, then go back to the end of the
               previous word to ensure that we don't truncate in the middle of
               a word */
            st = st.substring(0, len + 1);
            var st2 = st.replace(/\w+$/, '');
            if ((st2.length === 0) || (st2.length > len)){
                st2 = st.substring(0, len);
            }

            return (this.trim(st2) + (ellipsis ? '...' : ''));
        }
    } else {
        return st;
    }
};

/**
 * Create a function that invokes the given callback after the tolerance period
 * has passed since the last invocation of the function.
 *
 * This is useful to defer responding to a stream of repetetive events until the
 * end of the stream.
 *
 * @param {Function} callback
 *          The function to be run once the tolerance period has passed.
 * @param {Number} toleranceMillis
 *          The tolerance duration in milliseconds.
 * @returns {Function} The function to invoke in order to trigger a start/reset
 *          of the tolerance period.
 * @export
 */
Aura.Utils.Util.prototype.createTimeoutCallback = function(callback, toleranceMillis) {
    $A.assert(!$A.util.isUndefinedOrNull(callback) && $A.util.isFunction(callback), "Invalid callback");
    $A.assert(toleranceMillis > 0, "Must use a positive tolerance period.");

    // The last time the returned function was invoked.
    var rtime = null;
    // True if a timeoutCallback invocation is scheduled.
    var timeout = false;

    /**
     * See if the tolerance period has passed and schedule another check or invoke the callback accordingly.
     */
    function timeoutCallback() {
        var currentDuration = new Date() - rtime;
        $A.assert(currentDuration >= 0);
        if (currentDuration < toleranceMillis) {
            // An invocation occurred after this timeout was scheduled. Recheck
            // when the period starting from the last invocation finishes.
            setTimeout(timeoutCallback, toleranceMillis - currentDuration);
        } else {
            // The tolerance period has completed without any invocations. Fire the user callback.
            timeout = false;
            rtime = null;
            callback();
        }
    }

    /**
     * The function to return starts/resets the tolernace period on every invocation.
     */
    return function() {
        // Update rtime for this invocation.
        rtime = new Date();

        // If we haven't already scheduled a timeout for this period, then set one.
        if (timeout === false) {
            timeout = true;
            setTimeout(timeoutCallback, toleranceMillis);
        }
    };
};

/**
 * Adds an event listener to a DOM element.
 *
 * @param {HTMLElement} element The DOM element to which to apply the listener.
 * @param {String} eventName The name of the DOM event, minus the "on" prefix (e.g. "click", "focus", "blur", etc.).
 * @param {Object} handler The JS handler to add.
 * @param {Boolean} useCapture Whether to use event capturing.
 * @param {Number} timeout Optional timeout (in milliseconds) that will delay the handler execution.
 * @returns {Object} Either a function (success) or null (fail)
 * @export
 */
Aura.Utils.Util.prototype.on = (function() {
    if (window["addEventListener"]) {
        return function(element, eventName, handler, useCapture, timeout) {
            var originalHandler = handler;

            if (timeout) {
                handler = this.createTimeoutCallback(handler, timeout);
            }

            if(element){
                originalHandler.registeredAuraHandler = handler;

                element["addEventListener"](eventName, handler, useCapture);
            }
        };
    } else {
        var preventDefault = function(){
            this.returnValue = false;
        };

        var stopPropagation = function(){
            this.cancelBubble = true;
        };

        return function(element, eventName, handler, useCapture, timeout) {
            if (!element){
                return;
            }

            var originalHandler = handler;

            // Eliminate registration of duplicate handlers on older browsers
            var handlerCache = element["handlerCache"];
            if (!handlerCache) {
                element["handlerCache"] = handlerCache = {};
            }

            var handlers = handlerCache[eventName];
            if (handlers) {
                for (var n = 0; n < handlers.length; n++) {
                    if (handlers[n] === handler) {
                        // Do not wire up duplicate handlers
                        return;
                    }
                }

                handlers.push(handler);
            } else {
                handlerCache[eventName] = [handler];
            }

            if (timeout) {
                handler = $A.util.createTimeoutCallback(handler, timeout);
            }

            // Correct the context of the events (this) pointer to the element its attached to.
            // Add standard interaction methods
            var newHandler = function (event) {
                event.currentTarget = element;
                event.target = event.srcElement;
                event.which = event.keyCode;
                event.preventDefault = preventDefault;
                event.stopPropagation = stopPropagation;
                handler.call(element, event || window.event);
                event.currentTarget = event.target = event.which = event.preventDefault = event.stopPropagation = null;
            };

            originalHandler.registeredAuraHandler = newHandler;

            element["attachEvent"]('on' + eventName, newHandler, false);
        };
    }
})();

/**
 * Removes an event listener from a DOM element. See also Util.on() a.k.a. $A.util.on()
 *
 * @param {HTMLElement} element The DOM element from which to remove the listener.
 * @param {String} eventName The name of the DOM event, minus the "on" prefix (e.g. "click", "focus", "blur", etc.).
 * @param {Function} listener The JS listener function to remove.
 * @param {Boolean} useCapture Whether to use event capturing.
 * @export
 */
Aura.Utils.Util.prototype.removeOn = function(element, eventName, listener, useCapture) {
    $A.assert(element, "try to remove an event listener from a no-longer-exist DOM element");

    if (this.isUndefined(listener)) {
        return;
    }

    if (listener.registeredAuraHandler) {
        listener = listener.registeredAuraHandler;
    }

    if (window["removeEventListener"]) {
        element.removeEventListener(eventName, listener, useCapture);
    } else if (window["detachEvent"]) {
        element.detachEvent("on" + eventName, listener);
    } else {
        $A.assert(false, "user agent must support either removeEventListener or detachEvent to remove an event handler.");
    }
};

/**
 * Stores the values of a form to a Map object. Values from a checkbox, radio, drop-down list, and textarea
 * are stored in the Map.
 *
 * @param {Object} form
 * @returns {Object} The map containing the values from the form input.
 * @export
 */
Aura.Utils.Util.prototype.formToMap = function(form) {
    var map = {};

    for (var i=0; i<form.length; i++) {
        var element = form[i];
        var name = element.name;
        var value = null;

        if(name){
            if (element.tagName === "INPUT") {

                var type = element.type;
                if(type === "button" || type === "submit"){
                    //do nothing;
                }else if(type === "checkbox") {
                    if(element.checked){
                        value = element.value;
                    }
                }else if(type === "radio") {
                    if(element.checked && element.value && element.value !== ""){
                        value = element.value;
                    }
                }else{
                    value = element.value;
                }
            } else if (element.tagName === "SELECT") {
                value = this.getSelectValue(element);
            } else if (element.tagName === "TEXTAREA") {
                value = element.value;
            }
            if(value !== null && value !== undefined){
                this.addValueToMap(map, name, value);
            }
        }
    }
    return map;
};

/**
 * Gets the selected values from a list of options.
 * Returns a single value if only a single option is selected.
 *
 * @param {Object} select
 * @returns {Object} A list of selected options.
 * @export
 */
Aura.Utils.Util.prototype.getSelectValue = function(select) {

    if (select.options.length === 0) {
        return null;
    }
    if (!select.multiple) {
        return select.options[select.selectedIndex].value;
    }
    else {
        var list = [];
        var options = select.options;
        for (var i=0; i<options.length; i++) {
            var option = options[i];
            if (option.selected) {
                list[list.length] = option.value;
            }
        }
        return list;
    }
};

/**
 * Adds a value to a map with a given key.  If the key already exists, the values are turned into a list.
 * If the value has a dot in it - e.g. "properties.4" - it will be turned into an inner map, with
 * the second part as the inner key.
 *
 * @param {Object} inputMap The input map to be processed.
 * @param {String} key The data key whose value is to be added to the input map.
 * @param {Object} value The value of the data to add to the input map.
 * @export
 */
Aura.Utils.Util.prototype.addValueToMap = function(inputMap, key, value) {
    if (key.indexOf(".") > 0) {
        var inputName = key.substring(0, key.indexOf("."));
        var subMapKey = key.substring(key.indexOf(".") + 1, key.length);
        this.addMapValueToMap(inputMap, inputName, value, subMapKey);
        return;
    }
    else {
        var ix = key.indexOf("00N");
        if(ix === 0 || ix === 2) { // CF00N
            this.addMapValueToMap(inputMap, "properties", value, key);
            return;
        }
    }
    var oldVal = inputMap[key];
    if(!oldVal){
        inputMap[key] = value;
    }else if (!this.isArray(oldVal)){
        var valArray = [];
        valArray[0] = oldVal;
        valArray[1] = value;
        inputMap[key] = valArray;
    }else{
        oldVal.push(value);
    }
};

/**
 * Generates a map of values inside the main input map.  This is used, for example,
 * When input fields have a "." operator, so
 * input name="def.def1"
 * input name="def.def2"
 * get put in the input map under "def", as a map with "def1" and "def2" mapped to their values.
 *
 * @param {Object} inputMap The input map to be processed.
 * @param {String} key The data key whose value is to be added to the input map.
 * @param {Object} value The value of the data to add to the input map.
 * @param {String} subMapKey
 * @export
 */
Aura.Utils.Util.prototype.addMapValueToMap = function(inputMap, key, value, subMapKey) {
    var subMap = inputMap[key];
    if (!subMap) {
        subMap = {};
        inputMap[key] = subMap;
    }
    subMap[subMapKey] = value;
};

/**
 * Walks up a definition hierarchy to search for a sub definition by qualified name.
 *
 * @param {Object} def
 *          The definition to search
 * @param {String} qname
 *          The qualified name to search for
 * @returns {Boolean} true if qualified name is found in defs hierarchy
 * @export
 */
Aura.Utils.Util.prototype.isSubDef = function(def, qname) {
    while (def) {
        if (def.getDescriptor().getQualifiedName() === qname) {
            return true;
        }

        // Now walk the hierarchy
        def = def.getSuperDef();
    }

    return false;
};

/**
 *
 * @description Takes the methods, and properties from one object and assigns them to another.
 * Returns the base object with the members from the child object.
 * This is commonly used to apply a set of configurations to a default set, to get a single set of configuration properties.
 *
 * @example
 * $A.util.apply(Child.prototype, Parent); // Returns a new object inheriting all the methods and properties from Parent.
 *
 * @example
 * $A.util.apply(Child.prototype, { isCool: true }); // Parent would then have a property of child.
 *
 * @example
 * $A.util.apply({ foo: 'bar', diameter: 10}, { diameter: 20, bat: 'man' }, true); //== {foo:'bar', diameter: 20, bat: 'man'}
 *
 * @example
 * $A.util.apply({ foo: 'bar', diameter: 10}, { diameter: 20, bat: 'man' }, false); //== {foo:'bar', diameter: 10, bat: 'man'}
 *
 * @param {Object|Function} baseObject The object that will receive the methods, and properties.
 * @param {Object|Function} members The methods and properties to assign to the baseObject.
 * @param {Boolean} [forceCopy] If the property already exists, should we still copy the member? false by default
 * @param {Boolean} [deepCopy] Should we continue to navigate child objects if we don't overwrite them? false by default
 */
Aura.Utils.Util.prototype.apply = function(/* Object|Function */ baseObject, /* Object|Function*/ members, /* bool */ forceCopy, /* bool */ deepCopy) {
    if(members) {
        var value=null;
        for (var property in members) {
            var setValue=forceCopy||!baseObject.hasOwnProperty(property);
            if(setValue||deepCopy){
                value=members[property];
                if(deepCopy&&value!=undefined) {//eslint-disable-line eqeqeq
                    var branchValue = null;
                    if (this.isArray(value)) {
                        branchValue = baseObject[property] || [];
                    } else if (this.isPlainObject(value)) {
                        branchValue = baseObject[property] || {};
                    }
                    if (branchValue) {
                        baseObject[property] = this.apply(branchValue, value, forceCopy, deepCopy);
                        continue;
                    }
                }
                if(setValue) {
                    baseObject[property] = value;
                }
            }
        }
    }
    return baseObject;
};

/**
 * apply() has a bug that it copies values from the prototype.
 * This was found in late 210 a week before FF. Thats to late for a change to apply(), so Kris Gray created
 * this method which does the right thing.
 *
 * We'll fix the bug by using this new method, and in 212, we'll switch apply() to behave like this method.
 * The API and functionality is the same except that it does not copy values from the prototype.
 * Please DO NOT EXPORT THIS METHOD. That makes it much harder to replace in 212.
 */
Aura.Utils.Util.prototype.applyNotFromPrototype = function(/* Object|Function */ baseObject, /* Object|Function*/ members, /* bool */ forceCopy, /* bool */ deepCopy) {
    if(members) {
        var value=null;
        for (var property in members) {
            if(!members.hasOwnProperty(property)) {continue;}
            var setValue=forceCopy||!baseObject.hasOwnProperty(property);
            if(setValue||deepCopy){
                value=members[property];
                if(deepCopy&&value!=undefined) {//eslint-disable-line eqeqeq
                    var branchValue = null;
                    if (this.isArray(value)) {
                        branchValue = baseObject[property] || [];
                    } else if (this.isPlainObject(value)) {
                        branchValue = baseObject[property] || {};
                    }
                    if (branchValue) {
                        baseObject[property] = this.applyNotFromPrototype(branchValue, value, forceCopy, deepCopy);
                        continue;
                    }
                }
                if(setValue) {
                    baseObject[property] = value;
                }
            }
        }
    }
    return baseObject;
};


Aura.Utils.Util.prototype.CAMEL_CASE_TO_HYPHENS_REGEX = /([A-Z])/g;

/**
 * Converts camelCase to hyphens.
 *
 * @param {String} str The string to be converted.
 * @returns {String} The string containing hyphens that replaces the camelCase.
 */
Aura.Utils.Util.prototype.camelCaseToHyphens = function(str) {
    return str.replace(this.CAMEL_CASE_TO_HYPHENS_REGEX, "-$1").toLowerCase();
};

/**
 * Converts hyphens to camelCase.
 *
 * @param {String} str The string to be converted.
 * @returns {String} The string in camelCase.
 */
Aura.Utils.Util.prototype.hyphensToCamelCase = function(str) {
    function hyphensToCamelCaseHelper(s, group) {
        return group.toUpperCase();
    }

    return str.replace(/-([a-z])/gi, hyphensToCamelCaseHelper);
};

/**
*  Converts words to camelCase, strips non-alphanumeric characters
*
* */
Aura.Utils.Util.prototype.toCamelCase=function(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+|[^\w]+)/g, function (match, index) {
        if (/\s+|[^\w]+/.test(match)){
            return "";
        }
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
};

/**
 *
 * @description A map of nodeNames that cannot accept custom data attributes.
 * @private
 */
Aura.Utils.Util.prototype.noData = {
    "embed": true,
    "object": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000", // flash
    "applet": true,
    "#text": true
};

/**
 *
 * @description Returns whether a given DOM element can accept custom data attributes.
 *
 * @param {HTMLElement} element The element to check for custom data attribute support.
 * @returns {Boolean} Whether element accepts custom data attributes.
 */
Aura.Utils.Util.prototype.acceptsData = function(element) {
    if (!this.isHTMLElement(element)) {
        return false;
    }

    if (element.nodeName) {
        var match = this.noData[ element.nodeName.toLowerCase() ];

        if (match) {
            return !(match === true || element.getAttribute("classid") !== match);
        }
    }
    return true;
};

/**
 * Return attributeValue of an element
 *
 * @param {HTMLElement} element The element from which to retrieve data.
 * @param {String} attributeName The name of attribute to look up on element.
 * @export
 */
Aura.Utils.Util.prototype.getElementAttributeValue = function(element,attributeName){
    var attrValue = element.getAttribute(attributeName);
    //For browser Compatibility - getAttribute doesn't always work in IE
    if($A.util.isUndefinedOrNull(attrValue)){
        //Gets list of attributes as they are written on the Element. The return value of this is going to be undefined
        attrValue = element.attributes[attributeName];

        //If the element does exist, then get its nodeValue.
        //If it doesn't exist, we will return null per Mozzilla Standards and how the getAttribute method works normally
        if(!$A.util.isUndefinedOrNull(attrValue)){
            attrValue = attrValue.nodeValue;
        } else if(!$A.util.isUndefinedOrNull(element[attributeName])) {
            attrValue = element[attributeName];
        } else{
            attrValue = null;
        }
    }
    return attrValue;
};

/**
* @description Attempts to set focus on 'target'.
* @param {HTMLElement|Component} target The DOM element or Component to which to send focus.
* @export
*/
Aura.Utils.Util.prototype.setFocus=function(target){
    if(this.isComponent(target)){
        if(!target.focus){
            target=target.getElement();
        }
    }
    if(target&&target.focus){
        try{
            target.focus();
        }catch(e){
            // Fail quietly
        }
    }
};

/**
 *
 * @description Returns a custom data attribute value from a DOM element.
 * For more information on custom data attributes, see http://html5doctor.com/html5-custom-data-attributes/
 * @param {HTMLElement} element The element from which to retrieve data.
 * @param {String} key The data key to look up on element.
 * @export
 */
Aura.Utils.Util.prototype.getDataAttribute = function(element, key) {
    if (!this.acceptsData(element) || this.isUndefined(key)) {
        return null;
    }

    key = this.getDataAttributeName(key);
    return element.getAttribute(key);
};

/**
 *
 * @description Sets a custom data attribute value from a DOM element.
 * For more information on custom data attributes, see http://html5doctor.com/html5-custom-data-attributes/
 * @param {HTMLElement} element The element from which to retrieve data.
 * @param {String} key The data key to add to element.
 * @param {String} value The value of the data to add to an element. If value is undefined, the key data attribute will be removed from element.
 * @export
 */
Aura.Utils.Util.prototype.setDataAttribute = function(element, key, value) {
    if (!this.acceptsData(element) || this.isUndefined(key)) {
        return null;
    }

    key = this.getDataAttributeName(key);

    if (!this.isUndefined(value)) {
        return element.setAttribute(key, value);
    }
    return element.removeAttribute(key);

};

/**
 * @private
 */
Aura.Utils.Util.prototype.getDataAttributeName = function(key) {
    var name = this.dataAttributeCache[key];
    if (!name) {
        name = "data-" + this.camelCaseToHyphens(key);
        this.dataAttributeCache[key] = name;
    }

    return name;
};

/**
 * Checks whether a custom data attribute value already exists.
 * @param {HTMLElement} element The element from which to retrieve data.
 * @param {String} key The data key to look up on element.
 * @returns {Boolean} true if element has data attribute
* @export
 */
Aura.Utils.Util.prototype.hasDataAttribute = function(element, key) {
    return !this.isUndefinedOrNull(this.getDataAttribute(element, key));
};

/**
 * Checks if the object is an HTML element.
 * @param {Object} obj
 * @returns {Boolean} True if the object is an HTMLElement object, or false otherwise.
 */
Aura.Utils.Util.prototype.isHTMLElement = function(obj) {
    if (typeof HTMLElement === "object") {
        return obj instanceof HTMLElement;
    } else {
        return obj && obj.nodeType === 1 && typeof obj.nodeName === "string";
    }
};

/**
 * Checks if the object is a SVG element.
 * @param {Object} obj
 * @returns {Boolean} True if the object is an SVGElement object, or false otherwise.
 */
Aura.Utils.Util.prototype.isSVGElement = function(obj) {
    if(obj.correspondingUseElement) {
        return obj.correspondingUseElement instanceof SVGElement || obj instanceof SVGElement;
    }
    return obj instanceof SVGElement;
};

/**
 * Attach the element to the HTML body
 * @param {DOMElement} element
 * @export
 */
Aura.Utils.Util.prototype.attachToDocumentBody = function(element) {
    if (element) {
        var body = document.getElementsByTagName("body")[0];
        body.appendChild(element);
    }
};
/**
* Check for substrings at the end.
* @param {String} fullstr The string to check against.
* @param {String} substr The substring to look for at the end.
* @returns {Boolean} True if fullstr ends with substr.
* @export
*/
Aura.Utils.Util.prototype.stringEndsWith = function(fullstr, substr) {
    var lastIndex = fullstr.lastIndexOf(substr);
    return (lastIndex !== -1) && (lastIndex + substr.length === fullstr.length);
};

/**
 * Creates a new function whith bound arguments.
 * @param {Function} method to bind.
 * @param {Any} bound 'this' instance for the new function's scope.
 * @param {Any} var-args of bound parameters.
 * @returns {Function} a new function that invokes the provided function instance with bound arguments.
 */
if (Function.prototype.bind) {
    Aura.Utils.Util.bind = function(method /*, this, bind arguments*/) {
        var args = Array.prototype.slice.call(arguments, 1);
        return Function.prototype.bind.apply(method, args);
    };
} else {
    Aura.Utils.Util.bind = function(method /*, this, bind arguments*/) {
        var args = Array.prototype.slice.call(arguments, 1),
            that = args.shift(),
            util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isFunction(method)) {
            throw new TypeError("$A.util.bind called on non-function.");
        }

        if (arguments.length === 1) {
            return method;
        }

        return function(/*remaining arguments*/) {
            var remainingArgs = Array.prototype.slice.call(arguments);
            var combined = util.merge([], args, remainingArgs);
            return method.apply(that, combined);
        };
    };
}

/** @export */
Aura.Utils.Util.prototype.bind = Aura.Utils.Util.bind;

/**
 * Performs a series of 'safe' sequential lookup of nested properies.
 *
 * Example: a safe lookup for "VALUE" in: object: {
 *    first: {
 *       second: [
 *           "VALUE"
 *       ]
 *    }
 * }
 *
 * Can be done via: $A.util.lookup(object, "first", "second", 0);
 * Instead of: object && object.first && object.first.second && object.first.second[0]
 *
 * @param {Object} root object or array to sequentially lookup properties from.
 * @param {String} var-args of string property names.
 * @return {Any} the looked-up property or undefined if any properties along the way were not found.
 * @export
 */
Aura.Utils.Util.prototype.lookup = function(object /*, var-args of arrays*/) {
    var properties = Array.prototype.slice.call(arguments, 1),
        util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

    return util.reduce(properties, function(current, property) {
        return current && current[property];
    }, object);
};


/**
 * Does an in-place merge of any number of array into the first.
 * @param {Array} array to receive the elements of subsequent arrays.
 * @param {Array} var-args of arrays that will have their elements copied into the first.
 * @returns {Array} the first array (which has been modified in-place).
 * @export
 */
Aura.Utils.Util.prototype.merge = function(first /*, var-args of arrays*/) {
    var arrays = Array.prototype.slice.call(arguments, 1),
        util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

    if (!arrays) {
        return first;
    }

    if (!util.isArray(first)) {
        throw "Merge takes only arrays as arguments.";
    }

    util.forEach(arrays, function(array) {
        if (!util.isArray(array)) {
            throw "Merge takes only arrays as arguments.";
        }
    });

    util.forEach(arrays, function(array) {
        util.forEach(array, function(element) {
            first.push(element);
        });
    });

    return first;
};

/** forEach: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.forEach) {
    Aura.Utils.Util.forEach = function(array, method, that) {
        array.forEach(method, that);
    };
} else {
    /**
     * Runs a function over each element in an array.
     * @param {Array} array to loop over.
     * @param {Function} method to call for each element.
     * @param {Any} the 'this' instance inside the scope of provided method.
     */
    Aura.Utils.Util.forEach = function(array, method, that) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.forEach called on non-array.");
        }

        if (!util.isFunction(method)) {
            throw new TypeError("$A.util.forEach called with non-function callback.");
        }

        var index;
        for (index = 0; index < array.length; index++) {
            method.call(that, array[index], index);
        }
    };
}

/** @export */
Aura.Utils.Util.prototype.forEach = Aura.Utils.Util.forEach;

/** map: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.map) {
    Aura.Utils.Util.map = function(array, method, that) {
        return array.map(method, that);
    };
} else {
    /**
     * Returns an array containing the return value of the provided function over every element of the input array.
     * @param {Array} array to loop over.
     * @param {Function} tranforms an element from the input array to an element in the output array.
     * @param {Any} the 'this' instance inside the scope of provided transformation method.
     * @returns {Array} where every element is a result of the transformation function
     * applied to the element (at the same index) from the input array.
     */
    Aura.Utils.Util.map = function(array, method, that) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.map called on non-array.");
        }

        if (!util.isFunction(method)) {
            throw new TypeError("$A.util.map called with non-function callback.");
        }

        var index, result = [];
        for (index = 0; index < array.length; index++) {
            result.push(method.call(that, array[index], index));
        }
        return result;
    };
}
/** @export */
Aura.Utils.Util.prototype.map = Aura.Utils.Util.map;

/** reduce: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.reduce) {
    Aura.Utils.Util.reduce = function(array, method, initial) {
        return array.reduce(method, initial);
    };
} else {
    /**
     * Loops over an array, calling a function that provides the returned result of calling the function on the
     * previous element.
     * @param {Array} array to loop over.
     * @param {Function} reduction method that takes the resturned result from the previous call, the current element from
     * the input array and index.
     * @param {Any} the initial object passed to the first element in the array's reduction method.
     * @returns {Any} the final value returned from calling the reduction method on the last element.
     */
    Aura.Utils.Util.reduce = function(array, method, initial) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.reduce called on non-array.");
        }

        if (!util.isFunction(method)) {
            throw new TypeError("$A.util.reduce called with non-function callback.");
        }

        var index, result = initial;
        for (index = 0; index < array.length; index++) {
            result = method.call(this, result, array[index], index);
        }
        return result;
    };
}

/** @export */
Aura.Utils.Util.prototype.reduce = Aura.Utils.Util.reduce;

/** every: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.every) {
    Aura.Utils.Util.every = function(array, predicate, that) {
        return array.every(predicate, that);
    };
} else {
    /**
     * Loops over an array, calling a function that returns some boolean. Returns true if all calls return a truthy result.
     * @param {Array} array to loop over.
     * @param {Function} predicate that returns a boolean result based on the current array element.
     * @param {Any} the 'this' instance inside the scope of provided transformation method.
     * @returns {Boolean} true if all elements of the array satisfy the predicate.
     */
    Aura.Utils.Util.every = function(array, predicate, that) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.every called on non-array.");
        }

        if (!util.isFunction(predicate)) {
            throw new TypeError("$A.util.every called with non-function predicate.");
        }

        var index;
        for (index = 0; index < array.length; index++) {
            if(!predicate.call(that, array[index], index)) {
                return false;
            }
        }
        return true;
    };
}

/** @export */
Aura.Utils.Util.prototype.every = Aura.Utils.Util.every;

/** some: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.some) {
    Aura.Utils.Util.some = function(array, predicate, that) {
        return array.some(predicate, that);
    };
} else {
    /**
     * Loops over an array, calling a function that returns some boolean. Returns true if any calls return a truthy result.
     * @param {Array} array to loop over.
     * @param {Function} predicate that returns a boolean result based on the current array element.
     * @param {Any} the 'this' instance inside the scope of provided transformation method.
     * @returns {Boolean} true if any of the elements of the array satisfy the predicate.
     */
    Aura.Utils.Util.some = function(array, predicate, that) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.some called on non-array.");
        }

        if (!util.isFunction(predicate)) {
            throw new TypeError("$A.util.some called with non-function predicate.");
        }

        var index;
        for (index = 0; index < array.length; index++) {
            if(predicate.call(that, array[index], index)) {
                return true;
            }
        }
        return false;
    };
}

/** @export */
Aura.Utils.Util.prototype.some = Aura.Utils.Util.some;

/** filter: see documentation below (attached to last definition so that it is picked up for doc generation). */
if (Array.prototype.filter) {
    Aura.Utils.Util.filter = function(array, predicate, that) {
        return array.filter(predicate, that);
    };
} else {
    /**
     * Loops over an array, constructing a new array with the elements that pass the filter predicate.
     * @param {Function} predicate that returns a boolean result based on the current array element the result of which
     *                   indicates whether the element will be returned in the filter result array.
     * @param {Any} the 'this' instance inside the scope of provided predicate.
     * @returns {Array} ordered array of elements that pass the predicate.
     */
    Aura.Utils.Util.filter = function(array, predicate, that) {
        var util = this instanceof Aura.Utils.Util ? this : new Aura.Utils.Util();

        if (!util.isArray(array)) {
            throw new TypeError("$A.util.filter called on non-array.");
        }

        if (!util.isFunction(predicate)) {
            throw new TypeError("$A.util.filter called with non-function predicate.");
        }

        var index, result = [];
        for (index = 0; index < array.length; index++) {
            if(predicate.call(that, array[index], index)) {
                result.push(array[index]);
            }
        }
        return result;
    };
}

/** @export */
Aura.Utils.Util.prototype.filter = Aura.Utils.Util.filter;

/**
 * Schedules the specified component to be asynchronously destroyed.
 * @param {Component} cmp
 *          The component to be destroyed.
 * @private
 */
Aura.Utils.Util.prototype.destroyAsync = function(cmp) {
    if (this.componentGCProcessing) {
        // We're in the middle of emptying the component trash and something just async to destroy another
        // component async so finish the destroy now
        if (cmp && cmp.finishDestroy) {
            cmp.finishDestroy();
        }
    } else {
        this.trashedComponentQueue.push(cmp);

        if (!this.componentGCPending) {
            this.componentGCPending = true;

            // Async when not testing to not confuse component stats verification tests
            var that = this;
            setTimeout(function() {
                try {
                   that.componentGCProcessing = true;

                    that.emptyComponentTrash();
                } finally {
                    that.componentGCProcessing = false;
                }
            }, 3000);
        }
    }
};

/**
 * Returns whether "instance" is, directly or indirectly, an instance of
 * "constructor."  An object is indirectly an instance if derivePrototypeFrom was
 * used to make the child type derive from the parent type.
 *
 * JavaScript's instanceof operator is not used as it doesn't understand
 * type inheritance. Using this method would avoid the need for child.prototype to be
 * an instance of parent; we also avoid having "unbound" instances.
 *
 * @param instance The object to test
 * @param constructor  The object to test against
 * @returns {Boolean} Returns true if instance is an instance of constructor.
 * @export
 */
Aura.Utils.Util.prototype.instanceOf = function(instance, constructor) {
    if (instance === null || instance === undefined || constructor === null || constructor === undefined) {
        return false;
    }
    if (instance instanceof constructor) {
        return true;
    }
    if (instance.superclass) {
        var superCtor = instance.superclass.constructor;
        while (superCtor) {
            if (superCtor === constructor) {
                return true;
            }
            superCtor = superCtor.superclass ? superCtor.constructor : undefined;
        }
    }
    return false;
};

/**
 * Destroys any components currently in the trashcan.
 * @private
 */
Aura.Utils.Util.prototype.emptyComponentTrash = function() {
    var length = this.trashedComponentQueue.length;
    if (length > 0) {
        for (var i = 0; i < length; i++){
            var cmp = this.trashedComponentQueue[i];
            if (cmp && cmp.finishDestroy) {
                cmp.finishDestroy();
            }
        }

        this.trashedComponentQueue = [];
    }

    this.componentGCPending = false;
};

/**
 * Determines if an element is either a descendant of, or the same as, another element in the DOM tree.
 * Both arguments to this function must be of type HTMLElement or SVGElement.
 *
 * @param {(HTMLElement|SVGElement)} container The element you think is the outermost container.
 * @param {(HTMLElement|SVGElement)} element The element you think is buried inside the container.
 * @returns {Boolean} Returns true if 'element' is indeed inside 'container', false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.contains = function(container, element) {
    $A.assert($A.util.isHTMLElement(container) || $A.util.isSVGElement(container),
            "$A.util.conatins(): 'container' must be HTMLElement or SVGElement: " + container);
    $A.assert($A.util.isHTMLElement(element) || $A.util.isSVGElement(element),
            "$A.util.conatins(): 'element' must be HTMLElement or SVGElement: " + element);

    while(element) {
        if (element === container) {
            return true;
        }
        if (element.nodeType === 11) { // Check if we have a shadow root (same node type as document fragment)
            // if we have a shadow root, use host instead of parentNode
            element = element.host;
        } else {
            element = element.parentNode;
        }
    }

    return false;
};


/**
 * Simple event squasher.
 *
 * @param {UIEvent} event the DOM event to squash
 * @param {Boolean} preventDefault if preventDefault() should also be called
 * @export
 */
Aura.Utils.Util.prototype.squash = function(event, preventDefault) {
    event = event || window.event;
    if(event.stopPropagation) {
        event.stopPropagation();
    }
    event.cancelBubble = true;

    if (preventDefault) {
        if(event.preventDefault) {
            event.preventDefault();
        }
        event.returnValue = false;
    }
};

/**
 * Strip off html tags from html codes.
 *
 * @param {String} input the input html codes
 * @param {Array} tags the html tag names to be removed
 * @return {String} an output string without those specified tags
 * @export
 */
Aura.Utils.Util.prototype.stripTags = function(input, tags) {
    if (this.isUndefinedOrNull(input) || this.isEmpty(input)) {
        return "";
    }
    var div = document.createElement('div');
    div.innerHTML = input;
    if (!this.isArray(tags)) {
        tags = [tags];
    }
    for (var j = 0; j < tags.length; j++) {
        var elems = div.getElementsByTagName(tags[j]);
        var i = elems.length;
        while (i--) {
            elems[i].parentNode.removeChild(elems[i]);
        }
    }
    var result = div.innerHTML;
    this.removeElement(div);
    return result;
};


/**
 * Simple function to get client viewport dimensions. If neither window.innerWidth
 * nor document.body.clientWidth is supported by the client, returns "0" for
 * both width and height.
 *
 * @return {Object} JS object with the fields "width" and "height"
 * @export
 */
Aura.Utils.Util.prototype.getWindowSize = function() {
    return {
        width : window.innerWidth || document.body.clientWidth || 0,
        height : window.innerHeight || document.body.clientHeight || 0
    };
};

/**
 * Checks if the object is an Aura component.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is a component, or return false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isComponent = function(obj) {
    return obj instanceof Component;
};

/**
 * Checks if the object is an Aura value expression.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is an expression, or false otherwise.
 * @export
 */
Aura.Utils.Util.prototype.isExpression = function (obj) {
    return obj instanceof PropertyReferenceValue || obj instanceof FunctionCallValue;
};

/**
 * Checks if the object is an Aura value object.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is an Aura value (PropertyReferenceValue, FunctionCallValue, PassthroughValue).
 * @export
 */
Aura.Utils.Util.prototype.isValue = function(obj) {
    return obj instanceof PropertyReferenceValue || obj instanceof FunctionCallValue ||
        obj instanceof PassthroughValue;
};

/**
 * Checks if the object is an Aura action object.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is an Aura Action.
 * @export
 */
Aura.Utils.Util.prototype.isAction = function(obj) {
    return obj instanceof Action;
};

/**
 * Checks if the object is an Aura Event object.
 *
 * @param {Object} obj The object to check for.
 * @returns {Boolean} True if the object type is an Aura Event.
 * @export
 */
Aura.Utils.Util.prototype.isEvent = function(obj) {
    return obj instanceof Aura.Event.Event;
};

/**
 * Checks if touch events are supported. Cache the result, it shouldn't change.
 *
 * @returns {Boolean} True if touch events are supported.
 * @export
*/
Aura.Utils.Util.prototype.supportsTouchEvents = function() {

    /*
    * NOTE:
    * There is no perfect way to detect wether the browser supports touch events or not.
    * Nice summary here: http://www.stucox.com/blog/you-cant-detect-a-touchscreen
    * But we can get close to it for our use cases making some assumptions.
    */

    if ($A.util.isUndefined(this.supportsTouchEvents.cache)) {
        this.supportsTouchEvents.cache = (

            // If we are on some sort of NON-DESKTOP device, we check wether it supports 'ontouchstart'
            // We do this because Chrome, IE and firefox will give false positives when checking this properties
            (($A.get('$Browser.formFactor') !== 'DESKTOP' || $A.get('$Browser.isIOS') || $A.get('$Browser.isAndroid')) && 'ontouchstart' in window)

            // IE  will also give false positives, so we make sure that only enable pointer events when is a windowsPhone
            || ($A.get('$Browser.isWindowsPhone') && (window["navigator"]["pointerEnabled"] ||  window["navigator"]["msPointerEnabled"]))
            // According to the browser support matrix (http://sfdc.co/cnHk6M), Touch-enabled laptops, such as Surface Pro 3 are ONLY supported via keyboard+mouse
            || ($A.get('$Browser.formFactor') !== 'DESKTOP' && (window["navigator"]["msMaxTouchPoints"] > 0 || window["navigator"]["maxTouchPoints"] > 0)))

            // Aura internal testing
            && ($A.getContext().getMode() !== 'PTEST')
            && ($A.getContext().getMode() !== 'CADENCE')
            && ($A.getContext().getMode() !== 'SELENIUM')
            && ($A.getContext().getMode() !== 'STATS')
            && ($A.getContext().getMode() !== 'SELENIUMDEBUG');
    }
    return this.supportsTouchEvents.cache;
};

/**
 * Estimate the size of an object or primitive in bytes.
 *
 * @param {Object} item The object or primitive whose size to estimate.
 * @return {Number} The estimated size of the item in bytes.
 * @export
 */
Aura.Utils.Util.prototype.estimateSize = function(obj) {
    return this.sizeEstimator.estimateSize(obj);
};


/**
 * Convert collection to a true array.
 * When dealing with a NodeList, sometimes you'll need it to actually be an array to properly deal with it.
 * Cannot always use Array.prototype.slice.call(), since it doesn't work in IE6/7/8 on NodeLists.
 * @returns An empty array if you pass a null or undefined value to collection.
 */
Aura.Utils.Util.prototype.toArray = function(collection) {
    if(this.isUndefinedOrNull(collection)) {
        return [];
    }

    try {
        // Done in a Try/Catch as calling this on a NodeList in IE6/7/8 throws an exception
        return Array.prototype.slice.call(collection);
    } catch(e) {
        // Try to just convert the collection to a normal array using a good ole for loop.
        var length = collection.length;
        var newCollection = new Array(length);
        for(var c=0;c<length;c++){
            newCollection[c] = collection[c];
        }
        return newCollection;
    }
};

/** @export */
Aura.Utils.Util.prototype.setText = function(node, text) {
    if (node.textContent !== undefined) {
        //IE9 or up, and all other browsers
        node.textContent = text;
    } else if (node.innerText !== undefined) {
        //IE8 or down, note: FF doesn't have this
        node.innerText = text;
    }
};

/**
 * Posts message to the provided window. This was done to workaround an issue where browser sets
 * event.source to be safeEvalWorker window (see W-3443540).
 * NOTE: safeEvalWorker has been removed.
 * @param {Window} targetWindow The destination window for the message
 * @param {Array} argsArray list of arguments to be posted
 * @export
 */
Aura.Utils.Util.prototype.postMessage = function(targetWindow, argsArray){
    if(targetWindow && targetWindow["postMessage"]){
        targetWindow["postMessage"].apply(targetWindow, argsArray);
    }
};

/**
 * Get a string representation of component hierarchy by calling getOwner and walk up the component tree.
 * @param {component} leaf component to walk up the hierarchy
 * @private
 */
Aura.Utils.Util.prototype.getComponentHierarchy = function(component){
    if (this.isUndefinedOrNull(component)) {
        return '';
    }
    var ret = ['['+component.getType()+']'];
    var owner = component.getOwner();

    while (!this.isUndefinedOrNull(owner) && owner !== owner.getOwner()) {
        ret.push('['+owner.getType()+']');
        owner = owner.getOwner();
    }
    if (!this.isUndefinedOrNull(owner)) {
        ret.push('['+owner.getType()+']');
    }
    return ret.reverse().join('>');
};

/**
 * eval throwing an error to check whether sourceURL is supported.
 * @private
 */
Aura.Utils.Util.prototype.hasSourceURL = function() {
    if (this.sourceURLsupported === undefined) {
        try {
            this.globalEval('(undefined).x', "testSourceURL.js");
        } catch(e) {
            this.sourceURLsupported = e.stack.indexOf("testSourceURL.js") > -1;
        }
    }

    return this.sourceURLsupported;
};

/**
 * Returns a hash for a passed in string.
 * Replicates Java's hashCode method (https://docs.oracle.com/javase/7/docs/api/java/lang/String.html#hashCode()).
 * @param {String} a string to be hashed.
 * @returns {Number} a hashed representation of the passed in string.
 * @private
 */
Aura.Utils.Util.prototype.getHashCode = function(value) {
    var hash = 0;
    if (!value || !value.length) {
        return hash;
    }
    for (var i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash = hash & hash;
    }
    return hash;
};

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    /**
     * Gets the aura debug tool component whether in an iframe or not.
     * @returns {Object} The debug tool component.
     * @export
     */
    Aura.Utils.Util.prototype.getDebugToolComponent = function(){
        if (!this.isUndefinedOrNull(this.debugToolWindow)) {
            var debugElem = this.debugToolWindow.document.getElementById('__aura_debug_tool');
            if (!this.isUndefinedOrNull(debugElem)) {
                return this.debugToolWindow["aura"].componentService.getAttributeProviderForElement(debugElem);
            }
        }
    };

    /**
     * Gets the aura instance of debug tool which has been opened in a child window
     *
     * @returns {Object} Aura instance
     * @export
     */
    Aura.Utils.Util.prototype.getDebugToolsAuraInstance = function(){
        if (!this.isUndefinedOrNull(this.debugToolWindow)) {
            return this.debugToolWindow["aura"];
        } else {
            return $A;
        }
    };

    /**
     * Set the aura debug tool handle when opened in a popup.
     * @export
     */
    Aura.Utils.Util.prototype.setDebugToolWindow = function(debugWindow){
        if (!this.isUndefinedOrNull(debugWindow)) {
            this.debugToolWindow = debugWindow;
        }
    };

    /**
     * Grab windows url, if debug tool is a child window get url of parent
     *
     * @returns {String} URL of the window
     * @export
     */
    Aura.Utils.Util.prototype.getUrl = function(){
        if (this.isUndefinedOrNull(opener)) {
            return window.location.href;
        } else {
            return opener.location.href;
        }
    };

    /**
     * Get the text content of a DOM node. Tries <code>textContent</code> followed by
     * <code>innerText</code>, followed by <code>nodeValue</code> to take browser differences into account.
     * @param {Node} node The node to get the text content from
     * @returns {String} The text content of the DOM node or empty string if unable to extract text
     * @export
     */
    Aura.Utils.Util.prototype.getText = function(node) {
        $A.assert(!this.isUndefinedOrNull(node), "node cannot be undefined or null");

        var t = node.textContent;
        if (t === undefined) {
            t = node.innerText || "";
        }

        // Older IE needs special handling
        if (t === "") {
            // Text nodes
            if (node.nodeType === 3) {
                return node.nodeValue;
            }

            // For old IE, if it's a <style> tag innerText doesnt work so try cssText
            if (node.tagName === "STYLE" && !this.isUndefinedOrNull(node.styleSheet)) {
                return node.styleSheet.cssText || "";
            }
        }
        return t;
    };

    /**
     * Loads a JavaScript resource.
     * @param {String} url The URL of the JavaScript resource to load.
     * @param {Function} callback Callback function that is invoked when the resource is loaded.
     * @export
     */
    Aura.Utils.Util.prototype.includeScript = function(url, callback) {
        if (this.isUndefined(this.includeScript.cache)) {
            this.includeScript.cache = {};
        }

        var cache = this.includeScript.cache;

        var script = cache[url];

        if (script) {
            if (script.state === "LOADED") {
                callback.call();
            } else {
                script.queue.push(callback);
            }
        } else {
            cache[url] = { state: "LOADING", queue: [callback] };

            var s = document.createElement("script");
            s.src = url;
            s.onload = function() {
                cache[url].state = "LOADED";
                var queue = cache[url].queue;
                while(queue.length > 0) {
                    queue.shift().call();
                }
            };

            document.head.appendChild( s ).parentNode.removeChild( s );
        }
    };
//#end
