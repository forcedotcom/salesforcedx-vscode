export const jsconfigCore = {
  compilerOptions: {
    experimentalDecorators: true
  },
  include: ['**/*'],
  typeAcquisition: {
    include: ['jest']
  }
} as const;

