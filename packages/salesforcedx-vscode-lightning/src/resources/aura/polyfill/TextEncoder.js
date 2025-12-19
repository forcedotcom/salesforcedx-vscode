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

// https://github.com/inexorabletash/text-encoding v0.6.0
// - Stripped to only support utf-8 and utf-16
// - Aura-specific change to handle obfuscation
// This is free and unencumbered software released into the public domain.

/* eslint-disable */
(function(global) {
    'use strict';

    //
    // Utilities
    //

    /**
     * @param {number} a The number to test.
     * @param {number} min The minimum value in the range, inclusive.
     * @param {number} max The maximum value in the range, inclusive.
     * @return {boolean} True if a >= min and a <= max.
     */
    function inRange(a, min, max) {
        return min <= a && a <= max;
    }

    /**
     * @param {!Array} array The array to check.
     * @param {*} item The item to look for in the array.
     * @return {boolean} True if the item appears in the array.
     */
    function includes(array, item) {
        return array.indexOf(item) !== -1;
    }

    /**
     * @param {*} o
     * @return {Object}
     */
    function ToDictionary(o) {
        if (o === undefined) return {};
        if (o === Object(o)) return o;
        throw TypeError('Could not convert argument to dictionary');
    }

    /**
     * @param {string} string Input string of UTF-16 code units.
     * @return {!Array} Code points.
     */
    function stringToCodePoints(string) {
        // https://heycam.github.io/webidl/#dfn-obtain-unicode

        // 1. Let S be the DOMString value.
        var s = String(string);

        // 2. Let n be the length of S.
        var n = s.length;

        // 3. Initialize i to 0.
        var i = 0;

        // 4. Initialize U to be an empty sequence of Unicode characters.
        var u = [];

        // 5. While i < n:
        while (i < n) {

            // 1. Let c be the code unit in S at index i.
            var c = s.charCodeAt(i);

            // 2. Depending on the value of c:

            // c < 0xD800 or c > 0xDFFF
            if (c < 0xD800 || c > 0xDFFF) {
                // Append to U the Unicode character with code point c.
                u.push(c);
            }

            // 0xDC00 ≤ c ≤ 0xDFFF
            else if (0xDC00 <= c && c <= 0xDFFF) {
                // Append to U a U+FFFD REPLACEMENT CHARACTER.
                u.push(0xFFFD);
            }

            // 0xD800 ≤ c ≤ 0xDBFF
            else if (0xD800 <= c && c <= 0xDBFF) {
                // 1. If i = n−1, then append to U a U+FFFD REPLACEMENT
                // CHARACTER.
                if (i === n - 1) {
                    u.push(0xFFFD);
                }
                // 2. Otherwise, i < n−1:
                else {
                    // 1. Let d be the code unit in S at index i+1.
                    var d = string.charCodeAt(i + 1);

                    // 2. If 0xDC00 ≤ d ≤ 0xDFFF, then:
                    if (0xDC00 <= d && d <= 0xDFFF) {
                        // 1. Let a be c & 0x3FF.
                        var a = c & 0x3FF;

                        // 2. Let b be d & 0x3FF.
                        var b = d & 0x3FF;

                        // 3. Append to U the Unicode character with code point
                        // 2^16+2^10*a+b.
                        u.push(0x10000 + (a << 10) + b);

                        // 4. Set i to i+1.
                        i += 1;
                    }

                    // 3. Otherwise, d < 0xDC00 or d > 0xDFFF. Append to U a
                    // U+FFFD REPLACEMENT CHARACTER.
                    else  {
                        u.push(0xFFFD);
                    }
                }
            }

            // 3. Set i to i+1.
            i += 1;
        }

        // 6. Return U.
        return u;
    }

    /**
     * @param {!Array} code_points Array of code points.
     * @return {string} string String of UTF-16 code units.
     */
    function codePointsToString(code_points) {
        var s = '';
        for (var i = 0; i < code_points.length; ++i) {
            var cp = code_points[i];
            if (cp <= 0xFFFF) {
                s += String.fromCharCode(cp);
            } else {
                cp -= 0x10000;
                s += String.fromCharCode((cp >> 10) + 0xD800,
                    (cp & 0x3FF) + 0xDC00);
            }
        }
        return s;
    }


    //
    // Implementation of Encoding specification
    // https://encoding.spec.whatwg.org/
    //

    //
    // 4. Terminology
    //

    /**
     * An ASCII byte is a byte in the range 0x00 to 0x7F, inclusive.
     * @param {number} a The number to test.
     * @return {boolean} True if a is in the range 0x00 to 0x7F, inclusive.
     */
    function isASCIIByte(a) {
        return 0x00 <= a && a <= 0x7F;
    }

    /**
     * End-of-stream is a special token that signifies no more tokens
     * are in the stream.
     * @const
     */ var end_of_stream = -1;

    /**
     * A stream represents an ordered sequence of tokens.
     *
     * @param {!(Array|Uint8Array)} tokens Array of tokens that provide
     * the stream.
     */
    function Stream(tokens) {
        /** @type {!Array} */
        this.tokens = [].slice.call(tokens);
        // Reversed as push/pop is more efficient than shift/unshift.
        this.tokens.reverse();
    }

    Stream.prototype = {
        /**
         * @return {boolean} True if end-of-stream has been hit.
         */
        endOfStream: function() {
            return !this.tokens.length;
        },

        /**
         * When a token is read from a stream, the first token in the
         * stream must be returned and subsequently removed, and
         * end-of-stream must be returned otherwise.
         *
         * @return {number} Get the next token from the stream, or
         * end_of_stream.
         */
        read: function() {
            if (!this.tokens.length)
                return end_of_stream;
            return this.tokens.pop();
        },

        /**
         * When one or more tokens are prepended to a stream, those tokens
         * must be inserted, in given order, before the first token in the
         * stream.
         *
         * @param {(number|!Array)} token The token(s) to prepend to the
         * stream.
         */
        prepend: function(token) {
            if (Array.isArray(token)) {
                var tokens = /**@type {!Array}*/(token);
                while (tokens.length)
                    this.tokens.push(tokens.pop());
            } else {
                this.tokens.push(token);
            }
        },

        /**
         * When one or more tokens are pushed to a stream, those tokens
         * must be inserted, in given order, after the last token in the
         * stream.
         *
         * @param {(number|!Array)} token The tokens(s) to push to the
         * stream.
         */
        push: function(token) {
            if (Array.isArray(token)) {
                var tokens = /**@type {!Array}*/(token);
                while (tokens.length)
                    this.tokens.unshift(tokens.shift());
            } else {
                this.tokens.unshift(token);
            }
        }
    };

    //
    // 5. Encodings
    //

    // 5.1 Encoders and decoders

    /** @const */
    var finished = -1;

    /**
     * @param {boolean} fatal If true, decoding errors raise an exception.
     * @param {number=} opt_code_point Override the standard fallback code point.
     * @return {number} The code point to insert on a decoding error.
     */
    function decoderError(fatal, opt_code_point) {
        if (fatal)
            throw TypeError('Decoder error');
        return opt_code_point || 0xFFFD;
    }

    /** @interface */
    function Decoder() {}
    Decoder.prototype = {
        /**
         * @param {Stream} stream The stream of bytes being decoded.
         * @param {number} bite The next byte read from the stream.
         * @return {?(number|!Array)} The next code point(s)
         *     decoded, or null if not enough data exists in the input
         *     stream to decode a complete code point, or |finished|.
         */
        handler: function(stream, bite) {}
    };

    /** @interface */
    function Encoder() {}
    Encoder.prototype = {
        /**
         * @param {Stream} stream The stream of code points being encoded.
         * @param {number} code_point Next code point read from the stream.
         * @return {(number|!Array)} Byte(s) to emit, or |finished|.
         */
        handler: function(stream, code_point) {}
    };

    // 5.2 Names and labels

    // TODO: Define @typedef for Encoding: {name:string,labels:Array}
    // https://github.com/google/closure-compiler/issues/247

    /**
     * @param {string} label The encoding label.
     * @return {?{name:string,labels:Array}}
     */
    function getEncoding(label) {
        // 1. Remove any leading and trailing ASCII whitespace from label.
        label = String(label).trim().toLowerCase();

        // 2. If label is an ASCII case-insensitive match for any of the
        // labels listed in the table below, return the corresponding
        // encoding, and failure otherwise.
        if (Object.prototype.hasOwnProperty.call(label_to_encoding, label)) {
            return label_to_encoding[label];
        }
        return null;
    }

    /**
     * Encodings table: https://encoding.spec.whatwg.org/encodings.json
     * @const
     * @type {!Array}
     */
    var encodings = [
        {
            "encodings": [
                {
                    "labels": [
                        "unicode-1-1-utf-8",
                        "utf-8",
                        "utf8"
                    ],
                    "name": "UTF-8"
                }
            ],
            "heading": "The Encoding"
        },
        {
            "encodings": [
                {
                    "labels": [
                        "utf-16be"
                    ],
                    "name": "UTF-16BE"
                },
                {
                    "labels": [
                        "utf-16",
                        "utf-16le"
                    ],
                    "name": "UTF-16LE"
                }
            ],
            "heading": "Legacy miscellaneous encodings"
        }
    ];

    // Label to encoding registry.
    /** @type {Object} */
    var label_to_encoding = {};
    encodings.forEach(function(category) {
        category['encodings'].forEach(function(encoding) {
            encoding['labels'].forEach(function(label) {
                label_to_encoding[label] = encoding;
            });
        });
    });

    // Registry of of encoder/decoder factories, by encoding name.
    /** @type {Object} */
    var encoders = {};
    /** @type {Object} */
    var decoders = {};

    //
    // 8. API
    //

    /** @const */ var DEFAULT_ENCODING = 'utf-8';

    // 8.1 Interface TextDecoder

    /**
     * @param {string=} label The label of the encoding;
     *     defaults to 'utf-8'.
     * @param {Object=} options
     */
    function TextDecoder(label, options) {
        // Web IDL conventions
        if (!(this instanceof TextDecoder))
            throw TypeError('Called as a function. Did you forget \'new\'?');
        label = label !== undefined ? String(label) : DEFAULT_ENCODING;
        options = ToDictionary(options);

        // A TextDecoder object has an associated encoding, decoder,
        // stream, ignore BOM flag (initially unset), BOM seen flag
        // (initially unset), error mode (initially replacement), and do
        // not flush flag (initially unset).

        this._encoding = null;
        this._decoder = null;
        this._ignoreBOM = false;
        this._BOMseen = false;
        this._error_mode = 'replacement';
        this._do_not_flush = false;


        // 1. Let encoding be the result of getting an encoding from
        // label.
        var encoding = getEncoding(label);

        // 2. If encoding is failure or replacement, throw a RangeError.
        if (encoding === null || encoding.name === 'replacement')
            throw RangeError('Unknown encoding: ' + label);
        if (!decoders[encoding.name]) {
            throw Error('Decoder not present.' +
                ' Did you forget to include encoding-indexes.js?');
        }

        // 3. Let dec be a new TextDecoder object.
        var dec = this;

        // 4. Set dec's encoding to encoding.
        dec._encoding = encoding;

        // 5. If options's fatal member is true, set dec's error mode to
        // fatal.
        if (Boolean(options['fatal']))
            dec._error_mode = 'fatal';

        // 6. If options's ignoreBOM member is true, set dec's ignore BOM
        // flag.
        if (Boolean(options['ignoreBOM']))
            dec._ignoreBOM = true;

        // For pre-ES5 runtimes:
        if (!Object.defineProperty) {
            this.encoding = dec._encoding.name.toLowerCase();
            this.fatal = dec._error_mode === 'fatal';
            this.ignoreBOM = dec._ignoreBOM;
        }

        // 7. Return dec.
        return dec;
    }

    if (Object.defineProperty) {
        // The encoding attribute's getter must return encoding's name.
        Object.defineProperty(TextDecoder.prototype, 'encoding', {
            /** @this {TextDecoder} */
            get: function() { return this._encoding.name.toLowerCase(); }
        });

        // The fatal attribute's getter must return true if error mode
        // is fatal, and false otherwise.
        Object.defineProperty(TextDecoder.prototype, 'fatal', {
            /** @this {TextDecoder} */
            get: function() { return this._error_mode === 'fatal'; }
        });

        // The ignoreBOM attribute's getter must return true if ignore
        // BOM flag is set, and false otherwise.
        Object.defineProperty(TextDecoder.prototype, 'ignoreBOM', {
            /** @this {TextDecoder} */
            get: function() { return this._ignoreBOM; }
        });
    }

    /**
     * @param {BufferSource=} input The buffer of bytes to decode.
     * @param {Object=} options
     * @return {string} The decoded string.
     */
    TextDecoder.prototype.decode = function decode(input, options) {
        var bytes;
        if (typeof input === 'object' && input instanceof ArrayBuffer) {
            bytes = new Uint8Array(input);
        } else if (typeof input === 'object' && 'buffer' in input &&
            input.buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(input.buffer,
                input.byteOffset,
                input.byteLength);
        } else {
            bytes = new Uint8Array(0);
        }

        options = ToDictionary(options);

        // 1. If the do not flush flag is unset, set decoder to a new
        // encoding's decoder, set stream to a new stream, and unset the
        // BOM seen flag.
        if (!this._do_not_flush) {
            this._decoder = decoders[this._encoding.name]({
                fatal: this._error_mode === 'fatal'});
            this._BOMseen = false;
        }

        // 2. If options's stream is true, set the do not flush flag, and
        // unset the do not flush flag otherwise.
        this._do_not_flush = Boolean(options['stream']);

        // 3. If input is given, push a copy of input to stream.
        // TODO: Align with spec algorithm - maintain stream on instance.
        var input_stream = new Stream(bytes);

        // 4. Let output be a new stream.
        var output = [];

        var result;

        // 5. While true:
        while (true) {
            // 1. Let token be the result of reading from stream.
            var token = input_stream.read();

            // 2. If token is end-of-stream and the do not flush flag is
            // set, return output, serialized.
            // TODO: Align with spec algorithm.
            if (token === end_of_stream)
                break;

            // 3. Otherwise, run these subsubsteps:

            // 1. Let result be the result of processing token for decoder,
            // stream, output, and error mode.
            result = this._decoder.handler(input_stream, token);

            // 2. If result is finished, return output, serialized.
            if (result === finished)
                break;

            if (result !== null) {
                if (Array.isArray(result))
                    output.push.apply(output, (result));
                else
                    output.push(result);
            }

            // 3. Otherwise, if result is error, throw a TypeError.
            // (Thrown in handler)

            // 4. Otherwise, do nothing.
        }
        // TODO: Align with spec algorithm.
        if (!this._do_not_flush) {
            do {
                result = this._decoder.handler(input_stream, input_stream.read());
                if (result === finished)
                    break;
                if (result === null)
                    continue;
                if (Array.isArray(result))
                    output.push.apply(output, (result));
                else
                    output.push(result);
            } while (!input_stream.endOfStream());
            this._decoder = null;
        }

        // A TextDecoder object also has an associated serialize stream
        // algorithm...
        function serializeStream(stream) {
            // 1. Let token be the result of reading from stream.
            // (Done in-place on array, rather than as a stream)

            // 2. If encoding is UTF-8, UTF-16BE, or UTF-16LE, and ignore
            // BOM flag and BOM seen flag are unset, run these subsubsteps:
            if (includes(['UTF-8', 'UTF-16LE', 'UTF-16BE'], this._encoding.name) &&
                !this._ignoreBOM && !this._BOMseen) {
                if (stream.length > 0 && stream[0] === 0xFEFF) {
                    // 1. If token is U+FEFF, set BOM seen flag.
                    this._BOMseen = true;
                    stream.shift();
                } else if (stream.length > 0) {
                    // 2. Otherwise, if token is not end-of-stream, set BOM seen
                    // flag and append token to stream.
                    this._BOMseen = true;
                } else {
                    // 3. Otherwise, if token is not end-of-stream, append token
                    // to output.
                    // (no-op)
                }
            }
            // 4. Otherwise, return output.
            return codePointsToString(stream);
        }

        return serializeStream.call(this, output);
    };

    // 8.2 Interface TextEncoder

    /**
     * @param {string=} label The label of the encoding. NONSTANDARD.
     * @param {Object=} options NONSTANDARD.
     */
    function TextEncoder(label, options) {
        // Web IDL conventions
        if (!(this instanceof TextEncoder))
            throw TypeError('Called as a function. Did you forget \'new\'?');
        options = ToDictionary(options);

        // A TextEncoder object has an associated encoding and encoder.

        this._encoding = null;
        this._encoder = null;

        // Non-standard
        this._do_not_flush = false;
        this._fatal = Boolean(options['fatal']) ? 'fatal' : 'replacement';

        // 1. Let enc be a new TextEncoder object.
        var enc = this;

        // 2. Set enc's encoding to UTF-8's encoder.
        if (Boolean(options['NONSTANDARD_allowLegacyEncoding'])) {
            // NONSTANDARD behavior.
            label = label !== undefined ? String(label) : DEFAULT_ENCODING;
            var encoding = getEncoding(label);
            if (encoding === null || encoding.name === 'replacement')
                throw RangeError('Unknown encoding: ' + label);
            if (!encoders[encoding.name]) {
                throw Error('Encoder not present.' +
                    ' Did you forget to include encoding-indexes.js?');
            }
            enc._encoding = encoding;
        } else {
            // Standard behavior.
            enc._encoding = getEncoding('utf-8');

            if (label !== undefined && 'console' in global) {
                console.warn('TextEncoder constructor called with encoding label, '
                    + 'which is ignored.');
            }
        }

        // For pre-ES5 runtimes:
        if (!Object.defineProperty)
            this.encoding = enc._encoding.name.toLowerCase();

        // 3. Return enc.
        return enc;
    }

    if (Object.defineProperty) {
        // The encoding attribute's getter must return encoding's name.
        Object.defineProperty(TextEncoder.prototype, 'encoding', {
            /** @this {TextEncoder} */
            get: function() { return this._encoding.name.toLowerCase(); }
        });
    }

    TextEncoder.prototype.encode = function encode(opt_string, options) {
        opt_string = opt_string ? String(opt_string) : '';
        options = ToDictionary(options);

        // NOTE: This option is nonstandard. None of the encodings
        // permitted for encoding (i.e. UTF-8, UTF-16) are stateful when
        // the input is a USVString so streaming is not necessary.
        if (!this._do_not_flush)
            this._encoder = encoders[this._encoding.name]({
                fatal: this._fatal === 'fatal'});
        this._do_not_flush = Boolean(options['stream']);

        // 1. Convert input to a stream.
        var input = new Stream(stringToCodePoints(opt_string));

        // 2. Let output be a new stream
        var output = [];

        var result;
        // 3. While true, run these substeps:
        while (true) {
            // 1. Let token be the result of reading from input.
            var token = input.read();
            if (token === end_of_stream)
                break;
            // 2. Let result be the result of processing token for encoder,
            // input, output.
            result = this._encoder.handler(input, token);
            if (result === finished)
                break;
            if (Array.isArray(result))
                output.push.apply(output, (result));
            else
                output.push(result);
        }
        // TODO: Align with spec algorithm.
        if (!this._do_not_flush) {
            while (true) {
                result = this._encoder.handler(input, input.read());
                if (result === finished)
                    break;
                if (Array.isArray(result))
                    output.push.apply(output, (result));
                else
                    output.push(result);
            }
            this._encoder = null;
        }
        // 3. If result is finished, convert output into a byte sequence,
        // and then return a Uint8Array object wrapping an ArrayBuffer
        // containing output.
        return new Uint8Array(output);
    };


    //
    // 9. The encoding
    //

    // 9.1 utf-8

    // 9.1.1 utf-8 decoder
    /**
     * @implements {Decoder}
     * @param {{fatal: boolean}} options
     */
    function UTF8Decoder(options) {
        var fatal = options.fatal;

        // utf-8's decoder's has an associated utf-8 code point, utf-8
        // bytes seen, and utf-8 bytes needed (all initially 0), a utf-8
        // lower boundary (initially 0x80), and a utf-8 upper boundary
        // (initially 0xBF).
        var /** @type {number} */ utf8_code_point = 0,
            /** @type {number} */ utf8_bytes_seen = 0,
            /** @type {number} */ utf8_bytes_needed = 0,
            /** @type {number} */ utf8_lower_boundary = 0x80,
            /** @type {number} */ utf8_upper_boundary = 0xBF;

        /**
         * @param {Stream} stream The stream of bytes being decoded.
         * @param {number} bite The next byte read from the stream.
         * @return {?(number|!Array)} The next code point(s)
         *     decoded, or null if not enough data exists in the input
         *     stream to decode a complete code point.
         */
        this.handler = function(stream, bite) {
            // 1. If byte is end-of-stream and utf-8 bytes needed is not 0,
            // set utf-8 bytes needed to 0 and return error.
            if (bite === end_of_stream && utf8_bytes_needed !== 0) {
                utf8_bytes_needed = 0;
                return decoderError(fatal);
            }

            // 2. If byte is end-of-stream, return finished.
            if (bite === end_of_stream)
                return finished;

            // 3. If utf-8 bytes needed is 0, based on byte:
            if (utf8_bytes_needed === 0) {

                // 0x00 to 0x7F
                if (inRange(bite, 0x00, 0x7F)) {
                    // Return a code point whose value is byte.
                    return bite;
                }

                // 0xC2 to 0xDF
                if (inRange(bite, 0xC2, 0xDF)) {
                    // Set utf-8 bytes needed to 1 and utf-8 code point to byte
                    // − 0xC0.
                    utf8_bytes_needed = 1;
                    utf8_code_point = bite - 0xC0;
                }

                // 0xE0 to 0xEF
                else if (inRange(bite, 0xE0, 0xEF)) {
                    // 1. If byte is 0xE0, set utf-8 lower boundary to 0xA0.
                    if (bite === 0xE0)
                        utf8_lower_boundary = 0xA0;
                    // 2. If byte is 0xED, set utf-8 upper boundary to 0x9F.
                    if (bite === 0xED)
                        utf8_upper_boundary = 0x9F;
                    // 3. Set utf-8 bytes needed to 2 and utf-8 code point to
                    // byte − 0xE0.
                    utf8_bytes_needed = 2;
                    utf8_code_point = bite - 0xE0;
                }

                // 0xF0 to 0xF4
                else if (inRange(bite, 0xF0, 0xF4)) {
                    // 1. If byte is 0xF0, set utf-8 lower boundary to 0x90.
                    if (bite === 0xF0)
                        utf8_lower_boundary = 0x90;
                    // 2. If byte is 0xF4, set utf-8 upper boundary to 0x8F.
                    if (bite === 0xF4)
                        utf8_upper_boundary = 0x8F;
                    // 3. Set utf-8 bytes needed to 3 and utf-8 code point to
                    // byte − 0xF0.
                    utf8_bytes_needed = 3;
                    utf8_code_point = bite - 0xF0;
                }

                // Otherwise
                else {
                    // Return error.
                    return decoderError(fatal);
                }

                // Then (byte is in the range 0xC2 to 0xF4, inclusive) set
                // utf-8 code point to utf-8 code point << (6 × utf-8 bytes
                // needed) and return continue.
                utf8_code_point = utf8_code_point << (6 * utf8_bytes_needed);
                return null;
            }

            // 4. If byte is not in the range utf-8 lower boundary to utf-8
            // upper boundary, inclusive, run these substeps:
            if (!inRange(bite, utf8_lower_boundary, utf8_upper_boundary)) {

                // 1. Set utf-8 code point, utf-8 bytes needed, and utf-8
                // bytes seen to 0, set utf-8 lower boundary to 0x80, and set
                // utf-8 upper boundary to 0xBF.
                utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;
                utf8_lower_boundary = 0x80;
                utf8_upper_boundary = 0xBF;

                // 2. Prepend byte to stream.
                stream.prepend(bite);

                // 3. Return error.
                return decoderError(fatal);
            }

            // 5. Set utf-8 lower boundary to 0x80 and utf-8 upper boundary
            // to 0xBF.
            utf8_lower_boundary = 0x80;
            utf8_upper_boundary = 0xBF;

            // 6. Increase utf-8 bytes seen by one and set utf-8 code point
            // to utf-8 code point + (byte − 0x80) << (6 × (utf-8 bytes
            // needed − utf-8 bytes seen)).
            utf8_bytes_seen += 1;
            utf8_code_point += (bite - 0x80) << (6 * (utf8_bytes_needed -
                utf8_bytes_seen));

            // 7. If utf-8 bytes seen is not equal to utf-8 bytes needed,
            // continue.
            if (utf8_bytes_seen !== utf8_bytes_needed)
                return null;

            // 8. Let code point be utf-8 code point.
            var code_point = utf8_code_point;

            // 9. Set utf-8 code point, utf-8 bytes needed, and utf-8 bytes
            // seen to 0.
            utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;

            // 10. Return a code point whose value is code point.
            return code_point;
        };
    }

    // 9.1.2 utf-8 encoder
    /**
     * @implements {Encoder}
     * @param {{fatal: boolean}} options
     */
    function UTF8Encoder(options) {
        var fatal = options.fatal;
        /**
         * @param {Stream} stream Input stream.
         * @param {number} code_point Next code point read from the stream.
         * @return {(number|!Array)} Byte(s) to emit.
         */
        this.handler = function(stream, code_point) {
            // 1. If code point is end-of-stream, return finished.
            if (code_point === end_of_stream)
                return finished;

            // 2. If code point is in the range U+0000 to U+007F, return a
            // byte whose value is code point.
            if (inRange(code_point, 0x0000, 0x007f))
                return code_point;

            // 3. Set count and offset based on the range code point is in:
            var count, offset;
            // U+0080 to U+07FF, inclusive:
            if (inRange(code_point, 0x0080, 0x07FF)) {
                // 1 and 0xC0
                count = 1;
                offset = 0xC0;
            }
            // U+0800 to U+FFFF, inclusive:
            else if (inRange(code_point, 0x0800, 0xFFFF)) {
                // 2 and 0xE0
                count = 2;
                offset = 0xE0;
            }
            // U+10000 to U+10FFFF, inclusive:
            else if (inRange(code_point, 0x10000, 0x10FFFF)) {
                // 3 and 0xF0
                count = 3;
                offset = 0xF0;
            }

            // 4.Let bytes be a byte sequence whose first byte is (code
            // point >> (6 × count)) + offset.
            var bytes = [(code_point >> (6 * count)) + offset];

            // 5. Run these substeps while count is greater than 0:
            while (count > 0) {

                // 1. Set temp to code point >> (6 × (count − 1)).
                var temp = code_point >> (6 * (count - 1));

                // 2. Append to bytes 0x80 | (temp & 0x3F).
                bytes.push(0x80 | (temp & 0x3F));

                // 3. Decrease count by one.
                count -= 1;
            }

            // 6. Return bytes bytes, in order.
            return bytes;
        };
    }

    /** @param {{fatal: boolean}} options */
    encoders['UTF-8'] = function(options) {
        return new UTF8Encoder(options);
    };
    /** @param {{fatal: boolean}} options */
    decoders['UTF-8'] = function(options) {
        return new UTF8Decoder(options);
    };

    // 15.2 Common infrastructure for utf-16be and utf-16le

    /**
     * @param {number} code_unit
     * @param {boolean} utf16be
     * @return {!Array} bytes
     */
    function convertCodeUnitToBytes(code_unit, utf16be) {
        // 1. Let byte1 be code unit >> 8.
        var byte1 = code_unit >> 8;

        // 2. Let byte2 be code unit & 0x00FF.
        var byte2 = code_unit & 0x00FF;

        // 3. Then return the bytes in order:
        // utf-16be flag is set: byte1, then byte2.
        if (utf16be)
            return [byte1, byte2];
        // utf-16be flag is unset: byte2, then byte1.
        return [byte2, byte1];
    }

    // 15.2.1 shared utf-16 decoder
    /**
     * @implements {Decoder}
     * @param {boolean} utf16_be True if big-endian, false if little-endian.
     * @param {{fatal: boolean}} options
     */
    function UTF16Decoder(utf16_be, options) {
        var fatal = options.fatal;
        var /** @type {?number} */ utf16_lead_byte = null,
            /** @type {?number} */ utf16_lead_surrogate = null;
        /**
         * @param {Stream} stream The stream of bytes being decoded.
         * @param {number} bite The next byte read from the stream.
         * @return {?(number|!Array)} The next code point(s)
         *     decoded, or null if not enough data exists in the input
         *     stream to decode a complete code point.
         */
        this.handler = function(stream, bite) {
            // 1. If byte is end-of-stream and either utf-16 lead byte or
            // utf-16 lead surrogate is not null, set utf-16 lead byte and
            // utf-16 lead surrogate to null, and return error.
            if (bite === end_of_stream && (utf16_lead_byte !== null ||
                utf16_lead_surrogate !== null)) {
                return decoderError(fatal);
            }

            // 2. If byte is end-of-stream and utf-16 lead byte and utf-16
            // lead surrogate are null, return finished.
            if (bite === end_of_stream && utf16_lead_byte === null &&
                utf16_lead_surrogate === null) {
                return finished;
            }

            // 3. If utf-16 lead byte is null, set utf-16 lead byte to byte
            // and return continue.
            if (utf16_lead_byte === null) {
                utf16_lead_byte = bite;
                return null;
            }

            // 4. Let code unit be the result of:
            var code_unit;
            if (utf16_be) {
                // utf-16be decoder flag is set
                //   (utf-16 lead byte << 8) + byte.
                code_unit = (utf16_lead_byte << 8) + bite;
            } else {
                // utf-16be decoder flag is unset
                //   (byte << 8) + utf-16 lead byte.
                code_unit = (bite << 8) + utf16_lead_byte;
            }
            // Then set utf-16 lead byte to null.
            utf16_lead_byte = null;

            // 5. If utf-16 lead surrogate is not null, let lead surrogate
            // be utf-16 lead surrogate, set utf-16 lead surrogate to null,
            // and then run these substeps:
            if (utf16_lead_surrogate !== null) {
                var lead_surrogate = utf16_lead_surrogate;
                utf16_lead_surrogate = null;

                // 1. If code unit is in the range U+DC00 to U+DFFF, return a
                // code point whose value is 0x10000 + ((lead surrogate −
                // 0xD800) << 10) + (code unit − 0xDC00).
                if (inRange(code_unit, 0xDC00, 0xDFFF)) {
                    return 0x10000 + (lead_surrogate - 0xD800) * 0x400 +
                        (code_unit - 0xDC00);
                }

                // 2. Prepend the sequence resulting of converting code unit
                // to bytes using utf-16be decoder flag to stream and return
                // error.
                stream.prepend(convertCodeUnitToBytes(code_unit, utf16_be));
                return decoderError(fatal);
            }

            // 6. If code unit is in the range U+D800 to U+DBFF, set utf-16
            // lead surrogate to code unit and return continue.
            if (inRange(code_unit, 0xD800, 0xDBFF)) {
                utf16_lead_surrogate = code_unit;
                return null;
            }

            // 7. If code unit is in the range U+DC00 to U+DFFF, return
            // error.
            if (inRange(code_unit, 0xDC00, 0xDFFF))
                return decoderError(fatal);

            // 8. Return code point code unit.
            return code_unit;
        };
    }

    // 15.2.2 shared utf-16 encoder
    /**
     * @implements {Encoder}
     * @param {boolean} utf16_be True if big-endian, false if little-endian.
     * @param {{fatal: boolean}} options
     */
    function UTF16Encoder(utf16_be, options) {
        var fatal = options.fatal;
        /**
         * @param {Stream} stream Input stream.
         * @param {number} code_point Next code point read from the stream.
         * @return {(number|!Array)} Byte(s) to emit.
         */
        this.handler = function(stream, code_point) {
            // 1. If code point is end-of-stream, return finished.
            if (code_point === end_of_stream)
                return finished;

            // 2. If code point is in the range U+0000 to U+FFFF, return the
            // sequence resulting of converting code point to bytes using
            // utf-16be encoder flag.
            if (inRange(code_point, 0x0000, 0xFFFF))
                return convertCodeUnitToBytes(code_point, utf16_be);

            // 3. Let lead be ((code point − 0x10000) >> 10) + 0xD800,
            // converted to bytes using utf-16be encoder flag.
            var lead = convertCodeUnitToBytes(
                ((code_point - 0x10000) >> 10) + 0xD800, utf16_be);

            // 4. Let trail be ((code point − 0x10000) & 0x3FF) + 0xDC00,
            // converted to bytes using utf-16be encoder flag.
            var trail = convertCodeUnitToBytes(
                ((code_point - 0x10000) & 0x3FF) + 0xDC00, utf16_be);

            // 5. Return a byte sequence of lead followed by trail.
            return lead.concat(trail);
        };
    }

    // 15.3 utf-16be
    // 15.3.1 utf-16be decoder
    /** @param {{fatal: boolean}} options */
    encoders['UTF-16BE'] = function(options) {
        return new UTF16Encoder(true, options);
    };
    // 15.3.2 utf-16be encoder
    /** @param {{fatal: boolean}} options */
    decoders['UTF-16BE'] = function(options) {
        return new UTF16Decoder(true, options);
    };

    // 15.4 utf-16le
    // 15.4.1 utf-16le decoder
    /** @param {{fatal: boolean}} options */
    encoders['UTF-16LE'] = function(options) {
        return new UTF16Encoder(false, options);
    };
    // 15.4.2 utf-16le encoder
    /** @param {{fatal: boolean}} options */
    decoders['UTF-16LE'] = function(options) {
        return new UTF16Decoder(false, options);
    };

    // Aura-specific changes follow
    if (!global['TextEncoder']) {
        TextEncoder.prototype['encode'] = TextEncoder.prototype.encode;
        global['TextEncoder'] = TextEncoder;
    }
    if (!global['TextDecoder']) {
        TextDecoder.prototype['decode'] = TextDecoder.prototype.decode;
        global['TextDecoder'] = TextDecoder;
    }
}(window));
