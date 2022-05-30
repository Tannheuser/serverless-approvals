import { Logger } from '@aws-lambda-powertools/logger';
import DynamoDB from 'aws-sdk/clients/dynamodb';

import { ApprovalRequest, BaseRepository, Origin } from '../models';
import { generateCombinedKey, stringify } from '../utils';
import { ActionToApprove } from '../types';

export class ApprovalRequestRepository implements BaseRepository {
  private tableName = process.env.APPROVALS_TABLE_NAME;
  private pendingIndex = process.env.APPROVALS_PENDING_GSI;
  private dynamoDB = new DynamoDB();
  private converter = DynamoDB.Converter;

  constructor(private readonly logger: Logger) {
  }

  private executeStatement = async (statement: string) => {
    this.logger.debug(`[Execute statement]: ${statement}`);
    const result = await this.dynamoDB.executeStatement({Statement: statement}).promise();
    this.logger.debug(`[Execute statement result]: ${JSON.stringify(result)}`);

    return (result.Items || []).map(item => this.converter.unmarshall(item)) as ApprovalRequest[];
  };

  private generateOriginQuery = (origin: Origin) => {
    if (origin.originId && origin.originType) {
      return `"origin" = '${generateCombinedKey(origin)}'`;
    } else if (origin.originId) {
      return `contains("origin", '${origin.originId}')`;
    } else if (origin.originType) {
      return `begins_with("origin", '${origin.originType}')`;
    }

    return '';
  };

  private generateCreatedByQuery = (sub: string | undefined) => {
    return sub ? `AND "createdBy" <> '${sub}'` : '';
  };

  private generateActionQuery = (action: string | undefined) => {
    return action ? `AND "action" = '${action}'` : '';
  };

  async createItem (request: ApprovalRequest) {
    const statement = `INSERT INTO "${this.tableName}" value ${stringify(request)}`;
    await this.executeStatement(statement);

    return request;
  }

  getPendingItems(origin: Origin, sub?: string, action?: ActionToApprove) {
    const subQuery = this.generateCreatedByQuery(sub);
    const actionQuery = this.generateActionQuery(action);
    const query = `SELECT * FROM "${this.tableName}"."${this.pendingIndex}" WHERE ${this.generateOriginQuery(origin)}`;
    const statement = `${query} ${subQuery} ${actionQuery}`;

    return this.executeStatement(statement);
  }

  async updateStatus(request: ApprovalRequest) {
    const messageUpdateStatement = request.message ? ` SET "message" = '${request.message}' ` : '';
    const updatedAtStatement = request.updatedAt ? ` SET "updatedAt" = '${request.updatedAt}' ` : '';
    const updatedByStatement = request.updatedBy ? ` SET "updatedBy" = '${request.updatedBy}' ` : '';
    const deletedAtStatement = request.deletedAt ? ` SET "deletedAt" = '${request.deletedAt}' ` : '';
    const deletedByStatement = request.deletedBy ? ` SET "deletedBy" = '${request.deletedBy}' ` : '';
    const statement = `
        UPDATE "${this.tableName}"
        SET "status" = '${request.status}' ${updatedAtStatement} ${updatedByStatement} ${deletedAtStatement} ${deletedByStatement} ${messageUpdateStatement}
        REMOVE "pending"
        WHERE "action" = '${request.action}' AND "origin" = '${request.origin}'
        RETURNING ALL NEW *`;
    const result = await this.executeStatement(statement);

    return result;
  }
}
