import { ApprovalRequest } from './approval-request';

export interface BaseRepository {
  createItem: (request: ApprovalRequest) => Promise<ApprovalRequest>;
}
