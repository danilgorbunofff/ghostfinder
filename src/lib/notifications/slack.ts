export interface SlackWasteMessage {
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  topGhosts: { vendor: string; ghostSeats: number; monthlyWaste: number }[]
  reportUrl: string
}

/**
 * Send a waste report summary to Slack via an Incoming Webhook.
 * Uses Slack's Block Kit for rich formatting.
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackWasteMessage
): Promise<void> {
  const topGhostLines = message.topGhosts
    .slice(0, 5)
    .map((g) => `• *${g.vendor}*: ${g.ghostSeats} ghost seats ($${g.monthlyWaste}/mo)`)
    .join('\n')

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '👻 GhostFinder — Weekly Waste Report',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Monthly Waste:*\n$${message.totalMonthlyWaste.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Annual Projection:*\n$${message.totalAnnualWaste.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Ghost Seats:*\n${message.ghostSeatCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Duplicate Apps:*\n${message.duplicateCount}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Ghost Seats:*\n${topGhostLines || '_No ghost seats detected_'}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Report',
            },
            url: message.reportUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
  }
}
