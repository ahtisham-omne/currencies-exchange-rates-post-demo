import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE_TITLE = "Partners Management";

const ROUTE_TITLES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/partners\/groups\/imports\/[^/]+$/, title: "Import Details" },
  { pattern: /^\/partners\/groups\/imports$/, title: "Partner Group Imports" },
  { pattern: /^\/vendors\/imports\/[^/]+$/, title: "Import Details" },
  { pattern: /^\/vendors\/imports$/, title: "Partner Imports" },
  { pattern: /^\/partners\/groups\/[^/]+$/, title: "Partner Group Details" },
  { pattern: /^\/partners\/groups$/, title: "Partner Groups" },
  { pattern: /^\/partners\/contacts\/[^/]+$/, title: "Contact Details" },
  { pattern: /^\/partners\/contacts$/, title: "Contacts Directory" },
  { pattern: /^\/partners\/credit$/, title: "Credit Management" },
  { pattern: /^\/partners\/carriers$/, title: "Carrier Management" },
  { pattern: /^\/partners\/locations$/, title: "Partner Locations" },
  { pattern: /^\/partners\/qualified-vendors$/, title: "Qualified Vendors" },
  { pattern: /^\/partners\/reports$/, title: "Reports & Analytics" },
  { pattern: /^\/vendors\/create$/, title: "Add New Partner" },
  { pattern: /^\/vendors\/[^/]+\/edit$/, title: "Edit Partner" },
  { pattern: /^\/vendors\/[^/]+$/, title: "Partner Details" },
  { pattern: /^\/vendors$/, title: "Partners" },
];

export function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = ROUTE_TITLES.find(r => r.pattern.test(pathname));
    document.title = match ? `${match.title} · ${BASE_TITLE}` : BASE_TITLE;
  }, [pathname]);

  return null;
}
