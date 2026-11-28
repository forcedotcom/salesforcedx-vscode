let provider;
export const stats = { lookups: 0, activations: 0 };
export const setProvider = (services, active) => {
  provider = {
    isActive: active,
    exports: { services },
    activate: async () => {
      stats.activations++;
      provider.isActive = true;
      return provider.exports;
    }
  };
};
export const extensions = {
  getExtension: id => {
    if (id !== 'salesforce.salesforcedx-vscode-services') throw new Error(`Unexpected extension: ${id}`);
    stats.lookups++;
    return provider;
  }
};
