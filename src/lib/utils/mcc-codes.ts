/**
 * Merchant Category Codes (MCC) associated with software and SaaS purchases.
 */

export const SOFTWARE_MCC_CODES: Record<string, string> = {
  '5734': 'Computer Software Stores',
  '5817': 'Digital Goods: Applications (Marketplaces)',
  '5818': 'Digital Goods: Large Merchants',
  '7372': 'Computer Programming, Data Processing',
  '7379': 'Computer Maintenance and Repair',
  '7399': 'Business Services (misc SaaS)',
  '5045': 'Computers, Computer Peripherals',
  '5946': 'Camera & Photographic Supplies (Adobe)',
}

export const KNOWN_SAAS_VENDORS: Record<string, {
  displayName: string
  category: string
  patterns: string[]
}> = {
  slack: {
    displayName: 'Slack',
    category: 'Communication',
    patterns: ['slack', 'slack technologies', 'slack technologies ltd'],
  },
  zoom: {
    displayName: 'Zoom',
    category: 'Video Conferencing',
    patterns: ['zoom', 'zoom.us', 'zoom video'],
  },
  adobe: {
    displayName: 'Adobe',
    category: 'Design & Creative',
    patterns: ['adobe', 'adobe systems', 'adobe inc', 'adobe systems europe'],
  },
  github: {
    displayName: 'GitHub',
    category: 'Development',
    patterns: ['github', 'github inc', 'github ireland'],
  },
  figma: {
    displayName: 'Figma',
    category: 'Design & Creative',
    patterns: ['figma'],
  },
  salesforce: {
    displayName: 'Salesforce',
    category: 'CRM',
    patterns: ['salesforce', 'sfdc'],
  },
  hubspot: {
    displayName: 'HubSpot',
    category: 'Marketing',
    patterns: ['hubspot'],
  },
  microsoft: {
    displayName: 'Microsoft 365',
    category: 'Productivity',
    patterns: ['microsoft', 'msft', 'microsoft 365', 'office 365', 'ms office', 'microsoft ireland'],
  },
  google_workspace: {
    displayName: 'Google Workspace',
    category: 'Productivity',
    patterns: ['google workspace', 'gsuite', 'g suite', 'google ireland', 'google commerce'],
  },
  atlassian: {
    displayName: 'Atlassian (Jira/Confluence)',
    category: 'Project Management',
    patterns: ['atlassian', 'atlassian pty', 'jira', 'confluence', 'bitbucket'],
  },
  notion: {
    displayName: 'Notion',
    category: 'Productivity',
    patterns: ['notion', 'notion labs', 'notion labs ireland'],
  },
  aws: {
    displayName: 'Amazon Web Services',
    category: 'Cloud Infrastructure',
    patterns: ['aws', 'amazon web services', 'amazon aws', 'aws emea'],
  },
  datadog: {
    displayName: 'Datadog',
    category: 'Monitoring',
    patterns: ['datadog'],
  },
  intercom: {
    displayName: 'Intercom',
    category: 'Customer Support',
    patterns: ['intercom'],
  },
  zendesk: {
    displayName: 'Zendesk',
    category: 'Customer Support',
    patterns: ['zendesk'],
  },
  dropbox: {
    displayName: 'Dropbox',
    category: 'Storage',
    patterns: ['dropbox'],
  },
  asana: {
    displayName: 'Asana',
    category: 'Project Management',
    patterns: ['asana'],
  },
  monday: {
    displayName: 'Monday.com',
    category: 'Project Management',
    patterns: ['monday', 'monday.com'],
  },
  linear: {
    displayName: 'Linear',
    category: 'Project Management',
    patterns: ['linear'],
  },
  vercel: {
    displayName: 'Vercel',
    category: 'Cloud Infrastructure',
    patterns: ['vercel'],
  },
  twilio: {
    displayName: 'Twilio',
    category: 'Communication',
    patterns: ['twilio'],
  },
  sendgrid: {
    displayName: 'SendGrid',
    category: 'Email',
    patterns: ['sendgrid'],
  },
  mailchimp: {
    displayName: 'Mailchimp',
    category: 'Email Marketing',
    patterns: ['mailchimp'],
  },
  webflow: {
    displayName: 'Webflow',
    category: 'Website Builder',
    patterns: ['webflow'],
  },
  calendly: {
    displayName: 'Calendly',
    category: 'Scheduling',
    patterns: ['calendly'],
  },
  docusign: {
    displayName: 'DocuSign',
    category: 'Document Management',
    patterns: ['docusign'],
  },
  snowflake: {
    displayName: 'Snowflake',
    category: 'Data Platform',
    patterns: ['snowflake'],
  },
  okta: {
    displayName: 'Okta',
    category: 'Identity',
    patterns: ['okta'],
  },
  '1password': {
    displayName: '1Password',
    category: 'Security',
    patterns: ['1password', 'agilebits'],
  },
  lastpass: {
    displayName: 'LastPass',
    category: 'Security',
    patterns: ['lastpass'],
  },
  microsoft_teams: {
    displayName: 'Microsoft Teams',
    category: 'Video Conferencing',
    patterns: ['teams', 'microsoft teams'],
  },
  google_meet: {
    displayName: 'Google Meet',
    category: 'Video Conferencing',
    patterns: ['google meet'],
  },
}

export function isSoftwareMCC(mccCode: string | null | undefined): boolean {
  if (!mccCode) return false
  return mccCode in SOFTWARE_MCC_CODES
}
