export function PlaidLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#111111" />
      <path d="M6 7h3l2 5-2 5H6l2-5-2-5z" fill="white" />
      <path d="M11 7h3l2 5-2 5h-3l2-5-2-5z" fill="white" opacity="0.6" />
    </svg>
  )
}

export function OktaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#007DC1" />
      <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#4285F4" />
      <path d="M17.5 12.2c0-.4 0-.8-.1-1.2H12v2.3h3.1c-.1.7-.5 1.3-1.1 1.7v1.4h1.8c1-1 1.7-2.4 1.7-4.2z" fill="white"/>
      <path d="M12 18c1.5 0 2.7-.5 3.7-1.4l-1.8-1.4c-.5.3-1.1.5-1.9.5-1.5 0-2.7-1-3.1-2.3H7v1.4C8 16.8 9.8 18 12 18z" fill="white" opacity="0.9"/>
      <path d="M8.9 13.4c-.1-.4-.2-.7-.2-1.1s.1-.8.2-1.1V9.8H7C6.7 10.5 6.5 11.2 6.5 12s.2 1.5.5 2.2l1.9-1.4v.6z" fill="white" opacity="0.7"/>
      <path d="M12 8.6c.8 0 1.6.3 2.1.8l1.6-1.6C14.7 6.9 13.5 6.5 12 6.5 9.8 6.5 8 7.7 7 9.5l1.9 1.5C9.3 9.6 10.5 8.6 12 8.6z" fill="white" opacity="0.8"/>
    </svg>
  )
}

export function GoCardlessLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#00827F" />
      <path d="M7 12a5 5 0 0 1 10 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="14" r="2" fill="white" />
    </svg>
  )
}
