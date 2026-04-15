interface EmailWasteReport {
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  reportUrl: string
}

/**
 * Send waste report via email using Resend API.
 */
export async function sendEmailNotification(
  recipients: string[],
  report: EmailWasteReport
): Promise<void> {
  if (recipients.length === 0) return

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'GhostFinder <alerts@ghostfinder.app>',
      to: recipients,
      subject: `👻 SaaS Waste Alert: $${report.totalMonthlyWaste.toLocaleString()}/mo identified`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Weekly Waste Report</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Monthly Waste</strong><br>
                <span style="font-size: 24px; color: #f97316;">
                  $${report.totalMonthlyWaste.toLocaleString()}
                </span>
              </td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Annual Projection</strong><br>
                <span style="font-size: 24px; color: #ef4444;">
                  $${report.totalAnnualWaste.toLocaleString()}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Ghost Seats</strong><br>
                <span style="font-size: 24px;">${report.ghostSeatCount}</span>
              </td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Duplicate Apps</strong><br>
                <span style="font-size: 24px;">${report.duplicateCount}</span>
              </td>
            </tr>
          </table>
          <a href="${report.reportUrl}"
             style="display: inline-block; background: #3b82f6; color: white;
                    padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Full Report
          </a>
          <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">
            This alert was sent by GhostFinder. Manage notification settings in your dashboard.
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email send failed: ${error}`)
  }
}
