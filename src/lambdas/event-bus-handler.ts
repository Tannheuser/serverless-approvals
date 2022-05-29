// import { EventBridgeEvent, Context } from 'aws-lambda';
//
// import { ApprovalService } from '../services';
// import { EventBridgeEventDetail } from '../types';

import { logger } from '../utils';

export const handler = async (event: any, context: any) => {
    const origin = event.detail;

    logger.info(event);

    return { status: 200 };
};
