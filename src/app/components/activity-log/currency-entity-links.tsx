import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Hit, StatusPillNode } from "./activity-log";
import { useCurrencies } from "../../context/CurrencyContext";
import { statusOf } from "../../pages/currency/model";

/* The records this module's logs name: currencies. Every one is a link with
 * its card (rules-since-2.6, 3 Nov). No module draws a currency card yet,
 * so this one is built once from the Currency Library's own columns
 * (Currency, Symbol, Decimals, Country, Status) on the shared HoverCard, at
 * 400 ms open and 200 ms close, with the dark header flush to its edge.
 * Click opens the currency's page. A code the library does not hold stays
 * plain. */

const LINK = "font-medium text-primary underline underline-offset-2 decoration-1 cursor-pointer";
const OPEN_DELAY = 400;
const CLOSE_DELAY = 200;

export function CurrencyLink({ code, query }: { code: string; query: string }) {
  const navigate = useNavigate();
  const { getCurrency } = useCurrencies();
  const c = getCurrency(code);
  if (!c) {
    return (
      <span className="font-medium text-foreground">
        <Hit text={code} query={query} />
      </span>
    );
  }
  const status = statusOf(c);
  const rows: [string, string][] = [
    ["Symbol", c.symbol],
    ["Decimals", String(c.decimalPlaces)],
    ["Country", c.country],
  ];
  return (
    <HoverCard openDelay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
      <HoverCardTrigger asChild>
        <span
          className={LINK}
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/accounting/currencies/${c.code}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/accounting/currencies/${c.code}`);
          }}
        >
          <Hit text={code} query={query} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="activity-log-portal w-[300px] p-0 rounded-[14px] border overflow-hidden z-[10000]"
        style={{ borderColor: "var(--border)", boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16), 0 4px 10px rgba(15, 23, 42, 0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center gap-[11px] overflow-hidden p-[14px]" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}>
          <div className="pointer-events-none absolute rounded-full" style={{ top: -36, right: -26, width: 120, height: 120, background: "rgba(255, 255, 255, 0.04)" }} />
          <div className="flex shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255, 255, 255, 0.08)" }}>
            <Coins size={18} style={{ color: "rgba(255, 255, 255, 0.55)" }} />
          </div>
          <div className="relative min-w-0">
            <div className="truncate text-[14px] font-bold text-white">{c.code}</div>
            <div className="mt-0.5 truncate text-[12px]" style={{ color: "var(--color-slate-400)" }}>
              {c.name}
              {c.isBaseCurrency ? " · Base currency" : ""}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-[15px] py-[13px] text-[12px]" style={{ color: "var(--color-slate-500)" }}>
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-2.5">
              <span>{label}</span>
              <span className="ml-auto truncate font-medium text-foreground">{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-2.5">
            <span>Status</span>
            <span className="ml-auto">
              <StatusPillNode label={status} active={status === "Active"} query="" />
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
