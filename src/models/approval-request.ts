import { ApprovalRequestStatus } from './approval-request-status';
import { TimeTracker } from './time-tracker';
import { KeySchema } from './key-schema';

export interface ApprovalRequest extends KeySchema, TimeTracker {
  pending?: number;
  message?: string;
  status: ApprovalRequestStatus;
}
