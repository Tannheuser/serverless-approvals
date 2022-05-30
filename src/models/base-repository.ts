import { ApprovalRequest } from './approval-request';
import { Origin } from './origin';

export interface BaseRepository {
  createItem: (request: ApprovalRequest) => Promise<ApprovalRequest>;
  getPendingItems: (origin: Origin, sub?: string) => Promise<ApprovalRequest[]>;
  updateStatus: (request: ApprovalRequest) => Promise<ApprovalRequest>;
}
