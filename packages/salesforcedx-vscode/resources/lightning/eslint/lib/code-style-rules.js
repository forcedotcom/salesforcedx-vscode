/*
 * Copyright (C) 2016 salesforce.com, inc.
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

 module.exports = {
    rules: {
        // code style rules, these are the default value, but the user can
        // customize them via --config in the linter by providing custom values
        // for each of these rules.
        "no-trailing-spaces": 1,
        "no-spaced-func": 1,
        "no-mixed-spaces-and-tabs": 0,
        "no-multi-spaces": 0,
        "no-multiple-empty-lines": 0,
        "no-lone-blocks": 1,
        "no-lonely-if": 1,
        "no-inline-comments": 0,
        "no-extra-parens": 0,
        "no-extra-semi": 1,
        "no-warning-comments": [0, { "terms": ["todo", "fixme", "xxx"], "location": "start" }],
        "block-scoped-var": 1,
        "brace-style": [1, "1tbs"],
        "camelcase": 1,
        "comma-dangle": [1, "never"],
        "comma-spacing": 1,
        "comma-style": 1,
        "complexity": [0, 11],
        "consistent-this": [0, "that"],
        "curly": [1, "all"],
        "eol-last": 0,
        "func-names": 0,
        "func-style": [0, "declaration"],
        "generator-star-spacing": 0,
        "indent": 0,
        "key-spacing": 0,
        "keyword-spacing": [0],
        "max-depth": [0, 4],
        "max-len": [0, 80, 4],
        "max-nested-callbacks": [0, 2],
        "max-params": [0, 3],
        "max-statements": [0, 10],
        "new-cap": 0,
        "newline-after-var": 0,
        "one-var": [0, "never"],
        "operator-assignment": [0, "always"],
        "padded-blocks": 0,
        "quote-props": 0,
        "quotes": 0,
        "semi": 1,
        "semi-spacing": [0, {"before": false, "after": true}],
        "sort-vars": 0,
        "space-after-function-name": [0, "never"],
        "space-before-blocks": [0, "always"],
        "space-before-function-paren": [0, "always"],
        "space-before-function-parentheses": [0, "always"],
        "space-in-brackets": [0, "never"],
        "space-in-parens": [0, "never"],
        "space-infix-ops": 0,
        "space-unary-ops": [1, { "words": true, "nonwords": false }],
        "spaced-comment": [0, "always"],
        "vars-on-top": 0,
        "valid-jsdoc": 0,
        "wrap-regex": 0,
        "yoda": [1, "never"]
    }
};
