export class DeveloperLogDebugLevels {
  private static instance: DeveloperLogDebugLevels;
  private active: boolean;
  private debugLevelId: string;
  private prevApexCodeDebugLevel: string;
  private prevVFDebugLevel: string;

  private constructor() {
    this.active = false;
  }

  public static getInstance() {
    if (!DeveloperLogDebugLevels.instance) {
      DeveloperLogDebugLevels.instance = new DeveloperLogDebugLevels();
    }
    return DeveloperLogDebugLevels.instance;
  }

  public turnOnLogging(
    id: string,
    oldApexCodeDebugLevel: string,
    oldVFDebugLevel: string
  ) {
    this.debugLevelId = id;
    this.prevApexCodeDebugLevel = oldApexCodeDebugLevel;
    this.prevVFDebugLevel = oldVFDebugLevel;
    this.active = true;
  }

  public turnOffLogging() {
    this.active = false;
  }

  public isActive() {
    return this.active;
  }

  public getPrevApexCodeDebugLevel() {
    return this.prevApexCodeDebugLevel;
  }

  public getPrevVFCodeDebugLevel() {
    return this.prevVFDebugLevel;
  }

  public getDebugLevelId() {
    return this.debugLevelId;
  }
}
