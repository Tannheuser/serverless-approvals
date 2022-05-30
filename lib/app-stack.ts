import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';

import { CustomStackProps } from './custom-stack-props';
import { join } from 'path';
import { readFileSync } from 'fs';
import { ApprovalMutation, ApprovalQuery } from '../src/graphql';

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps & CustomStackProps) {
    super(scope, id, props);

    const serviceName = 'serverless-approvals';
    const region = props?.env?.region || 'eu-central-1';
    const stage = props?.stage || 'dev';
    const appsyncApiId = `${serviceName}-appsync-api-${stage}`;
    const appsyncApiKey = `${serviceName}-appsync-api-key-${stage}`;
    const appsyncApiSchema = `${serviceName}-appsync-api-schema-${stage}`;
    const appSyncLambdaPolicy = `${serviceName}-lambda-policy-${stage}`;
    const appSyncLambdaId = `${serviceName}-graphql-handler-${stage}`;
    const appSyncLambdaDataSource = `${serviceName}-appsync-data-source-${stage}`;
    const pendingRequestsResolverId = `${serviceName}-${ApprovalQuery.GetRequests}-${stage}`;
    const reviewableRequestsResolverId = `${serviceName}-${ApprovalQuery.GetReviewableRequests}-${stage}`;
    const approveRequestResolverId = `${serviceName}-${ApprovalMutation.ApproveRequest}-${stage}`;
    const rejectRequestResolverId = `${serviceName}-${ApprovalMutation.RejectRequest}-${stage}`;
    const approvalsTable = `${serviceName}-table-${stage}`;
    const pendingGSI = 'pending-origin-index';
    const defaultRoleId = `${serviceName}-default-role-${stage}`;
    const eventNamespace = serviceName;
    const eventBusId = `${serviceName}-event-bus-${stage}`;
    const eventBridgeLambdaId = `${serviceName}-event-bus-handler-${stage}`;
    const createApprovalRequestSource = `${serviceName}-${stage}-source`;
    const createApprovalRequestRuleId = `${serviceName}-${stage}-CreateApprovalRequest`;

    // Default IAM role
    const defaultRole = new iam.Role(this, defaultRoleId, {
      assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('lambda.amazonaws.com'), new iam.ServicePrincipal('appsync.amazonaws.com')),
      description: 'Default role for serverless approvals service.',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
      roleName: defaultRoleId
    });

    // DynamoDB
    const dynamoTable = new dynamodb.Table(this, approvalsTable, {
      partitionKey: {
        name: 'action',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'origin',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: approvalsTable,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    dynamoTable.addGlobalSecondaryIndex({
      indexName: pendingGSI,
      partitionKey: {
        name: 'pending',
        type: dynamodb.AttributeType.NUMBER,
      },
      sortKey: {
        name: 'origin',
        type: dynamodb.AttributeType.STRING,
      },
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
      APPROVALS_PENDING_GSI: pendingGSI,
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
      timeout: Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_14_X,
      role: defaultRole,
      environment: environment,
      deadLetterQueueEnabled: false,
      tracing: lambda.Tracing.ACTIVE,
    };

    const appSyncLambda = new NodejsFunction(this, appSyncLambdaId, {
      ...lambdaProperties,
      functionName: appSyncLambdaId,
      entry: join(__dirname, '../src/lambdas/graphql-handler.ts'),
    });

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
        source: [createApprovalRequestSource],
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

    // AppSync API
    const graphqlApi = new appsync.CfnGraphQLApi(this, appsyncApiId, {
      name: appsyncApiId,
      authenticationType: 'API_KEY',
    });

     const graphApiKey = new appsync.CfnApiKey(this, appsyncApiKey, {
      apiId: graphqlApi.attrApiId,
    });
    const graphqlApiSchema = new appsync.CfnGraphQLSchema(
      this,
      appsyncApiSchema,
      {
        apiId: graphqlApi.attrApiId,
        definition: readFileSync(join(__dirname, '../src/graphql/schema.graphql')).toString(),
      }
    );

    graphqlApiSchema.addDependsOn(graphqlApi);

    const lambdaDataSource = new appsync.CfnDataSource(
      this,
      appSyncLambdaDataSource,
      {
        apiId: graphqlApi.attrApiId,
        name: 'GraphQLDataSource',
        type: "AWS_LAMBDA",
        lambdaConfig: {
          lambdaFunctionArn: appSyncLambda.functionArn,
        },
        serviceRoleArn: defaultRole.roleArn,
      }
    );

    lambdaDataSource.addDependsOn(graphqlApi);

    const getPendingRequestsResolver = new appsync.CfnResolver(this, pendingRequestsResolverId, {
      apiId: graphqlApi.attrApiId,
      typeName: 'Query',
      fieldName: ApprovalQuery.GetRequests,
      dataSourceName: lambdaDataSource.attrName,
    });

    const getReviewableRequestsResolver = new appsync.CfnResolver(this, reviewableRequestsResolverId, {
      apiId: graphqlApi.attrApiId,
      typeName: 'Query',
      fieldName: ApprovalQuery.GetReviewableRequests,
      dataSourceName: lambdaDataSource.attrName,
    });

    const approveRequestResolver = new appsync.CfnResolver(this, approveRequestResolverId, {
      apiId: graphqlApi.attrApiId,
      typeName: 'Mutation',
      fieldName: ApprovalMutation.ApproveRequest,
      dataSourceName: lambdaDataSource.attrName,
    });

    const rejectRequestResolver = new appsync.CfnResolver(this, rejectRequestResolverId, {
      apiId: graphqlApi.attrApiId,
      typeName: 'Mutation',
      fieldName: ApprovalMutation.RejectRequest,
      dataSourceName: lambdaDataSource.attrName,
    });

    // getPendingRequestsResolver.addDependsOn(graphqlApiSchema);
    getPendingRequestsResolver.addDependsOn(lambdaDataSource);
    // getReviewableRequestsResolver.addDependsOn(graphqlApiSchema);
    getReviewableRequestsResolver.addDependsOn(lambdaDataSource);
    approveRequestResolver.addDependsOn(lambdaDataSource);
    rejectRequestResolver.addDependsOn(lambdaDataSource);

    const statement = new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [ appSyncLambda.functionArn ]
    });

    const policy = new iam.Policy(this, appSyncLambdaPolicy, {
        statements: [statement]
    });

    policy.attachToRole(<iam.IRole> appSyncLambda.role);
  }
}
