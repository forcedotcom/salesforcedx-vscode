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
 * Format is a string using the java format pattern (e.g. #,##0.0). Note that this does not handle quoted
 * special characters or exponents.
 * Symbols is an optional map of localized symbols to use, otherwise it will use the current locale's symbols
 *
 * @constructor
 * @export
 */
Aura.Utils.NumberFormat = function NumberFormat(format, symbols) {
    this.originalFormat = format;
    this.symbols = symbols || {"decimalSeparator": $A.get("$Locale.decimal"),
                               "groupingSeparator": $A.get("$Locale.grouping"),
                               "currency": $A.get("$Locale.currency"),
                               "currencyCode": $A.get("$Locale.currencyCode"),
                               "zeroDigit": $A.get("$Locale.zero")};
    // default values for any format
    this.zeroCharCodeOffset = this.symbols["zeroDigit"].charCodeAt(0) - Aura.Utils.NumberFormat.ZERO.charCodeAt(0);
    this.hasCurrency = false;
    this.multiplier = 0;
    this.minDigits = 1;
    this.positiveGroupingDigits = []; /** decimal group places, starting from group next to decimal point */
    this.minFractionDigits = 0;
    this.maxFractionDigits = 0;
    this.prefix = null;
    this.suffix = null;
    this.hasNegativePattern = false;
    this.negativePrefix = null;
    this.negativeSuffix = null;

    var parsePhase = 0; // start
    var prefixEnd = 0;
    var suffixStart = format.length;
    var zeros = 0;
    var leftNumber = false;
    var rightNumbers = 0;
    var group = -1;
    var decimal = false;

    var posPattern, negPattern;
    var split = format.indexOf(";");
    if (split !== -1) {
        // we have a separate negative pattern
        posPattern = format.substring(0, split);
        negPattern = format.substring(split + 1);
    } else {
        // no negative pattern
        posPattern = format;
    }

    for (var i = 0; i < posPattern.length; i++) {
        var c = posPattern.charAt(i);
        switch (parsePhase) {
        case 0:
            if (c === "#" || c === Aura.Utils.NumberFormat.ZERO || c === "." || c === ",") {
                // on to the pattern phase
                parsePhase = 1;
                prefixEnd = i;
                i--;
                break;
            } else {
                this.checkForSpecialChar(c);
            }
            break;
        case 1:
            switch (c) {
            case "#":
                if (zeros > 0 || decimal) {
                    rightNumbers++;
                } else {
                    leftNumber = true;
                }
                if (group >= 0 && !decimal) {
                    // saw a group but not a decimal
                    group++;
                }
                break;
            case Aura.Utils.NumberFormat.ZERO:
                if (rightNumbers > 0) {
                    this.parseError("'0's must be sequential");
                }
                zeros++;
                if (group >= 0 && !decimal) {
                    // saw a group but not a decimal
                    group++;
                }
                break;
            case ",":
                if (!leftNumber && !zeros) {
                    this.parseError("there must be a number before the grouping separator");
                }
                if (decimal) {
                    this.parseError("grouping separator found after the decimal separator");
                }
                // start counting the numbers between groups
                if (group > 0) {
                    this.positiveGroupingDigits.unshift(group);
                }
                group = 0;
                break;
            case ".":
                if (decimal) {
                    this.parseError("too many decimal separators");
                }
                this.minDigits = zeros;
                zeros = 0;
                decimal = true;
                break;
            default:
                // on to the suffix phase
                suffixStart = i--;
                parsePhase = 2;
                break;
            }
            break;
        case 2:
            this.checkForSpecialChar(c);
            break;
        }
    }
    if (group > 0) {
        this.positiveGroupingDigits.unshift(group);
    }
    if (group === 0) {
        this.parseError("grouping cannot be 0");
    }
    if (!decimal) {
        this.minDigits = zeros;
        this.minFractionDigits = 0;
        this.maxFractionDigits = 0;
    } else {
        this.minFractionDigits = zeros;
        this.maxFractionDigits = this.minFractionDigits + rightNumbers;
    }
    if (this.minDigits === this.minFractionDigits === 0) {
        this.minDigits = 1;
    }
    var innerPattern = posPattern;
    if (prefixEnd) {
        this.prefix = posPattern.substring(0, prefixEnd);
        innerPattern = innerPattern.substring(prefixEnd);
    }
    if (suffixStart < posPattern.length) {
        this.suffix = posPattern.substring(suffixStart);
        innerPattern = innerPattern.substring(0, suffixStart);
    }
    if (negPattern) {
        this.hasNegativePattern = true;
        var inner = negPattern.indexOf(innerPattern);
        if (inner === -1) {
            this.parseError("negative pattern doesn't contain identical number format");
        }
        if (inner !== 0) {
            this.negativePrefix = negPattern.substring(0, inner);
        }
        if (inner + innerPattern.length < negPattern.length) {
            this.negativeSuffix = negPattern.substring(inner + innerPattern.length);
        }
    }
    this.replaceCurrencies();
};

Aura.Utils.NumberFormat.ZERO = "0";

Aura.Utils.NumberFormat.prototype.parseError = function(s) {
    throw new Error("Invalid pattern: " + this.originalFormat + "\n" + s);
};

/**
 * Helper method to track special characters.
 * @private
 */
Aura.Utils.NumberFormat.prototype.checkForSpecialChar = function(c) {
    var mult;
    switch (c) {
    case "\u00a4":
        this.hasCurrency = true;
        break;
    case "%":
        mult = 2;
        break;
    case "\u2030":
        mult = 3;
        break;
    case "\u2031":
        mult = 4;
        break;
    }
    if (mult) {
        if (this.multiplier !== 0) {
            this.parseError("too many percentage symbols");
        } else {
            this.multiplier = mult;
        }
    }
};

/**
 * Replaces currency markers with the local currency symbol.
 * @private
 */
Aura.Utils.NumberFormat.prototype.replaceCurrencies = function() {
    if (this.hasCurrency) {
        this.prefix = this.replaceCurrency(this.prefix);
        this.suffix = this.replaceCurrency(this.suffix);
        this.negativePrefix = this.replaceCurrency(this.negativePrefix);
        this.negativeSuffix = this.replaceCurrency(this.negativeSuffix);
    }
};

/**
 * @private
 */
Aura.Utils.NumberFormat.prototype.replaceCurrency = function(str) {
    if (str) {
        return str.replace(/\u00a4\u00a4/g, this.symbols["currencyCode"]).replace(/\u00a4/g, this.symbols["currency"]);
    }
    return str;
};

/**
 * @private
 */
Aura.Utils.NumberFormat.prototype.translateDigits = function(charArray) {
    if (this.zeroCharCodeOffset) {
        for (var i = 0; i < charArray.length; i++) {
            charArray[i] = String.fromCharCode(charArray[i].charCodeAt(0) + this.zeroCharCodeOffset);
        }
    }
    return charArray;
};

/**
 * Format a number into a string. Accepts a string of the format "#.#"
 * for formatting numbers requiring greater than double precision.
 * @param {!Number|String} number The number to be formatted.
 * @export
 */
Aura.Utils.NumberFormat.prototype.format = function(number) {
    if ($A.util.isString(number)) {
        if (number.charAt(0) === "+") {
            number = number.substring(1);
        }
    } else if (!$A.util.isFiniteNumber(number)) {
        throw new Error('Unable to format. Not a valid number, "' + number + '"');
    } else {
        number = (+number).toString();
    }
    
    // If the number is in exponential format we need to normalize it
    // so it no longer has the exponential in it.
    if ((number.indexOf("e") > -1) || number.indexOf("E") > -1) {
        number = number.replace(/^(-)?(\d+)\.?(\d*)e([+\-]?\d+)$/i, function normalizeExponential (match, sign, integer, decimal, exponential) { // eslint-disable-line no-useless-escape
            exponential = Number(exponential);
            
            var isExpontnetialNegative  = (exponential < 0),
                normalizedIntegerLength = integer.length + exponential,
                length = (isExpontnetialNegative ? integer : decimal).length;
            
            exponential = Math.abs(exponential);
            exponential = (exponential >= length) ? (exponential - length + isExpontnetialNegative) : 0;

            var paddingZeros   = (new Array(exponential + 1)).join("0"),
                floatingNumber = isExpontnetialNegative ? (paddingZeros + (integer + decimal)) : ((integer + decimal) + paddingZeros);
            normalizedIntegerLength += (isExpontnetialNegative ? paddingZeros.length : 0);
            
            sign = (sign || "");
            return sign + floatingNumber.substr(0, normalizedIntegerLength) + (normalizedIntegerLength < floatingNumber.length ? ("." + floatingNumber.substr(normalizedIntegerLength)) : "");
        });
    }
    var charArray = number.split("");

    // check if its negative
    var negative = false;
    if (charArray[0] === "-") {
        negative = true;
        charArray.shift();
    }
    // find the decimal place and remove it
    var decimalPos = charArray.indexOf(".");
    if (decimalPos === -1) {
        decimalPos = charArray.length;
    } else {
        charArray.splice(decimalPos, 1);
    }
    // apply multiplier
    decimalPos += this.multiplier;
    while (decimalPos > charArray.length) {
        charArray.push(Aura.Utils.NumberFormat.ZERO);
    }

    // strip leading zeros off for numbers like 000.01
    while (charArray[0] === Aura.Utils.NumberFormat.ZERO) {
        charArray.shift();
        decimalPos--;
    }

    // round if needed using HALF_UP
    if (this.maxFractionDigits < charArray.length - decimalPos) {
        var rounderIndex = decimalPos + this.maxFractionDigits;
        // Modification from the original, if we remove a bunch of zeros from the
        // number, rounderIndex can be less than zero. This means we need to just ignore
        // the contents of our array, and make sure that we haven't walked out too far for our
        // min fraction digits.
        if (rounderIndex >= 0) {
            var round = charArray[rounderIndex] >= "5";
            charArray = charArray.slice(0, rounderIndex);
            while (round && rounderIndex > 0) {
                var c = charArray[--rounderIndex];
                if (c !== "9") {
                    charArray[rounderIndex] = String.fromCharCode(c.charCodeAt(0) + 1);
                    // done rounding
                    round = false;
                } else {
                    charArray[rounderIndex] = Aura.Utils.NumberFormat.ZERO;
                }
            }
            // might need an extra 1 at the beginning
            if (round) {
                charArray.unshift("1");
                decimalPos++;
            }
        } else {
            charArray=[];
            if (-decimalPos > this.minFractionDigits) {
                decimalPos = -this.minFractionDigits;
            }
        }
    }

    var prefix = this.prefix;
    var suffix = this.suffix;
    if (negative && this.hasNegativePattern) {
        prefix = this.negativePrefix;
        suffix = this.negativeSuffix;
    }
    var result = [];

    if (negative && !this.hasNegativePattern) {
        // if there is no negative pattern, append '-' for negative numbers
        result.push("-");
    }
    if (prefix) {
        result.push(prefix);
    }
    var zeroPad = this.minDigits - decimalPos;

    for (var i = 0; i < zeroPad; i++) {
        // too short, add 0s
        charArray.unshift(Aura.Utils.NumberFormat.ZERO);
        decimalPos++;
    }

    // format the integral part
    if (this.positiveGroupingDigits.length === 0 || decimalPos <= this.positiveGroupingDigits[0]) {
        // no need for grouping
        result = result.concat(this.translateDigits(charArray.slice(0, decimalPos)));
    } else {
        // Parsing charArray from decimalPos leftwards, so intermediate results prepends to intChars, and appended to result at the end
        var intChars = [];
        var parsedIndex = decimalPos;
        var groupIndex = 0;
        while (parsedIndex > 0) {
            var currentGroupingDigits = this.positiveGroupingDigits[groupIndex];
            if ((groupIndex + 1) < this.positiveGroupingDigits.length) {
                groupIndex++;
            }
            var nextParsedIndex = (parsedIndex - currentGroupingDigits) < 0 ? 0 : (parsedIndex - currentGroupingDigits);
            intChars = this.translateDigits(charArray.slice(nextParsedIndex, parsedIndex)).concat(intChars);
            if (nextParsedIndex > 0) {
                intChars.unshift(this.symbols["groupingSeparator"]);
            }
            parsedIndex = nextParsedIndex;
        }
        result = result.concat(intChars);
    }

    // format the fractional part
    var fracLength = charArray.length - decimalPos;
    if (fracLength > 0 || this.minFractionDigits > 0) {
        result.push(this.symbols["decimalSeparator"]);
        if (fracLength > 0) {
            result = result.concat(this.translateDigits(charArray.slice(decimalPos)));
        }
        for (i = fracLength; i < this.minFractionDigits; i++) {
            result.push(this.symbols["zeroDigit"]);
        }
        // removing trailing zeros when fraction length is longer than min fraction length.
        for (i = fracLength; i > this.minFractionDigits && result[result.length-1] === '0'; i--) {
            result.pop();
        }
        if (result[result.length - 1] === this.symbols["decimalSeparator"]) {
            result.pop();
        }
    }

    if (suffix) {
        result.push(suffix);
    }

    return result.join("");
};