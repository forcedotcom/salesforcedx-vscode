type IndexableArrayItem<T> = {
  index: number;
  item: T;
};

export type IndexableArray<T> = Array<IndexableArrayItem<T>>;

export const lwcIndexableArray = <T>(arr: T[]): IndexableArray<T> =>
  arr.map((item, index) => ({ index, item }));
