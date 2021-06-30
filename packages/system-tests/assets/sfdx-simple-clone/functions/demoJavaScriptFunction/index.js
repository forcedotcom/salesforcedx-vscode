const sdk = require('@salesforce/salesforce-sdk');

/**
 * Describe DemoJavaScriptFunction here.
 *
 * The exported method is the entry point for your code when the function is invoked. 
 *
 * Following parameters are pre-configured and provided to your function on execution: 
 * @param event:   represents the data associated with the occurrence of an event, and  
 *                 supporting metadata about the source of that occurrence.
 * @param context: represents the connection to Evergreen and your Salesforce org.
 * @param logger:  logging handler used to capture application logs and traces specific  
 *                 to a given execution of a function.
 */
module.exports = async function (event, context, logger) {
    logger.info(`Invoking DemoJavaScriptFunction with payload ${JSON.stringify(event.data || {})}`);

    const results = await context.org.data.query('SELECT Id, Name FROM Account');
    logger.info(JSON.stringify(results));
    return results;
}
