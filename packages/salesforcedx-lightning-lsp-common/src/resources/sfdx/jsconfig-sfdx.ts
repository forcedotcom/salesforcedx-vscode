export const jsconfigSfdx = {
  compilerOptions: {
    experimentalDecorators: true,
    baseUrl: '.',
    paths: {
      'c/*': ['*']
    }
  },
  include: ['**/*'],
  typeAcquisition: {
    include: ['jest']
  }
} as const;
