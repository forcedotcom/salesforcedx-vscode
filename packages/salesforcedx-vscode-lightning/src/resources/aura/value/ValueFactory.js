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
 * creates the right value object based on whats passed in
 */
var valueFactory = {
    create: function create(valueConfig, component) {
        // Currently we only care about objects and strings.
        if(!valueConfig) {
            return valueConfig;
        }
        if (aura.util.isPlainObject(valueConfig)) {
            if (valueConfig["exprType"] === "PROPERTY") {
                var isGlobal=valueConfig["path"].charAt(0)==='$';
                if(valueConfig["byValue"]){
                    return (isGlobal?$A:component).get(valueConfig["path"]);
                }
                if(isGlobal) {
                    return $A.expressionService.getReference(valueConfig["path"],component);
                }else if($A.util.isComponent(component)){
                    return component.getReference(valueConfig["path"],component);
                }
                return new PropertyReferenceValue(valueConfig["path"], component);
            } else if (valueConfig["exprType"] === "FUNCTION") {
                return new FunctionCallValue(valueConfig, component);
            }else{
                // Recurse over child objects to create Actions, PropertyReferences, and FunctionCalls
                var childConfig={};
                for(var key in valueConfig){
                    childConfig[key]=valueFactory.create(valueConfig[key], component);
                }
                valueConfig=childConfig;
            }
        } else if (aura.util.isString(valueConfig) && valueConfig.charAt(0)==='{' && component) {
            if(valueConfig.charAt(1)==='!'||valueConfig.charAt(1)==='#'){
                //JBUCH: TODO: REMOVE THIS ELSEIF CLAUSE ONCE USES IN CORE ARE FIXED
                $A.log("Aura ValueFactory: String expressions are no longer supported.");
            }
        }
        return valueConfig;
    }

//#if {"modes" : ["STATS"]}
    ,nextId : -1,

    index : function(value) {
        if(!value){
            return;
        }

        var index = this.getIndex(value.toString());
        var id = this.nextId++;
        value.id = id;

        index[id] = value;
    },

    getIndex : function(type){
        var index = this.valueIndex;
        if(!index){
            index = {};
            this.valueIndex = index;
        }

        if(type){
            var typeIndex = index[type];
            if(!typeIndex){
                typeIndex = {};
                index[type] = typeIndex;
            }
            index = typeIndex;
        }

        return index;
    },

    clearIndex : function(){
        delete this.valueIndex;
    },

    deIndex : function(value) {
        var index = this.getIndex(value.toString());
        delete index[value.id];
    }
//#end
};

Aura.Value.ValueFactory  = valueFactory;