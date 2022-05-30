import { EventBridgeEvent, Context } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequestRepository } from '../repositories';
import { ApprovalService, EventMessenger } from '../services';
import { ApprovalRequestInput } from '../models';

const logger = new Logger({
  logLevel: 'DEBUG',
  serviceName: 'serverless-approvals-event-lambda'
});
const eventMessenger = new EventMessenger();
const repository = new ApprovalRequestRepository(logger);

class ApprovalEventLambda implements LambdaInterface {
  // @logger.injectLambdaContext()
  public async handler(event: EventBridgeEvent<string, ApprovalRequestInput>, context: Context) {
    const { action, sub, ...origin } = event.detail;

    logger.debug(`[Event bridge event]: ${JSON.stringify(event)}`);

    return new ApprovalService(repository, logger, eventMessenger).createApprovalRequest(action, origin, sub);
  }
}

const lambdaInstance = new ApprovalEventLambda();

export const handler = lambdaInstance.handler;

