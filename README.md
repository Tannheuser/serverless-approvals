# Serverless Approvals

This is a project to manage approval requests using AWS serverless infrastructure.

## Architecture overview

![alt text](https://github.com/Tannheuser/serverless-approvals/blob/main/misc/diagram.png?raw=true)

### Current limitations

* It's not possible to create multiple requests of the same type for the same origin.
* You have to specify user sub manually in GraphQL queries and mutations.
* No unit tests (yet).

### Possible future improvements

* Make log level configurable.
* Use another authentication type for API calls (instead of API KEY).
* Be able to fetch user sub from API calls (from token or lambda context);
* Use DynamoDB Streams to interact with consumer services in a more event driven way.

## Configuration

By default, `[default]` AWS profile is used for AWS CDK configuration.
If you want to use another named profile, you could specify it in `cdk.json` file as`"profile": "your_profile_name"`
or provide a `--profile your_profile_name` parameter to AWS CDK commands.

## Installation

Make sure you have `typescript` and `aws-cdk` installed.

For the first time run cdk bootstrap command:

```console
cdk bootstrap
```

Run cdk synth to synthesize an AWS CloudFormation template:

```console
cdk synth
```

Run cdk deploy:

```console
cdk deploy
```

Specify a named profile parameter to AWS CDK commands if needed
```console
cdk command --profile your_profile_name
```

## Creating approval requests

To send a custom event to the approval event bus you should specify correct values for the `Event source` and `Event details` fields.

The `Detail type` field is not used, so it could contain any valid value.

###### Example
Event bus: 
`serverless-approvals-dev-source`

Event details:
```console
{
  "action": "create",
  "originType": "transaction",
  "originId": "QWERTY",
  "sub": "user-sub-1"
}
```

## Working with GraphQL API

### Queries

###### Get pending requests

You could fetch pending (not processed) approval requests by using `getPendingRequests` query.

Additionally, requests could be filtered by `originType` or `originTyId`.

```console
query MyQuery {
  getPendingRequests(filter: {originType: "transaction"}) {
    action
    originId
    originType
    status
    createdBy
  }
}
```

###### Get reviewable requests

You could fetch pending (not processed) approval requests,
which could be reviewed by current user (were not originally created by this user).

In this case you have to provide user `sub` as a filter parameter.

```console
query MyQuery {
  getReviewableRequests(filter: {sub: "user-sub-2", originType: "transaction"}) {
    action
    originId
    originType
    status
    createdBy
  }
}
```

### Mutations

You could approve or reject pending approval requests, which were originally created by other user.

###### Approve pending request

```console
mutation MyMutation {
  approveRequest(
    input: {
      action: "create"
      message: "Approved",
      originId: "QWERTY",
      originType: "transaction",
      sub: "user-sub-2"}) {
    action
    originId
    originType
    status
    updatedAt
  }
}

```

###### Reject pending request

```console
mutation MyMutation {
  rejectRequest(
    input: {
      action: "create"
      originId: "QWERTY",
      originType: "transaction",
      sub: "user-sub-2"}) {
    action
    originId
    originType
    status
    updatedAt
  }
}
```

## Other useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
