import { ApprovalRequest } from './approval-request';
import { Origin } from './origin';
import { ActionToApprove } from '../types';

export interface BaseRepository {
  createItem: (request: ApprovalRequest) => Promise<ApprovalRequest>;
  getPendingItems: (origin: Origin, sub?: string, action?: ActionToApprove) => Promise<ApprovalRequest[]>;
  updateStatus: (request: ApprovalRequest) => Promise<ApprovalRequest[]>;
}
