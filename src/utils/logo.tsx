/* utils/logo.tsx ---------------------------------------------------------- */
export const ShadLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      aria-label="shadcn logo"
      fill="currentColor"
      {...props}
    >
      <rect x="3"  y="3"  width="8" height="8" rx="1" />
      <rect x="13" y="3"  width="8" height="8" rx="1" />
      <rect x="3"  y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
  