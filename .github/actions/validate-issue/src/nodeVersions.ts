type VersionInfo = {
  start: Date;
  end: Date;
};

export const isAnyVersionValid = (currentDate: Date) => async (
  versions: string[]
): Promise<boolean> => {
  const resp = (await ((
    await fetch(
      "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json"
    )
  ).json() as unknown)) as Record<string, VersionInfo>;

  return versions
    .map((version) => `v${version}`)
    .some(
      (formattedVersion) =>
        formattedVersion in resp &&
        currentDate >= new Date(resp[formattedVersion].start) &&
        currentDate <= new Date(resp[formattedVersion].end)
    );
};
