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
 * @description The Aura Dev Tool Service, accessible using <code>$A.devToolServices</code>.
 * Use mostly in non-production modes.
 * @constructor
 * @protected
 */
var AuraDevToolService = function() {

    /**
     * Mostly used by select.
     *
     * @param reg
     * @returns {Array}
     * @private
     */

    function getParentNode(el) {
        var isShadowRoot = (el.nodeType === 11) && !!el.host;
        if (isShadowRoot) {
            return el.host;
        }
        return el.parentNode;
    }

    function flattenRegistry(reg){
        var ret = [];
        for(var k in reg){
            ret.push(reg[k]);
        }
        return ret;
    }

    /**
     * @constructor
     * @private
     */
    function Statement(){
        this.criteria = {};
    }

    /**
     * @constructor
     * @private
     */
    function ResultSet(config, privConfig){

        var priv = {};

        for(var k in config){
            this[k] = config[k];
        }
        for(var j in privConfig){
            priv[j] = privConfig[j];
        }
        this._priv = priv;
    }

    var s = {

        "views" : {
            "component" : function(){
                return flattenRegistry($A.services.component.indexes.globalId);
            },
            "componentDef" : function(){
                return flattenRegistry($A.services.component.componentDefRegistry);
            },
            "controllerDef" : function(){
                return flattenRegistry($A.services.component.controllerDefRegistry);
            },
            "modelDef" : function(){
                return flattenRegistry($A.services.component.modelDefRegistry);
            }
//#if {"modes" : ["STATS"]}
            ,
            "functionCallValue" : function(){
                return flattenRegistry(valueFactory.getIndex("FunctionCallValue"));
            },
            "passthroughValue" : function(){
                return flattenRegistry(valueFactory.getIndex("PassthroughValue"));
            },
            "PropertyReferenceValue" : function(){
                return flattenRegistry(valueFactory.getIndex("PropertyReferenceValue"));
            },
            "value" : function(){
                var ret = {};
                var index = valueFactory.getIndex();
                for(var i in index){
                    var subIndex = index[i];
                    for(var j in subIndex){
                        var value = subIndex[j];
                        ret[value.id] = value;
                    }
                }
                return flattenRegistry(ret);
            },
            "rerenderings" : function(){
                return $A.renderingService.statsIndex["rerenderDirty"];
            },

            "renderings": function() {
                var aggregate = [];
                var types = ["render", "afterRender", "rerender", "unrender"];

                for(var i = 0; i < types.length; i++) {
                    var type = types[i];
                    var stat = $A.renderingService.statsIndex[type];

                    for(var j = 0; j < stat.length; j++) {
                        stat[j].type = type;
                        aggregate.push(stat[j]);
                    }
                }
                return aggregate;
            },

            "event": function() {
                return Aura.Event.Event.prototype.statsIndex;
            }
//#end
        },

        "filters" : {
            "noop" : function(){
                return true;
            }
        },

        /**
         * Returns the number of filtered rows and groups.
         * @public
         * @param {Object} config
         */
        select : function(config){
            config = config || {};
            var view;
            var from = config["from"];
            if(from){
                view = this["views"][from];
                $A.assert(view, "Invalid view : "+from);
            }else{
                view = this.defaultView;
            }
            var fields = config["fields"] || this.defaultFields;
            var derivedFields = config["derivedFields"] || this.defaultDerivedFields;
            var filter = config["where"] || this.defaultFilter;

            if($A.util.isString(filter)){
                filter = new Function("row","with(row){return "+filter+";}");
            }

            for(var der in derivedFields){
                var derField = derivedFields[der];
                if($A.util.isString(derField)){
                    derivedFields[der] = new Function("row","with(row){return "+derField+";}");
                }
            }

            var groupBy = config["groupBy"] || this.defaultGroupBy;

            var rawRows = view();
            var rows = this.filterFields(fields, derivedFields, rawRows);
            rows = this.applyFilter(filter, rows, rawRows);
            var ret = this.applyGroupBy(groupBy, rows.rows, rows.rawRows);

            return ret;
        },

        applyGroupBy : function(groupBy, rows, rawRows){
            if(groupBy === undefined || groupBy === null){
                return new ResultSet({"rows" : rows, "rowCount" : rows.length},{"rawRows" : rawRows});
            }
            var ret = {};
            var groupCount = 0;
            for(var i=0;i<rows.length;i++){
                var row = rows[i];
                var key = row[groupBy];
                var group = ret[key];
                if(group === undefined){
                    group = [];
                    ret[key] = group;
                    groupCount++;
                }
                group.push(row);
            }
            return new ResultSet({"rowCount" : rows.length, "groupCount" : groupCount, "groups" : ret},{"rawRows" : rawRows, "rows" : rows});
        },

        filterFields : function(fields, derivedFields, rows){
            fields = $A.util.trim(fields);
            if(fields === this.defaultFields && derivedFields === this.defaultDerivedFields){
                return rows;
            }

            if(fields === this.defaultFields){
                fields = [];
            }

            if(!$A.util.isArray(fields)){
                var fieldSplit = fields.split(",");
                fields = [];
                for(var k=0;k<fieldSplit.length;k++){
                    var field = $A.util.trim(fieldSplit[k]);
                    var fieldConfig = {};
                    fields[k] = fieldConfig;
                    var splitField = field.match(/^(\S+)(?: as (\w+))?$/i);
                    fieldConfig.alias = splitField[2] || field;
                    fieldConfig.name = splitField[1].split(".");
                }
            }

            var ret = [];
            for(var j=0;j<rows.length;j++){
                var row = rows[j];
                if(row){
                    var newRow = {};
                    for(var i=0;i<fields.length;i++){
                        newRow[fields[i].alias] = this.processField(row, fields[i].name, 0);
                    }

                    var uberRow = {};
                    $A.util.apply(uberRow, row, true);
                    $A.util.apply(uberRow, newRow, true);
                    for(var key in derivedFields){
                        var derivedField = derivedFields[key];
                        var val = derivedField(uberRow);
                        newRow[key] = val;
                    }

                    ret.push(newRow);
                }
            }
            return ret;
        },

        processField : function(root, fields, place){
            var field = fields[place];
            var val;


            val = root[field];

            if(val === undefined){
                var func = root["get"+this.initCap(field)];
                if(func === undefined){
                    func = root["is"+this.initCap(field)];
                }
                if(func !== undefined){
                    val = func.call(root);
                }else{
                    //JBUCH: HALO: TODO: INVESTIGATE AND REPLACE
                    if(root.getValue){
                        var f = "";
                        for(var i=place;i<fields.length;i++){
                            if(i !== place){
                                f += ".";
                            }
                            f += fields[i];
                        }
                        place = i;
                        //JBUCH: HALO: TODO: INVESTIGATE AND REPLACE
                        val = root.getValue(f);
                    }
                }
            }else if($A.util.isFunction(val)){
                val = val.call(root);
            }
            place++;
            if(val !== undefined &&  fields.length > place){
                val = this.processField(val, fields, place);
            }
            return val;
        },

        initCap : function(str) {
             return str.substring(0,1).toUpperCase() + str.substring(1,str.length);

        },

        applyFilter : function(filter, rows, rawRows){
            var ret = [];
            var rawRet = [];
            for(var i=0;i<rows.length;i++){
                var row = rows[i];
                var rawRow = rawRows[i];
                if(filter(row, rawRow)){
                    ret.push(row);
                    rawRet.push(rawRow);
                }
            }
            return {rows : ret, rawRows : rawRet};
        },

        newStatement : function(){
            return new Statement();
        },

        output : function(cmp) {
            return cmp.toJSON();
        },
        accessibilityAide:{

            /**
             * @param array       - the array that we are going add elements to
             * @param nodeList    - array of elements that are needed to be turned into an array of objects
             * @param activeClass - class of where the active element is (null if on the current tag, non null if on a child)
             */
            nodeListToObjectArray : function(array, nodeList, activeClass){
            	var node;
            	for(var i = 0; i < nodeList.length; i++){
            		node =  nodeList[i];
            		if($A.util.isUndefinedOrNull(activeClass)){
            			 array.push({
            				"activeElm" : node
            			 });
            		 }
            		 else{
            			 array.push({
             				"activeElm" : node,
             				"ariaHidden" : node.querySelectorAll(activeClass)[0]
             			 });
            		 }

            	 }

            },

            /**
             * @param panels - the panels that we are going to look at (panelSlide, forcePanel, etc. Items that can basically be set to active)
             * @param topPanelsCount the panels that could take over the page
             * @return all errors that are found
             */
            findTopLevelErrors : function(panels, topPanelsCount, elementsCovered){
                var errorArray = [];
                var activePanel = null;
                var panelObj = null;
                var hiddenValue = "";

                for(var i = 0; i< panels.length; i++){
                    panelObj = panels[i];
                    activePanel = panelObj["activeElm"];
                    var panelWithAriaHidden;

                    if(panelObj.hasOwnProperty("ariaHidden")){
                        panelWithAriaHidden = panelObj["ariaHidden"];
                    }
                    else{
                        panelWithAriaHidden = panelObj["activeElm"];
                    }

                    hiddenValue = $A.util.getElementAttributeValue(panelWithAriaHidden, "aria-hidden");
                    //Panel is not the top element
                    if($A.util.hasClass(activePanel, "panelSlide")){
                        //If there is a top element, make sure that it has its aria-hidden attribute set to true
                        if(topPanelsCount > 0){
                            if($A.util.isEmpty(hiddenValue) || (hiddenValue.toLowerCase().indexOf("false") > -1)){
                                errorArray.push(activePanel);
                            }
                        }
                        else{
                            //Otherwise, the panel should have the correct
                            if(!$A.util.isUndefinedOrNull(hiddenValue) && (hiddenValue.toLowerCase().indexOf("true") > -1)){
                                errorArray.push(activePanel);
                            }
                        }
                    }
                    //Panel is the top element
                    //Class 'slideIn' is to accommodate panelSliders which no longer have an 'active' class attached to the top element
                    else{
                        if($A.util.hasClass(activePanel, "active") || $A.util.hasClass(activePanel, "slideIn")){
                            if(!$A.util.isUndefinedOrNull(hiddenValue) && (hiddenValue.toLowerCase().indexOf("true") > -1)){
                                errorArray.push(activePanel);
                            }
                        }
                        else{
                        	var hiddenValueParent = $A.util.getElementAttributeValue(activePanel, "aria-hidden");
                        	if(elementsCovered && ($A.util.isEmpty(hiddenValueParent) || (hiddenValueParent.toLowerCase().indexOf("false") > -1))){
                        		 errorArray.push(activePanel);
                        	}
                        	else if(!elementsCovered && ($A.util.isEmpty(hiddenValue) || (hiddenValue.toLowerCase().indexOf("false") > -1))){
                        		errorArray.push(activePanel);
                            }
                        }
                    }
                }

                return errorArray;
            },

            /**
             * Helper functions that returns an error array when ever an inputDefaultError that is not associated with an ID is used
             * @param   uls          - all of the ULs on the page
             * @param   inputTags    - all of the input tags that can be associated with the inputDefaultError
             * @param   selectTags   - all of the select tags that can be associated with the inputDefaultError
             * @param   textAreaTags - all of the textAreaTags tags that can be associated with the inputDefaultError
             * @returns array        - error array,
             */
             inputDefaultErrorAide : function(uls, inputTags, selectTags, textAreaTags) {
                  var ul  = null;
                  var elmntAtrib = "";
                  var errorArray = [];

                  var accessAideFuncs = aura.devToolService.accessibilityAide;
                  for(var i = 0; i< uls.length; i++){
                      ul = uls[i];
                      elmntAtrib = $A.util.getElementAttributeValue(ul ,"class");

                      if(!$A.util.isUndefinedOrNull(elmntAtrib) && elmntAtrib.indexOf("uiInputDefaultError") > -1){
                          elmntAtrib = $A.util.getElementAttributeValue(ul ,"id");

                          //As long as a select, inputTag or textArea have the value we are looking for set we pass
                          if(!(accessAideFuncs.findMatchingId(elmntAtrib, inputTags, "aria-describedby")    ||
                                  accessAideFuncs.findMatchingId(elmntAtrib, selectTags, "aria-describedby") ||
                                  accessAideFuncs.findMatchingId(elmntAtrib, textAreaTags, "aria-describedby"))){
                              errorArray.push(ul);
                          }
                      }
                  }

                  return errorArray;
                  },
                /**
                 * Helper function that will return true if the two values equal each other
                 * @param   id             - value that we are expecting
                 * @param   tags           - tags to iterate through
                 * @param   attribute2find - attribute that we want to extract from the ID
                 * @returns boolean    - true signifies that it was found
                 */
             findMatchingId : function (id, tags, attribute2find){
                 var tagIds = null;
                 for(var i = 0; i<tags.length; i++){
                     tagIds = $A.util.getElementAttributeValue(tags[i], attribute2find);

                     if(!$A.util.isUndefinedOrNull(tagIds)){
                    	 tagIds = tagIds.trim().split(/\s+/);
                    	 for(var j = 0; j < tagIds.length; j++){
	                    	 if(tagIds[j].indexOf(id) === 0){
	                             return true;
	                         }
                    	 }
                     }

                 }
                 return false;
             },
            /**
             * Helper function that will return true if the two values equal each other
             * @param   attribute  - Contents of the attribute that we want to look at
             * @param   val        - What we want to compare the attribute to
             * @returns boolean    - Signifies whether or not they are equal
             */
            doesContain : function(attribute, val){
                 return attribute === val;
            },
            /**
             * Helper function that tells us whether something is in the dict or not
             * @param   attribute  - Contents of the attribute that we want to look at
             * @param   dict       - list of items that attribute should be equal to
             * @returns boolean    - returns true if attribute value is not dict
             */
            doesNotContain : function(attribute, dict){
                  return !(attribute in dict);
            },

            /**
             * Goes up the tree (until it reaches the body tag) and finds whether the initial tag param is in another sent up tag
             * @param   tag           - The starting tag that we are going to use to go up the tree
             * @param   parentTagName - Name of the tag that we should find should the the starting tags parent
             * @returns boolean       - Signifies whether or not the tag we want was found or not (found: true, else: false)
             */
            checkParentMatchesTag : function(tag, parentTagName) {
                while (tag.tagName !== "BODY") {
                    if (tag.tagName && tag.tagName.toUpperCase() === parentTagName) {
                        return true;
                    }
                    tag = getParentNode(tag);
                }
                return false;
            },

            /**
             * Function that goes through all labels and turns the for attribute into a key
             * @param   labels    - All the labels that we want to go through
             * @param   attribute - The attribute that is being sought (for, id, title, etc)
             * @returns dictionary  - Mapping of for atrib value to booleans
             */
            getDictFromTags : function(labels, attribute){
                var atrib = null;
                var dict = {};
                if($A.util.isUndefinedOrNull(labels)){
                   return dict;
                }

                for(var j =0; j<labels.length; j++){
                    atrib = $A.util.getElementAttributeValue(labels[j], attribute);
                    if(!$A.util.isEmpty(atrib)){
                       dict[atrib] = true;
                    }
                 }
                 return dict;
            },

            /**
             * Function that goes through all Image tags, makes sure it is set, then checks the alt tag
             * @param   imgErrorMsg                - Default error message telling user why they should set alt tag
             */
            findAllImgTags:function (allImgTags, imgErrorMsg){
        	 var accessAideFuncs = aura.devToolService.accessibilityAide;

        	 var data_aura_rendered_by = "";
        	 var errorArray = [];
        	 var imgType = "";
        	 var alt = "";

        	 for(var index = 0; index < allImgTags.length; index++){
        	     data_aura_rendered_by = $A.util.getElementAttributeValue(allImgTags[index], "data-aura-rendered-by");
        	     imgType = null;
        	     alt = null;

        	   // Checking for the data_aura_rendered_by attribute
         	   if(!$A.util.isEmpty(data_aura_rendered_by)){
                   var component = $A.getCmp(data_aura_rendered_by);
                   if(!$A.util.isUndefinedOrNull(component) && !$A.util.isComponent(component)){
                	   // This is to account for <img/> created both dynamically by image.cmp as well as the ones
                       // that are within a .cmp and are therefore created by aura through the html.cmp template.
                       // we can skip ui:button images, they're hardcoded
                       if(!component.isInstanceOf("ui:image")){
                           component=component.getAttributeValueProvider();
                       }
                       if(!component.isInstanceOf("ui:image")){
                           // We can't check non ui:image tags
                           continue;
                       }
                       imgType = component.get('v.imageType');
                       alt     = component.get('v.alt');
                   }

         	    }

         	     //Checking for injected image tag
     		     if($A.util.isUndefinedOrNull(imgType)){
     		    	  //Need to use the dom version so that it will return null if element is not present
     		    	  var htmlAlt = allImgTags[index].getAttribute("alt");
     		          if(!$A.util.isUndefinedOrNull(htmlAlt)){
     		        	  htmlAlt = htmlAlt.toLowerCase().replace(/[\s\t\r\n]/g,'');
     		        	  if(htmlAlt !=="undefined" && htmlAlt !=="null" && htmlAlt !=="empty"){
     		        	     continue;
     		        	  }
     		          }

     		          errorArray.push(allImgTags[index]);
     		      }else {
     		    	 if($A.util.isUndefinedOrNull(alt)){
        		          alt="";
        		      }

        		      alt = alt.toLowerCase().replace(/[\s\t\r\n]/g,'');

        		      if(alt==="undefined" || alt==="null" || alt ==="empty"){
        		    	  errorArray.push(allImgTags[index]);
        		      }
        		      else if(imgType === "informational" &&  alt === ""){
        		    	  errorArray.push(allImgTags[index]);
        		      }
        		      else if(imgType === "decorative" && alt !== ""){
        		    	  errorArray.push(allImgTags[index]);
        		      }
     		     }
        	 }

        	 return accessAideFuncs.formatOutput(imgErrorMsg, errorArray);
            },

            /**
             * Function that checks all descendants of an element for a matching tag and retrieves the specified property
             * from the first encountered element - May need refactoring
             *
             * @param element - element whose descendants to check
             * @param property - the property to retrieve from the child element
             * @param childTag - the tag to match with the child elements
             * @returns property - property to be retrieved or null if property does not exist
             */
            getPropertyFromDescendantTag : function (element, property, childTag) {
            	if(!$A.util.isUndefinedOrNull(element)) {
            		var matchingChildren = element.getElementsByTagName(childTag);
            		//if(!$A.util.isEmpty(matchingChildren)) {
            		if(matchingChildren.length > 0) {
            			return $A.util.getElementAttributeValue(matchingChildren[0], property) ||
            				   $A.util.getElementAttributeValue(matchingChildren[0], "data-aura-rendered-by");
            		}
            	}
            	return null;
            },

            /**
             * Function that goes through all the labels and checks that they are associated with an input through the 'for' attribute
             * or that they have a child input tag.
             *
             * @param lbls          -  All the labels to go over
             * @returns errorArray  -  Returns all the erroneous labels
             */
            matchLabelToInput : function(lbls) {

            	var errorArray = [];
            	var atrib = null;
            	var isParent = false;
            	var dict = {};
            	var inputID = null;
                var label = null;
            	var accessAideFuncs = aura.devToolService.accessibilityAide;

            	 for(var i = 0; i < lbls.length; i++){
            		 label = lbls[i];
                     atrib = $A.util.getElementAttributeValue(label, "for");
                     isParent = (accessAideFuncs.getPropertyFromDescendantTag(label, "id", "INPUT") ||
                 		 		 accessAideFuncs.getPropertyFromDescendantTag(label, "id", "TEXTAREA") ||
                 		 		 accessAideFuncs.getPropertyFromDescendantTag(label, "id", "SELECT"));

                     // if label is not associated through a 'for' and is not a parent of an input - ERROR
                     if($A.util.isEmpty(atrib) && (!isParent)) {
                    	 errorArray.push(label);
                     }

                     // if label is associated to an input,
                     // check if multiple labels are associated to a single input
                     else
                     {
                        inputID = atrib || isParent;
                         if($A.util.isUndefinedOrNull(dict[inputID])){
                             dict[inputID] = label;
                         }
                         // if this inputID has already been encountered and
                         // if it is not the same label to input mapping, then mark as an error tag
                         else if($A.util.getElementAttributeValue(dict[inputID], "data-aura-rendered-by") !==
                        	 	 $A.util.getElementAttributeValue(label, "data-aura-rendered-by")){
                             errorArray.push(dict[inputID]);
                             errorArray.push(label);
                         }
                     }

                     // Get the element that label's 'for' points to
                     // Element's id must match the for attribute value and check if its tag is an input
                     if(!$A.util.isEmpty(atrib)) {
                    	var inputElem = document.getElementById(atrib);
                        if(($A.util.isUndefinedOrNull(inputElem)) || (inputElem.tagName !== "INPUT" && inputElem.tagName !== "TEXTAREA" && inputElem.tagName !== "SELECT")){
                        	errorArray.push(label);
                        }
                     }
                  }

            	return errorArray;
            },

            /**
             * Function that goes through all labels and check for either the for attribute and the label id, or if a parent tag is a label
             * This function skips over several input types: submit, reset, image, hidden, and button. All of these have labels associated
             * with them in different ways
             *
             * @param   lbls       - All of the labels to
             * @param   inputTags  - The attribute that is being sought (for, id, title, etc)
             * @returns array     - All erroneous tags
             */
            inputLabelAide : function(lbls, inputTags){
                var errorArray = [];
                var lblIsPres  = true;
                var inputTag   = null;
                var type       = null;
                var inputTypes = "hidden button submit reset";
                var accessAideFuncs = aura.devToolService.accessibilityAide;

                var lblDict = accessAideFuncs.getDictFromTags(lbls, "for");

                for (var index = 0; index < inputTags.length; index++){
                    inputTag = inputTags[index];
                    type = $A.util.getElementAttributeValue(inputTag, "type");

                    if(!$A.util.isEmpty(type) && inputTypes.indexOf(type)> -1){
                        continue;
                    }
                    else if (type === "image"){
                        var alt = $A.util.getElementAttributeValue(inputTag, "alt");
                        if($A.util.isEmpty(alt) || alt.replace(/[\s\t\r\n]/g,'') === ""){
                            errorArray.push(inputTag);
                        }
                    }
                    else{
                        lblIsPres = ((inputTag.id in lblDict) || (accessAideFuncs.checkParentMatchesTag(inputTag, "LABEL")));

                        if(!lblIsPres){

                        	// W-2812697: Allowing aria-label for an <input> if it exists inside a <th>
                        	if(inputTag.tagName === "INPUT" && type === "range") {
                        		var ariaLbl = $A.util.getElementAttributeValue(inputTag, "aria-label");
                        		var parent = accessAideFuncs.checkParentMatchesTag(inputTag, "TH");
                        		if($A.util.isEmpty(ariaLbl) || parent === false) {
                        			errorArray.push(inputTag);
                        		}
                        	}
                        	else {
                        		errorArray.push(inputTag);
                        	}
                        }
                    }
                 }
                 return errorArray;
            },

            /**
             * Function that goes finds all given tags and makes sure that they all have an attribute set
             * @param   tags   - Name of the tag to find all instances of
             * @param   attribute - The attribute that is being sought (for, id, title, etc)
             * @param   errorVal  - Value that this attribute should not be set to
             * @param   evalFunc  - Function to evaluate whether or not attribute is valid
             * @returns array    - All erroneous tags
             */
            checkForAttrib : function(tags, attribute, errorVal, evalFunc){
                var errorArray = [];
                var atrib ="";

                for(var i=0; i<tags.length; i++){
                    atrib = $A.util.getElementAttributeValue(tags[i], attribute);
                    if($A.util.isEmpty(atrib) || evalFunc(atrib.toLowerCase(), errorVal)){
                        errorArray.push(tags[i]);
                    }
                }
                return errorArray;
            },

            /**
             * This method grabs all attributes of a tag and turns them into strings
             * @param   attribs - All of the attributes in a tag
             * @returns string - String value of all of the tag attributes
             */
            attribStringVal : function(attribs){
                if($A.util.isUndefinedOrNull(attribs)){
                    return "No data found";
                }

                var strAttrib ="";
                var attrib=null;

                for(var i = 0; i<attribs.length; i++){
                    attrib = attribs.item(i);
                    strAttrib = strAttrib + " " +attrib.nodeName+ "=\""+attrib.value+"\"";
                }
                return strAttrib;
            },
            /**
             * Method that looks at the given tag and will look print out the next two parents components names
             * @param   tag     - The initial tag to find the parents of
             * @returns String  - The string representation of the the cmp stack trace
             */
            getStackTrace : function(tag){
            	var cmp = null;
                var cmpInfo = {};
                var cmpNameList = "";
                var cmpName = "";

                //Keep going up until we hit the either the BODY or HTML tag
                while(!$A.util.isUndefinedOrNull(tag) && $A.util.isString(tag.tagName) && tag.tagName.toLowerCase() !== "body" && tag.tagName.toLowerCase() !== "html"){
                    var data_aura_rendered_by = $A.util.getElementAttributeValue(tag, "data-aura-rendered-by");

                    //Make sure it has a rendered by value
                    if(!$A.util.isEmpty(data_aura_rendered_by)){
                         cmp = $A.getCmp(data_aura_rendered_by);
                         if(!$A.util.isUndefinedOrNull(cmp)){
                        	 cmp = cmp.getAttributeValueProvider();
                             //Cannot query cmp.getName() in case of PassthroughValue.
                             if(typeof cmp.getName !== "function"){
                                 cmp = cmp.getDef().getDescriptor().getFullName();
                             }else{
                                 cmpName = cmp.getType();
                             }
                             //Making sure that we have unique components
                             if(!(cmpName in cmpInfo)){
                                 cmpInfo[cmpName] = "";
                                 cmpNameList = cmpNameList +"    by "+ cmpName +"\n";
                             }
                         }
                     }
                     tag = getParentNode(tag);
                 }

                 return cmpNameList;
            },

            /**
             * Method grabs everything from the given array and prints out the error and the tag(s) that are the issue
             * @param   tagError - The error message for the given tag
             * @param   errArray - The array of errors
             * @returns String - Either the empty string or a string representation of the error
             */
            formatOutput : function(tagError, errArray){
            	 if(errArray.length === 0){
                     return "";
                 }

                 var len = errArray.length;
                 var nodeName = "";
                 var elm = null;
                 var errStr = tagError+"\n";
                 var accessAideFuncs = aura.devToolService.accessibilityAide;

                 for(var i = 0; i<len; i++){
                 	elm = errArray[i];
                     nodeName = elm.nodeName.toLowerCase();

                     errStr = errStr+"  Error Tag: <"+nodeName+""+accessAideFuncs.attribStringVal(elm.attributes)+">...</"+nodeName+">\n";
                     errStr = errStr+"  Stack Trace: error tag is rendered\n" + accessAideFuncs.getStackTrace(elm)+"\n";
                 }

                 return errStr;
            },
            /**
             * Method looks at the given tags title, and makes sure that it is not the empty string
             * @param   hd - The head tag
             * @returns Array - Returns an array of all erroneous values
             */
            checkHeadHasCorrectTitle : function(hdErrMsg, hd){
                var title = hd.getElementsByTagName("title")[0];
                var errArray = [];
                if($A.util.isUndefinedOrNull(title) || $A.util.getText(title) === ""){
                   errArray.push(hd);
                }
                return errArray;
            },
            /**
             * Method looks at the given anchors img (if it exists) and checks to see if it has an img atrib
             * @param   anchor  - The anchor in question
             * @returns Boolean - Returns whether a valid img alt was found
             */
            anchrDoesNotHaveImgWithAlt : function(anchor){
                var imgs = anchor.getElementsByTagName("img");
                var alt = "";

                for(var i =0; i<imgs.length; i++){
                    alt = $A.util.getElementAttributeValue(imgs[i], "alt");

                    if(!$A.util.isEmpty(alt) && alt.replace(/[\s\t\r\n]/g,'') !== ""){
                       return false;
                    }
                }
                return true;
            },

            /**
             * Method looks at the given arrays for anchor statements that are the empty string
             * @param   anchors - The anchor tags in the document
             * @returns Array - Returns an array of all erroneous values
             */
             checkAnchorHasInnerText : function (anchors){
                var errArray = [];
                var anchor = null;
                var text = "";
                var accessAideFuncs = $A.devToolService.accessibilityAide;

                for(var index = 0; index<anchors.length; index++){
                    anchor = anchors[index];

                    //Text should not be undefined or null at any point since $A.test.getText will always return something
                    text = $A.util.getText(anchor).replace(/[\s\t\r\n]/g,'');
                    if(text === "" && accessAideFuncs.anchrDoesNotHaveImgWithAlt(anchor)){
                         errArray.push(anchor);
                    }
                }
                return errArray;
            },
            /**
             * Method grabs everything from the given array and finds all tags that are erroneous
             * @param   inputTags - radio and checkbox inputs
             * @returns array     - Array of all errors that have been found
             */
             radioButtonAide : function(inputTags){
                 var errorArray = [];
                 var inputTag = null;
                 var inputType = "";
                 var rcName = "";
                 var dict = {};
                 var tmpArray = [];
                 var accessAideFuncs = aura.devToolService.accessibilityAide;

                 for(var i =0; i<inputTags.length; i++){
                    inputTag = inputTags[i];
                    inputType = $A.util.getElementAttributeValue(inputTag, 'type').toLowerCase();

                    if(inputType === "radio" || inputType === "checkbox"){
                        rcName = $A.util.getElementAttributeValue(inputTag, 'name');
                        if($A.util.isEmpty(rcName)){
                            continue;
                        }

                        if(!(rcName in dict) ){
                            dict[""+rcName] = [];
                        }

                        dict[rcName].push(inputTag);
                    }
                }

                for(rcName in dict){
                    tmpArray = dict[rcName];
                        if(tmpArray.length >= 2){
                            for(var index = 0; index<tmpArray.length; index++){
                                if(!accessAideFuncs.checkParentMatchesTag(tmpArray[index], "FIELDSET")){
                                    errorArray.push(tmpArray[index]);
                                }
                            }
                        }
                }

                return errorArray;
             },
             /**
              * Method that takes in a list of buttons and makes sure that they all have some text associated with them in the labels
              * @param   buttons     - All buttons that are on the page
              * @returns Array    - Array of all the errors
              */
              buttonLabelAide : function(buttons){
                  var errorArray = [];
                  var button = null;
                  var buttonImage = null;
                  var testText = null;
                  for(var i = 0; i<buttons.length; i++){
                      button = buttons[i];
                      if(!$A.util.isUndefinedOrNull(button)){

                          buttonImage = button.getElementsByTagName("img");
                          if(buttonImage.length === 0){
                             testText = $A.util.getText(button).replace(/[\s\t\r\n]/g, '');

                             if(testText === ''){
                                 errorArray.push(button);
                             }
                          }
                     }
                  }
                  return errorArray;
               },

               /**
                * Method that takes in a list of buttons and makes sure that they do not have any duplicate text in them
                * @param   - All buttons that are on the page
                * @returns - Array of all the errors
                */
               buttonDuplicateTextAide : function(buttons) {
            	   var errorArray = [];
            	   var button = null;
            	   var text = null;
            	   var dict = {};
        		   var descendants = null;
        		   var descendant = null;
            	   for(var i = 0; i < buttons.length; i++) {
            		   dict = [];
            		   button = buttons[i];
            		   descendants = button.childNodes;
            		   for(var j = 0; j < descendants.length; j++) {
            			   text = null;
            			   descendant = descendants[j];
            			   text = $A.util.getText(descendant);
            			   if(descendant.tagName ===  "IMG") {
            				   text = descendant.getAttribute("alt");
            			   }
            			   text = text.toLowerCase().trim();

            			   if(text !== "") {
            				   if(dict.indexOf(text) >= 0) {
                				   errorArray.push(button);
                			   }
                			   else {
                				   dict.push(text);
                			   }
            			   }
            		   }
            	   }
            	   return errorArray;
               },

               /**
                * Method that goes through all tables present on the page and makes sure the tags underneath them have either an id or scope associated with them
                * @param   tables        - The tags to find
                * @returns Array         - The error array
                */
                checkTables : function(tables){
                    var headerDict = {};
                    var ths = [];
                    var scopeVal = "";
                    var idVals = "";
                    var errorArray = [];
                    var i = 0, j = 0;
                    var skipTDCheck = false;
                    var validScopes = {'row': false, 'col': false, 'rowgroup': false, 'colgroup' : false};
                    for(var index = 0; index<tables.length; index++){
                        ths = tables[index].getElementsByTagName("th");
                        //Reset Variables
                        headerDict = {};
                        skipTDCheck = false;

                         //If we have no headers, tds wont be a problem
                         if(ths.length === 0){
                            continue;
                         }

                         //Phase 1:  If all <th> within a <table> contain scope attribute and scope attribute value is one of col, row, colgroup, rowgroup, then pass test.
                         for(i = 0; i<ths.length; i++){
                             //Grab scope
                             scopeVal = $A.util.getElementAttributeValue(ths[i], "scope");
                             idVals = $A.util.getElementAttributeValue(ths[i], "id");
                             //If Scope exists
                             if(!$A.util.isEmpty(scopeVal)){
                                 if(!(scopeVal in validScopes) || $A.util.trim(scopeVal) === ""){
                                    errorArray.push(ths[i]);
                                 }

                                 skipTDCheck = true;
                             }
                             else if(!$A.util.isEmpty(idVals)){
                                 headerDict[idVals] = true;
                             }
                             else{
                                 errorArray.push(ths[i]);
                             }
                         }

                         //If we have already found an error with the THS (either they don't have an ID or they don't have a scope) skip the rest
                         if(!$A.util.isEmpty(errorArray) || skipTDCheck){
                             continue;
                         }


                         //Phase 2: If all <th> within a <table> contain "id" and all <td> contain "headers" attribute, and each id listed in header attribute matches id attribute of a <th>, then pass test.
                         var tds = tables[index].getElementsByTagName("td");

                         //Don't need this I believe
                         if(tds.length === 0){
                             continue;
                         }
                         for(i = 0; i<tds.length; i++){
                             idVals = $A.util.getElementAttributeValue(tds[i], "headers");
                             if($A.util.isEmpty(idVals)){
                                errorArray.push(tds[i]);
                                continue;
                             }

                             idVals = $A.util.trim(idVals).split(/\s+/);
                             for(j = 0; j<idVals.length; j++){
                                if(!(idVals[j] in headerDict)){
                                   errorArray.push(tds[i]);
                                   break;
                                }
                             }
                         }
                     }
                     return errorArray;
                 },
                 /**
                  * Method that takes in a list of h#, the tag that show follow directly after, and all possible items that can be found.
                  * It will start start searching through siblings of h# to find invalid-nested tags and return an error array with them if found
                  * @param   tags     - Array of all h# tags to look at
                  * @param   nextTag  - String representation of the very next tag that we should see.
                  *             i.e. if tags contains all h1 tags, nextTag should be "h2"
                  * @param   allHdrs  - Dictionary of all possible h# we can see.
                  *                i.e. if tags is a list of all h1 tags in the document, then allHdrs will be a dictionary
                  *                of h2-h6.
                  * @returns Array    - Array of all the errors
                  */
                 findNextHeader : function(tags, nextTag, allHdrs){
                     var errorArray = [];
                     var children = [];
                     var child = null;
                     var currTag;
                     var startLooking = false;

                     for(var index = 0; index< tags.length; index++){
                        
                        children = getParentNode(tags[index]).children;
                        currTag = "";
                        startLooking = false;

                        if($A.util.isUndefinedOrNull(children)){
                            continue;
                        }

                        for(var childIndex = 0; childIndex < children.length; childIndex++){
                            child = children[childIndex];

                            if(tags[index] === child){
                               startLooking = true;
                            }

                            if(startLooking){
                                currTag = child.tagName.toLowerCase();

                                if(currTag in allHdrs){
                                    if(currTag !== nextTag){
                                        errorArray.push(child);
                                    }
                                    break;
                                }
                             }
                         }
                     }

                     return errorArray;
                 }
        },
        verifyAccessibility : {
        	/**
             * Check making sure that all images have an alt attribute present
             * @returns String - Returns a string representation of the errors
             */
            checkImagesHaveAlts : {
         	    "tag"  : "A11Y_DOM_01",
         	    "func" : function(domElem){
            	    var imgError = "[A11Y_DOM_01] All image tags require the presence of the alt attribute.\n  More info http://sfdc.co/a11y_dom_01";

            	    var allImgTags = domElem.getElementsByTagName("img");
           		    return aura.devToolService.accessibilityAide.findAllImgTags(allImgTags, imgError);
            	}
            },

        	/**
             * Check making sure all inputs have an associated label
             * @returns String - Returns a string representation of the errors
             */
            checkInputsHaveLabel : {
                "tag"  : "A11Y_DOM_02",
                "func" : function(domElem) {
                     var inputLabelMsg   = "[A11Y_DOM_02] An input was found without an associated label. All inputs must be identified by a label.\n  More info http://sfdc.co/a11y_dom_02";
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var inputTextTags   = domElem.getElementsByTagName('input');
                     var textAreaTags    = domElem.getElementsByTagName('textarea');
                     var selectTags      = domElem.getElementsByTagName('select');
                     var lbls = domElem.getElementsByTagName("LABEL");
                     var errorArray = [];

                     errorArray = errorArray.concat(accessAideFuncs.inputLabelAide(lbls, inputTextTags));
                     errorArray = errorArray.concat(accessAideFuncs.inputLabelAide(lbls, textAreaTags));
                     errorArray = errorArray.concat(accessAideFuncs.inputLabelAide(lbls, selectTags));
                     return accessAideFuncs.formatOutput(inputLabelMsg, errorArray);
                 }
            },

            /**
             * Check making sure all buttons have non empty label
             * @returns String - Returns a string representation of the errors
             */
            checkButtonHaveLabel : {
                "tag"  : "A11Y_DOM_03",
                "func" : function(domElem){
                    var buttonLabelErrorMsg = "[A11Y_DOM_03] Buttons must have non-empty text labels.\n  More info http://sfdc.co/a11y_dom_03";
                    var errorArray = [];
                    var accessAideFuncs = aura.devToolService.accessibilityAide;
                    var buttonTags = domElem.getElementsByTagName('button');

                    errorArray = errorArray.concat(accessAideFuncs.buttonLabelAide(buttonTags));
                    return accessAideFuncs.formatOutput(buttonLabelErrorMsg, errorArray);
               }
            },

            /**
             * Check making sure that all anchors have text associated with them
             * @returns String - Returns a string representation of the errors
             */
            checkAnchorHasText : {
        	    "tag"  : "A11Y_DOM_04",
        	    "func" :  function(domElem){
                    var anchorErrMsg = "[A11Y_DOM_04] Links must have non-empty text content.\n  More info http://sfdc.co/a11y_dom_04";
                    var accessAideFuncs = $A.devToolService.accessibilityAide;
                    var anchors = domElem.getElementsByTagName("a");
                    return accessAideFuncs.formatOutput(anchorErrMsg, accessAideFuncs.checkAnchorHasInnerText(anchors));
                }
            },

            /**
             * Check making sure that all iframes have a non empty title associated with them
             * @returns String - Returns a string representation of the errors
             */
            checkIframeHasTitle : {
          	    "tag" : "A11Y_DOM_06",
          	    "func" : function(domElem){
                     var iFrameTitleMsg = "[A11Y_DOM_06] Each frame and iframe element must have a non-empty title attribute.\n  More info http://sfdc.co/a11y_dom_06";
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var iframes = domElem.getElementsByTagName("iframe");

                     /**THIS CODE BLOCK SHOULD BE REMOVED AFTER PARTIAL CODE RUNNING**/
                     var id = null;
                     var src = null;
                     var frame = null;
                     var iframeArray = [];
                     for(var i = 0; i<iframes.length; i++){
                         frame = iframes[i];
                         id  = $A.util.getElementAttributeValue(frame, "id");
                         src = $A.util.getElementAttributeValue(frame, "src");

                         if((!$A.util.isUndefinedOrNull(src) && src.indexOf("/apex/") !== -1) ||
                            (!$A.util.isUndefinedOrNull(id) && id.toLowerCase().indexOf("vfframeid") !== -1)){
                            continue;
                         }

                         iframeArray.push(frame);
                     }
                    /*************************************************************************/
                    return accessAideFuncs.formatOutput(iFrameTitleMsg,accessAideFuncs.checkForAttrib(iframeArray, "title", "", accessAideFuncs.doesContain));
                 }
            },

            /**
             * Check making sure the head element is set correctly
             * @returns String - Returns a string representation of the errors
             */
            checkCorrectHeaderOrder : {
        	    "tag"  : "A11Y_DOM_07",
        	    "func" : function(domElem){
                     var hdErrMsg = "[A11Y_DOM_07] The head section must have a non-empty title element.\n  More info http://sfdc.co/a11y_dom_07";
                     var accessAideFuncs = $A.devToolService.accessibilityAide;
                     var hd = domElem.getElementsByTagName("head")[0];

                     if($A.util.isEmpty(hd)){
                         return "";
                     }
                     return accessAideFuncs.formatOutput(hdErrMsg, accessAideFuncs.checkHeadHasCorrectTitle(hdErrMsg, hd));
                }
            },

            /**
             * Check making sure that table cells have scope in them, and that they are equal to row, col, rowgroup, colgroup
             * @returns String - Returns a string representation of the errors
             */
            checkTableCellsHaveScope : {
                "tag"  : "A11Y_DOM_08",
                "func" : function(domElem){
                     var tableErrorMsg = "[A11Y_DOM_08] Data table cells must be associated with data table headers.\n  More info http://sfdc.co/a11y_dom_08";
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var tables = domElem.getElementsByTagName("table");
                     return accessAideFuncs.formatOutput(tableErrorMsg, accessAideFuncs.checkTables(tables, tableErrorMsg));
                 }
            },

            /**
             * Check making sure that all fieldset tags do not have the display:none field set and makes sure that each one has a legend
             * @returns String - Returns a string representation of the errors
             */
            checkFieldsetsAreCorrect : {
                "tag"  : "A11Y_DOM_09",
                "func" : function(domElem){
                     var fieldsetLegendMsg = "[A11Y_DOM_09] Fieldset must have a legend element.\n  More info http://sfdc.co/a11y_dom_09";
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var fieldSets = domElem.getElementsByTagName('fieldset');
                     var legends = "";
                     var errorArray = [];
                     var fieldSetStyle  = "";

                     for(var i=0; i<fieldSets.length; i++){
                         legends = fieldSets[i].getElementsByTagName('legend');
                         fieldSetStyle = fieldSets[i].style.display;

                         if(!$A.util.isUndefinedOrNull(fieldSetStyle) && fieldSetStyle === "none"){
                             continue;
                         }

                         if(legends.length === 0){
                             errorArray.push(fieldSets[i]);
                         }
                      }

                     return accessAideFuncs.formatOutput(fieldsetLegendMsg, errorArray);
                  }
            },

            /**
             * Check making sure that all radio and checkboxes are grouped within a fieldset
             * @returns String - Returns a string representation of the errors
             */
            checkRadioGrouping : {
                "tag"  : "A11Y_DOM_10",
                "func" : function(domElem){
                     var radioButtonFieldSetMsg = "[A11Y_DOM_10] Related radio buttons or checkboxes must be grouped with a fieldset.\n  More info http://sfdc.co/a11y_dom_10";
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var inputTags = domElem.getElementsByTagName('input');

                     return accessAideFuncs.formatOutput(radioButtonFieldSetMsg, accessAideFuncs.radioButtonAide(inputTags));
                }
            },

            /**
             * Checking to make sure that all nested Headers have a single level of difference
             * @returns String - Returns a string representation of the errors
             */
            checkNestedHeader : {
                "tag"  : "A11Y_DOM_11",
                "func" : function(domElem){
                     var headerErrMsg = "[A11Y_DOM_11] Headings should be properly nested.\n  More info http://sfdc.co/a11y_dom_11";
                     var errArray = [];
                     var accessAideFuncs = $A.devToolService.accessibilityAide;
                     var hdrs1 = domElem.getElementsByTagName("h1");
                     var hdrs2 = domElem.getElementsByTagName("h2");
                     var hdrs3 = domElem.getElementsByTagName("h3");
                     var hdrs4 = domElem.getElementsByTagName("h4");
                     var hdrs5 = domElem.getElementsByTagName("h5");

                     errArray = errArray.concat(accessAideFuncs.findNextHeader(hdrs1, "h2", {"h2":"", "h3":"", "h4":"", "h5":"", "h6":""}));
                     errArray = errArray.concat(accessAideFuncs.findNextHeader(hdrs2, "h3", {"h3":"", "h4":"", "h5":"", "h6":""}));
                     errArray = errArray.concat(accessAideFuncs.findNextHeader(hdrs3, "h4", {"h4":"", "h5":"", "h6":""}));
                     errArray = errArray.concat(accessAideFuncs.findNextHeader(hdrs4, "h5", {"h5":"", "h6":""}));
                     errArray = errArray.concat(accessAideFuncs.findNextHeader(hdrs5, "h6", {"h6":""}));

                     return accessAideFuncs.formatOutput(headerErrMsg, errArray);
                }
            },

            /**
             * Test that will verify that all top level panels have the correct aria associated with them
             * @returns String - Returns a string representation of the errors
             */
            checkTopLevelPanels : {
                "tag"  : "A11Y_DOM_12",
                "func" : function (domElem){
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var errorMsg = "[A11Y_DOM_12] Base and top panels should have proper aria-hidden properties.\n  More info http://sfdc.co/a11y_dom_12";

                     var modalOverlay = "div.uiPanelDialog";
                     var panelOverlay = "div.forcePanelOverlay";
                     var panelSlide   = "section.stage.panelSlide";
                     var panelSliderOverlay = "div.forcePanelSlider";
                     //Get all panels
                     var panels = [];
                     accessAideFuncs.nodeListToObjectArray(panels, domElem.querySelectorAll(modalOverlay));
                     accessAideFuncs.nodeListToObjectArray(panels, domElem.querySelectorAll(panelOverlay));
                     accessAideFuncs.nodeListToObjectArray(panels, domElem.querySelectorAll(panelSlide));
                     accessAideFuncs.nodeListToObjectArray(panels, domElem.querySelectorAll(panelSliderOverlay), "div.body");
                     var topPanelsCount = domElem.querySelectorAll(modalOverlay+".active").length + domElem.querySelectorAll(panelOverlay+".active").length;
                     var elementCoveringEverythingActive = topPanelsCount > 0;
                     topPanelsCount = topPanelsCount + domElem.querySelectorAll(panelSliderOverlay+".active").length;

                     var errorArray = accessAideFuncs.findTopLevelErrors(panels, topPanelsCount, elementCoveringEverythingActive);
                     return accessAideFuncs.formatOutput(errorMsg, errorArray);
                }
            },

            /**
             * Check making sure that if an inputDefaultError exists on the page, that there is a corresponding input associated with it
             * @returns String - Returns a string representation of the errors
             */
            checkInputdefaultErrorLinkage : {
                "tag"  : "A11Y_DOM_13",
                "func" : function (domElem){
                     var accessAideFuncs = aura.devToolService.accessibilityAide;
                     var inputErrorMsg = "[A11Y_DOM_13] Aria-describedby must be used to associate error message with input control.\n  More info http://sfdc.co/a11y_dom_13";
                     var errorArray = accessAideFuncs.inputDefaultErrorAide(domElem.getElementsByTagName("ul"), domElem.getElementsByTagName("input"), domElem.getElementsByTagName("select"), domElem.getElementsByTagName("textarea"));
                     return accessAideFuncs.formatOutput(inputErrorMsg, errorArray);
                }
            },

            /**
             * Check that there is no duplicate text inside a button so that screen readers don't read them twice
             * @returns String - Returns a string representation of the errors
             */
            checkDuplicateButtonText : {
            	"tag"  : "A11Y_DOM_14",
            	"func" : function(domElem) {
            		var dupeButtonTextErrorMsg = "[A11Y_DOM_14] Button must not have duplicate values.\n  More info http://sfdc.co/a11y_dom_14";
            		var accessAideFuncs = aura.devToolService.accessibilityAide;
            		var buttonTags = domElem.getElementsByTagName('button');
            		var errorArray = accessAideFuncs.buttonDuplicateTextAide(buttonTags);
            		return accessAideFuncs.formatOutput(dupeButtonTextErrorMsg, errorArray);
            	}
            },

	        /**
	         * Check that the labels present in the DOM are associated to exactly one input
	         * @returns String - Returns a string representation of the errors
	         */
	        checkOrphanLabels : {
	        	"tag"  : "A11Y_DOM_15",
	        	"func" : function(domElem) {
	        		var orphanLabelErrorMsg = "[A11Y_DOM_15] A label was found without an associated input. Labels should only be used to identify inputs.\n More Info: http://sfdc.co/a11y_dom_15";
	        		var accessAideFuncs = aura.devToolService.accessibilityAide;
	        		var labels = domElem.getElementsByTagName("LABEL");
	        		var errorArray = accessAideFuncs.matchLabelToInput(labels);
	        		return accessAideFuncs.formatOutput(orphanLabelErrorMsg, errorArray);
	        	}
	        }
        },

        /**
         * Calls all functions in VerifyAccessibility and stores the result in a string
         * @param domElem     - element to start at. Can be null or a dom element
         * @param checksToSkip - Array of function names to run. Defaults to run all.
         * @returns String    - Returns a a concatenated string representation of all errors or the empty string
         */
        checkAccessibility : function(domElem, checksToRun){
            var functions = aura.devToolService.verifyAccessibility;
            var result = "";
            var funcObject = "";
            //Checking if user of the tool wants to start at a specific element or not
            if($A.util.isUndefinedOrNull(domElem)){
                domElem = document;
            }

            //Checking if there are a set of tests that we want to be run or not
            if($A.util.isEmpty(checksToRun)){
            	checksToRun = ["A11Y_DOM_01", "A11Y_DOM_02", "A11Y_DOM_03", "A11Y_DOM_04",
            	               "A11Y_DOM_06", "A11Y_DOM_07", "A11Y_DOM_08", "A11Y_DOM_09",
            	               "A11Y_DOM_10", "A11Y_DOM_11", "A11Y_DOM_12", "A11Y_DOM_13",
            	               "A11Y_DOM_14", "A11Y_DOM_15"];
            }
            //Run all tests that are applicable
            for(var funcLabel in functions){
               funcObject = functions[funcLabel];
               if(checksToRun.indexOf(funcObject["tag"]) !== -1){
            	    result = result + funcObject["func"](domElem);
               }

            }

            return result;
        },
        help : function(){
            $A.deprecated("$A.qhelp and $A.devToolService.help are not supported.");
            var ret = [];
            ret.push("\n COQL Usage");
            var txt = this.helpText;
            for(var i=0;i<txt.length;i++){
                var item = txt[i];
                ret.push("\n\n"+(i+1)+") ");
                ret.push(item.title);
                ret.push("\n\t============\n\t");
                ret.push(item.code);
                ret.push("\n\t============\n\n\t");
                ret.push(item.description);
            }
            return ret.join("");
        }

    };

    s.helpText = [
        {
            title : 'Query all components',
            code : '$A.getQueryStatement().query()',
            description : '"component" is the default view, and "*" is the default field'
        },
        {
            title : 'Choose a view to query',
            code : '$A.getQueryStatement().from("componentDef").query()',
            description : 'Available views are : '+function(views){
                var ret = [];
                for(var i in views){
                    ret.push(i);
                }
                return ret.toString();
            }(s["views"])
        },
        {
            title : 'Choose fields to query',
            code : '$A.getQueryStatement().from("component").field("toString").field("globalId").fields("def, super").query()',
            description : 'Any property or method on the view, any expression that can be resolved against the view may be specified. "get" and "is" are also tried as prefixes for resolving function names.  Multiple fields can be comma separated or multiple calls to field() can be used.'
        },
        {
            title : 'Group results',
            code : '$A.getQueryStatement().from("value").field("toString").groupBy("toString").query()',
            description : 'The value of groupBy must be a selected field.  Note : The "value" view is only visible in stats mode.'
        },
        {
            title : 'Define derived fields',
            code : '$A.getQueryStatement().from("component").field("descriptor", "getDef().getDescriptor().toString()").query()',
            description : 'You can create a derived field, such as getDef().getDescriptor().toString(), and refer to it as a real field called "descriptor" .'
        },
        {
            title : 'Diff the results of running a query twice',
            code : 'var before = $A.getQueryStatement().query(); var after = $A.getQueryStatement().query(); after.diff(before);',
            description : 'This is useful if you want to do something between running the before and after query.  Any options for queries can be used (fields, groupBy, etc...)'
        }
    ];

    Statement.prototype.query = function(){
        var auraError=$A.error;
        $A.error=function(message,error){
            if(error.message.indexOf("Access Check Failed!")<0){
                auraError.call($A,message,error);
            }
        };
        try {
            var ret = s.select(this.criteria);
            ret._priv["statement"] = this;
            return ret;
        }finally{
            $A.error=auraError;
        }
    };

    ResultSet.prototype.diff = function(from){

        var origFromRawRows = from._priv["rawRows"];
        var fromRawRows = [];
        var k;
        for(k=0;k<origFromRawRows.length;k++){
            fromRawRows[k] = origFromRawRows[k];
        }
        var origFromRows = from["rows"];
        if(!origFromRows){
            origFromRows = from._priv["rows"];
        }
        var fromRows = [];
        for(k=0;k<origFromRows.length;k++){
            fromRows[k] = origFromRows[k];
        }
        var toRawRows = this._priv["rawRows"];
        var toRows = this["rows"];
        if(!toRows){
            toRows = this._priv["rows"];
        }

        var added = [];
        var addedRaw = [];
        var existing = [];
        var existingRaw = [];

        for(var i=0;i<toRawRows.length;i++){
            var rawRow = toRawRows[i];
            var row = toRows[i];
            var fromRawRow = null;
            for(var j=0;fromRawRow === null && j<fromRows.length;j++){
                fromRawRow = fromRawRows[j];

                if(rawRow !== fromRawRow){
                    fromRawRow = null;
                }else{
                    fromRawRows.splice(j,1);
                    fromRows.splice(j,1);
                }
            }
            if(fromRawRow !== null){
                existing.push(row);
                existingRaw.push(rawRow);
            }else{
                added.push(row);
                addedRaw.push(rawRow);
            }
        }
        var groupBy = this._priv["statement"].criteria["groupBy"];
        var ret = new ResultSet({
            "added" : s.applyGroupBy(groupBy, added, addedRaw),
            "existing" : s.applyGroupBy(groupBy, existing, existingRaw),
            "removed" : s.applyGroupBy(groupBy, fromRows, fromRawRows)
        },
        {
            "from" : from,
            "to" : this,
            "statement" : this._priv["statement"]
        });
        return ret;
    };

    Statement.prototype.from = function(from){
        this.criteria["from"] = from;
        return this;
    };

    Statement.prototype.field = function(field, func){
        if(func){
            //derived field
            var derivedFields = this.criteria["derivedFields"];
            if(!derivedFields){
                derivedFields = {};
                this.criteria["derivedFields"] = derivedFields;
            }
            derivedFields[field] = func;
        }else{
            var fields = this.criteria["fields"];
            if(!fields){
                fields = field;
            }else{
                fields = fields + ", "+field;
            }
            this.criteria["fields"] = fields;
        }
        return this;
    };

    Statement.prototype.fields = Statement.prototype.field;

    Statement.prototype.where = function(func){
        this.criteria["where"] = func;
        return this;
    };

    Statement.prototype.groupBy = function(col){
        this.criteria["groupBy"] = col;
        return this;
    };



    s.defaultView = s["views"]["component"];
    s.defaultFields = "*";
    s.defaultDerivedFields = {};
    s.defaultFilter = s["filters"]["noop"];
    s.defaultGroupBy = undefined;

    ResultSet.prototype["diff"] = ResultSet.prototype.diff;

    Statement.prototype["from"] = Statement.prototype.from;
    Statement.prototype["query"] = Statement.prototype.query;
    Statement.prototype["field"] = Statement.prototype.field;
    Statement.prototype["fields"] = Statement.prototype.fields;
    Statement.prototype["where"] = Statement.prototype.where;
    Statement.prototype["groupBy"] = Statement.prototype.groupBy;

    s["output"] = s.output;
    s["checkAccessibility"] = s.checkAccessibility;

    return s;
};
