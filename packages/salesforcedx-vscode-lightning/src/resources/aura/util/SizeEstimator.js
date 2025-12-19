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
 * @description Provides operations to estimate size of JSON objects in memory.
 * @constructor
 */
var SizeEstimator = function SizeEstimator() {};

/*
 * Note on sizing.  The following values are taken from the ECMAScript specification, where available.
 * Other values are guessed.
 *
 * Source: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf
 */
SizeEstimator.CHARACTER_SIZE = 2;
SizeEstimator.NUMBER_SIZE    = 8;
SizeEstimator.BOOLEAN_SIZE   = 4; // This value is not defined by the spec.
SizeEstimator.POINTER_SIZE   = 8;

SizeEstimator.prototype.hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Estimates the size of a value.
 * @param {*} value the item to estimate
 * @return {Number} the estimated size of the item in bytes.
 */
SizeEstimator.prototype.estimateSize = function(value) {
    if (value === null || value === undefined) {
        return 0;
    }
    var type = typeof value;

    if (type === 'object') {
        try {
            return $A.util.json.encode(value).length;
        } catch (e) {
            $A.log("Error during size estimate, using 0: " + e);
            return 0;
        }
    }

    switch (type) {
        case 'string'  : return this.sizeOfString(value);
        case 'number'  : return SizeEstimator.NUMBER_SIZE;
        case 'boolean' : return SizeEstimator.BOOLEAN_SIZE;
        default : return SizeEstimator.POINTER_SIZE;
    }
};

SizeEstimator.prototype.sizeOfString = function(value) {
    return value.length * SizeEstimator.CHARACTER_SIZE;
};

Aura.Utils.SizeEstimator = SizeEstimator;