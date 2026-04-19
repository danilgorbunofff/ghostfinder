// Centralized data-testid selectors for E2E tests.
// Components must add matching data-testid attributes.

export const S = {
  // Sidebar navigation
  nav: {
    sidebar: 'sidebar-nav',
    dashboard: 'nav-dashboard',
    inventory: 'nav-inventory',
    connections: 'nav-connections',
    reports: 'nav-reports',
    billing: 'nav-billing',
    settings: 'nav-settings',
    mobileToggle: 'nav-mobile-toggle',
    orgName: 'nav-org-name',
    userRole: 'nav-user-role',
  },

  // Page header
  header: {
    wrapper: 'page-header',
    userEmail: 'header-user-email',
  },

  // Dashboard home
  dashboard: {
    statsCards: 'stats-cards',
    totalSpend: 'stat-total-spend',
    estimatedWaste: 'stat-estimated-waste',
    opportunities: 'stat-opportunities',
    userActivity: 'stat-user-activity',
    gettingStarted: 'getting-started',
    stepBank: 'step-bank-connection',
    stepIdentity: 'step-identity-provider',
    stepReport: 'step-waste-report',
    spendChart: 'spend-chart',
    vendorBreakdown: 'vendor-breakdown',
    quickActions: 'quick-actions',
  },

  // Connections
  connections: {
    plaidButton: 'plaid-connect-button',
    googleButton: 'google-connect-button',
    oktaButton: 'okta-connect-button',
    goCardlessButton: 'gocardless-connect-button',
    oktaOrgUrl: 'okta-org-url',
    oktaApiToken: 'okta-api-token',
    oktaSubmit: 'okta-connect-submit',
    connectionCard: 'connection-card',
    connectionStats: 'connection-stats',
    onboardingProgress: 'onboarding-progress',
    statusBadge: 'connection-status',
  },

  // Inventory
  inventory: {
    searchInput: 'inventory-search',
    statusFilter: 'inventory-status-filter',
    categoryFilter: 'inventory-category-filter',
    costFilter: 'inventory-cost-filter',
    viewToggle: 'inventory-view-toggle',
    exportButton: 'inventory-export',
    clearFilters: 'clear-filters',
    vendorTable: 'vendor-table',
    vendorGrid: 'vendor-grid',
    vendorRow: 'vendor-row',
    vendorDrawer: 'vendor-drawer',
    drawerClose: 'drawer-close',
    inventoryStats: 'inventory-stats',
    emptyState: 'inventory-empty',
  },

  // Reports
  reports: {
    reportSelector: 'report-selector',
    ghostSeatCard: 'ghost-seat-card',
    duplicateCard: 'duplicate-card',
    emptyState: 'reports-empty-state',
    reportDate: 'report-date',
    totalWaste: 'report-total-waste',
  },

  // Billing
  billing: {
    freeCard: 'plan-free',
    monitorCard: 'plan-monitor',
    recoveryCard: 'plan-recovery',
    currentBadge: 'current-plan-badge',
    billingToggle: 'billing-toggle',
    upgradeButton: 'upgrade-button',
    manageButton: 'manage-subscription',
    upgradeConfirm: 'upgrade-confirm',
    pastDueBanner: 'past-due-banner',
  },

  // Settings
  settings: {
    tabProfile: 'tab-profile',
    tabOrganization: 'tab-organization',
    tabNotifications: 'tab-notifications',
    tabDangerZone: 'tab-danger-zone',
    orgNameInput: 'org-name-input',
    orgSaveButton: 'org-save-button',
    membersList: 'members-list',
    dangerZoneSection: 'danger-zone-section',
    deleteOrgButton: 'delete-org-button',
    emailToggle: 'notification-email-toggle',
    slackToggle: 'notification-slack-toggle',
    thresholdInput: 'notification-threshold',
  },

  // Dev tools panel
  dev: {
    toggle: 'dev-tools-toggle',
    panel: 'dev-tools-panel',
    close: 'dev-tools-close',
    tabData: 'dev-tab-data',
    tabConn: 'dev-tab-conn',
    tabCron: 'dev-tab-cron',
    tabAuth: 'dev-tab-auth',
    tabState: 'dev-tab-state',
  },

  // Auth pages (unauthenticated)
  auth: {
    loginEmail: 'login-email',
    loginPassword: 'login-password',
    loginSubmit: 'login-submit',
    loginGoogle: 'login-google',
    loginError: 'login-error',
    signupEmail: 'signup-email',
    signupPassword: 'signup-password',
    signupSubmit: 'signup-submit',
    signupGoogle: 'signup-google',
    signupError: 'signup-error',
    signupConfirmation: 'signup-confirmation',
  },
} as const
