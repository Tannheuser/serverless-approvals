import EventBridge from 'aws-sdk/clients/eventbridge';

export class EventMessenger {
  private readonly eventBridge = new EventBridge();
  private readonly namespace = process.env.NAMESPACE;
  private readonly eventBus = process.env.EVENT_BUS;

  async notify<T>(source: string, event?: T) {
    await this.eventBridge
      .putEvents({
        Entries: [
          {
            Source: this.namespace,
            DetailType: source,
            Detail: JSON.stringify(event),
            EventBusName: this.eventBus
          },
        ],
      })
      .promise();
  }
}
