/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:quotemark

import {
  collectValuesDefault,
  IHTMLTagProvider,
  IValueSets,
  TagSpecification
} from './htmlTags';

class VisualforceTagSpecification extends TagSpecification {
  public readonly label: string;
  constructor(label: string, documentation: string, attributes: string[] = []) {
    super(documentation, attributes);
    this.label = label;
  }
}

interface VisualforceTagSet {
  [tag: string]: VisualforceTagSpecification;
}

export function getVisualforceTagProvider(): IHTMLTagProvider {
  const valueSets: IValueSets = {
    b: ['true', 'false']
  };
  return {
    getId: () => 'visualforce',
    isApplicable: languageId => languageId === 'visualforce',
    collectTags: (collector: (tag: string, label: string) => void) => {
      for (const tag in VISUALFORCE_TAGS) {
        if (VISUALFORCE_TAGS.hasOwnProperty(tag)) {
          collector(
            VISUALFORCE_TAGS[tag].label,
            VISUALFORCE_TAGS[tag].documentation
          );
        }
      }
    },
    collectAttributes: (
      tag: string,
      collector: (attribute: string, type: string) => void
    ) => {
      if (tag) {
        const tags = VISUALFORCE_TAGS[tag];
        if (tags) {
          const attributes = tags.attributes;
          if (attributes) {
            attributes.forEach(attr => {
              const segments = attr.split(':');
              collector(segments[0], segments[1]);
            });
          }
        }
      }
    },
    collectValues: (
      tag: string,
      attribute: string,
      collector: (value: string) => void
    ) => {
      collectValuesDefault(
        tag,
        attribute,
        collector,
        VISUALFORCE_TAGS,
        [],
        valueSets
      );
    }
  };
}

const VISUALFORCE_TAGS: VisualforceTagSet = {
  'analytics:reportchart': new VisualforceTagSpecification(
    'analytics:reportChart',
    ' Use this component to add Salesforce report charts to a Visualforce page. You can filter chart data to show specific results. The component is available in API version 29.0 or later.\n\n Before you add a report chart, check that the source report has a chart in Salesforce app.\n\n',
    [
      'cacheAge',
      'cacheResults:b',
      'developerName',
      'filter',
      'hideOnError:b',
      'id',
      'rendered:b',
      'reportId',
      'showRefreshButton:b',
      'size'
    ]
  ),
  'apex:actionfunction': new VisualforceTagSpecification(
    'apex:actionFunction',
    " A component that provides support for invoking controller action methods directly from JavaScript code using an AJAX request. An < apex:actionFunction > component must be a child of an < apex:form > component. Because binding between the caller and < apex:actionFunction > is done based on parameter order, ensure that the order of < apex:param > is matched by the caller's argument list.\n\n Unlike < apex:actionSupport >, which only provides support for invoking controller action methods from other Visualforce components, < apex:actionFunction > defines a new JavaScript function which can then be called from within a block of JavaScript code.\n\n Note: Beginning with API version 23 you can't place < apex:actionFunction > inside an iteration component — < apex:pageBlockTable >, < apex:repeat >, and so on. Put the < apex:actionFunction > after the iteration component, and inside the iteration put a normal JavaScript function that calls it.\n\n ",
    [
      'action',
      'focus',
      'id',
      'immediate:b',
      'name',
      'namespace',
      'onbeforedomupdate',
      'oncomplete',
      'rendered:b',
      'reRender',
      'status',
      'timeout'
    ]
  ),
  'apex:actionpoller': new VisualforceTagSpecification(
    'apex:actionPoller',
    " A timer that sends an AJAX request to the server according to a time interval that you specify. Each request can result in a full or partial page update. \n\n An < apex:actionPoller > must be within the region it acts upon. For example, to use an < apex:actionPoller > with an < apex:actionRegion >, the < apex:actionPoller > must be within the < apex:actionRegion >. \n\n Considerations When Using < apex:actionPoller > \n\n Action methods used by < apex:actionPoller > should be lightweight. It's a best practice to avoid performing DML, external service calls, and other resource-intensive operations in action methods called by an < apex:actionPoller >. Consider carefully the effect of your action method being called repeatedly by an < apex:actionPoller > at the interval you specify, especially if it's used on a page that will be widely distributed, or left open for long periods. < apex:actionPoller > refreshes the connection regularly, keeping login sessions alive. A page with < apex:actionPoller > on it won't time out due to inactivity. If an < apex:actionPoller > is ever re-rendered as the result of another action, it resets itself. Avoid using this component with enhanced lists. ",
    [
      'action',
      'enabled:b',
      'id',
      'interval',
      'oncomplete',
      'onsubmit',
      'rendered:b',
      'reRender',
      'status',
      'timeout'
    ]
  ),
  'apex:actionregion': new VisualforceTagSpecification(
    'apex:actionRegion',
    ' An area of a Visualforce page that demarcates which components should be processed by the Force.com server when an AJAX request is generated. Only the components in the body of the < apex:actionRegion > are processed by the server, thereby increasing the performance of the page.\n\n Note that an < apex:actionRegion > component only defines which components the server processes during a request&#x2014;it doesn’t define what areas of the page are re-rendered when the request completes. To control that behavior, use the rerender attribute on an < apex:actionSupport >, < apex:actionPoller >, < apex:commandButton >, < apex:commandLink >, < apex:tab >, or < apex:tabPanel > component.\n\n See Also: Using the transient keyword\n\n ',
    ['id', 'immediate:b', 'rendered:b', 'renderRegionOnly:b']
  ),
  'apex:actionstatus': new VisualforceTagSpecification(
    'apex:actionStatus',
    ' A component that displays the status of an AJAX update request. An AJAX request can either be in progress or complete.\n\n ',
    [
      'dir',
      'for',
      'id',
      'lang',
      'layout',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onstart',
      'onstop',
      'rendered:b',
      'startStyle',
      'startStyleClass',
      'startText',
      'stopStyle',
      'stopStyleClass',
      'stopText',
      'style',
      'styleClass',
      'title'
    ]
  ),
  'apex:actionsupport': new VisualforceTagSpecification(
    'apex:actionSupport',
    ' A component that adds AJAX support to another component, allowing the component to be refreshed asynchronously by the server when a particular event occurs, such as a button click or mouseover.\n\n See also: < apex:actionFunction >.\n\n ',
    [
      'action',
      'disabled:b',
      'disableDefault:b',
      'event',
      'focus',
      'id',
      'immediate:b',
      'onbeforedomupdate',
      'oncomplete',
      'onsubmit',
      'rendered:b',
      'reRender',
      'status',
      'timeout'
    ]
  ),
  'apex:areaseries': new VisualforceTagSpecification(
    'apex:areaSeries',
    ' A data series to be rendered as shaded areas in a Visualforce chart. It\'s similar to a line series with the fill attribute set to true, except that multiple Y values for each X will "stack" as levels upon each other.\n\n At a minimum you must specify the fields in the data collection to use as X and Y values for each point along the line that defines the amount of area each point represents, as well as the X and Y axes to scale against. Add multiple Y values to add levels to the chart. Each level takes a new color.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:areaSeries > components in a single chart, and you can add < apex:barSeries >, < apex:lineSeries >, and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    [
      'axis',
      'colorSet',
      'highlight:b',
      'highlightLineWidth',
      'highlightOpacity',
      'highlightStrokeColor',
      'id',
      'opacity',
      'rendered:b',
      'rendererFn',
      'showInLegend:b',
      'tips:b',
      'title',
      'xField',
      'yField'
    ]
  ),
  'apex:attribute': new VisualforceTagSpecification(
    'apex:attribute',
    ' A definition of an attribute on a custom component. The attribute tag can only be a child of a component tag.\n\n Note that you cannot define attributes with names like id or rendered. These attributes are automatically created for all custom component definitions.\n\n ',
    [
      'access',
      'assignTo',
      'default',
      'description',
      'encode:b',
      'id',
      'name',
      'required:b',
      'type'
    ]
  ),
  'apex:axis': new VisualforceTagSpecification(
    'apex:axis',
    ' Defines an axis for a chart. Use this to set the units, scale, labeling, and other visual options for the axis. You can define up to four axes for a single chart, one for each edge.\n\n Note: This component must be enclosed within an < apex:chart > component.\n\n ',
    [
      'dashSize',
      'fields',
      'grid:b',
      'gridFill:b',
      'id',
      'margin',
      'maximum',
      'minimum',
      'position',
      'rendered:b',
      'steps',
      'title',
      'type'
    ]
  ),
  'apex:barseries': new VisualforceTagSpecification(
    'apex:barSeries',
    ' A data series to be rendered as bars in a Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each bar, as well as the X and Y axes to scale against. Add multiple Y values to add grouped or stacked bar segments to the chart. Each segment takes a new color.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:barSeries > and < apex:lineSeries > components in a single chart. You can also add < apex:areaSeries > and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    [
      'axis',
      'colorSet',
      'colorsProgressWithinSeries:b',
      'groupGutter',
      'gutter',
      'highlight:b',
      'highlightColor',
      'highlightLineWidth',
      'highlightOpacity',
      'highlightStroke',
      'id',
      'orientation',
      'rendered:b',
      'rendererFn',
      'showInLegend:b',
      'stacked:b',
      'tips:b',
      'title',
      'xField',
      'xPadding',
      'yField',
      'yPadding'
    ]
  ),
  'apex:canvasapp': new VisualforceTagSpecification(
    'apex:canvasApp',
    " Renders a canvas app identified by the given developerName/namespacePrefix or applicationName/namespacePrefix value pair. The developerName attribute takes precedence if both developerName and applicationName are set. \n\n Requirements: Force.com Canvas should be enabled in the organization. \n\n Keep the following considerations in mind when using the < apex:canvasApp > component: A development organization is an organization in which a canvas app is developed and packaged. An installation organization is an organization in which a packaged canvas app is installed. The < apex:canvasApp > component usage in a Visualforce page isn't updated if a canvas app's application name or developer name is changed. A canvas app can be deleted even if there's a Visualforce page referencing it via < apex:canvasApp > . \n\n",
    [
      'applicationName',
      'border',
      'canvasId',
      'containerId',
      'developerName',
      'entityFields',
      'height',
      'id',
      'maxHeight',
      'maxWidth',
      'namespacePrefix',
      'onCanvasAppError',
      'onCanvasAppLoad',
      'parameters',
      'rendered:b',
      'scrolling',
      'width'
    ]
  ),
  'apex:chart': new VisualforceTagSpecification(
    'apex:chart',
    ' A Visualforce chart. Defines general characteristics of the chart, including size and data binding.\n\n ',
    [
      'animate:b',
      'background',
      'colorSet',
      'data',
      'floating:b',
      'height',
      'hidden:b',
      'id',
      'legend:b',
      'name',
      'rendered:b',
      'renderTo',
      'resizable:b',
      'theme',
      'width'
    ]
  ),
  'apex:chartlabel': new VisualforceTagSpecification(
    'apex:chartLabel',
    ' Defines how labels are displayed. Depending on what component wraps it, < apex:chartLabel > gives you options for affecting the display of data series labels, pie chart segment labels, and axes labels.\n\n Note: This component must be enclosed by a data series component or an < apex:axis > component.\n\n ',
    [
      'color',
      'display',
      'field',
      'font',
      'id',
      'minMargin',
      'orientation',
      'rendered:b',
      'rendererFn',
      'rotate'
    ]
  ),
  'apex:charttips': new VisualforceTagSpecification(
    'apex:chartTips',
    ' Defines tooltips which appear on mouseover of data series elements. This component offers more configuration options than the default tooltips displayed by setting the tips attribute of a data series component to true.\n\n Note: This component must be enclosed by a data series component.\n\n ',
    [
      'height',
      'id',
      'labelField',
      'rendered:b',
      'rendererFn',
      'trackMouse:b',
      'valueField',
      'width'
    ]
  ),
  'apex:column': new VisualforceTagSpecification(
    'apex:column',
    ' A single column in a table. An < apex:column > component must always be a child of an < apex:dataTable > or < apex:pageBlockTable > component.\n\n Note that if you specify an sObject field as the value attribute for an < apex:column >, the associated label for that field is used as the column header by default. To override this behavior, use the headerValue attribute on the column, or the column\'s header facet.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for the column in every row of the table.\n\n ',
    [
      'breakBefore:b',
      'colspan',
      'dir',
      'footerClass',
      'footercolspan',
      'footerdir',
      'footerlang',
      'footeronclick',
      'footerondblclick',
      'footeronkeydown',
      'footeronkeypress',
      'footeronkeyup',
      'footeronmousedown',
      'footeronmousemove',
      'footeronmouseout',
      'footeronmouseover',
      'footeronmouseup',
      'footerstyle',
      'footertitle',
      'footerValue',
      'headerClass',
      'headercolspan',
      'headerdir',
      'headerlang',
      'headeronclick',
      'headerondblclick',
      'headeronkeydown',
      'headeronkeypress',
      'headeronkeyup',
      'headeronmousedown',
      'headeronmousemove',
      'headeronmouseout',
      'headeronmouseover',
      'headeronmouseup',
      'headerstyle',
      'headertitle',
      'headerValue',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'rowspan',
      'style',
      'styleClass',
      'title',
      'value',
      'width'
    ]
  ),
  'apex:commandbutton': new VisualforceTagSpecification(
    'apex:commandButton',
    ' A button that is rendered as an HTML input element with the type attribute set to submit, reset, or image, depending on the < apex:commandButton > tag\'s specified values. The button executes an action defined by a controller, and then either refreshes the current page, or navigates to a different page based on the PageReference variable that is returned by the action.\n\n An < apex:commandButton > component must always be a child of an < apex:form > component.\n\n See also: < apex:commandLink >\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'action',
      'alt',
      'dir',
      'disabled:b',
      'id',
      'image',
      'immediate:b',
      'lang',
      'onblur',
      'onclick',
      'oncomplete',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'reRender',
      'status',
      'style',
      'styleClass',
      'tabindex',
      'timeout',
      'title',
      'value'
    ]
  ),
  'apex:commandlink': new VisualforceTagSpecification(
    'apex:commandLink',
    ' A link that executes an action defined by a controller, and then either refreshes the current page, or navigates to a different page based on the PageReference variable that is returned by the action. An < apex:commandLink > component must always be a child of an < apex:form > component.\n\n To add request parameters to an < apex:commandLink >, use nested < apex:param > components.\n\n See also: < apex:commandButton >, < apex:outputLink >.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'action',
      'charset',
      'coords',
      'dir',
      'hreflang',
      'id',
      'immediate:b',
      'lang',
      'onblur',
      'onclick',
      'oncomplete',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rel',
      'rendered:b',
      'reRender',
      'rev',
      'shape',
      'status',
      'style',
      'styleClass',
      'tabindex',
      'target',
      'timeout',
      'title',
      'type',
      'value'
    ]
  ),
  'apex:component': new VisualforceTagSpecification(
    'apex:component',
    ' A custom Visualforce component. All custom component definitions must be wrapped inside a single < apex:component > tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag, or , depending on the layout attribute.\n\n ',
    [
      'access',
      'allowDML:b',
      'controller',
      'extensions',
      'id',
      'language',
      'layout',
      'rendered:b',
      'selfClosing:b'
    ]
  ),
  'apex:componentbody': new VisualforceTagSpecification(
    'apex:componentBody',
    ' This tag allows a custom component author to define a location where a user can insert content into the custom component. This is especially useful for generating custom iteration components. This component is valid only within an < apex:component > tag, and only a single definition per custom component is allowed.\n\n ',
    ['id', 'rendered:b']
  ),
  'apex:componentexample': new VisualforceTagSpecification(
    'apex:componentExample',
    'Defines an example for a component definition that will be displayed in the online component reference.',
    [
      'demoPage',
      'description',
      'examplePage',
      'id',
      'imageURL',
      'name',
      'rendered:b'
    ]
  ),
  'apex:composition': new VisualforceTagSpecification(
    'apex:composition',
    " An area of a page that includes content from a second template page. Template pages are Visualforce pages that include one or more < apex:insert > components. The < apex:composition > component names the associated template, and provides body for the template's < apex:insert > components with matching < apex:define > components. Any content outside of an < apex:composition > component is not rendered.\n\n See also: < apex:insert >, < apex:define >\n\n ",
    ['rendered', 'template']
  ),
  'apex:datalist': new VisualforceTagSpecification(
    'apex:dataList',
    ' An ordered or unordered list of values that is defined by iterating over a set of data. The body of the < apex:dataList > component specifies how a single item should appear in the list. The data set can include up to 1,000 items.\n\n ',
    [
      'dir',
      'first',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'rows',
      'style',
      'styleClass',
      'title',
      'type',
      'value',
      'var'
    ]
  ),
  'apex:datatable': new VisualforceTagSpecification(
    'apex:dataTable',
    ' An HTML table that’s defined by iterating over a set of data, displaying information about one item of data per row. The body of the contains one or more column components that specify what information should be displayed for each item of data. The data set can include up to 1,000 items, or 10,000 items when the page is executed in read-only mode.\n\n For Visualforce pages running Salesforce.com API version 20.0 or higher, an tag can be contained within this component to generate columns.\n\n See also: \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated table\'s tag.\n\n ',
    [
      'align',
      'bgcolor',
      'border',
      'captionClass',
      'captionStyle',
      'cellpadding',
      'cellspacing',
      'columnClasses',
      'columns',
      'columnsWidth',
      'dir',
      'first',
      'footerClass',
      'frame',
      'headerClass',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onRowClick',
      'onRowDblClick',
      'onRowMouseDown',
      'onRowMouseMove',
      'onRowMouseOut',
      'onRowMouseOver',
      'onRowMouseUp',
      'rendered:b',
      'rowClasses',
      'rows',
      'rules',
      'style',
      'styleClass',
      'summary',
      'title',
      'value',
      'var',
      'width'
    ]
  ),
  'apex:define': new VisualforceTagSpecification(
    'apex:define',
    ' A template component that provides content for an < apex:insert > component defined in a Visualforce template page. \n\n See also: < apex:composition >, < apex:insert >\n\n ',
    ['name']
  ),
  'apex:description': new VisualforceTagSpecification(
    'apex:description',
    '',
    []
  ),
  'apex:detail': new VisualforceTagSpecification(
    'apex:detail',
    ' The standard detail page for a particular object, as defined by the associated page layout for the object in Setup. This component includes attributes for including or excluding the associated related lists, related list hover links, and title bar that appear in the standard Salesforce application interface.\n\n ',
    [
      'id',
      'inlineEdit:b',
      'oncomplete',
      'relatedList:b',
      'relatedListHover:b',
      'rendered:b',
      'rerender',
      'showChatter:b',
      'subject',
      'title:b'
    ]
  ),
  'apex:dynamiccomponent': new VisualforceTagSpecification(
    'apex:dynamicComponent',
    ' This tag acts as a placeholder for your dynamic Apex components. It has one required parameter—componentValue—which accepts the name of an Apex method that returns a dynamic component.\n\n The following Visualforce components do not have dynamic Apex representations: < apex:attribute > < apex:component > < apex:componentBody > < apex:composition > < apex:define > < apex:dynamicComponent > < apex:include > < apex:insert > < apex:param > < apex:variable > \n\n ',
    ['componentValue', 'id', 'invokeAfterAction:b', 'rendered:b']
  ),
  'apex:enhancedlist': new VisualforceTagSpecification(
    'apex:enhancedList',
    ' The list view picklist for an object, including its associated list of records for the currently selected view. In standard Salesforce applications this component is displayed on the main tab for a particular object. This component has additional attributes that can be specified, such as the height and rows per page, as compared to < apex:listView >.\n\n Note: When an < apex:enhancedList > is rerendered through another component\'s rerender attribute, the < apex:enhancedList > must be inside of an < apex:outputPanel > component that has its layout attribute set to "block". The < apex:enhancedList > component is not allowed on pages that have the attribute showHeader set to false. You can only have five < apex:enhancedList > components on a single page. Ext JS versions less than 3 should not be included on pages that use this component.\n\n See also: < apex:listView >.\n\n ',
    [
      'customizable:b',
      'height',
      'id',
      'listId',
      'oncomplete',
      'rendered:b',
      'reRender',
      'rowsPerPage',
      'type',
      'width'
    ]
  ),
  'apex:facet': new VisualforceTagSpecification(
    'apex:facet',
    " A placeholder for content that's rendered in a specific part of the parent component, such as the header or footer of an .\n\n An component can only exist in the body of a parent component if the parent supports facets. The name of the facet component must match one of the pre-defined facet names on the parent component. This name determines where the content of the facet component is rendered. The order in which a facet component is defined within the body of a parent component doesn't affect the appearance of the parent component.\n\n See for an example of facets.\n\n Note: Although you can't represent an directly in Apex, you can specify it on a dynamic component that has the facet. For example:\n\n Component.apex.dataTable dt = new Component.apex.dataTable(); dt.facets.header = 'Header Facet';\n\n",
    ['name']
  ),
  'apex:flash': new VisualforceTagSpecification(
    'apex:flash',
    'A Flash movie, rendered with the HTML object and embed tags.',
    [
      'flashvars',
      'height',
      'id',
      'loop:b',
      'play:b',
      'rendered:b',
      'src',
      'width'
    ]
  ),
  'apex:form': new VisualforceTagSpecification(
    'apex:form',
    " A section of a Visualforce page that allows users to enter input and then submit it with an < apex:commandButton > or < apex:commandLink >. The body of the form determines the data that is displayed and the way it's processed. It's a best practice to use only one < apex:form > tag in a page or custom component.\n\n As of API version 18.0, this tag can't be a child component of < apex:repeat >.\n\n This component supports HTML pass-through attributes using the \"html-\" prefix. Pass-through attributes are attached to the generated tag.\n\n ",
    [
      'accept',
      'acceptcharset',
      'dir',
      'enctype',
      'forceSSL:b',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onreset',
      'onsubmit',
      'prependId:b',
      'rendered:b',
      'style',
      'styleClass',
      'target',
      'title'
    ]
  ),
  'apex:gaugeseries': new VisualforceTagSpecification(
    'apex:gaugeSeries',
    ' A data series that shows progress along a specific metric. At a minimum you must specify the fields in the data collection to use as label and value pair for the gauge level to be shown. The readability of a gauge chart benefits when you specify meaningful values for the minimum and maximum along the associated < apex:axis >, which must be of type "gauge".\n\n Note: This component must be enclosed within an < apex:chart > component. You should put only one < apex:gaugeSeries > in a chart.\n\n ',
    [
      'colorSet',
      'dataField',
      'donut',
      'highlight:b',
      'id',
      'labelField',
      'needle:b',
      'rendered:b',
      'rendererFn',
      'tips:b'
    ]
  ),
  'apex:iframe': new VisualforceTagSpecification(
    'apex:iframe',
    ' A component that creates an inline frame within a Visualforce page. A frame allows you to keep some information visible while other information is scrolled or replaced.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'frameborder:b',
      'height',
      'id',
      'rendered:b',
      'scrolling:b',
      'src',
      'title',
      'width'
    ]
  ),
  'apex:image': new VisualforceTagSpecification(
    'apex:image',
    ' A graphic image, rendered with the HTML < img > tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'alt',
      'dir',
      'height',
      'id',
      'ismap:b',
      'lang',
      'longdesc',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'style',
      'styleClass',
      'title',
      'url',
      'usemap',
      'value',
      'width'
    ]
  ),
  'apex:include': new VisualforceTagSpecification(
    'apex:include',
    ' A component that inserts a second Visualforce page into the current page. The entire page subtree is injected into the Visualforce DOM at the point of reference and the scope of the included page is maintained.\n\n If content should be stripped from the included page, use the < apex:composition > component instead.\n\n ',
    ['id', 'pageName', 'rendered:b']
  ),
  'apex:includelightning': new VisualforceTagSpecification(
    'apex:includeLightning',
    'Includes the Lightning Components for Visualforce JavaScript library, lightning.out.js, from the correct Salesforce domain.',
    ['id', 'rendered:b']
  ),
  'apex:includescript': new VisualforceTagSpecification(
    'apex:includeScript',
    ' A link to a JavaScript library that can be used in the Visualforce page. When specified, this component injects a script reference into the element of the generated HTML page.\n\n Multiple references to the same script are de-duplicated, making this component safe to use inside an iteration component. This might occur if, for example, you use an inside a custom component, and then use that component inside an iteration.\n\n For performance reasons, you might choose to use a static JavaScript tag before your closing tag, rather than this component. If you do, you\'ll need to manage de-duplication yourself.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    ['id', 'loadOnReady:b', 'value']
  ),
  'apex:inlineeditsupport': new VisualforceTagSpecification(
    'apex:inlineEditSupport',
    ' This component provides inline editing support to < apex:outputField > and various container components. In order to support inline editing, this component must also be within an < apex:form > tag.\n\n The < apex:inlineEditSupport > component can only be a descendant of the following tags: < apex:dataList > < apex:dataTable > < apex:form > < apex:outputField > < apex:pageBlock > < apex:pageBlockSection > < apex:pageBlockTable > < apex:repeat > \n\n See also: the inlineEdit attribute of < apex:detail >\n\n ',
    [
      'changedStyleClass',
      'disabled:b',
      'event',
      'hideOnEdit',
      'id',
      'rendered:b',
      'resetFunction',
      'showOnEdit'
    ]
  ),
  'apex:input': new VisualforceTagSpecification(
    'apex:input',
    ' An HTML5-friendly general purpose input component that adapts to the data expected by a form field. It uses the HTML type attribute to allow client browsers to display type-appropriate user input widgets, such as a date picker or range slider, or to perform client-side formatting or validation, such as with a numeric range or a telephone number. Use this component to get user input for a controller property or method that does not correspond to a field on a Salesforce object.\n\n This component doesn\'t use Salesforce styling. Also, since it doesn\'t correspond to a Salesforce field, or any other data on an object, custom code is required to use the value the user enters.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'alt',
      'dir',
      'disabled:b',
      'id',
      'label',
      'lang',
      'list',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'required:b',
      'size',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'type',
      'value'
    ]
  ),
  'apex:inputcheckbox': new VisualforceTagSpecification(
    'apex:inputCheckbox',
    ' An HTML input element of type checkbox. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'dir',
      'disabled:b',
      'id',
      'immediate:b',
      'label',
      'lang',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'rendered:b',
      'required:b',
      'selected:b',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:inputfield': new VisualforceTagSpecification(
    'apex:inputField',
    'An HTML input element for a value that corresponds to a field on a Salesforce object. The component respects the attributes of the associated field, including whether the field is required or unique, and the user interface widget to display to get input from the user. For example, if the specified component is a date field, a calendar input widget is displayed. When used in an , tags automatically display with their corresponding output label.\n\n Consider the following when using DOM events with this tag: For lookup fields, mouse events fire on both the text box and graphic icon. For multi-select picklists, all events fire, but the DOM ID is suffixed with _unselected for the left box, _selected for the right box, and _right_arrow and _left_arrow for the graphic icons. For rich text areas, no events fire. \n\n Note: Read-only fields, and fields for certain Salesforce objects with complex automatic behavior, such as Event.StartDateTime and Event.EndDateTime, don\'t render as editable when using . Use a different input component such as instead. An component for a rich text area field can\'t be used for image uploads in Site.com sites or Force.com Sites due to security constraints. If you want to enable users to upload image files in either of those contexts, use an component. If custom help is defined for the field in Setup, the field must be a child of an or , and the Salesforce page header must be displayed for the custom help to appear on your Visualforce page. To override the display of custom help, use the in the body of an . \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'id',
      'label',
      'list',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'rendered:b',
      'required:b',
      'showDatePicker:b',
      'style',
      'styleClass',
      'taborderhint',
      'type',
      'value'
    ]
  ),
  'apex:inputfile': new VisualforceTagSpecification(
    'apex:inputFile',
    'A component that creates an input field to upload a file.\n\n Note: The maximum file size that can be uploaded via Visualforce is 10 MB.\n\n',
    [
      'accept',
      'accessKey',
      'alt',
      'contentType',
      'dir',
      'disabled:b',
      'fileName',
      'fileSize',
      'id',
      'lang',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'rendered:b',
      'required',
      'size',
      'style',
      'styleclass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:inputhidden': new VisualforceTagSpecification(
    'apex:inputHidden',
    ' An HTML input element of type hidden, that is, an input element that is invisible to the user. Use this component to pass variables from page to page.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    ['id', 'immediate:b', 'rendered:b', 'required:b', 'value']
  ),
  'apex:inputsecret': new VisualforceTagSpecification(
    'apex:inputSecret',
    ' An HTML input element of type password. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object, for a value that is masked as the user types.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'alt',
      'dir',
      'disabled:b',
      'id',
      'immediate:b',
      'label',
      'lang',
      'maxlength',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'readonly:b',
      'redisplay:b',
      'rendered:b',
      'required:b',
      'size',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:inputtext': new VisualforceTagSpecification(
    'apex:inputText',
    ' An HTML input element of type text. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object.\n\n This component doesn\'t use Salesforce styling. Also, since it doesn\'t correspond to a field, or any other data on an object, custom code is required to use the value the user enters.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'alt',
      'dir',
      'disabled:b',
      'id',
      'label',
      'lang',
      'list',
      'maxlength',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'required:b',
      'size',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:inputtextarea': new VisualforceTagSpecification(
    'apex:inputTextarea',
    ' A text area input element. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object, for a value that requires a text area.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'cols',
      'dir',
      'disabled:b',
      'id',
      'label',
      'lang',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'readonly:b',
      'rendered:b',
      'required:b',
      'richText:b',
      'rows',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:insert': new VisualforceTagSpecification(
    'apex:insert',
    ' A template component that declares a named area that must be defined by an < apex:define > component in another Visualforce page. Use this component with the < apex:composition > and < apex:define > components to share data between multiple pages.\n\n ',
    ['name']
  ),
  'apex:legend': new VisualforceTagSpecification(
    'apex:legend',
    ' Defines a chart legend. This component offers additional configuration options beyond the defaults used by the legend attribute of the < apex:chart > component.\n\n Note: This component must be enclosed within an < apex:chart > component.\n\n ',
    ['font', 'id', 'padding', 'position', 'rendered:b', 'spacing']
  ),
  'apex:lineseries': new VisualforceTagSpecification(
    'apex:lineSeries',
    ' A data series to be rendered as connected points in a linear Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as the X and Y axes to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:barSeries > and < apex:lineSeries > components in a single chart. You can also add < apex:areaSeries > and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    [
      'axis',
      'fill:b',
      'fillColor',
      'highlight:b',
      'highlightStrokeWidth',
      'id',
      'markerFill',
      'markerSize',
      'markerType',
      'opacity',
      'rendered:b',
      'rendererFn',
      'showInLegend:b',
      'smooth',
      'strokeColor',
      'strokeWidth',
      'tips:b',
      'title',
      'xField',
      'yField'
    ]
  ),
  'apex:listviews': new VisualforceTagSpecification(
    'apex:listViews',
    ' The list view picklist for an object, including its associated list of records for the currently selected view. In standard Salesforce applications this component is displayed on the main tab for a particular object.\n\n See also: < apex:enhancedList >.\n\n ',
    ['id', 'rendered:b', 'type']
  ),
  'apex:logcallpublisher': new VisualforceTagSpecification(
    'apex:logCallPublisher',
    'The Log a Call publisher lets support agents who use Case Feed create logs for customer calls. This component can only be used in organizations that have Case Feed, Chatter, and feed tracking on cases enabled.',
    [
      'autoCollapseBody:b',
      'entityId',
      'id',
      'logCallBody',
      'logCallBodyHeight',
      'onSubmitFailure',
      'onSubmitSuccess',
      'rendered:b',
      'reRender',
      'showAdditionalFields:b',
      'showSubmitButton:b',
      'submitButtonName',
      'submitFunctionName',
      'title',
      'width'
    ]
  ),
  'apex:message': new VisualforceTagSpecification(
    'apex:message',
    ' A message for a specific component, such as a warning or error. If an < apex:message > or < apex:messages > component is not included in a page, most warning and error messages are only shown in the debug log.\n\n ',
    ['dir', 'for', 'id', 'lang', 'rendered:b', 'style', 'styleClass', 'title']
  ),
  'apex:messages': new VisualforceTagSpecification(
    'apex:messages',
    ' All messages that were generated for all components on the current page. If an < apex:message > or < apex:messages > component is not included in a page, most warning and error messages are only shown in the debug log.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag. (Each message is contained in a list item.)\n\n ',
    [
      'dir',
      'globalOnly:b',
      'id',
      'lang',
      'layout',
      'rendered:b',
      'style',
      'styleClass',
      'title'
    ]
  ),
  'apex:outputfield': new VisualforceTagSpecification(
    'apex:outputField',
    ' A read-only display of a label and value for a field on a Salesforce object. An < apex:outputField > component respects the attributes of the associated field, including how it should be displayed to the user. For example, if the specified < apex:outputField > component is a currency field, the appropriate currency symbol is displayed. Likewise, if the < apex:outputField > component is a lookup field or URL, the value of the field is displayed as a link.\n\n Note that if custom help is defined for the field in Setup, the field must be a child of an < apex:pageBlock > or < apex:pageBlockSectionItem >, and the Salesforce page header must be displayed for the custom help to appear on your Visualforce page. To override the display of custom help, use the < apex:outputField > in the body of an < apex:pageBlockSectionItem >.\n\n The Rich Text Area data type can only be used with this component on pages running Salesforce.com API versions greater than 18.0.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'dir',
      'id',
      'label',
      'lang',
      'rendered:b',
      'style',
      'styleClass',
      'title',
      'value'
    ]
  ),
  'apex:outputlabel': new VisualforceTagSpecification(
    'apex:outputLabel',
    ' A label for an input or output field. Use this component to provide a label for a controller method that does not correspond to a field on a Salesforce object.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'dir',
      'escape:b',
      'for',
      'id',
      'lang',
      'onblur',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:outputlink': new VisualforceTagSpecification(
    'apex:outputLink',
    ' A link to a URL. This component is rendered in HTML as an anchor tag with an href attribute. Like its HTML equivalent, the body of an < apex:outputLink > is the text or image that displays as the link. To add query string parameters to a link, use nested < apex:param > components.\n\n See also: < apex:commandLink > \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'charset',
      'coords',
      'dir',
      'disabled:b',
      'hreflang',
      'id',
      'lang',
      'onblur',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rel',
      'rendered:b',
      'rev',
      'shape',
      'style',
      'styleClass',
      'tabindex',
      'target',
      'title',
      'type',
      'value'
    ]
  ),
  'apex:outputpanel': new VisualforceTagSpecification(
    'apex:outputPanel',
    ' A set of content that is grouped together, rendered with an HTML tag, tag, or neither. Use an to group components together for AJAX refreshes.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag, or , depending on the value of the layout attribute.\n\n ',
    [
      'dir',
      'id',
      'lang',
      'layout',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'style',
      'styleClass',
      'title'
    ]
  ),
  'apex:outputtext': new VisualforceTagSpecification(
    'apex:outputText',
    ' Displays text on a Visualforce page. You can customize the appearance of < apex:outputText > using CSS styles, in which case the generated text is wrapped in an HTML < span > tag. You can also escape the rendered text if it contains sensitive HTML and XML characters. This component does take localization into account.\n\n Use with nested param tags to format the text values, where {n} corresponds to the n-th nested param tag. The value attribute supports the same syntax as the MessageFormat class in Java.\n\n Warning: Encrypted custom fields that are embedded in the < apex:outputText > component display in clear text. The < apex:outputText > component doesn\'t respect the View Encrypted Data permission for users. To prevent showing sensitive information to unauthorized users, use the < apex:outputField > tag instead.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'dir',
      'escape:b',
      'id',
      'label',
      'lang',
      'rendered:b',
      'style',
      'styleClass',
      'title',
      'value'
    ]
  ),
  'apex:page': new VisualforceTagSpecification(
    'apex:page',
    ' A single Visualforce page. All pages must be wrapped inside a single page component tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'action',
      'apiVersion',
      'applyBodyTag:b',
      'applyHtmlTag:b',
      'cache:b',
      'contentType',
      'controller',
      'deferLastCommandUntilReady:b',
      'docType',
      'expires',
      'extensions',
      'id',
      'label',
      'language',
      'lightningStylesheets:b',
      'manifest',
      'name',
      'pageStyle',
      'readOnly:b',
      'recordSetName',
      'recordSetVar',
      'renderAs',
      'rendered:b',
      'setup:b',
      'showChat:b',
      'showHeader:b',
      'showQuickActionVfHeader:b',
      'sidebar:b',
      'standardController',
      'standardStylesheets:b',
      'tabStyle',
      'title',
      'wizard:b'
    ]
  ),
  'apex:pageblock': new VisualforceTagSpecification(
    'apex:pageBlock',
    ' An area of a page that uses styling similar to the appearance of a Salesforce detail page, but without any default content.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'dir',
      'helpTitle',
      'helpUrl',
      'id',
      'lang',
      'mode',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'tabStyle',
      'title'
    ]
  ),
  'apex:pageblockbuttons': new VisualforceTagSpecification(
    'apex:pageBlockButtons',
    ' A set of buttons that are styled like standard Salesforce buttons. This component must be a child component of an < apex:pageBlock >.\n\n Note that it is not necessary for the buttons themselves to be direct children of the < apex:pageBlockButtons > component&#x2014;buttons that are located at any level within an < apex:pageBlockButtons > component are styled appropriately.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that contains the buttons. This tag can be at the top or bottom, or both, of the < apex:pageBlock >, depending on the value of the location attribute of the < apex:pageBlockButtons > component.\n\n ',
    [
      'dir',
      'id',
      'lang',
      'location',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'style',
      'styleClass',
      'title'
    ]
  ),
  'apex:pageblocksection': new VisualforceTagSpecification(
    'apex:pageBlockSection',
    ' A section of data within an < apex:pageBlock > component, similar to a section in a standard Salesforce page layout definition.\n\n An < apex:pageBlockSection > component consists of one or more columns, each of which spans two cells: one for a field\'s label, and one for its value. Each component found in the body of an < apex:pageBlockSection > is placed into the next cell in a row until the number of columns is reached. At that point, the next component wraps to the next row and is placed in the first cell.\n\n To add a field from a Salesforce object to an < apex:pageBlockSection >, use an < apex:inputField > or < apex:outputField > component. Each of these components automatically displays with the field\'s associated label. To add fields for variables or methods that are not based on Salesforce object fields, or to customize the format of Salesforce object field labels, use an < apex:pageBlockSectionItem > component. Each < apex:inputField >, < apex:outputField >, or < apex:pageBlockSectionItem > component spans both cells of a single column.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'collapsible:b',
      'columns',
      'dir',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'showHeader:b',
      'title'
    ]
  ),
  'apex:pageblocksectionitem': new VisualforceTagSpecification(
    'apex:pageBlockSectionItem',
    ' A single piece of data in an < apex:pageBlockSection > that takes up one column in one row. An < apex:pageBlockSectionItem > component can include up to two child components. If no content is specified, the column is rendered as an empty space. If one child component is specified, the content spans both cells of the column. If two child components are specified, the content of the first is rendered in the left, "label" cell of the column, while the content of the second is rendered in the right, "data" cell of the column.\n\n Note that if you include an < apex:outputField > or an < apex:inputField > component in an < apex:pageBlockSectionItem >, these components do not display with their label or custom help text as they do when they are children of an < apex:pageBlockSection >. Also note that < apex:pageBlockSectionItem > components can\'t be rerendered; rerender the child components instead.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'dataStyle',
      'dataStyleClass',
      'dataTitle',
      'dir',
      'helpText',
      'id',
      'labelStyle',
      'labelStyleClass',
      'labelTitle',
      'lang',
      'onDataclick',
      'onDatadblclick',
      'onDatakeydown',
      'onDatakeypress',
      'onDatakeyup',
      'onDatamousedown',
      'onDatamousemove',
      'onDatamouseout',
      'onDatamouseover',
      'onDatamouseup',
      'onLabelclick',
      'onLabeldblclick',
      'onLabelkeydown',
      'onLabelkeypress',
      'onLabelkeyup',
      'onLabelmousedown',
      'onLabelmousemove',
      'onLabelmouseout',
      'onLabelmouseover',
      'onLabelmouseup',
      'rendered:b'
    ]
  ),
  'apex:pageblocktable': new VisualforceTagSpecification(
    'apex:pageBlockTable',
    ' A list of data displayed as a table within either an < apex:pageBlock > or < apex:pageBlockSection > component, similar to a related list or list view in a standard Salesforce page. Like an < apex:dataTable >, an < apex:pageBlockTable > is defined by iterating over a set of data, displaying information about one item of data per row. The set of data can contain up to 1,000 items, or 10,000 items when the page is executed in read-only mode.\n\n The body of the < apex:pageBlockTable > contains one or more column components that specify what information should be displayed for each item of data, similar to a table. Unlike the < apex:dataTable > component, the default styling for < apex:pageBlockTable > matches standard Salesforce styles. Any additional styles specified with < apex:pageBlockTable > attributes are appended to the standard Salesforce styles.\n\n Note that if you specify an sObject field as the value attribute for a column, the associated label for that field is used as the column header by default. To override this behavior, use the headerValue attribute on the column, or the column\'s header facet.\n\n For Visualforce pages running Salesforce.com API version 20.0 or higher, an < apex:repeat > tag can be contained within this component to generate columns.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated table\'s tag.\n\n ',
    [
      'align',
      'bgcolor',
      'border',
      'captionClass',
      'captionStyle',
      'cellpadding',
      'cellspacing',
      'columnClasses',
      'columns',
      'columnsWidth',
      'dir',
      'first',
      'footerClass',
      'frame',
      'headerClass',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onRowClick',
      'onRowDblClick',
      'onRowMouseDown',
      'onRowMouseMove',
      'onRowMouseOut',
      'onRowMouseOver',
      'onRowMouseUp',
      'rendered:b',
      'rowClasses',
      'rows',
      'rules',
      'style',
      'styleClass',
      'summary',
      'title',
      'value',
      'var',
      'width'
    ]
  ),
  'apex:pagemessage': new VisualforceTagSpecification(
    'apex:pageMessage',
    'This component should be used for presenting custom messages in the page using the Salesforce pattern for errors, warnings and other types of messages for a given severity. See also the pageMessages component.',
    [
      'detail',
      'escape:b',
      'id',
      'rendered:b',
      'severity',
      'strength',
      'summary',
      'title'
    ]
  ),
  'apex:pagemessages': new VisualforceTagSpecification(
    'apex:pageMessages',
    'This component displays all messages that were generated for all components on the current page, presented using the Salesforce styling.',
    ['escape:b', 'id', 'rendered:b', 'showDetail:b']
  ),
  'apex:panelbar': new VisualforceTagSpecification(
    'apex:panelBar',
    ' A page area that includes one or more < apex:panelBarItem > tags that can expand when a user clicks the associated header. When an < apex:panelBarItem > is expanded, the header and the content of the item are displayed while the content of all other items are hidden. When another < apex:panelBarItem > is expanded, the content of the original item is hidden again. An < apex:panelBar > can include up to 1,000 < apex:panelBarItem > tags.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'contentClass',
      'contentStyle',
      'headerClass',
      'headerClassActive',
      'headerStyle',
      'headerStyleActive',
      'height',
      'id',
      'items',
      'rendered:b',
      'style',
      'styleClass',
      'switchType',
      'value',
      'var',
      'width'
    ]
  ),
  'apex:panelbaritem': new VisualforceTagSpecification(
    'apex:panelBarItem',
    ' A section of an < apex:panelBar > that can expand or retract when a user clicks the section header. When expanded, the header and the content of the < apex:panelBarItem > is displayed. When retracted, only the header of the < apex:panelBarItem > displays.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'contentClass',
      'contentStyle',
      'expanded',
      'headerClass',
      'headerClassActive',
      'headerStyle',
      'headerStyleActive',
      'id',
      'label',
      'name',
      'onenter',
      'onleave',
      'rendered:b'
    ]
  ),
  'apex:panelgrid': new VisualforceTagSpecification(
    'apex:panelGrid',
    ' Renders an HTML table element in which each component found in the body of the < apex:panelGrid > is placed into a corresponding cell in the first row until the number of columns is reached. At that point, the next component wraps to the next row and is placed in the first cell. \n\n Note that if an < apex:repeat > component is used within an < apex:panelGrid > component, all content generated by the < apex:repeat > component is placed in a single < apex:panelGrid > cell. The < apex:panelGrid > component differs from < apex:dataTable > because it does not process a set of data with an iteration variable.\n\n See also: < apex:panelGroup >\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'bgcolor',
      'border',
      'captionClass',
      'captionStyle',
      'cellpadding',
      'cellspacing',
      'columnClasses',
      'columns',
      'dir',
      'footerClass',
      'frame',
      'headerClass',
      'id',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'rowClasses',
      'rules',
      'style',
      'styleClass',
      'summary',
      'title',
      'width'
    ]
  ),
  'apex:panelgroup': new VisualforceTagSpecification(
    'apex:panelGroup',
    ' A container for multiple child components so that they can be displayed in a single panelGrid cell. An < apex:panelGroup > must be a child component of an < apex:panelGrid >.\n\n ',
    ['id', 'layout', 'rendered:b', 'style', 'styleClass']
  ),
  'apex:param': new VisualforceTagSpecification(
    'apex:param',
    ' A parameter for the parent component. The < apex:param > component can only be a child of the following components: < apex:actionFunction > < apex:actionSupport > < apex:commandLink > < apex:outputLink > < apex:outputText > < flow:interview > \n\n Within < apex:outputText >, there’s support for the < apex:param > tag to match the syntax of the MessageFormat class in Java.\n\n ',
    ['assignTo', 'id', 'name', 'value']
  ),
  'apex:pieseries': new VisualforceTagSpecification(
    'apex:pieSeries',
    ' A data series to be rendered as wedges in a Visualforce pie chart. At a minimum you must specify the fields in the data collection to use as label and value pairs for each pie wedge.\n\n Note: This component must be enclosed within an < apex:chart > component. You can only have one < apex:pieSeries > in a chart.\n\n ',
    [
      'colorSet',
      'dataField',
      'donut',
      'highlight:b',
      'id',
      'labelField',
      'rendered:b',
      'rendererFn',
      'showInLegend:b',
      'tips:b'
    ]
  ),
  'apex:radarseries': new VisualforceTagSpecification(
    'apex:radarSeries',
    ' A data series to be rendered as the area inside a series of connected points in a radial Visualforce chart. Radar charts are also sometimes called "spider web" charts. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as a radial axis to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:radarSeries > components in a single chart.\n\n ',
    [
      'fill',
      'highlight:b',
      'id',
      'markerFill',
      'markerSize',
      'markerType',
      'opacity',
      'rendered:b',
      'showInLegend:b',
      'strokeColor',
      'strokeWidth',
      'tips:b',
      'title',
      'xField',
      'yField'
    ]
  ),
  'apex:relatedlist': new VisualforceTagSpecification(
    'apex:relatedList',
    ' A list of Salesforce records that are related to a parent record with a lookup or master-detail relationship.\n\n ',
    ['id', 'list', 'pageSize', 'rendered:b', 'subject', 'title']
  ),
  'apex:remoteobjectfield': new VisualforceTagSpecification(
    'apex:remoteObjectField',
    'Defines the fields to load for an sObject. Fields defined using this component, instead of the fields attribute of < apex:remoteObjectModel >, can have a shorthand name, which allows the use of a "nickname" for the field in client-side JavaScript code, instead of the full API name. Use as child of < apex:remoteObjectModel >.\n\n',
    ['id', 'jsShorthand', 'name', 'rendered:b']
  ),
  'apex:remoteobjectmodel': new VisualforceTagSpecification(
    'apex:remoteObjectModel',
    'Defines an sObject and its fields to make accessible using Visualforce Remote Objects. This definition can include a shorthand name for the object, which you can use in JavaScript instead of the full API name. This is especially useful if your organization has a namespace, and makes your code more maintainable.',
    [
      'create',
      'delete',
      'fields',
      'id',
      'jsShorthand',
      'name',
      'rendered:b',
      'retrieve',
      'update'
    ]
  ),
  'apex:remoteobjects': new VisualforceTagSpecification(
    'apex:remoteObjects',
    'Use this component, along with child < apex:remoteObjectModel > and < apex:remoteObjectField > components, to specify the sObjects and fields to access using Visualforce Remote Objects. These components generate models in JavaScript that you can use for basic create, select, update, and delete operations in your client-side JavaScript code.\n\n',
    [
      'create',
      'delete',
      'id',
      'jsNamespace',
      'rendered:b',
      'retrieve',
      'update'
    ]
  ),
  'apex:repeat': new VisualforceTagSpecification(
    'apex:repeat',
    " An iteration component that allows you to output the contents of a collection according to a structure that you specify. The collection can include up to 1,000 items.\n\n Note that if used within an < apex:pageBlockSection > or < apex:panelGrid > component, all content generated by a child < apex:repeat > component is placed in a single < apex:pageBlockSection > or < apex:panelGrid > cell.\n\n This component can't be used as a direct child of the following components: < apex:panelBar > < apex:selectCheckboxes > < apex:selectList > < apex:selectRadio > < apex:tabPanel > \n\n ",
    ['first', 'id', 'rendered:b', 'rows', 'value', 'var']
  ),
  'apex:scatterseries': new VisualforceTagSpecification(
    'apex:scatterSeries',
    ' A data series to be rendered as individual (not connected) points in a linear Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as the X and Y axes to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:scatterSeries > components in a single chart. You can also add < apex:areaSeries >, < apex:barSeries >, and < apex:lineSeries > components, but the results might not be very readable.\n\n ',
    [
      'axis',
      'highlight:b',
      'id',
      'markerFill',
      'markerSize',
      'markerType',
      'rendered:b',
      'rendererFn',
      'showInLegend:b',
      'tips:b',
      'title',
      'xField',
      'yField'
    ]
  ),
  'apex:scontrol': new VisualforceTagSpecification(
    'apex:scontrol',
    " An inline frame that displays an s-control.\n\n Note: s-controls have been superseded by Visualforce pages. After March 2010 organizations that have never created s-controls, as well as new organizations, won't be allowed to create them. Existing s-controls remain unaffected.\n\n ",
    [
      'controlName',
      'height',
      'id',
      'rendered:b',
      'scrollbars:b',
      'subject',
      'width'
    ]
  ),
  'apex:sectionheader': new VisualforceTagSpecification(
    'apex:sectionHeader',
    ' A title bar for a page. In a standard Salesforce page, the title bar is a colored header displayed directly under the tab bar.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    ['description', 'help', 'id', 'printUrl', 'rendered:b', 'subtitle', 'title']
  ),
  'apex:selectcheckboxes': new VisualforceTagSpecification(
    'apex:selectCheckboxes',
    ' A set of related checkbox input elements, displayed in a table.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'accesskey',
      'border',
      'borderVisible:b',
      'dir',
      'disabled:b',
      'disabledClass',
      'enabledClass',
      'id',
      'immediate:b',
      'label',
      'lang',
      'layout',
      'legendInvisible:b',
      'legendText',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'readonly:b',
      'rendered:b',
      'required:b',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:selectlist': new VisualforceTagSpecification(
    'apex:selectList',
    ' A list of options that allows users to select only one value or multiple values at a time, depending on the value of its multiselect attribute.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    [
      'accesskey',
      'dir',
      'disabled:b',
      'disabledClass',
      'enabledClass',
      'id',
      'label',
      'lang',
      'multiselect:b',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'readonly:b',
      'rendered:b',
      'required:b',
      'size',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:selectoption': new VisualforceTagSpecification(
    'apex:selectOption',
    ' A possible value for an < apex:selectCheckboxes > or < apex:selectList > component. The < apex:selectOption > component must be a child of one of those components.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for components within an < apex:selectCheckboxes > or < apex:selectRadio > parent component, or to the generated tag for components within an < apex:selectList > parent component.\n\n ',
    [
      'dir',
      'id',
      'itemDescription',
      'itemDisabled:b',
      'itemEscaped:b',
      'itemLabel',
      'itemValue',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'style',
      'styleClass',
      'title',
      'value'
    ]
  ),
  'apex:selectoptions': new VisualforceTagSpecification(
    'apex:selectOptions',
    ' A collection of possible values for an < apex:selectCheckBoxes >, < apex:selectRadio >, or < apex:selectList > component. An < apex:selectOptions > component must be a child of one of those components. It must also be bound to a collection of selectOption objects in a custom Visualforce controller.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for components within an < apex:selectCheckboxes > or < apex:selectRadio > parent component, or the generated tag for components within an < apex:selectList > parent component.\n\n ',
    ['id', 'rendered:b', 'value']
  ),
  'apex:selectradio': new VisualforceTagSpecification(
    'apex:selectRadio',
    ' A set of related radio button input elements, displayed in a table. Unlike checkboxes, only one radio button can ever be selected at a time.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    [
      'accesskey',
      'border',
      'borderVisible:b',
      'dir',
      'disabled:b',
      'disabledClass',
      'enabledClass',
      'id',
      'immediate:b',
      'label',
      'lang',
      'layout',
      'legendInvisible:b',
      'legendText',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onfocus',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onselect',
      'readonly:b',
      'rendered:b',
      'required:b',
      'style',
      'styleClass',
      'tabindex',
      'title',
      'value'
    ]
  ),
  'apex:slds': new VisualforceTagSpecification(
    'apex:slds',
    'Allows Visualforce pages to reference Lightning Design System styling. Use this component instead of uploading the Lightning Design System as a static resource.\n\nInclude in a Visualforce page to use Lightning Design System stylesheets in the page.\n\nIn general, the Lightning Design System is already scoped. If you set applyBodyTag or applyHtmlTag to false, however, you must include the scoping class slds-scope. Within the scoping class, your markup can reference Lightning Design System styles and assets.\n\nTo reference assets in the Lightning Design System, such as SVG icons and other images, use the URLFOR() formula function and the $Asset global variable. To use SVG icons, add the required XML namespaces by using xmlns="http://www.w3.org/2000/svg" and xmlns:xlink="http://www.w3.org/1999/xlink" in the html tag.\n\nCurrently, if you are using the Salesforce sidebar, header, or built-in stylesheets, you can’t add attributes to the html tag. This means that SVG icons aren’t supported on your page if you don’t have showHeader, standardStylesheets, and sidebar set to false.\n\nFor examples of Lightning Design System styling, see the Salesforce Lightning Design System reference site.\n\n ',
    ['id', 'rendered:b']
  ),
  'apex:stylesheet': new VisualforceTagSpecification(
    'apex:stylesheet',
    ' A link to a stylesheet that can be used to style components on the Visualforce page. When specified, this component injects the stylesheet reference into the head element of the generated HTML page.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    ['id', 'value']
  ),
  'apex:tab': new VisualforceTagSpecification(
    'apex:tab',
    ' A single tab in an < apex:tabPanel >. The < apex:tab > component must be a child of a < apex:tabPanel >.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that wraps the tab\'s contents.\n\n ',
    [
      'disabled:b',
      'focus',
      'id',
      'immediate:b',
      'label',
      'labelWidth',
      'name',
      'onclick',
      'oncomplete',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'ontabenter',
      'ontableave',
      'rendered:b',
      'reRender',
      'status',
      'style',
      'styleClass',
      'switchType',
      'timeout',
      'title'
    ]
  ),
  'apex:tabpanel': new VisualforceTagSpecification(
    'apex:tabPanel',
    ' A page area that displays as a set of tabs. When a user clicks a tab header, the tab\'s associated content displays, hiding the content of other tabs.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that contains all of the tabs.\n\n ',
    [
      'activeTabClass',
      'contentClass',
      'contentStyle',
      'dir',
      'disabledTabClass',
      'headerAlignment',
      'headerClass',
      'headerSpacing',
      'height',
      'id',
      'immediate:b',
      'inactiveTabClass',
      'lang',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'reRender',
      'selectedTab',
      'style',
      'styleClass',
      'switchType',
      'tabClass',
      'title',
      'value',
      'width'
    ]
  ),
  'apex:toolbar': new VisualforceTagSpecification(
    'apex:toolbar',
    ' A stylized, horizontal toolbar that can contain any number of child components. By default, all child components are aligned to the left side of the toolbar. Use an < apex:toolbarGroup > component to align one or more child components to the right.\n\n ',
    [
      'contentClass',
      'contentStyle',
      'height',
      'id',
      'itemSeparator',
      'onclick',
      'ondblclick',
      'onitemclick',
      'onitemdblclick',
      'onitemkeydown',
      'onitemkeypress',
      'onitemkeyup',
      'onitemmousedown',
      'onitemmousemove',
      'onitemmouseout',
      'onitemmouseover',
      'onitemmouseup',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'separatorClass',
      'style',
      'styleClass',
      'width'
    ]
  ),
  'apex:toolbargroup': new VisualforceTagSpecification(
    'apex:toolbarGroup',
    ' A group of components within a toolbar that can be aligned to the left or right of the toolbar. The < apex:toolbarGroup > component must be a child component of an < apex:toolbar >.\n\n ',
    [
      'id',
      'itemSeparator',
      'location',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'rendered:b',
      'separatorClass',
      'style',
      'styleClass'
    ]
  ),
  'apex:variable': new VisualforceTagSpecification(
    'apex:variable',
    ' A local variable that can be used as a replacement for a specified expression within the body of the component. Use < apex:variable > to reduce repetitive and verbose expressions within a page.\n\n Note: < apex:variable > does not support reassignment inside of an iteration component, such as < apex:dataTable > or < apex:repeat >. The result of doing so, e.g., incrementing the < apex:variable > as a counter, is unsupported and undefined.\n\n ',
    ['id', 'rendered:b', 'value', 'var']
  ),
  'apex:vote': new VisualforceTagSpecification(
    'apex:vote',
    'A component that displays the vote control for an object that supports it.',
    ['id', 'objectId', 'rendered:b', 'rerender']
  ),
  'c:myvfcomponent': new VisualforceTagSpecification('c:myvfcomponent', '', [
    'id',
    'rendered:b'
  ]),
  'chatter:feed': new VisualforceTagSpecification(
    'chatter:feed',
    "Displays the Chatter EntityFeed for a record or an UserProfileFeed for a user. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component. Note also that the chatter:feed component doesn't support feedItemType when the EntityId entity is a user. Use SOQL to filter on the UserProfileFeed object's Type field instead.",
    [
      'entityId',
      'feedItemType',
      'id',
      'onComplete',
      'rendered:b',
      'reRender',
      'showPublisher:b'
    ]
  ),
  'chatter:feedwithfollowers': new VisualforceTagSpecification(
    'chatter:feedWithFollowers',
    'An integrated UI component that displays the Chatter feed for a record, as well as its list of followers. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component. Do not include this component inside an < apex:form > tag.\n\n',
    ['entityId', 'id', 'onComplete', 'rendered:b', 'reRender', 'showHeader:b']
  ),
  'chatter:follow': new VisualforceTagSpecification(
    'chatter:follow',
    'Renders a button for a user to follow or unfollow a Chatter record. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    ['entityId', 'id', 'onComplete', 'rendered:b', 'reRender']
  ),
  'chatter:followers': new VisualforceTagSpecification(
    'chatter:followers',
    'Displays the list of Chatter followers for a record. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    ['entityId', 'id', 'rendered:b']
  ),
  'chatter:newsfeed': new VisualforceTagSpecification(
    'chatter:newsfeed',
    'Displays the Chatter NewsFeed for the current user. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    ['id', 'onComplete', 'rendered:b', 'reRender']
  ),
  'chatter:userphotoupload': new VisualforceTagSpecification(
    'chatter:userPhotoUpload',
    'Uploads a user’s photo to their Chatter profile page. To use this component, you must enable Chatter in the org. Users must belong to either Standard User, Portal User, High Volume Portal User, or Chatter External User profiles.',
    ['id', 'rendered:b', 'showOriginalPhoto:b']
  ),
  'flow:interview': new VisualforceTagSpecification(
    'flow:interview',
    'This component embeds a Flow interview in the page.',
    [
      'allowShowPause:b',
      'buttonLocation',
      'buttonStyle',
      'finishLocation',
      'id',
      'interview',
      'name',
      'pausedInterviewId',
      'rendered:b',
      'rerender',
      'showHelp:b'
    ]
  ),
  'ideas:detailoutputlink': new VisualforceTagSpecification(
    'ideas:detailOutputLink',
    'A link to the page displaying an idea. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.',
    [
      'id',
      'ideaId',
      'page',
      'pageNumber',
      'pageOffset',
      'rendered:b',
      'style',
      'styleClass'
    ]
  ),
  'ideas:listoutputlink': new VisualforceTagSpecification(
    'ideas:listOutputLink',
    'A link to the page displaying a list of ideas. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.',
    [
      'category',
      'communityId',
      'id',
      'page',
      'pageNumber',
      'pageOffset',
      'rendered:b',
      'sort',
      'status',
      'stickyAttributes:b',
      'style',
      'styleClass'
    ]
  ),
  'ideas:profilelistoutputlink': new VisualforceTagSpecification(
    'ideas:profileListOutputLink',
    "A link to the page displaying a user's profile. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.",
    [
      'communityId',
      'id',
      'page',
      'pageNumber',
      'pageOffset',
      'rendered:b',
      'sort',
      'stickyAttributes:b',
      'style',
      'styleClass',
      'userId'
    ]
  ),
  'knowledge:articlecasetoolbar': new VisualforceTagSpecification(
    'knowledge:articleCaseToolbar',
    'UI component used when an article is opened from the case detail page. This component shows current case information and lets the user attach the article to the case.',
    ['articleId', 'caseId', 'id', 'includeCSS:b', 'rendered:b']
  ),
  'knowledge:articlelist': new VisualforceTagSpecification(
    'knowledge:articleList',
    ' A loop on a filtered list of articles. You can use this component up to four times on the same page. Note that you can only specify one criterion for each data category and that only standard fields are accessible, such as: ID (string): the ID of the article Title (string): the title of the article Summary (string): the summary of the article urlName (string): the URL name of the article articleTypeName (string): the developer name of the article type articleTypeLabel (string): the label of the article type lastModifiedDate (date): the date of the last modification firstPublishedDate (date): the date of the first publication lastPublishedDate (date): the date of the last publication \n\n',
    [
      'articleTypes',
      'articleVar',
      'categories',
      'hasMoreVar',
      'id',
      'isQueryGenerated:b',
      'keyword',
      'language',
      'pageNumber',
      'pageSize',
      'rendered:b',
      'sortBy'
    ]
  ),
  'knowledge:articlerenderertoolbar': new VisualforceTagSpecification(
    'knowledge:articleRendererToolbar',
    'Displays a header toolbar for an article. This toolbar includes voting stars, a Chatter feed, a language picklist and a properties panel. Ext JS versions less than 3 should not be included on pages that use this component.',
    [
      'articleId',
      'canVote:b',
      'id',
      'includeCSS:b',
      'rendered:b',
      'showChatter:b'
    ]
  ),
  'knowledge:articletypelist': new VisualforceTagSpecification(
    'knowledge:articleTypeList',
    'A loop on all available article types.',
    ['articleTypeVar', 'id', 'rendered:b']
  ),
  'knowledge:categorylist': new VisualforceTagSpecification(
    'knowledge:categoryList',
    " A loop on a subset of the category hierarchy. The total number of categories displayed in a page can't exceed 100.\n\n You must have access to the category you set as rootCategory to get a list of any categories. To list categories available to a user, see the Knowledge Support REST APIs.\n\n",
    [
      'ancestorsOf',
      'categoryGroup',
      'categoryVar',
      'id',
      'level',
      'rendered:b',
      'rootCategory'
    ]
  ),
  'liveagent:clientchat': new VisualforceTagSpecification(
    'liveAgent:clientChat',
    ' The main parent element for any Live Agent chat window. You must create this element in order to do any additional customization of Live Agent.\n\n Live Agent must be enabled for your organization. Note that this component can only be used once in a Live Agent deployment.\n\n',
    ['id', 'rendered:b']
  ),
  'liveagent:clientchatalertmessage': new VisualforceTagSpecification(
    'liveAgent:clientChatAlertMessage',
    ' The area in a Live Agent chat window that displays system alert messages (such as "You have been disconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one alert message area.\n\n',
    [
      'agentsUnavailableLabel',
      'chatBlockedLabel',
      'connectionErrorLabel',
      'dismissLabel',
      'id',
      'internalFailureLabel',
      'noCookiesLabel',
      'noFlashLabel',
      'noHashLabel',
      'rendered:b'
    ]
  ),
  'liveagent:clientchatcancelbutton': new VisualforceTagSpecification(
    'liveAgent:clientChatCancelButton',
    ' The button within a Live Agent chat window a visitor clicks to cancel a chat session.\n\n Must be used within < liveAgent:clientChat >.\n\n',
    ['id', 'label', 'rendered:b']
  ),
  'liveagent:clientchatendbutton': new VisualforceTagSpecification(
    'liveAgent:clientChatEndButton',
    ' The button within a Live Agent chat window a visitor clicks to end a chat session.\n\n Must be used within < liveAgent:clientChat >.\n\n',
    ['id', 'label', 'rendered:b']
  ),
  'liveagent:clientchatfiletransfer': new VisualforceTagSpecification(
    'liveAgent:clientChatFileTransfer',
    ' The file upload area in a Live Agent chat window where a visitor can send a file to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one file upload.\n\n',
    [
      'fileTransferCanceledLabel',
      'fileTransferCancelFileLabel',
      'fileTransferDropFileLabel',
      'fileTransferFailedLabel',
      'fileTransferSendFileLabel',
      'fileTransferSuccessfulLabel',
      'fileTransferUploadLabel',
      'fileTransferUploadMobileLabel',
      'id',
      'rendered:b'
    ]
  ),
  'liveagent:clientchatinput': new VisualforceTagSpecification(
    'liveAgent:clientChatInput',
    ' The text box in a Live Agent chat window where a visitor types messages to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one input box.\n\n',
    ['autoResizeElementId', 'id', 'rendered:b', 'useMultiline:b']
  ),
  'liveagent:clientchatlog': new VisualforceTagSpecification(
    'liveAgent:clientChatLog',
    ' The area in a Live Agent chat window that displays the chat transcript to a visitor.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one chat log.\n\n',
    [
      'agentTypingLabel',
      'chatEndedByAgentLabel',
      'chatEndedByVisitorIdleTimeoutLabel',
      'chatEndedByVisitorLabel',
      'chatTransferredLabel',
      'combineMessagesText:b',
      'id',
      'rendered:b',
      'showTimeStamp:b',
      'visitorNameLabel'
    ]
  ),
  'liveagent:clientchatlogalertmessage': new VisualforceTagSpecification(
    'liveAgent:clientChatLogAlertMessage',
    ' The area in a Live Agent chat window that displays the idle time-out alert (customer warning) to a visitor.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one idle time-out alert.\n\n',
    [
      'autoResizeElementId',
      'id',
      'rendered:b',
      'respondToChatLabel',
      'respondWithinTimeLabel'
    ]
  ),
  'liveagent:clientchatmessages': new VisualforceTagSpecification(
    'liveAgent:clientChatMessages',
    ' The area in a Live Agent chat window that displays system status messages (such as "Chat session has been disconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one message area.\n\n',
    ['id', 'rendered:b']
  ),
  'liveagent:clientchatqueueposition': new VisualforceTagSpecification(
    'liveAgent:clientChatQueuePosition',
    " A text label indicating a visitor's position within a queue for a chat session initiated via a button that uses push routing. (On buttons that use pull routing, this component has no effect.)\n\n Must be used within < liveAgent:clientChat >.\n\n",
    ['id', 'label', 'rendered:b']
  ),
  'liveagent:clientchatsavebutton': new VisualforceTagSpecification(
    'liveAgent:clientChatSaveButton',
    ' The button in a Live Agent chat window a visitor clicks to save the chat transcript as a local file.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have multiple save buttons.\n\n',
    ['id', 'label', 'rendered:b']
  ),
  'liveagent:clientchatsendbutton': new VisualforceTagSpecification(
    'liveAgent:clientChatSendButton',
    ' The button in a Live Agent chat window a visitor clicks to send a chat message to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have multiple send buttons.\n\n',
    ['id', 'label', 'rendered:b']
  ),
  'liveagent:clientchatstatusmessage': new VisualforceTagSpecification(
    'liveAgent:clientChatStatusMessage',
    ' The area in a Live Agent chat window that displays system status messages (such as "You are being reconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one status message area.\n\n',
    ['id', 'reconnectingLabel', 'rendered:b']
  ),
  'messaging:attachment': new VisualforceTagSpecification(
    'messaging:attachment',
    'Compose an attachment and append it to the email.',
    ['filename', 'id', 'inline:b', 'renderAs', 'rendered:b']
  ),
  'messaging:emailheader': new VisualforceTagSpecification(
    'messaging:emailHeader',
    'Adds a custom header to the email. The body of a header is limited to 1000 characters.',
    ['id', 'name', 'rendered:b']
  ),
  'messaging:emailtemplate': new VisualforceTagSpecification(
    'messaging:emailTemplate',
    'Defines a Visualforce email template. All email template tags must be wrapped inside a single emailTemplate component tag. emailTemplate must contain either an htmlEmailBody tag or a plainTextEmailBody tag. The detail and form components are not permitted as child nodes. This component can only be used within a Visualforce email template. Email templates can be created and managed through Setup | Communication Templates | Email Templates.',
    [
      'id',
      'language',
      'recipientType',
      'relatedToType',
      'rendered:b',
      'replyTo',
      'subject'
    ]
  ),
  'messaging:htmlemailbody': new VisualforceTagSpecification(
    'messaging:htmlEmailBody',
    'The HTML version of the email body.',
    ['id', 'rendered:b']
  ),
  'messaging:plaintextemailbody': new VisualforceTagSpecification(
    'messaging:plainTextEmailBody',
    'The plain text (non-HTML) version of the email body.',
    ['id', 'rendered:b']
  ),
  'site:googleanalyticstracking': new VisualforceTagSpecification(
    'site:googleAnalyticsTracking',
    "The standard component used to integrate Google Analytics with Force.com sites to track and analyze site usage. Add this component just once, either on the site template for the pages you want to track, or the individual pages themselves. Don't set the component for both the template and the page. Attention: This component only works on pages used in a Force.com site. Sites must be enabled for your organization and the Analytics Tracking Code field must be populated. To get a tracking code, go to the Google Analytics website.",
    ['id', 'rendered:b']
  ),
  'site:previewasadmin': new VisualforceTagSpecification(
    'site:previewAsAdmin',
    'This component shows detailed error messages on a site in administrator preview mode. We recommend that you add it right before the closing apex:page tag. Note: The site:previewAsAdmin component contains the apex:messages tag, so if you have that tag elsewhere on your error pages, you will see the error message twice.',
    ['id', 'rendered:b']
  ),
  'social:profileviewer': new VisualforceTagSpecification(
    'social:profileViewer',
    " UI component that adds the Social Accounts and Contacts viewer to Account (including person account), Contact, or Lead detail pages. The viewer displays the record name, a profile picture, and the social network icons that allow users to sign in to their accounts and view social data directly in Salesforce.\n\n Social Accounts and Contacts must be enabled for your organization. Note that this component is only supported for Account, Contact, and Lead objects and can only be used once on a page. This component isn't available for Visualforce pages on Force.com sites.\n\n",
    ['entityId', 'id', 'rendered:b']
  ),
  'support:casearticles': new VisualforceTagSpecification(
    'support:caseArticles',
    'Displays the case articles tool. The tool can show articles currently attached to the Case and/or an article Keyword search. This component can only be used in organizations that have Case Feed and Knowledge enabled. Ext JS versions less than 3 should not be included on pages that use this component.',
    [
      'articleTypes',
      'attachToEmailEnabled:b',
      'bodyHeight',
      'caseId',
      'categories',
      'categoryMappingEnabled:b',
      'defaultKeywords',
      'defaultSearchType',
      'id',
      'insertLinkToEmail:b',
      'language',
      'logSearch:b',
      'mode',
      'onSearchComplete',
      'rendered:b',
      'reRender',
      'searchButtonName',
      'searchFieldWidth',
      'searchFunctionName',
      'showAdvancedSearch:b',
      'title',
      'titlebarStyle',
      'width'
    ]
  ),
  'support:casefeed': new VisualforceTagSpecification(
    'support:caseFeed',
    'The Case Feed component includes all of the elements of the standard Case Feed page, including the publishers (Email , Portal, Log a Call, and Internal Note), case activity feed, feed filters, and highlights panel. This component can only be used in organizations that have Case Feed enabled.',
    ['caseId', 'id', 'rendered:b']
  ),
  'support:caseunifiedfiles': new VisualforceTagSpecification(
    'support:caseUnifiedFiles',
    'Displays the Files component.',
    ['entityId', 'id', 'rendered:b']
  ),
  'support:clicktodial': new VisualforceTagSpecification(
    'support:clickToDial',
    "A component that renders a valid phone number as click-to-dial enabled for Open CTI for Salesforce Classic or Salesforce CRM Call Center. This field respects any existing click-to-dial commands for computer-telephony integrations (CTI) with Salesforce.\n\n Note: This component doesn't work with embedded Visualforce pages within standard page layouts. If you create a Visualforce page with a custom console component, you must set the showHeader attribute to true. If this attribute is set to false, click-to-dial is disabled. This component doesn’t work with Open CTI for Lightning Experience. \n\n",
    ['entityId', 'id', 'number', 'params', 'rendered:b']
  ),
  'topics:widget': new VisualforceTagSpecification(
    'topics:widget',
    ' UI component that displays topics assigned to a record and allows users to add and remove topics. The UI component is available only if topics are enabled for these supported objects: accounts, assets, campaigns, cases, contacts, contracts, leads, opportunities, and custom objects.',
    [
      'customUrl',
      'entity',
      'hideSuccessMessage:b',
      'id',
      'rendered:b',
      'renderStyle'
    ]
  ),
  'wave:dashboard': new VisualforceTagSpecification(
    'wave:dashboard',
    'Use this component to add a Salesforce Analytics dashboard to a Visualforce page.',
    [
      'dashboardId',
      'developerName',
      'filter',
      'height',
      'hideOnError:b',
      'id',
      'openLinksInNewWindow:b',
      'rendered:b',
      'showHeader:b',
      'showSharing:b',
      'showTitle:b',
      'width'
    ]
  )
};
