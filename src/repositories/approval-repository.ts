import { Logger } from '@aws-lambda-powertools/logger';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Converter } from 'aws-sdk/lib/dynamodb/converter';

import { ApprovalRequest, BaseRepository } from '../models';
import { stringify } from '../utils';

export class ApprovalRequestRepository implements BaseRepository {
  private tableName = process.env.APPROVALS_TABLE_NAME;
  private dynamoDB = new DynamoDB();
  private converter = Converter;

  constructor(private readonly logger: Logger) {
  }

  private executeStatement = async (statement: string) => {
    const result = await this.dynamoDB.executeStatement({Statement: statement}).promise();

    this.logger.debug(`[Execute statement]: ${JSON.stringify(result)}`);

    return result.Items?.map(item => this.converter.unmarshall(item));
  };

   async createItem (request: ApprovalRequest) {
    const statement = `INSERT INTO "${this.tableName}" value ${stringify(request)}`;
    await this.executeStatement(statement);

    return request;
  }
}
