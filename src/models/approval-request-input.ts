import { Origin } from './origin';

export interface ApprovalRequestInput extends Origin {
  action: string;
  sub: string;
}
