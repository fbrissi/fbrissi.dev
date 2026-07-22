type ViewAllLinkProps = {
  href: string;
  label: string;
};

export function ViewAllLink({ href, label }: ViewAllLinkProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover">
      {label}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
import Link from 'next/link';
