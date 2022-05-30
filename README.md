# Serverless Approvals

This is a project to manage approval requests using AWS serverless infrastructure.

## Architecture overview

![alt text](https://github.com/Tannheuser/serverless-approvals/blob/main/misc/diagram.png?raw=true)

### Current limitations

List of limitations

### Possible future improvements

## Configuration

By default, `[default]` AWS profile is used for AWS CDK configuration.
If you want to use another named profile, you could specify it in `cdk.json` file as`"profile": "your_profile_name"`
or provide a `--profile your_profile_name` parameter to AWS CDK command.

## Installation

Installation instruction.

## Creating approval requests

Event bus instruction.

## Fetching approval requests

AppSync Queries

## Reviewing approval requests

AppSync Mutations

## Other useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
