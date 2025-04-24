export interface GmailMessagesResponse {
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken: string;
  resultSizeEstimated: number;
}

export interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: {
      name: string;
      value: string;
    }[];
    body: {
      size: number;
      data: string;
    };
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface CachedAccessToken {
  accessToken: string;
  timestamp: number;
}
