import Link from "next/link";

export const LogoSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" {...props}>
      <rect x="1" y="1" width="9" height="9" rx="1.5" fill="currentColor" />
      <rect x="12" y="1.75" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="12" width="9" height="9" rx="1.5" className="fill-brand" />
    </svg>
  );
};

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-2 text-charcoal-900 dark:text-neutral-100">
      <LogoSVG />
      <span className="text-xl font-medium">Roundlot</span>
    </Link>
  );
};
