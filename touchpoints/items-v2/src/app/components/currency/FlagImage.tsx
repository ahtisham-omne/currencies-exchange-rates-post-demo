import * as React from "react";

/**
 * A flag drawn exactly as the Currency & Exchange Rates shell draws it
 * (src/app/coa/components/FlagImage.tsx in the main app): flag-icons' 4:3
 * artwork from the shell's /flags/4x3 set, in a 4:3 box with rounded corners
 * and a faint outline, sized in ems so it sits in a line of text at that
 * text's size. Inline styles, so it looks the same whatever this app's
 * Tailwind setup. Where the picture can't load (e.g. this app run on its own,
 * outside the shell) the two letters stand in, in a chip the flag's size.
 */

/* flag-icons files for codes that aren't plain ISO 3166 alpha-2. */
const FLAG_FILE: Record<string, string> = {
  ac: "sh-ac", // Ascension Island
  ta: "sh-ta", // Tristan da Cunha
};

export function FlagImage({
  code,
  className,
  style,
}: {
  /** ISO 3166 alpha-2 (or EU), either case. */
  code: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = React.useState(false);
  const c = (code ?? "").toLowerCase();
  const box: React.CSSProperties = {
    display: "inline-block",
    width: "1.33em",
    height: "1em",
    borderRadius: "0.15em",
    flexShrink: 0,
    verticalAlign: "-0.12em",
  };
  if (!c || failed) {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          ...box,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F1F5F9",
          border: "1px solid #E2E8F0",
          color: "#64748B",
          textTransform: "uppercase",
          ...style,
          // A numeric fontSize sets the flag's size; the chip scales from it.
          fontSize: typeof style?.fontSize === "number" ? style.fontSize * 0.55 : "0.55em",
          fontWeight: 700,
          width: "2.4em",
          height: "1.8em",
        }}
      >
        {c}
      </span>
    );
  }
  return (
    <img
      src={`/flags/4x3/${FLAG_FILE[c] ?? c}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      data-flag={c}
      className={className}
      style={{ ...box, objectFit: "cover", boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.1)", ...style }}
    />
  );
}
