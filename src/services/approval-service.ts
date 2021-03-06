import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequest, ApprovalResult, BaseRepository, EventType, Origin } from '../models';
import { ApprovalRequestStatus } from '../models';
import { ActionToApprove } from '../types';
import { EventMessenger } from './event-messenger';
import { generateCombinedKey, generateEventDetailType, splitCombinedKey } from '../utils';

export class ApprovalService {
  constructor(
    private readonly repository: BaseRepository,
    private readonly logger: Logger,
    private readonly eventMessenger: EventMessenger) {
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
    const result = await this.repository.updateStatus(request);
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

  async getReviewablePendingRequests(sub: string, origin: Origin, action?: ActionToApprove) {
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
      this.logger.error('[Create Approval Request Error]: Invalid origin. ' + JSON.stringify(origin));
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

      if (this.eventMessenger) {
        const eventType = generateEventDetailType(origin.originType, EventType.RequestCreated);
        const eventResponse = this.getEventResponse(origin, request.createdAt);
        await this.eventMessenger.notify(eventType, eventResponse);
      } else {
        this.logger.error('[Create Approval Request Error]: Event Messenger Does Not Initialised.');
      }

      return result;
    } catch (error) {
      this.logger.error('[Create Approval Request Error]: ', error as Error);
      throw error;
    }
  }

  async changeApprovalRequestStatus(approval: ApprovalResult, sub: string) {
    this.logger.debug(`[Change Request Status]: Approval result: ${JSON.stringify(approval)}`);

    const { action, message, approved, ...origin } = approval;

    if (!origin.originId || !origin.originType) {
      this.logger.error('[Change Request Status Error]: Invalid origin. ' + JSON.stringify(origin));
      throw new Error('Invalid origin');
    }

    try {
      const existingRequest = await this.getReviewablePendingRequests(sub, origin, action);

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

      if (this.eventMessenger) {
        const eventType = generateEventDetailType(
          origin.originType,
          approved ? EventType.RequestApproved : EventType.RequestRejected
        );
        const eventResponse = this.getEventResponse(origin, request.updatedAt);
        await this.eventMessenger.notify(eventType, eventResponse);
      } else {
        this.logger.error('[Change Request Status Error]: Event Messenger Does Not Initialised.');
      }

      return updatedRequest;
    } catch (error) {
      this.logger.error('[Change Request Status Error]: ', error as Error);
      throw error;
    }
  }
}
