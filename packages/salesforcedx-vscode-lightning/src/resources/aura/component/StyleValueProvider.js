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
function StyleValueProvider(component) {
	this.component = component;
}

StyleValueProvider.prototype.get = function(key) {
    if (key === "name") {
        var styleDef = this.component.getDef().getStyleDef();
        return !$A.util.isUndefinedOrNull(styleDef) ? styleDef.getClassName() : null;
    }
};

Aura.Component.StyleValueProvider = StyleValueProvider;