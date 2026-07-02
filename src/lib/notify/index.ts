/**
 * チャット通知の抽象レイヤ（Slack / Teams / なし）。
 *
 * 環境変数で実装を切り替える:
 *   - NOTIFY_PROVIDER = slack | teams | none（未設定は none = 何もしない）
 *   - NOTIFY_WEBHOOK_URL = Incoming Webhook の URL
 *
 * 未設定環境では NoopNotifier が選ばれるため、本番/開発とも安全に no-op で動作する。
 * ツール（Slack/Teams）の選定は運用側で決定し、env の差し替えのみで対応できる。
 */

export interface ChatMessage {
  text: string;
  linkUrl?: string;
}

export interface ChatNotifier {
  send(msg: ChatMessage): Promise<void>;
}

/** 未設定時のフォールバック。何もしない。 */
class NoopNotifier implements ChatNotifier {
  async send(): Promise<void> {
    /* no-op */
  }
}

/** Slack Incoming Webhook（最小構成）。 */
class SlackNotifier implements ChatNotifier {
  constructor(private readonly webhookUrl: string) {}
  async send(msg: ChatMessage): Promise<void> {
    const text = msg.linkUrl ? `${msg.text}\n${msg.linkUrl}` : msg.text;
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }
}

/** Teams Incoming Webhook（MessageCard 最小構成）。 */
class TeamsNotifier implements ChatNotifier {
  constructor(private readonly webhookUrl: string) {}
  async send(msg: ChatMessage): Promise<void> {
    const body: Record<string, unknown> = { text: msg.text };
    if (msg.linkUrl) {
      body.potentialAction = [
        {
          '@type': 'OpenUri',
          name: '開く',
          targets: [{ os: 'default', uri: msg.linkUrl }],
        },
      ];
    }
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}

/** env に応じた Notifier を返す。 */
export function getNotifier(): ChatNotifier {
  const provider = (process.env.NOTIFY_PROVIDER ?? 'none').toLowerCase();
  const url = process.env.NOTIFY_WEBHOOK_URL ?? '';
  if (provider === 'slack' && url) return new SlackNotifier(url);
  if (provider === 'teams' && url) return new TeamsNotifier(url);
  return new NoopNotifier();
}

/**
 * 通知送信の便利関数。通知失敗が呼び出し元（Cron 等）を壊さないよう、
 * 例外は握りつぶしてログのみ残す。
 */
export async function notifyChat(msg: ChatMessage): Promise<void> {
  try {
    await getNotifier().send(msg);
  } catch (err) {
    console.error('[notifyChat]', err);
  }
}
