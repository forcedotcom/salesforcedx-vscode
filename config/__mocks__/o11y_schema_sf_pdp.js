// Mock for Jest - o11y_schema is ESM-only, Jest runs CJS.
// Shape mirrors real o11y_schema/sf_pdp pdpEventSchema (namespace, name, pbjsSchema)
// so shape-key assertions in tests are meaningful.
module.exports = { pdpEventSchema: { namespace: 'sf_pdp', name: 'pdp_event', pbjsSchema: {} } };
