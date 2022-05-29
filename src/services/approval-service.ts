import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequest, BaseRepository, Origin } from '../models';
import { ApprovalRequestStatus } from '../models';
import { generateCombinedKey, splitCombinedKey } from '../utils';

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

  async getPendingRequests(origin?: Origin) {
    const result: object[] = []; // await this.repository.getPendingItems(origin);

    return this.convertDynamoResponse(result);
  }

  async getReviewablePendingRequests(sub: string, origin?: Origin) {
    const result: object[] = []; // await this.repository.getPendingItems(origin, sub);

    return this.convertDynamoResponse(result);
  }


  async createApprovalRequest(action: string, origin: Origin, sub: string) {
    this.logger.debug(`[Create Approval Request]: Action: ${action}, Origin: ${JSON.stringify(origin)}, Sub: ${sub}`);

    if (!origin.originId || !origin.originType) {
      this.logger.error('Invalid origin: ' + JSON.stringify(origin));
      throw new Error('Invalid origin');
    }

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
  }

  // @verbose()
  // async changeApprovalRequestStatus(approval: ApprovalResult) {
  //   const { message, approved, ...origin } = approval;
  //
  //   if (!origin.originId || !origin.originType) {
  //     throw new Error('Invalid origin');
  //   }
  //
  //   const existingRequest = await this.getPendingRequests(origin);
  //
  //   if (!existingRequest?.length) {
  //     // errorJson('APPROVAL_REQUEST_DOES_NOT_EXIST', approval);
  //     throw Error('Approval request does not exist');
  //   }
  //
  //   const request: ApprovalRequest = {
  //     // origin: generateEntityName(origin),
  //     createdAt: currentTime(),
  //     updatedAt: currentTime(),
  //     // updatedBy: this.context.sub,
  //     message,
  //     status: approved ? ApprovalRequestStatus.Approved : ApprovalRequestStatus.Rejected,
  //   };
  //   const updatedRequest = await this.setRequestStatus(request);

    // if (this.eventMessenger) {
    //   const eventType = generateEventDetailType(
    //     origin.originType,
    //     approved ? EventType.RequestApproved : EventType.RequestRejected
    //   );
    //   const eventResponse = this.getEventResponse(origin, request.updatedAt);
    //   await this.eventMessenger.notify(eventType, eventResponse);
    // } else {
    //   errorJson('EVENT_MESSENGER_DOES_NOT_SET', request);
    // }

    // return updatedRequest;
  // }
}
