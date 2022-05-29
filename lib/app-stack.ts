import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';


import { CustomStackProps } from './custom-stack-props';
import { LambdaStackProps } from './lambda-stack-props';
import { join } from 'path';

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps & CustomStackProps) {
    super(scope, id, props);

    const serviceName = 'serverless-approvals';
    const region = props?.env?.region || 'eu-central-1';
    const stage = props?.stage || 'dev';
    const appsyncApiId = `${serviceName}-appsync-api-${stage}`;
    const appsyncApiKey = `${serviceName}-appsync-api-key-${stage}`;
    const approvalsTable = `${serviceName}-table-${stage}`;
    const defaultRoleId = `${serviceName}-default-role-${stage}`;

    const eventNamespace = serviceName;
    const eventBusId = `${serviceName}-event-bus-${stage}`;
    const eventBridgeLambdaId = `${serviceName}-event-bus-handler-${stage}`;
    const createApprovalRequestRuleId = `${serviceName}-${stage}-CreateApprovalRequest`;

    // Default IAM role
    const defaultRole = new iam.Role(this, defaultRoleId, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Default role for serverless approvals service.',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
      roleName: defaultRoleId
    });

    // DynamoDB
    const dynamoTable = new dynamodb.Table(this, approvalsTable, {
      partitionKey: {
        name: 'origin',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'originId',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: approvalsTable,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const ddbPolicyStatement = new iam.PolicyStatement({
      actions: ['dynamodb:DescribeTable', 'dynamodb:PartiQLSelect', 'dynamodb:PartiQLInsert', 'dynamodb:PartiQLUpdate'],
      resources: [dynamoTable.tableArn],
    });

    const dynamoActionsOnTableIndexPolicyStatement = new iam.PolicyStatement({
      actions: ['dynamodb:PartiQLSelect'],
      resources: [dynamoTable.tableArn + '/index/*'],
    });

    defaultRole.addToPolicy(ddbPolicyStatement);
    defaultRole.addToPolicy(dynamoActionsOnTableIndexPolicyStatement);

    // Lambdas
    // It's better to move all this configuration to custom lambda construct
    const environment = {
      SERVICE: serviceName,
      REGION: region,
      NAMESPACE: eventNamespace,
      APPROVALS_TABLE_NAME: dynamoTable.tableName,
      EVENT_BUS: eventBusId,
    };

    const lambdaProperties = {
      bundling: {
        sourceMapMode: SourceMapMode.DEFAULT,
        minify: true,
        sourceMap: true,
        preCompilation: true,
        loader: {
          '.graphql': 'text',
        },
      },
      handler: 'handler',
      memorySize: 1024,
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_14_X,
      role: defaultRole,
      environment: environment,
      deadLetterQueueEnabled: false,
      tracing: lambda.Tracing.ACTIVE,
    };

    const eventBridgeLambda = new NodejsFunction(this, eventBridgeLambdaId, {
      ...lambdaProperties,
      functionName: eventBridgeLambdaId,
      entry: join(__dirname, '../src/lambdas/event-bus-handler.ts'),
    });

    // Event Bridge
    // Create a new event bus to avoid limitation of standard size
    const eventBus = new events.EventBus(this, eventBusId, {
      eventBusName: eventBusId,
    });

    new events.Rule(this, createApprovalRequestRuleId, {
      ruleName: createApprovalRequestRuleId,
      description: 'Runs serverless approvals lambda to create a new approval request.',
      eventBus,
      eventPattern: {
        source: [serviceName],
      },
      targets: [new targets.LambdaFunction(eventBridgeLambda)],
    });

    defaultRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        effect: iam.Effect.ALLOW,
        resources: [eventBus.eventBusArn],
      })
    );
  }
}
