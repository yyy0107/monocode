export type ImPlatform = "feishu" | "telegram" | "weixin" | "qq";

/** channelId identifies a configured channel/account, not just a platform. */
export type ImConversation = {
  channelId: string;
  threadId: string;
};

export type ImIncomingMessage = {
  conversation: ImConversation;
  messageId: string;
  senderId: string;
  text: string;
};

export type ImOutgoingMessage = {
  text: string;
  replyToMessageId?: string;
};

export type ImMessageHandler = (message: ImIncomingMessage) => Promise<void>;

/** Implementations own credentials, transport and native message conversion. */
export interface ImChannel {
  readonly id: string;
  readonly platform: ImPlatform;
  start(onMessage: ImMessageHandler): Promise<void>;
  /** Must also release resources left by a partially failed start(). */
  stop(): Promise<void>;
  send(threadId: string, message: ImOutgoingMessage): Promise<void>;
}

export type ImRouteContext = {
  message: ImIncomingMessage;
  sessionId: string | undefined;
  reply(message: ImOutgoingMessage): Promise<void>;
};

export type ImRouteHandler = (context: ImRouteContext) => Promise<void>;
