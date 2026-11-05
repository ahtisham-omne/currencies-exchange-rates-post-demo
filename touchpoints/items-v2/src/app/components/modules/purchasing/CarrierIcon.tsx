/**
 * CarrierIcon — square carrier logo tile, ported VERBATIM from the Partner
 * app (Partner-Management---Vendor `VendorsListPage.tsx`, the CarrierIcon
 * helper). Renders the carrier's brand logo on a white square when we have
 * an asset for it, else a tinted initials fallback. Used by the QV listing
 * "Carrier (Vendor)" column. The 8 logo assets already live in our repo
 * under @/assets/carriers (shared with ShippingCarrierCard).
 */
import fedexLogo from "@/assets/carriers/fedex.png";
import dhlLogo from "@/assets/carriers/dhl.png";
import upsLogo from "@/assets/carriers/ups.png";
import tcsLogo from "@/assets/carriers/tcs.png";
import sfLogo from "@/assets/carriers/sf.png";
import uspsLogo from "@/assets/carriers/usps.png";
import aramexLogo from "@/assets/carriers/aramex.png";
import maerskLogo from "@/assets/carriers/maersk.png";

function carrierInitials(name: string): string {
  if (!name) return "–";
  if (name.includes("FedEx")) return "FE";
  if (name.includes("DHL")) return "DHL";
  if (name.includes("UPS")) return "UPS";
  if (name.includes("TCS")) return "TCS";
  if (name.includes("SF")) return "SF";
  if (name.includes("USPS")) return "US";
  if (name.includes("Aramex")) return "AR";
  if (name.includes("Maersk")) return "MA";
  return name.substring(0, 2).toUpperCase();
}

const CARRIER_LOGOS: Record<string, string> = {
  FedEx: fedexLogo,
  DHL: dhlLogo,
  UPS: upsLogo,
  TCS: tcsLogo,
  SF: sfLogo,
  USPS: uspsLogo,
  Aramex: aramexLogo,
  Maersk: maerskLogo,
};

export function CarrierIcon({ carrier, large }: { carrier: string; large?: boolean }) {
  let carrierLogo: string | undefined;
  for (const key of Object.keys(CARRIER_LOGOS)) {
    if (carrier.includes(key)) {
      carrierLogo = CARRIER_LOGOS[key];
      break;
    }
  }
  return (
    <div
      className={`${large ? "w-10 h-10" : "w-7 h-7"} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`}
      style={{
        backgroundColor: carrierLogo ? "#FFFFFF" : "hsl(var(--muted))",
        color: "hsl(var(--muted-foreground))",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {carrierLogo ? (
        <img src={carrierLogo} alt="" className="w-full h-full object-contain p-1" />
      ) : (
        carrierInitials(carrier)
      )}
    </div>
  );
}

export default CarrierIcon;
