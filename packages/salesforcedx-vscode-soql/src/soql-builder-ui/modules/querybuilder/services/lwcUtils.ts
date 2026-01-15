type IndexableArrayItem<T> = {
  index: number;
  item: T;
};

type IndexableArray<T> = Array<IndexableArrayItem<T>>;

export function lwcIndexableArray<T>(arr: unknown[]): IndexableArray<T> {
  return arr.map((item: T, index: number): IndexableArrayItem<T> => {
    return { index, item };
  });
}
