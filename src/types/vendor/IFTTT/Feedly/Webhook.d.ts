/**
 * Feedly Webhook Payload
 *
 * Payload structure from IFTTT Feedly integration.
 * Sent when a new article is published in a subscribed feed.
 *
 * This webhook triggers the video download workflow:
 * 1. Feedly detects new article in subscribed YouTube channel
 * 2. IFTTT forwards article to WebhookFeedly Lambda
 * 3. Lambda publishes DownloadRequested event to EventBridge
 * 4. EventBridge routes to DownloadQueue then StartFileUpload
 *
 * @see WebhookFeedly Lambda for processing implementation
 * @see {@link https://ifttt.com/feedly | Feedly IFTTT Integration}
 */

/**
 * Webhook payload from IFTTT Feedly applet.
 *
 * Triggered by: "New article from specific feed" applet
 * Destination: WebhookFeedly Lambda via API Gateway
 */
export interface Webhook {
  /** First image URL from the article (YouTube thumbnail) */
  readonly articleFirstImageURL: string
  /** ISO 8601 timestamp when article was published */
  readonly articlePublishedAt: string
  /** Article/video title */
  readonly articleTitle: string
  /** Full URL to the article (YouTube video URL to extract video ID from) */
  readonly articleURL: string
}
