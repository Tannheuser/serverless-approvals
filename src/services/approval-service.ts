import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequest, ApprovalResult, BaseRepository, Origin } from '../models';
import { ApprovalRequestStatus } from '../models';
import { generateCombinedKey, splitCombinedKey } from '../utils';
import { ActionToApprove } from '../types';

export class ApprovalService {
  constructor( private readonly repository: BaseRepository, private readonly logger: Logger) {
  }

  private convertDynamoResponse = (items: { [p: string]: any }[] | undefined) => {
    return (items || []).map((item) => {
      const originKey = item.origin ? splitCombinedKey(item.origin) : null;
      const origin = {
        originId: originKey?.lastPart,
        originType: originKey?.firstPart,
      } as Origin;

      return { ...item, ...origin };
    });
  };

  private setRequestStatus = async (request: ApprovalRequest) => {
    const result: object[] = []; //await this.repository.setStatus(request);
    const requests = this.convertDynamoResponse(result);

    return requests?.length ? requests[0] : null;
  };

  private getEventResponse = (origin: Origin, dateTime = Date.now()) => {
    return {
      originId: origin.originId,
      originType: origin.originType,
      dateTime,
    };
  };

  async getPendingRequests(origin: Origin) {
    this.logger.debug(`[Get Pending Requests]: Origin: ${JSON.stringify(origin)}`);

    try {
      const result = await this.repository.getPendingItems(origin);

      return this.convertDynamoResponse(result);
    } catch (error) {
      this.logger.error('[Get Pending Requests Error]: ', error as Error);
      throw error;
    }
  }

  async getReviewablePendingRequests(sub: string, origin: Origin) {
    this.logger.debug(`[Get Reviewable Requests]: Sub: ${sub}, Origin: ${JSON.stringify(origin)}`);

    try {
      const result = await this.repository.getPendingItems(origin, sub);

      return this.convertDynamoResponse(result);
    } catch (error) {
      this.logger.error('[Get Reviewable Requests Error]: ', error as Error);
      throw error;
    }
  }

  async createApprovalRequest(action: ActionToApprove, origin: Origin, sub: string) {
    this.logger.debug(`[Create Approval Request]: Action: ${action}, Origin: ${JSON.stringify(origin)}, Sub: ${sub}`);

    if (!origin.originId || !origin.originType) {
      this.logger.error('Invalid origin: ' + JSON.stringify(origin));
      throw new Error('Invalid origin');
    }

    try {
      const currentTime = Date.now();
      const request: ApprovalRequest = {
        action,
        origin: generateCombinedKey(origin),
        createdAt: currentTime,
        createdBy: sub,
        pending: 1,
        status: ApprovalRequestStatus.Pending
      };
      const result = await this.repository.createItem(request);

      return result;
    } catch (error) {
      this.logger.error('[Create Approval Request Error]: ', error as Error);
      throw error;
    }
  }

  async changeApprovalRequestStatus(approval: ApprovalResult, sub: string) {
    this.logger.debug(`[Change Request Status]: Approval result: ${approval}`);

    const { action, message, approved, ...origin } = approval;

    if (!origin.originId || !origin.originType) {
      this.logger.error('Invalid origin: ' + JSON.stringify(origin));
      throw new Error('Invalid origin');
    }

    const existingRequest = await this.getPendingRequests(origin);

    if (!existingRequest?.length) {
      throw Error('Approval request does not exist');
    }

    const currentTime = Date.now();
    const request: ApprovalRequest = {
      action,
      origin: generateCombinedKey(origin),
      updatedAt: currentTime,
      updatedBy: sub,
      message,
      status: approved ? ApprovalRequestStatus.Approved : ApprovalRequestStatus.Rejected,
    };
    const updatedRequest = await this.setRequestStatus(request);

    return updatedRequest;
  }
}
