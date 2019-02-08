/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:quotemark

import { HTMLDataProvider, ITagData } from 'vscode-html-languageservice';

export function getVisualforceDataProvider() {
  return new HTMLDataProvider('visualforce', {
    version: 1,
    tags: VISUALFORCE_TAGS
  });
}

const VISUALFORCE_TAGS: ITagData[] = [
  {
    name: 'analytics:reportChart',
    description:
      'Use this component to add Salesforce report charts to a Visualforce page. You can filter chart data to show specific results. The component is available in API version 29.0 or later.\n\n Before you add a report chart, check that the source report has a chart in Salesforce app.\n\n',
    attributes: [
      {
        name: 'cacheAge'
      },
      {
        name: 'cacheResults:b'
      },
      {
        name: 'developerName'
      },
      {
        name: 'hideOnError:b'
      },
      {
        name: 'id'
      },
      {
        name: 'rendered:b'
      },
      {
        name: 'reportId'
      },
      {
        name: 'showRefreshButton:b'
      },
      {
        name: 'size'
      }
    ]
  },
  {
    name: 'apex:actionFunction',
    description:
      "A component that provides support for invoking controller action methods directly from JavaScript code using an AJAX request. An < apex:actionFunction > component must be a child of an < apex:form > component. Because binding between the caller and < apex:actionFunction > is done based on parameter order, ensure that the order of < apex:param > is matched by the caller's argument list.\n\n Unlike < apex:actionSupport >, which only provides support for invoking controller action methods from other Visualforce components, < apex:actionFunction > defines a new JavaScript function which can then be called from within a block of JavaScript code.\n\n Note: Beginning with API version 23 you can't place < apex:actionFunction > inside an iteration component — < apex:pageBlockTable >, < apex:repeat >, and so on. Put the < apex:actionFunction > after the iteration component, and inside the iteration put a normal JavaScript function that calls it.\n\n ",
    attributes: [
      { name: 'action' },
      { name: 'focus' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'name' },
      { name: 'namespace' },
      { name: 'onbeforedomupdate' },
      { name: 'oncomplete' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'status' },
      { name: 'timeout' }
    ]
  },
  {
    name: 'apex:actionPoller',
    description:
      "A timer that sends an AJAX request to the server according to a time interval that you specify. Each request can result in a full or partial page update. \n\n An < apex:actionPoller > must be within the region it acts upon. For example, to use an < apex:actionPoller > with an < apex:actionRegion >, the < apex:actionPoller > must be within the < apex:actionRegion >. \n\n Considerations When Using < apex:actionPoller > \n\n Action methods used by < apex:actionPoller > should be lightweight. It's a best practice to avoid performing DML, external service calls, and other resource-intensive operations in action methods called by an < apex:actionPoller >. Consider carefully the effect of your action method being called repeatedly by an < apex:actionPoller > at the interval you specify, especially if it's used on a page that will be widely distributed, or left open for long periods. < apex:actionPoller > refreshes the connection regularly, keeping login sessions alive. A page with < apex:actionPoller > on it won't time out due to inactivity. If an < apex:actionPoller > is ever re-rendered as the result of another action, it resets itself. Avoid using this component with enhanced lists. ",
    attributes: [
      { name: 'action' },
      { name: 'enabled:b' },
      { name: 'id' },
      { name: 'interval' },
      { name: 'oncomplete' },
      { name: 'onsubmit' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'status' },
      { name: 'timeout' }
    ]
  },
  {
    name: 'apex:actionRegion',
    description:
      'An area of a Visualforce page that demarcates which components should be processed by the Force.com server when an AJAX request is generated. Only the components in the body of the < apex:actionRegion > are processed by the server, thereby increasing the performance of the page.\n\n Note that an < apex:actionRegion > component only defines which components the server processes during a request&#x2014;it doesn’t define what areas of the page are re-rendered when the request completes. To control that behavior, use the rerender attribute on an < apex:actionSupport >, < apex:actionPoller >, < apex:commandButton >, < apex:commandLink >, < apex:tab >, or < apex:tabPanel > component.\n\n See Also: Using the transient keyword\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'rendered:b' },
      { name: 'renderRegionOnly:b' }
    ]
  },
  {
    name: 'apex:actionStatus',
    description:
      'A component that displays the status of an AJAX update request. An AJAX request can either be in progress or complete.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'for' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'layout' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onstart' },
      { name: 'onstop' },
      { name: 'rendered:b' },
      { name: 'startStyle' },
      { name: 'startStyleClass' },
      { name: 'startText' },
      { name: 'stopStyle' },
      { name: 'stopStyleClass' },
      { name: 'stopText' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:actionSupport',
    description:
      'A component that adds AJAX support to another component, allowing the component to be refreshed asynchronously by the server when a particular event occurs, such as a button click or mouseover.\n\n See also: < apex:actionFunction >.\n\n ',
    attributes: [
      { name: 'action' },
      { name: 'disabled:b' },
      { name: 'disableDefault:b' },
      { name: 'event' },
      { name: 'focus' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'onbeforedomupdate' },
      { name: 'oncomplete' },
      { name: 'onsubmit' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'status' },
      { name: 'timeout' }
    ]
  },
  {
    name: 'apex:areaSeries',
    description:
      'A data series to be rendered as shaded areas in a Visualforce chart. It\'s similar to a line series with the fill attribute set to true, except that multiple Y values for each X will "stack" as levels upon each other.\n\n At a minimum you must specify the fields in the data collection to use as X and Y values for each point along the line that defines the amount of area each point represents, as well as the X and Y axes to scale against. Add multiple Y values to add levels to the chart. Each level takes a new color.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:areaSeries > components in a single chart, and you can add < apex:barSeries >, < apex:lineSeries >, and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    attributes: [
      { name: 'axis' },
      { name: 'colorSet' },
      { name: 'highlight:b' },
      { name: 'highlightLineWidth' },
      { name: 'highlightOpacity' },
      { name: 'highlightStrokeColor' },
      { name: 'id' },
      { name: 'opacity' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'showInLegend:b' },
      { name: 'tips:b' },
      { name: 'title' },
      { name: 'xField' },
      { name: 'yField' }
    ]
  },
  {
    name: 'apex:attribute',
    description:
      'A definition of an attribute on a custom component. The attribute tag can only be a child of a component tag.\n\n Note that you cannot define attributes with names like id or rendered. These attributes are automatically created for all custom component definitions.\n\n ',
    attributes: [
      { name: 'access' },
      { name: 'assignTo' },
      { name: 'default' },
      { name: 'description' },
      { name: 'encode:b' },
      { name: 'id' },
      { name: 'name' },
      { name: 'required:b' },
      { name: 'type' }
    ]
  },
  {
    name: 'apex:axis',
    description:
      'Defines an axis for a chart. Use this to set the units, scale, labeling, and other visual options for the axis. You can define up to four axes for a single chart, one for each edge.\n\n Note: This component must be enclosed within an < apex:chart > component.\n\n ',
    attributes: [
      { name: 'dashSize' },
      { name: 'fields' },
      { name: 'grid:b' },
      { name: 'gridFill:b' },
      { name: 'id' },
      { name: 'margin' },
      { name: 'maximum' },
      { name: 'minimum' },
      { name: 'position' },
      { name: 'rendered:b' },
      { name: 'steps' },
      { name: 'title' },
      { name: 'type' }
    ]
  },
  {
    name: 'apex:barSeries',
    description:
      'A data series to be rendered as bars in a Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each bar, as well as the X and Y axes to scale against. Add multiple Y values to add grouped or stacked bar segments to the chart. Each segment takes a new color.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:barSeries > and < apex:lineSeries > components in a single chart. You can also add < apex:areaSeries > and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    attributes: [
      { name: 'axis' },
      { name: 'colorSet' },
      { name: 'colorsProgressWithinSeries:b' },
      { name: 'groupGutter' },
      { name: 'gutter' },
      { name: 'highlight:b' },
      { name: 'highlightColor' },
      { name: 'highlightLineWidth' },
      { name: 'highlightOpacity' },
      { name: 'highlightStroke' },
      { name: 'id' },
      { name: 'orientation' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'showInLegend:b' },
      { name: 'stacked:b' },
      { name: 'tips:b' },
      { name: 'title' },
      { name: 'xField' },
      { name: 'xPadding' },
      { name: 'yField' },
      { name: 'yPadding' }
    ]
  },
  {
    name: 'apex:canvasApp',
    description:
      "Renders a canvas app identified by the given developerName/namespacePrefix or applicationName/namespacePrefix value pair. The developerName attribute takes precedence if both developerName and applicationName are set. \n\n Requirements: Force.com Canvas should be enabled in the organization. \n\n Keep the following considerations in mind when using the < apex:canvasApp > component: A development organization is an organization in which a canvas app is developed and packaged. An installation organization is an organization in which a packaged canvas app is installed. The < apex:canvasApp > component usage in a Visualforce page isn't updated if a canvas app's application name or developer name is changed. A canvas app can be deleted even if there's a Visualforce page referencing it via < apex:canvasApp > . \n\n",
    attributes: [
      { name: 'applicationName' },
      { name: 'border' },
      { name: 'canvasId' },
      { name: 'containerId' },
      { name: 'developerName' },
      { name: 'entityFields' },
      { name: 'height' },
      { name: 'id' },
      { name: 'maxHeight' },
      { name: 'maxWidth' },
      { name: 'namespacePrefix' },
      { name: 'onCanvasAppError' },
      { name: 'onCanvasAppLoad' },
      { name: 'parameters' },
      { name: 'rendered:b' },
      { name: 'scrolling' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:chart',
    description:
      'A Visualforce chart. Defines general characteristics of the chart, including size and data binding.\n\n ',
    attributes: [
      { name: 'animate:b' },
      { name: 'background' },
      { name: 'colorSet' },
      { name: 'data' },
      { name: 'floating:b' },
      { name: 'height' },
      { name: 'hidden:b' },
      { name: 'id' },
      { name: 'legend:b' },
      { name: 'name' },
      { name: 'rendered:b' },
      { name: 'renderTo' },
      { name: 'resizable:b' },
      { name: 'theme' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:chartLabel',
    description:
      'Defines how labels are displayed. Depending on what component wraps it, < apex:chartLabel > gives you options for affecting the display of data series labels, pie chart segment labels, and axes labels.\n\n Note: This component must be enclosed by a data series component or an < apex:axis > component.\n\n ',
    attributes: [
      { name: 'color' },
      { name: 'display' },
      { name: 'field' },
      { name: 'font' },
      { name: 'id' },
      { name: 'minMargin' },
      { name: 'orientation' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'rotate' }
    ]
  },
  {
    name: 'apex:chartTips',
    description:
      'Defines tooltips which appear on mouseover of data series elements. This component offers more configuration options than the default tooltips displayed by setting the tips attribute of a data series component to true.\n\n Note: This component must be enclosed by a data series component.\n\n ',
    attributes: [
      { name: 'height' },
      { name: 'id' },
      { name: 'labelField' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'trackMouse:b' },
      { name: 'valueField' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:column',
    description:
      'A single column in a table. An < apex:column > component must always be a child of an < apex:dataTable > or < apex:pageBlockTable > component.\n\n Note that if you specify an sObject field as the value attribute for an < apex:column >, the associated label for that field is used as the column header by default. To override this behavior, use the headerValue attribute on the column, or the column\'s header facet.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for the column in every row of the table.\n\n ',
    attributes: [
      { name: 'breakBefore:b' },
      { name: 'colspan' },
      { name: 'dir' },
      { name: 'footerClass' },
      { name: 'footercolspan' },
      { name: 'footerdir' },
      { name: 'footerlang' },
      { name: 'footeronclick' },
      { name: 'footerondblclick' },
      { name: 'footeronkeydown' },
      { name: 'footeronkeypress' },
      { name: 'footeronkeyup' },
      { name: 'footeronmousedown' },
      { name: 'footeronmousemove' },
      { name: 'footeronmouseout' },
      { name: 'footeronmouseover' },
      { name: 'footeronmouseup' },
      { name: 'footerstyle' },
      { name: 'footertitle' },
      { name: 'footerValue' },
      { name: 'headerClass' },
      { name: 'headercolspan' },
      { name: 'headerdir' },
      { name: 'headerlang' },
      { name: 'headeronclick' },
      { name: 'headerondblclick' },
      { name: 'headeronkeydown' },
      { name: 'headeronkeypress' },
      { name: 'headeronkeyup' },
      { name: 'headeronmousedown' },
      { name: 'headeronmousemove' },
      { name: 'headeronmouseout' },
      { name: 'headeronmouseover' },
      { name: 'headeronmouseup' },
      { name: 'headerstyle' },
      { name: 'headertitle' },
      { name: 'headerValue' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'rowspan' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'value' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:commandButton',
    description:
      'A button that is rendered as an HTML input element with the type attribute set to submit, reset, or image, depending on the < apex:commandButton > tag\'s specified values. The button executes an action defined by a controller, and then either refreshes the current page, or navigates to a different page based on the PageReference variable that is returned by the action.\n\n An < apex:commandButton > component must always be a child of an < apex:form > component.\n\n See also: < apex:commandLink >\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'action' },
      { name: 'alt' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'image' },
      { name: 'immediate:b' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onclick' },
      { name: 'oncomplete' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'status' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'timeout' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:commandLink',
    description:
      'A link that executes an action defined by a controller, and then either refreshes the current page, or navigates to a different page based on the PageReference variable that is returned by the action. An < apex:commandLink > component must always be a child of an < apex:form > component.\n\n To add request parameters to an < apex:commandLink >, use nested < apex:param > components.\n\n See also: < apex:commandButton >, < apex:outputLink >.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'action' },
      { name: 'charset' },
      { name: 'coords' },
      { name: 'dir' },
      { name: 'hreflang' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onclick' },
      { name: 'oncomplete' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rel' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'rev' },
      { name: 'shape' },
      { name: 'status' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'target' },
      { name: 'timeout' },
      { name: 'title' },
      { name: 'type' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:component',
    description:
      'A custom Visualforce component. All custom component definitions must be wrapped inside a single < apex:component > tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag, or , depending on the layout attribute.\n\n ',
    attributes: [
      { name: 'access' },
      { name: 'allowDML:b' },
      { name: 'controller' },
      { name: 'extensions' },
      { name: 'id' },
      { name: 'language' },
      { name: 'layout' },
      { name: 'rendered:b' },
      { name: 'selfClosing:b' }
    ]
  },
  {
    name: 'apex:componentBody',
    description:
      'This tag allows a custom component author to define a location where a user can insert content into the custom component. This is especially useful for generating custom iteration components. This component is valid only within an < apex:component > tag, and only a single definition per custom component is allowed.\n\n ',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'apex:componentExample',
    description:
      'Defines an example for a component definition that will be displayed in the online component reference.',
    attributes: [
      { name: 'demoPage' },
      { name: 'description' },
      { name: 'examplePage' },
      { name: 'id' },
      { name: 'imageURL' },
      { name: 'name' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'apex:composition',
    description:
      "An area of a page that includes content from a second template page. Template pages are Visualforce pages that include one or more < apex:insert > components. The < apex:composition > component names the associated template, and provides body for the template's < apex:insert > components with matching < apex:define > components. Any content outside of an < apex:composition > component is not rendered.\n\n See also: < apex:insert >, < apex:define >\n\n ",
    attributes: [{ name: 'rendered' }, { name: 'template' }]
  },
  {
    name: 'apex:dataList',
    description:
      'An ordered or unordered list of values that is defined by iterating over a set of data. The body of the < apex:dataList > component specifies how a single item should appear in the list. The data set can include up to 1,000 items.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'first' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'rows' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'type' },
      { name: 'value' },
      { name: 'var' }
    ]
  },
  {
    name: 'apex:dataTable',
    description:
      'An HTML table that’s defined by iterating over a set of data, displaying information about one item of data per row. The body of the contains one or more column components that specify what information should be displayed for each item of data. The data set can include up to 1,000 items, or 10,000 items when the page is executed in read-only mode.\n\n For Visualforce pages running Salesforce.com API version 20.0 or higher, an tag can be contained within this component to generate columns.\n\n See also: \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated table\'s tag.\n\n ',
    attributes: [
      { name: 'align' },
      { name: 'bgcolor' },
      { name: 'border' },
      { name: 'captionClass' },
      { name: 'captionStyle' },
      { name: 'cellpadding' },
      { name: 'cellspacing' },
      { name: 'columnClasses' },
      { name: 'columns' },
      { name: 'columnsWidth' },
      { name: 'dir' },
      { name: 'first' },
      { name: 'footerClass' },
      { name: 'frame' },
      { name: 'headerClass' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onRowClick' },
      { name: 'onRowDblClick' },
      { name: 'onRowMouseDown' },
      { name: 'onRowMouseMove' },
      { name: 'onRowMouseOut' },
      { name: 'onRowMouseOver' },
      { name: 'onRowMouseUp' },
      { name: 'rendered:b' },
      { name: 'rowClasses' },
      { name: 'rows' },
      { name: 'rules' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'summary' },
      { name: 'title' },
      { name: 'value' },
      { name: 'var' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:define',
    description:
      'A template component that provides content for an < apex:insert > component defined in a Visualforce template page. \n\n See also: < apex:composition >, < apex:insert >\n\n ',
    attributes: [{ name: 'name' }]
  },
  { name: 'apex:description', description: '', attributes: [] },
  {
    name: 'apex:detail',
    description:
      'The standard detail page for a particular object, as defined by the associated page layout for the object in Setup. This component includes attributes for including or excluding the associated related lists, related list hover links, and title bar that appear in the standard Salesforce application interface.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'inlineEdit:b' },
      { name: 'oncomplete' },
      { name: 'relatedList:b' },
      { name: 'relatedListHover:b' },
      { name: 'rendered:b' },
      { name: 'rerender' },
      { name: 'showChatter:b' },
      { name: 'subject' },
      { name: 'title:b' }
    ]
  },
  {
    name: 'apex:dynamicComponent',
    description:
      'This tag acts as a placeholder for your dynamic Apex components. It has one required parameter—componentValue—which accepts the name of an Apex method that returns a dynamic component.\n\n The following Visualforce components do not have dynamic Apex representations: < apex:attribute > < apex:component > < apex:componentBody > < apex:composition > < apex:define > < apex:dynamicComponent > < apex:include > < apex:insert > < apex:param > < apex:variable > \n\n ',
    attributes: [
      { name: 'componentValue' },
      { name: 'id' },
      { name: 'invokeAfterAction:b' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'apex:enhancedList',
    description:
      'The list view picklist for an object, including its associated list of records for the currently selected view. In standard Salesforce applications this component is displayed on the main tab for a particular object. This component has additional attributes that can be specified, such as the height and rows per page, as compared to < apex:listView >.\n\n Note: When an < apex:enhancedList > is rerendered through another component\'s rerender attribute, the < apex:enhancedList > must be inside of an < apex:outputPanel > component that has its layout attribute set to "block". The < apex:enhancedList > component is not allowed on pages that have the attribute showHeader set to false. You can only have five < apex:enhancedList > components on a single page. Ext JS versions less than 3 should not be included on pages that use this component.\n\n See also: < apex:listView >.\n\n ',
    attributes: [
      { name: 'customizable:b' },
      { name: 'height' },
      { name: 'id' },
      { name: 'listId' },
      { name: 'oncomplete' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'rowsPerPage' },
      { name: 'type' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:facet',
    description:
      "A placeholder for content that's rendered in a specific part of the parent component, such as the header or footer of an .\n\n An component can only exist in the body of a parent component if the parent supports facets. The name of the facet component must match one of the pre-defined facet names on the parent component. This name determines where the content of the facet component is rendered. The order in which a facet component is defined within the body of a parent component doesn't affect the appearance of the parent component.\n\n See for an example of facets.\n\n Note: Although you can't represent an directly in Apex, you can specify it on a dynamic component that has the facet. For example:\n\n Component.apex.dataTable dt = new Component.apex.dataTable(); dt.facets.header = 'Header Facet';\n\n",
    attributes: [{ name: 'name' }]
  },
  {
    name: 'apex:flash',
    description: 'A Flash movie, rendered with the HTML object and embed tags.',
    attributes: [
      { name: 'flashvars' },
      { name: 'height' },
      { name: 'id' },
      { name: 'loop:b' },
      { name: 'play:b' },
      { name: 'rendered:b' },
      { name: 'src' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:form',
    description:
      "A section of a Visualforce page that allows users to enter input and then submit it with an < apex:commandButton > or < apex:commandLink >. The body of the form determines the data that is displayed and the way it's processed. It's a best practice to use only one < apex:form > tag in a page or custom component.\n\n As of API version 18.0, this tag can't be a child component of < apex:repeat >.\n\n This component supports HTML pass-through attributes using the \"html-\" prefix. Pass-through attributes are attached to the generated tag.\n\n ",
    attributes: [
      { name: 'accept' },
      { name: 'acceptcharset' },
      { name: 'dir' },
      { name: 'enctype' },
      { name: 'forceSSL:b' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onreset' },
      { name: 'onsubmit' },
      { name: 'prependId:b' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'target' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:gaugeSeries',
    description:
      'A data series that shows progress along a specific metric. At a minimum you must specify the fields in the data collection to use as label and value pair for the gauge level to be shown. The readability of a gauge chart benefits when you specify meaningful values for the minimum and maximum along the associated < apex:axis >, which must be of type "gauge".\n\n Note: This component must be enclosed within an < apex:chart > component. You should put only one < apex:gaugeSeries > in a chart.\n\n ',
    attributes: [
      { name: 'colorSet' },
      { name: 'dataField' },
      { name: 'donut' },
      { name: 'highlight:b' },
      { name: 'id' },
      { name: 'labelField' },
      { name: 'needle:b' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'tips:b' }
    ]
  },
  {
    name: 'apex:iframe',
    description:
      'A component that creates an inline frame within a Visualforce page. A frame allows you to keep some information visible while other information is scrolled or replaced.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'frameborder:b' },
      { name: 'height' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'scrolling:b' },
      { name: 'src' },
      { name: 'title' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:image',
    description:
      'A graphic image, rendered with the HTML < img > tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'alt' },
      { name: 'dir' },
      { name: 'height' },
      { name: 'id' },
      { name: 'ismap:b' },
      { name: 'lang' },
      { name: 'longdesc' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'url' },
      { name: 'usemap' },
      { name: 'value' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:include',
    description:
      'A component that inserts a second Visualforce page into the current page. The entire page subtree is injected into the Visualforce DOM at the point of reference and the scope of the included page is maintained.\n\n If content should be stripped from the included page, use the < apex:composition > component instead.\n\n ',
    attributes: [{ name: 'id' }, { name: 'pageName' }, { name: 'rendered:b' }]
  },
  {
    name: 'apex:includeLightning',
    description:
      'Includes the Lightning Components for Visualforce JavaScript library, lightning.out.js, from the correct Salesforce domain.',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'apex:includeScript',
    description:
      'A link to a JavaScript library that can be used in the Visualforce page. When specified, this component injects a script reference into the element of the generated HTML page.\n\n Multiple references to the same script are de-duplicated, making this component safe to use inside an iteration component. This might occur if, for example, you use an inside a custom component, and then use that component inside an iteration.\n\n For performance reasons, you might choose to use a static JavaScript tag before your closing tag, rather than this component. If you do, you\'ll need to manage de-duplication yourself.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [{ name: 'id' }, { name: 'loadOnReady:b' }, { name: 'value' }]
  },
  {
    name: 'apex:inlineEditSupport',
    description:
      'This component provides inline editing support to < apex:outputField > and various container components. In order to support inline editing, this component must also be within an < apex:form > tag.\n\n The < apex:inlineEditSupport > component can only be a descendant of the following tags: < apex:dataList > < apex:dataTable > < apex:form > < apex:outputField > < apex:pageBlock > < apex:pageBlockSection > < apex:pageBlockTable > < apex:repeat > \n\n See also: the inlineEdit attribute of < apex:detail >\n\n ',
    attributes: [
      { name: 'changedStyleClass' },
      { name: 'disabled:b' },
      { name: 'event' },
      { name: 'hideOnEdit' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'resetFunction' },
      { name: 'showOnEdit' }
    ]
  },
  {
    name: 'apex:input',
    description:
      'An HTML5-friendly general purpose input component that adapts to the data expected by a form field. It uses the HTML type attribute to allow client browsers to display type-appropriate user input widgets, such as a date picker or range slider, or to perform client-side formatting or validation, such as with a numeric range or a telephone number. Use this component to get user input for a controller property or method that does not correspond to a field on a Salesforce object.\n\n This component doesn\'t use Salesforce styling. Also, since it doesn\'t correspond to a Salesforce field, or any other data on an object, custom code is required to use the value the user enters.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'alt' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'list' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'size' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'type' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputCheckbox',
    description:
      'An HTML input element of type checkbox. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'selected:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputField',
    description:
      'An HTML input element for a value that corresponds to a field on a Salesforce object. The component respects the attributes of the associated field, including whether the field is required or unique, and the user interface widget to display to get input from the user. For example, if the specified component is a date field, a calendar input widget is displayed. When used in an , tags automatically display with their corresponding output label.\n\n Consider the following when using DOM events with this tag: For lookup fields, mouse events fire on both the text box and graphic icon. For multi-select picklists, all events fire, but the DOM ID is suffixed with _unselected for the left box, _selected for the right box, and _right_arrow and _left_arrow for the graphic icons. For rich text areas, no events fire. \n\n Note: Read-only fields, and fields for certain Salesforce objects with complex automatic behavior, such as Event.StartDateTime and Event.EndDateTime, don\'t render as editable when using . Use a different input component such as instead. An component for a rich text area field can\'t be used for image uploads in Site.com sites or Force.com Sites due to security constraints. If you want to enable users to upload image files in either of those contexts, use an component. If custom help is defined for the field in Setup, the field must be a child of an or , and the Salesforce page header must be displayed for the custom help to appear on your Visualforce page. To override the display of custom help, use the in the body of an . \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'label' },
      { name: 'list' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'showDatePicker:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'taborderhint' },
      { name: 'type' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputFile',
    description:
      'A component that creates an input field to upload a file.\n\n Note: The maximum file size that can be uploaded via Visualforce is 10 MB.\n\n',
    attributes: [
      { name: 'accept' },
      { name: 'accessKey' },
      { name: 'alt' },
      { name: 'contentType' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'fileName' },
      { name: 'fileSize' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'rendered:b' },
      { name: 'required' },
      { name: 'size' },
      { name: 'style' },
      { name: 'styleclass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputHidden',
    description:
      'An HTML input element of type hidden, that is, an input element that is invisible to the user. Use this component to pass variables from page to page.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputSecret',
    description:
      'An HTML input element of type password. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object, for a value that is masked as the user types.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'alt' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'maxlength' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'readonly:b' },
      { name: 'redisplay:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'size' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputText',
    description:
      'An HTML input element of type text. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object.\n\n This component doesn\'t use Salesforce styling. Also, since it doesn\'t correspond to a field, or any other data on an object, custom code is required to use the value the user enters.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'alt' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'list' },
      { name: 'maxlength' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'size' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:inputTextarea',
    description:
      'A text area input element. Use this component to get user input for a controller method that does not correspond to a field on a Salesforce object, for a value that requires a text area.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'cols' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'readonly:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'richText:b' },
      { name: 'rows' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:insert',
    description:
      'A template component that declares a named area that must be defined by an < apex:define > component in another Visualforce page. Use this component with the < apex:composition > and < apex:define > components to share data between multiple pages.\n\n ',
    attributes: [{ name: 'name' }]
  },
  {
    name: 'apex:legend',
    description:
      'Defines a chart legend. This component offers additional configuration options beyond the defaults used by the legend attribute of the < apex:chart > component.\n\n Note: This component must be enclosed within an < apex:chart > component.\n\n ',
    attributes: [
      { name: 'font' },
      { name: 'id' },
      { name: 'padding' },
      { name: 'position' },
      { name: 'rendered:b' },
      { name: 'spacing' }
    ]
  },
  {
    name: 'apex:lineSeries',
    description:
      'A data series to be rendered as connected points in a linear Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as the X and Y axes to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:barSeries > and < apex:lineSeries > components in a single chart. You can also add < apex:areaSeries > and < apex:scatterSeries > components, but the results might not be very readable.\n\n ',
    attributes: [
      { name: 'axis' },
      { name: 'fill:b' },
      { name: 'fillColor' },
      { name: 'highlight:b' },
      { name: 'highlightStrokeWidth' },
      { name: 'id' },
      { name: 'markerFill' },
      { name: 'markerSize' },
      { name: 'markerType' },
      { name: 'opacity' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'showInLegend:b' },
      { name: 'smooth' },
      { name: 'strokeColor' },
      { name: 'strokeWidth' },
      { name: 'tips:b' },
      { name: 'title' },
      { name: 'xField' },
      { name: 'yField' }
    ]
  },
  {
    name: 'apex:listViews',
    description:
      'The list view picklist for an object, including its associated list of records for the currently selected view. In standard Salesforce applications this component is displayed on the main tab for a particular object.\n\n See also: < apex:enhancedList >.\n\n ',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }, { name: 'type' }]
  },
  {
    name: 'apex:logCallPublisher',
    description:
      'The Log a Call publisher lets support agents who use Case Feed create logs for customer calls. This component can only be used in organizations that have Case Feed, Chatter, and feed tracking on cases enabled.',
    attributes: [
      { name: 'autoCollapseBody:b' },
      { name: 'entityId' },
      { name: 'id' },
      { name: 'logCallBody' },
      { name: 'logCallBodyHeight' },
      { name: 'onSubmitFailure' },
      { name: 'onSubmitSuccess' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'showAdditionalFields:b' },
      { name: 'showSubmitButton:b' },
      { name: 'submitButtonName' },
      { name: 'submitFunctionName' },
      { name: 'title' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:message',
    description:
      'A message for a specific component, such as a warning or error. If an < apex:message > or < apex:messages > component is not included in a page, most warning and error messages are only shown in the debug log.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'for' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:messages',
    description:
      'All messages that were generated for all components on the current page. If an < apex:message > or < apex:messages > component is not included in a page, most warning and error messages are only shown in the debug log.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag. (Each message is contained in a list item.)\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'globalOnly:b' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'layout' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:outputField',
    description:
      'A read-only display of a label and value for a field on a Salesforce object. An < apex:outputField > component respects the attributes of the associated field, including how it should be displayed to the user. For example, if the specified < apex:outputField > component is a currency field, the appropriate currency symbol is displayed. Likewise, if the < apex:outputField > component is a lookup field or URL, the value of the field is displayed as a link.\n\n Note that if custom help is defined for the field in Setup, the field must be a child of an < apex:pageBlock > or < apex:pageBlockSectionItem >, and the Salesforce page header must be displayed for the custom help to appear on your Visualforce page. To override the display of custom help, use the < apex:outputField > in the body of an < apex:pageBlockSectionItem >.\n\n The Rich Text Area data type can only be used with this component on pages running Salesforce.com API versions greater than 18.0.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:outputLabel',
    description:
      'A label for an input or output field. Use this component to provide a label for a controller method that does not correspond to a field on a Salesforce object.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'dir' },
      { name: 'escape:b' },
      { name: 'for' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:outputLink',
    description:
      'A link to a URL. This component is rendered in HTML as an anchor tag with an href attribute. Like its HTML equivalent, the body of an < apex:outputLink > is the text or image that displays as the link. To add query string parameters to a link, use nested < apex:param > components.\n\n See also: < apex:commandLink > \n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'charset' },
      { name: 'coords' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'hreflang' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onblur' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rel' },
      { name: 'rendered:b' },
      { name: 'rev' },
      { name: 'shape' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'target' },
      { name: 'title' },
      { name: 'type' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:outputPanel',
    description:
      'A set of content that is grouped together, rendered with an HTML tag, tag, or neither. Use an to group components together for AJAX refreshes.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag, or , depending on the value of the layout attribute.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'layout' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:outputText',
    description:
      'Displays text on a Visualforce page. You can customize the appearance of < apex:outputText > using CSS styles, in which case the generated text is wrapped in an HTML < span > tag. You can also escape the rendered text if it contains sensitive HTML and XML characters. This component does take localization into account.\n\n Use with nested param tags to format the text values, where {n} corresponds to the n-th nested param tag. The value attribute supports the same syntax as the MessageFormat class in Java.\n\n Warning: Encrypted custom fields that are embedded in the < apex:outputText > component display in clear text. The < apex:outputText > component doesn\'t respect the View Encrypted Data permission for users. To prevent showing sensitive information to unauthorized users, use the < apex:outputField > tag instead.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'escape:b' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:page',
    description:
      'A single Visualforce page. All pages must be wrapped inside a single page component tag.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'action' },
      { name: 'apiVersion' },
      { name: 'applyBodyTag:b' },
      { name: 'applyHtmlTag:b' },
      { name: 'cache:b' },
      { name: 'contentType' },
      { name: 'controller' },
      { name: 'deferLastCommandUntilReady:b' },
      { name: 'docType' },
      { name: 'expires' },
      { name: 'extensions' },
      { name: 'id' },
      { name: 'label' },
      { name: 'language' },
      { name: 'lightningStylesheets:b' },
      { name: 'manifest' },
      { name: 'name' },
      { name: 'pageStyle' },
      { name: 'readOnly:b' },
      { name: 'recordSetName' },
      { name: 'recordSetVar' },
      { name: 'renderAs' },
      { name: 'rendered:b' },
      { name: 'setup:b' },
      { name: 'showChat:b' },
      { name: 'showHeader:b' },
      { name: 'showQuickActionVfHeader:b' },
      { name: 'sidebar:b' },
      { name: 'standardController' },
      { name: 'standardStylesheets:b' },
      { name: 'tabStyle' },
      { name: 'title' },
      { name: 'wizard:b' }
    ]
  },
  {
    name: 'apex:pageBlock',
    description:
      'An area of a page that uses styling similar to the appearance of a Salesforce detail page, but without any default content.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'helpTitle' },
      { name: 'helpUrl' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'mode' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'tabStyle' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:pageBlockButtons',
    description:
      'A set of buttons that are styled like standard Salesforce buttons. This component must be a child component of an < apex:pageBlock >.\n\n Note that it is not necessary for the buttons themselves to be direct children of the < apex:pageBlockButtons > component&#x2014;buttons that are located at any level within an < apex:pageBlockButtons > component are styled appropriately.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that contains the buttons. This tag can be at the top or bottom, or both, of the < apex:pageBlock >, depending on the value of the location attribute of the < apex:pageBlockButtons > component.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'location' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:pageBlockSection',
    description:
      'A section of data within an < apex:pageBlock > component, similar to a section in a standard Salesforce page layout definition.\n\n An < apex:pageBlockSection > component consists of one or more columns, each of which spans two cells: one for a field\'s label, and one for its value. Each component found in the body of an < apex:pageBlockSection > is placed into the next cell in a row until the number of columns is reached. At that point, the next component wraps to the next row and is placed in the first cell.\n\n To add a field from a Salesforce object to an < apex:pageBlockSection >, use an < apex:inputField > or < apex:outputField > component. Each of these components automatically displays with the field\'s associated label. To add fields for variables or methods that are not based on Salesforce object fields, or to customize the format of Salesforce object field labels, use an < apex:pageBlockSectionItem > component. Each < apex:inputField >, < apex:outputField >, or < apex:pageBlockSectionItem > component spans both cells of a single column.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'collapsible:b' },
      { name: 'columns' },
      { name: 'dir' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'showHeader:b' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:pageBlockSectionItem',
    description:
      'A single piece of data in an < apex:pageBlockSection > that takes up one column in one row. An < apex:pageBlockSectionItem > component can include up to two child components. If no content is specified, the column is rendered as an empty space. If one child component is specified, the content spans both cells of the column. If two child components are specified, the content of the first is rendered in the left, "label" cell of the column, while the content of the second is rendered in the right, "data" cell of the column.\n\n Note that if you include an < apex:outputField > or an < apex:inputField > component in an < apex:pageBlockSectionItem >, these components do not display with their label or custom help text as they do when they are children of an < apex:pageBlockSection >. Also note that < apex:pageBlockSectionItem > components can\'t be rerendered; rerender the child components instead.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'dataStyle' },
      { name: 'dataStyleClass' },
      { name: 'dataTitle' },
      { name: 'dir' },
      { name: 'helpText' },
      { name: 'id' },
      { name: 'labelStyle' },
      { name: 'labelStyleClass' },
      { name: 'labelTitle' },
      { name: 'lang' },
      { name: 'onDataclick' },
      { name: 'onDatadblclick' },
      { name: 'onDatakeydown' },
      { name: 'onDatakeypress' },
      { name: 'onDatakeyup' },
      { name: 'onDatamousedown' },
      { name: 'onDatamousemove' },
      { name: 'onDatamouseout' },
      { name: 'onDatamouseover' },
      { name: 'onDatamouseup' },
      { name: 'onLabelclick' },
      { name: 'onLabeldblclick' },
      { name: 'onLabelkeydown' },
      { name: 'onLabelkeypress' },
      { name: 'onLabelkeyup' },
      { name: 'onLabelmousedown' },
      { name: 'onLabelmousemove' },
      { name: 'onLabelmouseout' },
      { name: 'onLabelmouseover' },
      { name: 'onLabelmouseup' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'apex:pageBlockTable',
    description:
      'A list of data displayed as a table within either an < apex:pageBlock > or < apex:pageBlockSection > component, similar to a related list or list view in a standard Salesforce page. Like an < apex:dataTable >, an < apex:pageBlockTable > is defined by iterating over a set of data, displaying information about one item of data per row. The set of data can contain up to 1,000 items, or 10,000 items when the page is executed in read-only mode.\n\n The body of the < apex:pageBlockTable > contains one or more column components that specify what information should be displayed for each item of data, similar to a table. Unlike the < apex:dataTable > component, the default styling for < apex:pageBlockTable > matches standard Salesforce styles. Any additional styles specified with < apex:pageBlockTable > attributes are appended to the standard Salesforce styles.\n\n Note that if you specify an sObject field as the value attribute for a column, the associated label for that field is used as the column header by default. To override this behavior, use the headerValue attribute on the column, or the column\'s header facet.\n\n For Visualforce pages running Salesforce.com API version 20.0 or higher, an < apex:repeat > tag can be contained within this component to generate columns.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated table\'s tag.\n\n ',
    attributes: [
      { name: 'align' },
      { name: 'bgcolor' },
      { name: 'border' },
      { name: 'captionClass' },
      { name: 'captionStyle' },
      { name: 'cellpadding' },
      { name: 'cellspacing' },
      { name: 'columnClasses' },
      { name: 'columns' },
      { name: 'columnsWidth' },
      { name: 'dir' },
      { name: 'first' },
      { name: 'footerClass' },
      { name: 'frame' },
      { name: 'headerClass' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onRowClick' },
      { name: 'onRowDblClick' },
      { name: 'onRowMouseDown' },
      { name: 'onRowMouseMove' },
      { name: 'onRowMouseOut' },
      { name: 'onRowMouseOver' },
      { name: 'onRowMouseUp' },
      { name: 'rendered:b' },
      { name: 'rowClasses' },
      { name: 'rows' },
      { name: 'rules' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'summary' },
      { name: 'title' },
      { name: 'value' },
      { name: 'var' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:pageMessage',
    description:
      'This component should be used for presenting custom messages in the page using the Salesforce pattern for errors, warnings and other types of messages for a given severity. See also the pageMessages component.',
    attributes: [
      { name: 'detail' },
      { name: 'escape:b' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'severity' },
      { name: 'strength' },
      { name: 'summary' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:pageMessages',
    description:
      'This component displays all messages that were generated for all components on the current page, presented using the Salesforce styling.',
    attributes: [
      { name: 'escape:b' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'showDetail:b' }
    ]
  },
  {
    name: 'apex:panelBar',
    description:
      'A page area that includes one or more < apex:panelBarItem > tags that can expand when a user clicks the associated header. When an < apex:panelBarItem > is expanded, the header and the content of the item are displayed while the content of all other items are hidden. When another < apex:panelBarItem > is expanded, the content of the original item is hidden again. An < apex:panelBar > can include up to 1,000 < apex:panelBarItem > tags.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'contentClass' },
      { name: 'contentStyle' },
      { name: 'headerClass' },
      { name: 'headerClassActive' },
      { name: 'headerStyle' },
      { name: 'headerStyleActive' },
      { name: 'height' },
      { name: 'id' },
      { name: 'items' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'switchType' },
      { name: 'value' },
      { name: 'var' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:panelBarItem',
    description:
      'A section of an < apex:panelBar > that can expand or retract when a user clicks the section header. When expanded, the header and the content of the < apex:panelBarItem > is displayed. When retracted, only the header of the < apex:panelBarItem > displays.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'contentClass' },
      { name: 'contentStyle' },
      { name: 'expanded' },
      { name: 'headerClass' },
      { name: 'headerClassActive' },
      { name: 'headerStyle' },
      { name: 'headerStyleActive' },
      { name: 'id' },
      { name: 'label' },
      { name: 'name' },
      { name: 'onenter' },
      { name: 'onleave' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'apex:panelGrid',
    description:
      'Renders an HTML table element in which each component found in the body of the < apex:panelGrid > is placed into a corresponding cell in the first row until the number of columns is reached. At that point, the next component wraps to the next row and is placed in the first cell. \n\n Note that if an < apex:repeat > component is used within an < apex:panelGrid > component, all content generated by the < apex:repeat > component is placed in a single < apex:panelGrid > cell. The < apex:panelGrid > component differs from < apex:dataTable > because it does not process a set of data with an iteration variable.\n\n See also: < apex:panelGroup >\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'bgcolor' },
      { name: 'border' },
      { name: 'captionClass' },
      { name: 'captionStyle' },
      { name: 'cellpadding' },
      { name: 'cellspacing' },
      { name: 'columnClasses' },
      { name: 'columns' },
      { name: 'dir' },
      { name: 'footerClass' },
      { name: 'frame' },
      { name: 'headerClass' },
      { name: 'id' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'rowClasses' },
      { name: 'rules' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'summary' },
      { name: 'title' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:panelGroup',
    description:
      'A container for multiple child components so that they can be displayed in a single panelGrid cell. An < apex:panelGroup > must be a child component of an < apex:panelGrid >.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'layout' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' }
    ]
  },
  {
    name: 'apex:param',
    description:
      'A parameter for the parent component. The < apex:param > component can only be a child of the following components: < apex:actionFunction > < apex:actionSupport > < apex:commandLink > < apex:outputLink > < apex:outputText > < flow:interview > \n\n Within < apex:outputText >, there’s support for the < apex:param > tag to match the syntax of the MessageFormat class in Java.\n\n ',
    attributes: [
      { name: 'assignTo' },
      { name: 'id' },
      { name: 'name' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:pieSeries',
    description:
      'A data series to be rendered as wedges in a Visualforce pie chart. At a minimum you must specify the fields in the data collection to use as label and value pairs for each pie wedge.\n\n Note: This component must be enclosed within an < apex:chart > component. You can only have one < apex:pieSeries > in a chart.\n\n ',
    attributes: [
      { name: 'colorSet' },
      { name: 'dataField' },
      { name: 'donut' },
      { name: 'highlight:b' },
      { name: 'id' },
      { name: 'labelField' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'showInLegend:b' },
      { name: 'tips:b' }
    ]
  },
  {
    name: 'apex:radarSeries',
    description:
      'A data series to be rendered as the area inside a series of connected points in a radial Visualforce chart. Radar charts are also sometimes called "spider web" charts. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as a radial axis to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:radarSeries > components in a single chart.\n\n ',
    attributes: [
      { name: 'fill' },
      { name: 'highlight:b' },
      { name: 'id' },
      { name: 'markerFill' },
      { name: 'markerSize' },
      { name: 'markerType' },
      { name: 'opacity' },
      { name: 'rendered:b' },
      { name: 'showInLegend:b' },
      { name: 'strokeColor' },
      { name: 'strokeWidth' },
      { name: 'tips:b' },
      { name: 'title' },
      { name: 'xField' },
      { name: 'yField' }
    ]
  },
  {
    name: 'apex:relatedList',
    description:
      'A list of Salesforce records that are related to a parent record with a lookup or master-detail relationship.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'list' },
      { name: 'pageSize' },
      { name: 'rendered:b' },
      { name: 'subject' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:remoteObjectField',
    description:
      'Defines the fields to load for an sObject. Fields defined using this component, instead of the fields attribute of < apex:remoteObjectModel >, can have a shorthand name, which allows the use of a "nickname" for the field in client-side JavaScript code, instead of the full API name. Use as child of < apex:remoteObjectModel >.\n\n',
    attributes: [
      { name: 'id' },
      { name: 'jsShorthand' },
      { name: 'name' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'apex:remoteObjectModel',
    description:
      'Defines an sObject and its fields to make accessible using Visualforce Remote Objects. This definition can include a shorthand name for the object, which you can use in JavaScript instead of the full API name. This is especially useful if your organization has a namespace, and makes your code more maintainable.',
    attributes: [
      { name: 'create' },
      { name: 'delete' },
      { name: 'fields' },
      { name: 'id' },
      { name: 'jsShorthand' },
      { name: 'name' },
      { name: 'rendered:b' },
      { name: 'retrieve' },
      { name: 'update' }
    ]
  },
  {
    name: 'apex:remoteObjects',
    description:
      'Use this component, along with child < apex:remoteObjectModel > and < apex:remoteObjectField > components, to specify the sObjects and fields to access using Visualforce Remote Objects. These components generate models in JavaScript that you can use for basic create, select, update, and delete operations in your client-side JavaScript code.\n\n',
    attributes: [
      { name: 'create' },
      { name: 'delete' },
      { name: 'id' },
      { name: 'jsNamespace' },
      { name: 'rendered:b' },
      { name: 'retrieve' },
      { name: 'update' }
    ]
  },
  {
    name: 'apex:repeat',
    description:
      "An iteration component that allows you to output the contents of a collection according to a structure that you specify. The collection can include up to 1,000 items.\n\n Note that if used within an < apex:pageBlockSection > or < apex:panelGrid > component, all content generated by a child < apex:repeat > component is placed in a single < apex:pageBlockSection > or < apex:panelGrid > cell.\n\n This component can't be used as a direct child of the following components: < apex:panelBar > < apex:selectCheckboxes > < apex:selectList > < apex:selectRadio > < apex:tabPanel > \n\n ",
    attributes: [
      { name: 'first' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'rows' },
      { name: 'value' },
      { name: 'var' }
    ]
  },
  {
    name: 'apex:scatterSeries',
    description:
      'A data series to be rendered as individual (not connected) points in a linear Visualforce chart. At a minimum you must specify the fields in the data collection to use as X and Y values for each point, as well as the X and Y axes to scale against.\n\n Note: This component must be enclosed within an < apex:chart > component. You can have multiple < apex:scatterSeries > components in a single chart. You can also add < apex:areaSeries >, < apex:barSeries >, and < apex:lineSeries > components, but the results might not be very readable.\n\n ',
    attributes: [
      { name: 'axis' },
      { name: 'highlight:b' },
      { name: 'id' },
      { name: 'markerFill' },
      { name: 'markerSize' },
      { name: 'markerType' },
      { name: 'rendered:b' },
      { name: 'rendererFn' },
      { name: 'showInLegend:b' },
      { name: 'tips:b' },
      { name: 'title' },
      { name: 'xField' },
      { name: 'yField' }
    ]
  },
  {
    name: 'apex:scontrol',
    description:
      "An inline frame that displays an s-control.\n\n Note: s-controls have been superseded by Visualforce pages. After March 2010 organizations that have never created s-controls, as well as new organizations, won't be allowed to create them. Existing s-controls remain unaffected.\n\n ",
    attributes: [
      { name: 'controlName' },
      { name: 'height' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'scrollbars:b' },
      { name: 'subject' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:sectionHeader',
    description:
      'A title bar for a page. In a standard Salesforce page, the title bar is a colored header displayed directly under the tab bar.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'description' },
      { name: 'help' },
      { name: 'id' },
      { name: 'printUrl' },
      { name: 'rendered:b' },
      { name: 'subtitle' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:selectCheckboxes',
    description:
      'A set of related checkbox input elements, displayed in a table.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'border' },
      { name: 'borderVisible:b' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'disabledClass' },
      { name: 'enabledClass' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'layout' },
      { name: 'legendInvisible:b' },
      { name: 'legendText' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'readonly:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:selectList',
    description:
      'A list of options that allows users to select only one value or multiple values at a time, depending on the value of its multiselect attribute.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'disabledClass' },
      { name: 'enabledClass' },
      { name: 'id' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'multiselect:b' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'readonly:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'size' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:selectOption',
    description:
      'A possible value for an < apex:selectCheckboxes > or < apex:selectList > component. The < apex:selectOption > component must be a child of one of those components.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for components within an < apex:selectCheckboxes > or < apex:selectRadio > parent component, or to the generated tag for components within an < apex:selectList > parent component.\n\n ',
    attributes: [
      { name: 'dir' },
      { name: 'id' },
      { name: 'itemDescription' },
      { name: 'itemDisabled:b' },
      { name: 'itemEscaped:b' },
      { name: 'itemLabel' },
      { name: 'itemValue' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:selectOptions',
    description:
      'A collection of possible values for an < apex:selectCheckBoxes >, < apex:selectRadio >, or < apex:selectList > component. An < apex:selectOptions > component must be a child of one of those components. It must also be bound to a collection of selectOption objects in a custom Visualforce controller.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag for components within an < apex:selectCheckboxes > or < apex:selectRadio > parent component, or the generated tag for components within an < apex:selectList > parent component.\n\n ',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }, { name: 'value' }]
  },
  {
    name: 'apex:selectRadio',
    description:
      'A set of related radio button input elements, displayed in a table. Unlike checkboxes, only one radio button can ever be selected at a time.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated container tag.\n\n ',
    attributes: [
      { name: 'accesskey' },
      { name: 'border' },
      { name: 'borderVisible:b' },
      { name: 'dir' },
      { name: 'disabled:b' },
      { name: 'disabledClass' },
      { name: 'enabledClass' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'label' },
      { name: 'lang' },
      { name: 'layout' },
      { name: 'legendInvisible:b' },
      { name: 'legendText' },
      { name: 'onblur' },
      { name: 'onchange' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onfocus' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'onselect' },
      { name: 'readonly:b' },
      { name: 'rendered:b' },
      { name: 'required:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'tabindex' },
      { name: 'title' },
      { name: 'value' }
    ]
  },
  {
    name: 'apex:slds',
    description:
      'Allows Visualforce pages to reference Lightning Design System styling. Use this component instead of uploading the Lightning Design System as a static resource.\n\nInclude in a Visualforce page to use Lightning Design System stylesheets in the page.\n\nIn general, the Lightning Design System is already scoped. If you set applyBodyTag or applyHtmlTag to false, however, you must include the scoping class slds-scope. Within the scoping class, your markup can reference Lightning Design System styles and assets.\n\nTo reference assets in the Lightning Design System, such as SVG icons and other images, use the URLFOR() formula function and the $Asset global variable. To use SVG icons, add the required XML namespaces by using xmlns="http://www.w3.org/2000/svg" and xmlns:xlink="http://www.w3.org/1999/xlink" in the html tag.\n\nCurrently, if you are using the Salesforce sidebar, header, or built-in stylesheets, you can’t add attributes to the html tag. This means that SVG icons aren’t supported on your page if you don’t have showHeader, standardStylesheets, and sidebar set to false.\n\nFor examples of Lightning Design System styling, see the Salesforce Lightning Design System reference site.\n\n ',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'apex:stylesheet',
    description:
      'A link to a stylesheet that can be used to style components on the Visualforce page. When specified, this component injects the stylesheet reference into the head element of the generated HTML page.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag.\n\n ',
    attributes: [{ name: 'id' }, { name: 'value' }]
  },
  {
    name: 'apex:tab',
    description:
      'A single tab in an < apex:tabPanel >. The < apex:tab > component must be a child of a < apex:tabPanel >.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that wraps the tab\'s contents.\n\n ',
    attributes: [
      { name: 'disabled:b' },
      { name: 'focus' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'label' },
      { name: 'labelWidth' },
      { name: 'name' },
      { name: 'onclick' },
      { name: 'oncomplete' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'ontabenter' },
      { name: 'ontableave' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'status' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'switchType' },
      { name: 'timeout' },
      { name: 'title' }
    ]
  },
  {
    name: 'apex:tabPanel',
    description:
      'A page area that displays as a set of tabs. When a user clicks a tab header, the tab\'s associated content displays, hiding the content of other tabs.\n\n This component supports HTML pass-through attributes using the "html-" prefix. Pass-through attributes are attached to the generated tag that contains all of the tabs.\n\n ',
    attributes: [
      { name: 'activeTabClass' },
      { name: 'contentClass' },
      { name: 'contentStyle' },
      { name: 'dir' },
      { name: 'disabledTabClass' },
      { name: 'headerAlignment' },
      { name: 'headerClass' },
      { name: 'headerSpacing' },
      { name: 'height' },
      { name: 'id' },
      { name: 'immediate:b' },
      { name: 'inactiveTabClass' },
      { name: 'lang' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'selectedTab' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'switchType' },
      { name: 'tabClass' },
      { name: 'title' },
      { name: 'value' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:toolbar',
    description:
      'A stylized, horizontal toolbar that can contain any number of child components. By default, all child components are aligned to the left side of the toolbar. Use an < apex:toolbarGroup > component to align one or more child components to the right.\n\n ',
    attributes: [
      { name: 'contentClass' },
      { name: 'contentStyle' },
      { name: 'height' },
      { name: 'id' },
      { name: 'itemSeparator' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onitemclick' },
      { name: 'onitemdblclick' },
      { name: 'onitemkeydown' },
      { name: 'onitemkeypress' },
      { name: 'onitemkeyup' },
      { name: 'onitemmousedown' },
      { name: 'onitemmousemove' },
      { name: 'onitemmouseout' },
      { name: 'onitemmouseover' },
      { name: 'onitemmouseup' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'separatorClass' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'width' }
    ]
  },
  {
    name: 'apex:toolbarGroup',
    description:
      'A group of components within a toolbar that can be aligned to the left or right of the toolbar. The < apex:toolbarGroup > component must be a child component of an < apex:toolbar >.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'itemSeparator' },
      { name: 'location' },
      { name: 'onclick' },
      { name: 'ondblclick' },
      { name: 'onkeydown' },
      { name: 'onkeypress' },
      { name: 'onkeyup' },
      { name: 'onmousedown' },
      { name: 'onmousemove' },
      { name: 'onmouseout' },
      { name: 'onmouseover' },
      { name: 'onmouseup' },
      { name: 'rendered:b' },
      { name: 'separatorClass' },
      { name: 'style' },
      { name: 'styleClass' }
    ]
  },
  {
    name: 'apex:variable',
    description:
      'A local variable that can be used as a replacement for a specified expression within the body of the component. Use < apex:variable > to reduce repetitive and verbose expressions within a page.\n\n Note: < apex:variable > does not support reassignment inside of an iteration component, such as < apex:dataTable > or < apex:repeat >. The result of doing so, e.g., incrementing the < apex:variable > as a counter, is unsupported and undefined.\n\n ',
    attributes: [
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'value' },
      { name: 'var' }
    ]
  },
  {
    name: 'apex:vote',
    description:
      'A component that displays the vote control for an object that supports it.',
    attributes: [
      { name: 'id' },
      { name: 'objectId' },
      { name: 'rendered:b' },
      { name: 'rerender' }
    ]
  },
  {
    name: 'c:myvfcomponent',
    description: '',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'chatter:feed',
    description:
      "Displays the Chatter EntityFeed for a record or an UserProfileFeed for a user. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component. Note also that the chatter:feed component doesn't support feedItemType when the EntityId entity is a user. Use SOQL to filter on the UserProfileFeed object's Type field instead.",
    attributes: [
      { name: 'entityId' },
      { name: 'feedItemType' },
      { name: 'id' },
      { name: 'onComplete' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'showPublisher:b' }
    ]
  },
  {
    name: 'chatter:feedWithFollowers',
    description:
      'An integrated UI component that displays the Chatter feed for a record, as well as its list of followers. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component. Do not include this component inside an < apex:form > tag.\n\n',
    attributes: [
      { name: 'entityId' },
      { name: 'id' },
      { name: 'onComplete' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'showHeader:b' }
    ]
  },
  {
    name: 'chatter:follow',
    description:
      'Renders a button for a user to follow or unfollow a Chatter record. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    attributes: [
      { name: 'entityId' },
      { name: 'id' },
      { name: 'onComplete' },
      { name: 'rendered:b' },
      { name: 'reRender' }
    ]
  },
  {
    name: 'chatter:followers',
    description:
      'Displays the list of Chatter followers for a record. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    attributes: [{ name: 'entityId' }, { name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'chatter:newsfeed',
    description:
      'Displays the Chatter NewsFeed for the current user. Note that Chatter components are unavailable for Visualforce pages on Force.com sites. Ext JS versions less than 3 should not be included on pages that use this component.',
    attributes: [
      { name: 'id' },
      { name: 'onComplete' },
      { name: 'rendered:b' },
      { name: 'reRender' }
    ]
  },
  {
    name: 'chatter:userPhotoUpload',
    description:
      'Uploads a user’s photo to their Chatter profile page. To use this component, you must enable Chatter in the org. Users must belong to either Standard User, Portal User, High Volume Portal User, or Chatter External User profiles.',
    attributes: [
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'showOriginalPhoto:b' }
    ]
  },
  {
    name: 'flow:interview',
    description: 'This component embeds a Flow interview in the page.',
    attributes: [
      { name: 'allowShowPause:b' },
      { name: 'buttonLocation' },
      { name: 'buttonStyle' },
      { name: 'finishLocation' },
      { name: 'id' },
      { name: 'interview' },
      { name: 'name' },
      { name: 'pausedInterviewId' },
      { name: 'rendered:b' },
      { name: 'rerender' },
      { name: 'showHelp:b' }
    ]
  },
  {
    name: 'ideas:detailOutputLink',
    description:
      'A link to the page displaying an idea. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.',
    attributes: [
      { name: 'id' },
      { name: 'ideaId' },
      { name: 'page' },
      { name: 'pageNumber' },
      { name: 'pageOffset' },
      { name: 'rendered:b' },
      { name: 'style' },
      { name: 'styleClass' }
    ]
  },
  {
    name: 'ideas:listOutputLink',
    description:
      'A link to the page displaying a list of ideas. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.',
    attributes: [
      { name: 'category' },
      { name: 'communityId' },
      { name: 'id' },
      { name: 'page' },
      { name: 'pageNumber' },
      { name: 'pageOffset' },
      { name: 'rendered:b' },
      { name: 'sort' },
      { name: 'status' },
      { name: 'stickyAttributes:b' },
      { name: 'style' },
      { name: 'styleClass' }
    ]
  },
  {
    name: 'ideas:profileListOutputLink',
    description:
      "A link to the page displaying a user's profile. Note: To use this component, please contact your salesforce.com representative and request that the Ideas extended standard controllers be enabled for your organization.",
    attributes: [
      { name: 'communityId' },
      { name: 'id' },
      { name: 'page' },
      { name: 'pageNumber' },
      { name: 'pageOffset' },
      { name: 'rendered:b' },
      { name: 'sort' },
      { name: 'stickyAttributes:b' },
      { name: 'style' },
      { name: 'styleClass' },
      { name: 'userId' }
    ]
  },
  {
    name: 'knowledge:articleCaseToolbar',
    description:
      'UI component used when an article is opened from the case detail page. This component shows current case information and lets the user attach the article to the case.',
    attributes: [
      { name: 'articleId' },
      { name: 'caseId' },
      { name: 'id' },
      { name: 'includeCSS:b' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'knowledge:articleList',
    description:
      'A loop on a filtered list of articles. You can use this component up to four times on the same page. Note that you can only specify one criterion for each data category and that only standard fields are accessible, such as: ID (string): the ID of the article Title (string): the title of the article Summary (string): the summary of the article urlName (string): the URL name of the article articleTypeName (string): the developer name of the article type articleTypeLabel (string): the label of the article type lastModifiedDate (date): the date of the last modification firstPublishedDate (date): the date of the first publication lastPublishedDate (date): the date of the last publication \n\n',
    attributes: [
      { name: 'articleTypes' },
      { name: 'articleVar' },
      { name: 'categories' },
      { name: 'hasMoreVar' },
      { name: 'id' },
      { name: 'isQueryGenerated:b' },
      { name: 'keyword' },
      { name: 'language' },
      { name: 'pageNumber' },
      { name: 'pageSize' },
      { name: 'rendered:b' },
      { name: 'sortBy' }
    ]
  },
  {
    name: 'knowledge:articleRendererToolbar',
    description:
      'Displays a header toolbar for an article. This toolbar includes voting stars, a Chatter feed, a language picklist and a properties panel. Ext JS versions less than 3 should not be included on pages that use this component.',
    attributes: [
      { name: 'articleId' },
      { name: 'canVote:b' },
      { name: 'id' },
      { name: 'includeCSS:b' },
      { name: 'rendered:b' },
      { name: 'showChatter:b' }
    ]
  },
  {
    name: 'knowledge:articleTypeList',
    description: 'A loop on all available article types.',
    attributes: [
      { name: 'articleTypeVar' },
      { name: 'id' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'knowledge:categoryList',
    description:
      "A loop on a subset of the category hierarchy. The total number of categories displayed in a page can't exceed 100.\n\n You must have access to the category you set as rootCategory to get a list of any categories. To list categories available to a user, see the Knowledge Support REST APIs.\n\n",
    attributes: [
      { name: 'ancestorsOf' },
      { name: 'categoryGroup' },
      { name: 'categoryVar' },
      { name: 'id' },
      { name: 'level' },
      { name: 'rendered:b' },
      { name: 'rootCategory' }
    ]
  },
  {
    name: 'liveAgent:clientChat',
    description:
      'The main parent element for any Live Agent chat window. You must create this element in order to do any additional customization of Live Agent.\n\n Live Agent must be enabled for your organization. Note that this component can only be used once in a Live Agent deployment.\n\n',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatAlertMessage',
    description:
      'The area in a Live Agent chat window that displays system alert messages (such as "You have been disconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one alert message area.\n\n',
    attributes: [
      { name: 'agentsUnavailableLabel' },
      { name: 'chatBlockedLabel' },
      { name: 'connectionErrorLabel' },
      { name: 'dismissLabel' },
      { name: 'id' },
      { name: 'internalFailureLabel' },
      { name: 'noCookiesLabel' },
      { name: 'noFlashLabel' },
      { name: 'noHashLabel' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'liveAgent:clientChatCancelButton',
    description:
      'The button within a Live Agent chat window a visitor clicks to cancel a chat session.\n\n Must be used within < liveAgent:clientChat >.\n\n',
    attributes: [{ name: 'id' }, { name: 'label' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatEndButton',
    description:
      'The button within a Live Agent chat window a visitor clicks to end a chat session.\n\n Must be used within < liveAgent:clientChat >.\n\n',
    attributes: [{ name: 'id' }, { name: 'label' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatFileTransfer',
    description:
      'The file upload area in a Live Agent chat window where a visitor can send a file to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one file upload.\n\n',
    attributes: [
      { name: 'fileTransferCanceledLabel' },
      { name: 'fileTransferCancelFileLabel' },
      { name: 'fileTransferDropFileLabel' },
      { name: 'fileTransferFailedLabel' },
      { name: 'fileTransferSendFileLabel' },
      { name: 'fileTransferSuccessfulLabel' },
      { name: 'fileTransferUploadLabel' },
      { name: 'fileTransferUploadMobileLabel' },
      { name: 'id' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'liveAgent:clientChatInput',
    description:
      'The text box in a Live Agent chat window where a visitor types messages to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one input box.\n\n',
    attributes: [
      { name: 'autoResizeElementId' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'useMultiline:b' }
    ]
  },
  {
    name: 'liveAgent:clientChatLog',
    description:
      'The area in a Live Agent chat window that displays the chat transcript to a visitor.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one chat log.\n\n',
    attributes: [
      { name: 'agentTypingLabel' },
      { name: 'chatEndedByAgentLabel' },
      { name: 'chatEndedByVisitorIdleTimeoutLabel' },
      { name: 'chatEndedByVisitorLabel' },
      { name: 'chatTransferredLabel' },
      { name: 'combineMessagesText:b' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'showTimeStamp:b' },
      { name: 'visitorNameLabel' }
    ]
  },
  {
    name: 'liveAgent:clientChatLogAlertMessage',
    description:
      'The area in a Live Agent chat window that displays the idle time-out alert (customer warning) to a visitor.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one idle time-out alert.\n\n',
    attributes: [
      { name: 'autoResizeElementId' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'respondToChatLabel' },
      { name: 'respondWithinTimeLabel' }
    ]
  },
  {
    name: 'liveAgent:clientChatMessages',
    description:
      'The area in a Live Agent chat window that displays system status messages (such as "Chat session has been disconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one message area.\n\n',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatQueuePosition',
    description:
      "A text label indicating a visitor's position within a queue for a chat session initiated via a button that uses push routing. (On buttons that use pull routing, this component has no effect.)\n\n Must be used within < liveAgent:clientChat >.\n\n",
    attributes: [{ name: 'id' }, { name: 'label' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatSaveButton',
    description:
      'The button in a Live Agent chat window a visitor clicks to save the chat transcript as a local file.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have multiple save buttons.\n\n',
    attributes: [{ name: 'id' }, { name: 'label' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatSendButton',
    description:
      'The button in a Live Agent chat window a visitor clicks to send a chat message to an agent.\n\n Must be used within < liveAgent:clientChat >. Each chat window can have multiple send buttons.\n\n',
    attributes: [{ name: 'id' }, { name: 'label' }, { name: 'rendered:b' }]
  },
  {
    name: 'liveAgent:clientChatStatusMessage',
    description:
      'The area in a Live Agent chat window that displays system status messages (such as "You are being reconnected").\n\n Must be used within < liveAgent:clientChat >. Each chat window can have only one status message area.\n\n',
    attributes: [
      { name: 'id' },
      { name: 'reconnectingLabel' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'messaging:attachment',
    description: 'Compose an attachment and append it to the email.',
    attributes: [
      { name: 'filename' },
      { name: 'id' },
      { name: 'inline:b' },
      { name: 'renderAs' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'messaging:emailHeader',
    description:
      'Adds a custom header to the email. The body of a header is limited to 1000 characters.',
    attributes: [{ name: 'id' }, { name: 'name' }, { name: 'rendered:b' }]
  },
  {
    name: 'messaging:emailTemplate',
    description:
      'Defines a Visualforce email template. All email template tags must be wrapped inside a single emailTemplate component tag. emailTemplate must contain either an htmlEmailBody tag or a plainTextEmailBody tag. The detail and form components are not permitted as child nodes. This component can only be used within a Visualforce email template. Email templates can be created and managed through Setup | Communication Templates | Email Templates.',
    attributes: [
      { name: 'id' },
      { name: 'language' },
      { name: 'recipientType' },
      { name: 'relatedToType' },
      { name: 'rendered:b' },
      { name: 'replyTo' },
      { name: 'subject' }
    ]
  },
  {
    name: 'messaging:htmlEmailBody',
    description: 'The HTML version of the email body.',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'messaging:plainTextEmailBody',
    description: 'The plain text (non-HTML) version of the email body.',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'site:googleAnalyticsTracking',
    description:
      "The standard component used to integrate Google Analytics with Force.com sites to track and analyze site usage. Add this component just once, either on the site template for the pages you want to track, or the individual pages themselves. Don't set the component for both the template and the page. Attention: This component only works on pages used in a Force.com site. Sites must be enabled for your organization and the Analytics Tracking Code field must be populated. To get a tracking code, go to the Google Analytics website.",
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'site:previewAsAdmin',
    description:
      'This component shows detailed error messages on a site in administrator preview mode. We recommend that you add it right before the closing apex:page tag. Note: The site:previewAsAdmin component contains the apex:messages tag, so if you have that tag elsewhere on your error pages, you will see the error message twice.',
    attributes: [{ name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'social:profileViewer',
    description:
      "UI component that adds the Social Accounts and Contacts viewer to Account (including person account}, Contact, or Lead detail pages. The viewer displays the record name, a profile picture, and the social network icons that allow users to sign in to their accounts and view social data directly in Salesforce.\n\n Social Accounts and Contacts must be enabled for your organization. Note that this component is only supported for Account, Contact, and Lead objects and can only be used once on a page. This component isn't available for Visualforce pages on Force.com sites.\n\n",
    attributes: [{ name: 'entityId' }, { name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'support:caseArticles',
    description:
      'Displays the case articles tool. The tool can show articles currently attached to the Case and/or an article Keyword search. This component can only be used in organizations that have Case Feed and Knowledge enabled. Ext JS versions less than 3 should not be included on pages that use this component.',
    attributes: [
      { name: 'articleTypes' },
      { name: 'attachToEmailEnabled:b' },
      { name: 'bodyHeight' },
      { name: 'caseId' },
      { name: 'categories' },
      { name: 'categoryMappingEnabled:b' },
      { name: 'defaultKeywords' },
      { name: 'defaultSearchType' },
      { name: 'id' },
      { name: 'insertLinkToEmail:b' },
      { name: 'language' },
      { name: 'logSearch:b' },
      { name: 'mode' },
      { name: 'onSearchComplete' },
      { name: 'rendered:b' },
      { name: 'reRender' },
      { name: 'searchButtonName' },
      { name: 'searchFieldWidth' },
      { name: 'searchFunctionName' },
      { name: 'showAdvancedSearch:b' },
      { name: 'title' },
      { name: 'titlebarStyle' },
      { name: 'width' }
    ]
  },
  {
    name: 'support:caseFeed',
    description:
      'The Case Feed component includes all of the elements of the standard Case Feed page, including the publishers (Email , Portal, Log a Call, and Internal Note}, case activity feed, feed filters, and highlights panel. This component can only be used in organizations that have Case Feed enabled.',
    attributes: [{ name: 'caseId' }, { name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'support:caseUnifiedFiles',
    description: 'Displays the Files component.',
    attributes: [{ name: 'entityId' }, { name: 'id' }, { name: 'rendered:b' }]
  },
  {
    name: 'support:clickToDial',
    description:
      "A component that renders a valid phone number as click-to-dial enabled for Open CTI for Salesforce Classic or Salesforce CRM Call Center. This field respects any existing click-to-dial commands for computer-telephony integrations (CTI) with Salesforce.\n\n Note: This component doesn't work with embedded Visualforce pages within standard page layouts. If you create a Visualforce page with a custom console component, you must set the showHeader attribute to true. If this attribute is set to false, click-to-dial is disabled. This component doesn’t work with Open CTI for Lightning Experience. \n\n",
    attributes: [
      { name: 'entityId' },
      { name: 'id' },
      { name: 'number' },
      { name: 'params' },
      { name: 'rendered:b' }
    ]
  },
  {
    name: 'topics:widget',
    description:
      'UI component that displays topics assigned to a record and allows users to add and remove topics. The UI component is available only if topics are enabled for these supported objects: accounts, assets, campaigns, cases, contacts, contracts, leads, opportunities, and custom objects.',
    attributes: [
      { name: 'customUrl' },
      { name: 'entity' },
      { name: 'hideSuccessMessage:b' },
      { name: 'id' },
      { name: 'rendered:b' },
      { name: 'renderStyle' }
    ]
  },
  {
    name: 'wave:dashboard',
    description:
      'Use this component to add a Salesforce Analytics dashboard to a Visualforce page.',
    attributes: [
      { name: 'dashboardId' },
      { name: 'developerName' },
      { name: 'filter' },
      { name: 'height' },
      { name: 'hideOnError:b' },
      { name: 'id' },
      { name: 'openLinksInNewWindow:b' },
      { name: 'rendered:b' },
      { name: 'showHeader:b' },
      { name: 'showSharing:b' },
      { name: 'showTitle:b' },
      { name: 'width' }
    ]
  }
];
