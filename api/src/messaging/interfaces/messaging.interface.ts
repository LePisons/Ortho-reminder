export interface MessageResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface IMessagingProvider {
  isAvailable(): boolean;
  send(
    recipient: string,
    content: string,
    templateName?: string,
  ): Promise<MessageResult>;
}
