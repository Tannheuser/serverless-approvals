import { Origin } from './origin';
import { ActionToApprove } from '../types';

export interface ApprovalResult extends Origin {
  action: ActionToApprove;
  message?: string;
  approved?: boolean;
}
