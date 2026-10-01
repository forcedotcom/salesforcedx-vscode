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

/*
 * Secure Filters (Anti-XSS) library approved by Salesforce Security 
 * https://github.com/SalesforceEng/secure-filters
 * v1.0.5 
*/

Aura.Utils.SecureFilters = (function () {
    var secureFilters = {};

    var QUOT = /\x22/g; // "
    var APOS = /\x27/g; // '
    var AST = /\*/g;
    var TILDE = /~/g;
    var BANG = /!/g;
    var LPAREN = /\(/g;
    var RPAREN = /\)/g;
    var CDATA_CLOSE = /\]\](?:>|\\x3E|\\u003E)/gi;

    // Matches alphanum plus ",._-" & unicode.
    // ESAPI doesn't consider "-" safe, but we do. It's both URI and HTML safe.
    var JS_NOT_ALLOWLISTED = /[^,\-\.0-9A-Z_a-z]/g;

    // add on '":\[]{}', which are necessary JSON metacharacters
    var JSON_NOT_ALLOWLISTED = /[^\x22,\-\.0-9:A-Z\[\x5C\]_a-z{}]/g;

    // Control characters that get converted to spaces.
    var HTML_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

    // Matches alphanum plus allowable whitespace, ",._-", and unicode.
    // NO-BREAK SPACE U+00A0 is fine since it's "whitespace".
    var HTML_NOT_ALLOWLISTED = /[^\t\n\v\f\r ,\.0-9A-Z_a-z\-\u00A0-\uFFFF]/g;

    // Matches alphanum and UTF-16 surrogate pairs (i.e. U+10000 and higher). The
    // rest of Unicode is deliberately absent in order to prevent charset encoding
    // issues.
    var CSS_NOT_ALLOWLISTED = /[^a-zA-Z0-9\uD800-\uDFFF]/g;

    /**
     * Encodes values for safe embedding in HTML tags and attributes.
     *
     * See html(value) in README.md for full documentation.
     *
     * @name html
     * @param {any} val will be converted to a String prior to encoding
     * @return {string} the encoded string
     */
    secureFilters.html = function(val) {
      var str = String(val);
      str = str.replace(HTML_CONTROL, ' ');
      return str.replace(HTML_NOT_ALLOWLISTED, function(match) {
        var code = match.charCodeAt(0);
        switch(code) {
        // folks expect these "nice" entities:
        case 0x22:
          return '&quot;';
        case 0x26:
          return '&amp;';
        case 0x3C:
          return '&lt;';
        case 0x3E:
          return '&gt;';

        default:
          // optimize for size:
          if (code < 100) {
            var dec = code.toString(10);
            return '&#'+dec+';';
          } else {
            // XXX: this doesn't produce strictly valid entities for code-points
            // requiring a UTF-16 surrogate pair. However, browsers are generally
            // tolerant of this. Surrogate pairs are currently in the allowlist
            // defined via HTML_NOT_ALLOWLISTED.
            var hex = code.toString(16).toUpperCase();
            return '&#x'+hex+';';
          }
        }
      });
    };

    /**
     * Backslash-encoding for a single character in JavaScript contexts.
     * @param {string} charStr single-character string.
     * @return {string} backslash escaped character.
     * @private
     */
    function jsSlashEncoder(charStr) {
      var code = charStr.charCodeAt(0);
      var hex = code.toString(16).toUpperCase();
      if (code < 0x80) { // ASCII
        if (hex.length === 1) {
          return '\\x0'+hex;
        } else {
          return '\\x'+hex;
        }
      } else { // Unicode
        switch(hex.length) {
          case 2:
            return '\\u00'+hex;
          case 3:
            return '\\u0'+hex;
          case 4:
            return '\\u'+hex;
          default:
            // charCodeAt() JS shouldn't return code > 0xFFFF, and only four hex
            // digits can be encoded via `\u`-encoding, so return REPLACEMENT
            // CHARACTER U+FFFD.
            return '\\uFFFD';
        }
      }

    }

    /**
     * Encodes values for safe embedding in JavaScript string contexts.
     *
     * See js(value) in README.md for full documentation.
     *
     * @name js
     * @param {any} val will be converted to a String prior to encoding
     * @return {string} the encoded string
     */
    secureFilters.js = function(val) {
      var str = String(val);
      return str.replace(JS_NOT_ALLOWLISTED, jsSlashEncoder);
    };

    /**
     * Encodes values embedded in HTML scripting attributes.
     *
     * See jsAttr(value) in README.md for full documentation.
     *
     * @name jsAttr
     * @param {any} val will be converted to a String prior to encoding
     * @return {string} the encoded string
     */
    secureFilters.jsAttr = function(val) {
      return secureFilters.html(secureFilters.js(val));
    };


    /**
     * Percent-encodes unsafe characters in URIs.
     *
     * See uri(value) in README.md for full documentation.
     *
     * @name uri
     * @param {any} val will be converted to a String prior to encoding
     * @return {string} the percent-encoded string
     */
    secureFilters.uri = function(val) {
      // encodeURIComponent() is well-standardized across browsers and it handles
      // UTF-8 natively.  It will not encode "~!*()'", so need to replace those here.
      // encodeURIComponent also won't encode ".-_", but those are known-safe.
      //
      // IE does not always encode '"' to '%27':
      // http://blog.imperva.com/2012/01/ie-bug-exposes-its-users-to-xss-attacks-.html
      var encode = encodeURIComponent(String(val));
      return encode
        .replace(BANG, '%21')
        .replace(QUOT, '%27')
        .replace(APOS, '%27')
        .replace(LPAREN, '%28')
        .replace(RPAREN, '%29')
        .replace(AST, '%2A')
        .replace(TILDE, '%7E');
    };

    /**
     * Encodes an object as JSON, but with unsafe characters in string literals
     * backslash-escaped.
     *
     * See jsObj(value) in README.md for full documentation.
     *
     * @name jsObj
     * @param {any} val
     * @return {string} the JSON- and backslash-encoded string
     */
    secureFilters.jsObj = function(val) {
      return JSON.stringify(val)
        .replace(JSON_NOT_ALLOWLISTED, jsSlashEncoder)
        // prevent breaking out of CDATA context.  Escaping < below is sufficient
        // to prevent opening a CDATA context.
        .replace(CDATA_CLOSE, '\\x5D\\x5D\\x3E');
    };

    /**
     * Encodes values for safe embedding in CSS context.
     *
     * See css(value) in README.md for full documentation.
     *
     * @name css
     * @param {any} val
     * @return {string} the backslash-encoded string
     */
    secureFilters.css = function(val) {
      var str = String(val);
      return str.replace(CSS_NOT_ALLOWLISTED, function(match) {
        var code = match.charCodeAt(0);
        if (code === 0) {
          return '\\fffd '; // REPLACEMENT CHARACTER U+FFFD
        } else {
          var hex = code.toString(16).toLowerCase();
          return '\\'+hex+' ';
        }
      });
    };

    /**
     * Encodes values for safe embedding in HTML style attribute context.
     *
     * See style(value) in README.md for full documentation.
     *
     * @name style
     * @param {any} val
     * @return {string} the entity- and backslash-encoded string
     */
    secureFilters.style = function(val) {
      return secureFilters.html(secureFilters.css(val));
    };

    return secureFilters;
    
 }());