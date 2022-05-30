import { EventType } from '../models';

export const generateEventDetailType = (originType: string, eventType: EventType) => {
  return `${originType}${eventType}`;
};
