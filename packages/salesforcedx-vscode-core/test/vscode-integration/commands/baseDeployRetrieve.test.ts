describe('Base Deploy Retrieve Commands', () => {
  describe('DeployRetrieveCommand', () => {
    it('should call concrete methods in correct order', () => {});

    it('should add component count to telemetry data', () => {});

    it('should return success when operation status is "Succeeded"', () => {});

    it('should return success when operation status is "SucceededPartial"', () => {});
  });

  describe('DeployCommand', () => {
    it('should call deploy on component set', () => {});

    it('should output table of deploy result', () => {});

    it('should report any diagnostics if deploy failed', () => {});

    it('should unlock the deploy queue when finished', () => {});
  });

  describe('RetrieveCommand', () => {
    it('should utilize Tooling API if retrieving one source-backed component', () => {});

    it('should output table of tooling retrieve result', () => {});

    it('should call retrieve on component set', () => {});

    it('should output table of retrieve result', () => {});
  });
});
