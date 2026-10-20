import type { ReactNode } from "react";

/**
 * Text that browser translators should leave alone: numbers already formatted for the
 * reader's locale (Google Translate reads pt-BR "380.019 km²" as English and turns it into
 * "380,019"), and names people chose. It also keeps the text node React owns in place, so
 * updating it can't crash a translated page.
 *
 * Translators drop the spaces between translated text and these, so put the spaces inside:
 * `is<Literal>{` ${n} `}</Literal>times`, not `is <Literal>{n}</Literal> times`.
 */
export function Literal({ children }: { children: ReactNode }) {
  return <span translate="no">{children}</span>;
}
