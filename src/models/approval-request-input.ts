import { Origin } from './origin';
import { ActionToApprove } from '../types';

export interface ApprovalRequestInput extends Origin {
  action: ActionToApprove;
  sub: string;
}
