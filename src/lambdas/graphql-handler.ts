import { Context, AppSyncResolverEvent } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';

import { ApprovalRequestRepository } from '../repositories';
import { ApprovalService } from '../services';
import { GraphqlQueryInput, Origin } from '../models';

const logger = new Logger({
  logLevel: 'DEBUG',
  serviceName: 'serverless-approvals-graphql-lambda'
});
const repository = new ApprovalRequestRepository(logger);

class GraphQLLambda implements LambdaInterface {
  // @logger.injectLambdaContext()
  public async handler(event: AppSyncResolverEvent<GraphqlQueryInput<Origin & { sub?: string }>, unknown>, context: Context) {

    logger.debug(`[AppSync event]: ${JSON.stringify(event)}`);

    switch (event.info.fieldName) {
      case 'getPendingRequests':
        const { sub, ...origin } = event?.arguments?.filter;
        return new ApprovalService(repository, logger).getPendingRequests(origin);
      default:
        return null;
    }
  }
}

const lambdaInstance = new GraphQLLambda();

export const handler = lambdaInstance.handler;

