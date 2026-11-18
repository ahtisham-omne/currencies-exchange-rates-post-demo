import { Fragment } from "react";
import { Check, Minus, Table2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./shared/PageHeader";
import {
  ACCESS_LEVELS,
  CAPABILITY_GROUPS,
  setAccessLevel,
  useAccessMode,
  useDenialStyle,
} from "./access-mode";

/* Capability matrix — the access model documenting itself.
 *
 * Every persona against every capability, so the gating rules are auditable
 * without reading the deriver. Column headers double as persona switches: the
 * active column is tinted, and clicking any other column head switches to it,
 * which makes it easy to flip a persona and immediately see the app change.
 *
 * Reached from the header avatar menu's "Capability matrix" row. */

export function AccessMatrixPage() {
  const navigate = useNavigate();
  const active = useAccessMode();
  const denial = useDenialStyle();

  return (
    <div className="w-full font-['Inter',sans-serif] flex flex-col h-full min-h-0">
      <PageHeader
        icon={Table2}
        onBack={() => navigate("/company-settings/user-access-control")}
        backLabel="Back to User Access Control"
        title="Capability matrix"
        subtitle="Every access level against every capability it can exercise in this module."
      />

      <div className="px-6 lg:px-8 pt-4 pb-6 flex-1 min-h-0 overflow-auto">
        {/* Active persona summary */}
        <div
          className="mb-4 rounded-xl border bg-white px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ borderColor: "#E2E8F0" }}
        >
          <span className="text-[12px] text-[#64748B]" style={{ fontWeight: 500 }}>
            Active level
          </span>
          <span
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1"
            style={{ backgroundColor: "#EDF4FF" }}
          >
            <span className="text-[13px]" style={{ fontWeight: 600, color: "#007FFF" }}>
              {active.label}
            </span>
          </span>
          <span className="text-[12px] text-[#94A3B8]">{active.description}</span>
          <span className="ml-auto text-[12px] text-[#64748B]">
            Denied actions are{" "}
            <span style={{ fontWeight: 600, color: "#0F172A" }}>
              {denial === "hidden" ? "hidden" : "shown disabled"}
            </span>
          </span>
        </div>

        {/* The matrix. Horizontally scrollable in its own container so the page
            body never scrolls sideways on narrow viewports. */}
        <div
          className="rounded-xl border bg-white overflow-x-auto"
          style={{ borderColor: "#E2E8F0" }}
        >
          <table className="w-full border-collapse" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 bg-[#F8FAFC] text-left px-4 py-3 text-[12px] text-[#64748B] border-b border-r"
                  style={{ fontWeight: 500, borderColor: "#E2E8F0", minWidth: 300 }}
                >
                  Capability
                </th>
                {ACCESS_LEVELS.map((p) => {
                  const isActive = p.level === active.level;
                  return (
                    <th
                      key={p.level}
                      className="px-3 py-3 border-b align-bottom"
                      style={{
                        borderColor: "#E2E8F0",
                        backgroundColor: isActive ? "#EDF4FF" : "#F8FAFC",
                        minWidth: 116,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setAccessLevel(p.level)}
                        className="w-full flex flex-col items-center gap-1 cursor-pointer group"
                        aria-label={`Switch to ${p.label}`}
                        aria-pressed={isActive}
                      >
                        <p.icon
                          className="w-4 h-4"
                          style={{ color: isActive ? "#007FFF" : "#94A3B8" }}
                        />
                        <span
                          className="text-[12px] leading-[16px] text-center group-hover:text-[#007FFF] transition-colors"
                          style={{
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? "#007FFF" : "#0F172A",
                          }}
                        >
                          {p.label}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_GROUPS.map((group) => (
                <Fragment key={group.group}>
                  <tr>
                    <td
                      colSpan={ACCESS_LEVELS.length + 1}
                      className="px-4 py-2 text-[11px] text-[#64748B] bg-[#F8FAFC] border-b"
                      style={{ fontWeight: 600, letterSpacing: "0.04em", borderColor: "#F1F5F9" }}
                    >
                      {group.group.toUpperCase()}
                    </td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item.key} className="hover:bg-[#F8FAFC] transition-colors">
                      <td
                        className="sticky left-0 z-10 bg-white px-4 py-2.5 border-b border-r"
                        style={{ borderColor: "#F1F5F9" }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                              {item.label}
                            </span>
                            {/* A tick on a scoped capability means "on the
                                records in this level's scope", not "on every
                                record". Nothing else in the table carries that
                                caveat, so the row says so itself. */}
                            {item.scoped && (
                              <span
                                className="inline-flex items-center shrink-0 rounded-md border border-[#E2E8F0] bg-white px-1.5 leading-[16px] text-[#64748B]"
                                style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.02em" }}
                                title="Limited to the roles in the level's Manage Roles scope"
                              >
                                Scoped
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-[#94A3B8] font-mono">
                            {item.permissionId}
                          </span>
                        </div>
                      </td>
                      {ACCESS_LEVELS.map((p) => {
                        const allowed = p[item.key];
                        const isActive = p.level === active.level;
                        return (
                          <td
                            key={p.level}
                            className="px-3 py-2.5 border-b text-center"
                            style={{
                              borderColor: "#F1F5F9",
                              backgroundColor: isActive ? "#F5F9FF" : undefined,
                            }}
                          >
                            {allowed ? (
                              <Check
                                className="w-4 h-4 inline-block"
                                style={{ color: "#059669" }}
                                aria-label="Allowed"
                              />
                            ) : (
                              <Minus
                                className="w-4 h-4 inline-block"
                                style={{ color: "#CBD5E1" }}
                                aria-label="Not allowed"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[12px] text-[#94A3B8]">
          Capability ids map onto the Users &amp; Roles permissions in the permission catalog.
          Visibility in the app is always the capability AND the record&rsquo;s status AND, for
          scoped capabilities, whether the record is in the viewer&rsquo;s scope. So an allowed
          action can still be withheld on an archived user, a predefined role, or a role outside
          your Manage Roles scope.
        </p>
      </div>
    </div>
  );
}
