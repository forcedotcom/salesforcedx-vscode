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
 * @description Creates a Model instance.
 * @constructor
 * @param {Object} def
 * @param {Object} data
 * @returns {Function}
 */
function Model(def, data){
    this.def=def;
    this.data=$A.util.apply({}, data, true, true);
    if(def){
        var members=def.getMembers();
        for(var i=0;i<members.length;i++){
            var name=members[i].getName();
            if(!this.data.hasOwnProperty(name)){
                this.data[name]=null;
            }
        }
    }
}

Model.prototype.get=function(key){
    var value = undefined;
    if (key.indexOf('.') < 0) {
        value = this.data[key];
    } else {
        value = aura.expressionService.resolve(key, this.data);
    }
    if (aura.util.isExpression(value)) {
        value = value.evaluate();
    }
    return value;
};

Model.prototype.set=function(key,value){
    var oldValue;
    var target=this.data;
    var step=key;
    if (key.indexOf('.') >= 0) {
        var path = key.split('.');
        target = aura.expressionService.resolve(path.slice(0, path.length - 1), target);
        $A.assert(target,"Model.set: unable to resolve '"+key+"'.");
        step=path[path.length-1];
    }
    oldValue = target[step];
    if (oldValue instanceof PropertyReferenceValue) {
        oldValue.set(value);
    } else {
        target[step]=value;
    }
};

Model.prototype.destroy = function(){
    for(var x in this.data){
        if(this.data.hasOwnProperty(x)){
            this.data[x]=undefined;
        }
    }
};

Aura.Model.Model = Model;