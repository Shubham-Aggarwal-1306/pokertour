"use client";

import { useEffect } from "react";

const beacon = (id: string, kind: "view" | "click") =>
  navigator.sendBeacon?.(`/api/tournaments/${encodeURIComponent(id)}/engage?kind=${kind}`);

/** Records a page view once per mount (feeds popularity ranking). */
export function TrackView({ id }: { id: string }) {
  useEffect(() => {
    beacon(id, "view");
  }, [id]);
  return null;
}

/** Outbound link to the organizer that counts as a strong popularity signal. */
export function OutboundLink({ id, href, className, children }: { id: string; href: string; className?: string; children: React.ReactNode }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={() => beacon(id, "click")}>
      {children}
    </a>
  );
}
