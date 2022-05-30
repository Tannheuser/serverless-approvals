import { Context, AppSyncResolverEvent } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequestRepository } from '../repositories';
import { ApprovalService } from '../services';
import { ApprovalMutation, ApprovalQuery } from '../graphql';
import { ApprovalResult, GraphqlOperationInput, Origin } from '../models';
import { ActionToApprove } from '../types';

const logger = new Logger({
  logLevel: 'DEBUG',
  serviceName: 'serverless-approvals-graphql-lambda'
});
const repository = new ApprovalRequestRepository(logger);

type GraphqlOperationParameter = Origin & { action?: ActionToApprove, sub?: string };

class GraphQLLambda implements LambdaInterface {
  // @logger.injectLambdaContext()
  public async handler(event: AppSyncResolverEvent<GraphqlOperationInput<GraphqlOperationParameter>, unknown>, context: Context) {

    logger.debug(`[AppSync event]: ${JSON.stringify(event)}`);

    try {
      const approvalService = new ApprovalService(repository, logger);

      switch (event.info.fieldName) {
        case ApprovalQuery.GetRequests: {
          const { sub, action, ...origin } = event?.arguments?.filter || {};
          return approvalService.getPendingRequests(origin);
        }
        case ApprovalQuery.GetReviewableRequests: {
          const { sub, action, ...origin } = event?.arguments?.filter || {};
          return approvalService.getReviewablePendingRequests(sub || '', origin);
        }
        case ApprovalMutation.ApproveRequest: {
          const { sub, ...approvalResult } = event?.arguments?.input || {};
          return approvalService.changeApprovalRequestStatus(<ApprovalResult>{ ...approvalResult, approved: true }, sub || '');

        }
        case ApprovalMutation.RejectRequest: {
          const { sub, ...approvalResult } = event?.arguments?.input || {}
          return approvalService.changeApprovalRequestStatus(<ApprovalResult>approvalResult, sub || '');
        }
        default:
          return null;
      }
      } catch (error) {
        logger.error('[AppSync GraphQL lambda error]', error as Error)
      }
  }
}

const lambdaInstance = new GraphQLLambda();

export const handler = lambdaInstance.handler;

