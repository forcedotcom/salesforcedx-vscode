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
 * @description Creates a new StyleDef instance, including the class name and descriptor.
 * @constructor
 * @param {Object} config
 */
function StyleDef(config){
    this.code = config[Json.ApplicationKey.CODE];
    this.className = config[Json.ApplicationKey.CLASSNAME];
    this.descriptor = new DefDescriptor(config[Json.ApplicationKey.DESCRIPTOR]);
    this.preloaded = $A.util.isUndefinedOrNull(this.code);
}

/**
 * Applies style to element. If this StyleDef's style has not been added to the DOM, add it to the DOM.
 */
StyleDef.prototype.apply = function(){
    var element = this.element;
    var code = this.code;
    if (!element && code) {
        element = aura.util.style.apply(code);
        this.element = element;
    }
    delete this.code;
};

StyleDef.prototype.remove = function(){
    //TODO
};

/**
 * Gets class name from the style definition.
 * @param {Object} className
 *
 */
StyleDef.prototype.getClassName = function(){
    return this.className;
};

/**
 * Returns a DefDescriptor object.
 *
 * @returns {DefDescriptor} A DefDescriptor object contains a prefix, namespace,
 *          and name.
 * @export
 */
StyleDef.prototype.getDescriptor = function() {
    return this.descriptor;
};

/**
 * Returns true if this def was preloaded into app.css, false if added via an individual <style> tag.
 */
StyleDef.prototype.isPreloaded = function() {
    return this.preloaded;
};

Aura.Style.StyleDef = StyleDef;