import * as fs from 'fs/promises';

export const exists = async (
  filePath: string,
  handleNotPresent: (e: any) => boolean = () => false
): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return handleNotPresent(e);
  }
};
