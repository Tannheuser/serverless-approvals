import { Origin } from '../models';
import { keySeparator } from '../const';

export const generateCombinedKey = (origin: Origin) => {
  return `${origin.originType}${keySeparator}${origin.originId}`;
};
