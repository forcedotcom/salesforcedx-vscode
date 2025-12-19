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
 * A representation of a set of individual bits, addressable as if organized as
 * an array.
 *
 * @constructor
 * @export
 */
Aura.Utils.Bitset = function Bitset(str) {
    if (typeof str !== "string") {
        str = "";
    }
    Aura.Utils.Bitset.init();
    this.data = str.split('');
    this.trim();
};

/**
 * Tests whether a specific individual bit is or is not set.
 *
 * @returns {@code true} if and only if the n'th bit of the set is true.
 * @export
 */
Aura.Utils.Bitset.prototype.testBit = function(n) {
    var i = Math.floor(n / 6);
    if (i >= this.data.length) {
        return false;
    } else {
        return ((Aura.Utils.Bitset.codes[this.data[i]] & (0x20 >> (n % 6))) !== 0);
    }
};

/**
 * Causes the n'th bit of the Bitset to be set true.
 */
Aura.Utils.Bitset.prototype.setBit = function(n) {
    var i = Math.floor(n / 6);
    this.pad(i);
    this.data[i] = Aura.Utils.Bitset.alphabet[Aura.Utils.Bitset.codes[this.data[i]]
            | (0x20 >> (n % 6))];
};

/**
 * Causes the n'th bit of the Bitset to be set false.
 */
Aura.Utils.Bitset.prototype.clearBit = function(n) {
    var i = Math.floor(n / 6);
    if (i < this.data.length) {
        this.data[i] = Aura.Utils.Bitset.alphabet[Aura.Utils.Bitset.codes[this.data[i]]
                & (0xff ^ (0x20 >> (n % 6)))];
        this.trim();
    }
};

/**
 * Returns a base64 representation of the Bitset.
 */
Aura.Utils.Bitset.prototype.toString = function() {
    return this.data.join('');
};

/**
 * Internal utility to remove trailing 0's from the bitset data.
 */
Aura.Utils.Bitset.prototype.trim = function() {
    for ( var i = this.data.length - 1; i >= 0; i--) {
        if (this.data[i] !== Aura.Utils.Bitset.alphabet[0]) {
            break;
        }
    }
    this.data.splice(i + 1, this.data.length);
};

/**
 * Internal utility to pad leading 0's onto the bitset data.
 */
Aura.Utils.Bitset.prototype.pad = function(n) {
    var size = this.data.length;
    for ( var i = 0; i <= n - size; i++) {
        this.data.push(Aura.Utils.Bitset.alphabet[0]);
    }
};

/**
 * Returns length of the bitset, in 6-bit words (not individual bits).
 */
Aura.Utils.Bitset.prototype.length = function() {
    return this.data.length;
};
// statics

Aura.Utils.Bitset.initialized = false;

Aura.Utils.Bitset.init = function() {
    if (!Aura.Utils.Bitset.initialized) {
        Aura.Utils.Bitset.initialized = true;
        Aura.Utils.Bitset.alphabet = [
           'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P',
           'Q','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f',
           'g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v',
           'w','x','y','z','0','1','2','3','4','5','6','7','8','9','+','/'
        ];

        Aura.Utils.Bitset.codes = [];
        for ( var i = 0; i < Aura.Utils.Bitset.alphabet.length; i++) {
            Aura.Utils.Bitset.codes[Aura.Utils.Bitset.alphabet[i]] = i;
        }
    }
};