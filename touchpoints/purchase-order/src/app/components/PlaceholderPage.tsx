import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import AppShell from "./layout/AppShell";
import TopBar from "./layout/TopBar";
import { FONT } from "./designTokens";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  topBarTitle?: string;
}

export default function PlaceholderPage({
  title,
  description = "This module is under development and will be available soon.",
  topBarTitle,
}: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <AppShell>
      <TopBar title={topBarTitle || title} showSearch={false} />
      <div
        className="flex-1 flex items-center justify-center p-4 lg:p-8"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div
          className="flex flex-col items-center gap-5 max-w-md text-center rounded-[var(--radius-lg)] border border-border p-10"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div
            className="flex items-center justify-center size-14 rounded-[var(--radius-lg)]"
            style={{ backgroundColor: "var(--warning-tint)", color: "var(--warning)" }}
          >
            <Construction className="size-7" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col gap-2">
            <h2
              className="text-foreground"
              style={{
                fontSize: "var(--text-h4)",
                fontWeight: "var(--font-weight-semibold)",
                lineHeight: "28px",
                fontFamily: FONT,
              }}
            >
              {title}
            </h2>
            <p
              className="text-muted-foreground"
              style={{
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-weight-normal)",
                lineHeight: "22px",
                fontFamily: FONT,
              }}
            >
              {description}
            </p>
          </div>

          <button
            className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-sm)] border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer mt-2"
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-weight-medium)",
              fontFamily: FONT,
            }}
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            Back to Home
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/* ── Pre-configured placeholder exports ── */

export function ReceivingDocumentsPage() {
  return (
    <PlaceholderPage
      title="Receiving Documents"
      description="Log and verify inbound goods against purchase orders. Coming soon."
    />
  );
}

export function EmailsPage() {
  return (
    <PlaceholderPage
      title="Emails"
      description="View and manage procurement-related email correspondence. Coming soon."
    />
  );
}

export function HelpPage() {
  return (
    <PlaceholderPage
      title="Help & Support"
      description="Documentation, tutorials, and support resources. Coming soon."
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Configure application preferences, users, and integrations. Coming soon."
    />
  );
}

export function ItemsSubPage({ title }: { title: string }) {
  return (
    <PlaceholderPage
      title={title}
      topBarTitle="Supply Chain"
      description={`The ${title} module is under development.`}
    />
  );
}