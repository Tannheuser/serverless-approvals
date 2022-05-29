import { keySeparator } from '../const';
import { CombinedKey } from '../models';

export const splitCombinedKey = (entity: string) => {
  const [firstPart, ...rest] = entity.split(keySeparator);
  const lastPart = rest.join(keySeparator);

  return { firstPart, lastPart } as CombinedKey;
};
