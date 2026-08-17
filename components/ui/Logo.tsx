import Image from "next/image";

export function Logo({ height = "2.2rem", className }: { height?: string; className?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height, lineHeight: 0 }} className={className}>
      <Image className="logo-light-mark" src="/brand/percept-logo.png" alt="Percept" width={896} height={196} style={{ width: "auto", height }} />
      <Image className="logo-dark-mark" src="/brand/percept-logo-dark.png" alt="" aria-hidden="true" width={896} height={196} style={{ width: "auto", height }} />
    </span>
  );
}
