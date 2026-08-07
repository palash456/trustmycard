import { appUrl } from "@/lib/app-url";

type AppCtaLinkProps = {
  children: React.ReactNode;
  className?: string;
  path?: string;
};

export function AppCtaLink({ children, className, path = "/connect" }: AppCtaLinkProps) {
  const href = appUrl(path);
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
