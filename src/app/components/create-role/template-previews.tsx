/**
 * Mini SVG preview illustrations for role templates.
 * Extracted from Step1RoleBasicInfo for reuse in AllTemplatesModal.
 */
import type React from "react";

interface PreviewProps {
  accent: string;
  accentLight: string;
  accentMid: string;
}

export function WarehousePreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="54" width="24" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="8" y="21" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="52" y="10" width="50" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="34" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="34" width="20" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="58" y="40" width="14" height="6" rx="2" fill={accentLight} />
      <rect x="58" y="40" width="14" height="6" rx="2" stroke={accentMid} strokeWidth="0.5" />
      <text x="62" y="45" fill={accent} fontSize="4.5" fontWeight="600">24</text>
      <rect x="58" y="50" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="58" y="50" width="28" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="58" y="55" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="58" y="55" width="18" height="2" rx="1" fill={accentMid} opacity="0.4" />
      <rect x="108" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="114" y="34" width="22" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="114" y="40" width="14" height="6" rx="2" fill={accentLight} />
      <rect x="114" y="40" width="14" height="6" rx="2" stroke={accentMid} strokeWidth="0.5" />
      <text x="118" y="45" fill={accent} fontSize="4.5" fontWeight="600">18</text>
      <rect x="114" y="50" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="114" y="50" width="32" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="114" y="55" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="114" y="55" width="24" height="2" rx="1" fill={accentMid} opacity="0.4" />
      <rect x="164" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="170" y="34" width="18" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="170" y="40" width="14" height="6" rx="2" fill={accentLight} />
      <rect x="170" y="40" width="14" height="6" rx="2" stroke={accentMid} strokeWidth="0.5" />
      <text x="174" y="45" fill={accent} fontSize="4.5" fontWeight="600">31</text>
      <rect x="170" y="50" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="170" y="50" width="36" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="170" y="55" width="38" height="2" rx="1" fill="#F1F5F9" />
      <rect x="170" y="55" width="14" height="2" rx="1" fill={accentMid} opacity="0.4" />
      <rect x="52" y="72" width="162" height="0.5" fill="#F1F5F9" />
      <rect x="52" y="78" width="30" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="90" y="78" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="120" y="78" width="16" height="2.5" rx="1.25" fill="#E2E8F0" />
      <circle cx="160" cy="79" r="3.5" fill={accentLight} />
      <circle cx="160" cy="79" r="3.5" stroke={accentMid} strokeWidth="0.5" />
      <rect x="52" y="87" width="162" height="0.5" fill="#F1F5F9" />
      <rect x="52" y="93" width="26" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="90" y="93" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="120" y="93" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <circle cx="160" cy="94" r="3.5" fill={accentLight} />
      <circle cx="160" cy="94" r="3.5" stroke={accentMid} strokeWidth="0.5" />
      <rect x="52" y="102" width="162" height="0.5" fill="#F1F5F9" />
      <rect x="52" y="108" width="34" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="90" y="108" width="24" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="120" y="108" width="14" height="2.5" rx="1.25" fill="#E2E8F0" />
      <circle cx="160" cy="109" r="3.5" fill="#F1F5F9" />
    </svg>
  );
}

export function FinancePreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="8" y="29" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="52" y="10" width="44" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="30" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="28" width="76" height="32" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="33" width="20" height="2" rx="1" fill="#CBD5E1" />
      <text x="58" y="44" fill={accent} fontSize="7" fontWeight="700">$142.8k</text>
      <rect x="58" y="49" width="28" height="2" rx="1" fill={accentMid} opacity="0.5" />
      <rect x="108" y="34" width="12" height="10" rx="1.5" fill={accentLight} />
      <polygon points="112,42 115,37 118,39.5" fill={accent} opacity="0.4" />
      <rect x="134" y="28" width="76" height="32" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="140" y="33" width="22" height="2" rx="1" fill="#CBD5E1" />
      <text x="140" y="44" fill="#1E293B" fontSize="7" fontWeight="700">$89.3k</text>
      <rect x="140" y="49" width="24" height="2" rx="1" fill="#E2E8F0" />
      <rect x="52" y="66" width="158" height="48" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="72" width="24" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="62" y="100" width="8" height="14" rx="1.5" fill={accentLight} />
      <rect x="62" y="106" width="8" height="8" rx="1.5" fill={accentMid} />
      <rect x="75" y="96" width="8" height="18" rx="1.5" fill={accentLight} />
      <rect x="75" y="103" width="8" height="11" rx="1.5" fill={accentMid} />
      <rect x="88" y="92" width="8" height="22" rx="1.5" fill={accentLight} />
      <rect x="88" y="98" width="8" height="16" rx="1.5" fill={accent} opacity="0.35" />
      <rect x="101" y="88" width="8" height="26" rx="1.5" fill={accentLight} />
      <rect x="101" y="96" width="8" height="18" rx="1.5" fill={accent} opacity="0.45" />
      <rect x="114" y="84" width="8" height="30" rx="1.5" fill={accentLight} />
      <rect x="114" y="90" width="8" height="24" rx="1.5" fill={accent} opacity="0.55" />
      <rect x="127" y="86" width="8" height="28" rx="1.5" fill={accentLight} />
      <rect x="127" y="94" width="8" height="20" rx="1.5" fill={accent} opacity="0.45" />
      <rect x="140" y="90" width="8" height="24" rx="1.5" fill={accentLight} />
      <rect x="140" y="98" width="8" height="16" rx="1.5" fill={accentMid} />
    </svg>
  );
}

export function SupplyChainPreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="8" y="37" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="52" y="10" width="52" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="34" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="30" width="42" height="42" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <circle cx="73" cy="44" r="8" fill={accentLight} />
      <circle cx="73" cy="44" r="8" stroke={accentMid} strokeWidth="0.8" />
      <rect x="69" y="42" width="8" height="4" rx="1" fill={accent} opacity="0.6" />
      <rect x="60" y="58" width="26" height="2" rx="1" fill="#CBD5E1" />
      <rect x="62" y="63" width="20" height="2" rx="1" fill="#E2E8F0" />
      <line x1="96" y1="51" x2="108" y2="51" stroke={accentMid} strokeWidth="1.2" strokeDasharray="2 2" />
      <polygon points="108,48.5 113,51 108,53.5" fill={accentMid} />
      <rect x="115" y="30" width="42" height="42" rx="5" fill="white" stroke={accentMid} strokeWidth="1" />
      <circle cx="136" cy="44" r="8" fill={accentLight} />
      <circle cx="136" cy="44" r="8" stroke={accent} strokeWidth="0.8" opacity="0.5" />
      <rect x="132" y="41" width="4" height="6" rx="1" fill={accent} opacity="0.5" />
      <rect x="137" y="43" width="3" height="4" rx="0.75" fill={accent} opacity="0.3" />
      <rect x="123" y="58" width="26" height="2" rx="1" fill="#CBD5E1" />
      <rect x="125" y="63" width="20" height="2" rx="1" fill="#E2E8F0" />
      <line x1="159" y1="51" x2="171" y2="51" stroke={accentMid} strokeWidth="1.2" strokeDasharray="2 2" />
      <polygon points="171,48.5 176,51 171,53.5" fill={accentMid} />
      <rect x="178" y="30" width="42" height="42" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <circle cx="199" cy="44" r="8" fill={accentLight} />
      <circle cx="199" cy="44" r="8" stroke={accentMid} strokeWidth="0.8" />
      <rect x="196" y="41" width="6" height="6" rx="1.5" fill={accent} opacity="0.35" />
      <rect x="186" y="58" width="26" height="2" rx="1" fill="#CBD5E1" />
      <rect x="188" y="63" width="20" height="2" rx="1" fill="#E2E8F0" />
      <rect x="52" y="82" width="158" height="32" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="88" width="28" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="58" y="94" width="18" height="2" rx="1" fill="#E2E8F0" />
      <circle cx="136" cy="93" r="10" fill="none" stroke="#F1F5F9" strokeWidth="3" />
      <circle cx="136" cy="93" r="10" fill="none" stroke={accentMid} strokeWidth="3" strokeDasharray="20 43" strokeLinecap="round" />
      <rect x="170" y="88" width="32" height="6" rx="3" fill={accentLight} />
      <rect x="170" y="88" width="32" height="6" rx="3" stroke={accentMid} strokeWidth="0.5" />
      <text x="178" y="93" fill={accent} fontSize="4" fontWeight="600">Active</text>
    </svg>
  );
}

export function SupportPreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="8" y="45" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="52" y="10" width="38" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="26" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="28" width="68" height="86" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="56" y="33" width="40" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="56" y="39" width="56" height="0.5" fill="#F1F5F9" />
      <rect x="56" y="43" width="8" height="8" rx="2" fill={accentLight} />
      <rect x="66" y="44" width="28" height="2" rx="1" fill="#334155" opacity="0.5" />
      <rect x="66" y="48.5" width="18" height="1.5" rx="0.75" fill="#E2E8F0" />
      <rect x="106" y="45" width="8" height="4" rx="2" fill={accentLight} stroke={accentMid} strokeWidth="0.5" />
      <rect x="56" y="55" width="60" height="0.5" fill="#F1F5F9" />
      <rect x="56" y="59" width="8" height="8" rx="2" fill="#F1F5F9" />
      <rect x="66" y="60" width="32" height="2" rx="1" fill="#334155" opacity="0.35" />
      <rect x="66" y="64.5" width="20" height="1.5" rx="0.75" fill="#E2E8F0" />
      <rect x="56" y="71" width="60" height="0.5" fill="#F1F5F9" />
      <rect x="56" y="75" width="8" height="8" rx="2" fill="#F1F5F9" />
      <rect x="66" y="76" width="26" height="2" rx="1" fill="#334155" opacity="0.35" />
      <rect x="66" y="80.5" width="22" height="1.5" rx="0.75" fill="#E2E8F0" />
      <rect x="56" y="87" width="60" height="0.5" fill="#F1F5F9" />
      <rect x="56" y="91" width="8" height="8" rx="2" fill="#F1F5F9" />
      <rect x="66" y="92" width="30" height="2" rx="1" fill="#334155" opacity="0.35" />
      <rect x="66" y="96.5" width="16" height="1.5" rx="0.75" fill="#E2E8F0" />
      <rect x="126" y="28" width="88" height="86" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="132" y="34" width="36" height="3" rx="1.5" fill="#334155" opacity="0.6" />
      <rect x="132" y="40" width="20" height="6" rx="3" fill={accentLight} stroke={accentMid} strokeWidth="0.5" />
      <text x="137" y="45" fill={accent} fontSize="3.8" fontWeight="500">Open</text>
      <rect x="132" y="52" width="74" height="0.5" fill="#F1F5F9" />
      <rect x="132" y="58" width="16" height="2" rx="1" fill="#CBD5E1" />
      <rect x="132" y="63" width="60" height="2" rx="1" fill="#E2E8F0" />
      <rect x="132" y="68" width="48" height="2" rx="1" fill="#E2E8F0" />
      <rect x="132" y="78" width="16" height="2" rx="1" fill="#CBD5E1" />
      <rect x="132" y="83" width="52" height="2" rx="1" fill="#E2E8F0" />
      <rect x="168" y="99" width="38" height="8" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" />
      <circle cx="173" cy="103" r="1.5" fill={accent} opacity="0.4" />
      <text x="177" y="105" fill="#94A3B8" fontSize="3.5" fontWeight="500">Read only</text>
    </svg>
  );
}

export function AuditorPreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="8" y="21" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="52" y="10" width="38" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="28" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="28" width="162" height="86" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="52" y="28" width="162" height="12" rx="4" fill="#FAFBFC" />
      <rect x="60" y="33" width="16" height="2" rx="1" fill="#94A3B8" />
      <rect x="90" y="33" width="20" height="2" rx="1" fill="#94A3B8" />
      <rect x="126" y="33" width="14" height="2" rx="1" fill="#94A3B8" />
      <rect x="156" y="33" width="18" height="2" rx="1" fill="#94A3B8" />
      <rect x="190" y="33" width="14" height="2" rx="1" fill="#94A3B8" />
      {[46, 58, 70, 82, 94].map((y, i) => (
        <g key={y}>
          <rect x="52" y={y + 8} width="162" height="0.5" fill="#F1F5F9" />
          <circle cx="63" cy={y + 4} r="3.5" fill={i < 3 ? accentLight : "#F8FAFC"} />
          <circle cx="63" cy={y + 4} r="3.5" stroke={i < 3 ? accentMid : "#E2E8F0"} strokeWidth="0.5" />
          {i < 3 && (
            <path d={`M${61} ${y + 4}L${62.5} ${y + 5.5}L${65} ${y + 2.5}`} stroke={accent} strokeWidth="1" strokeLinecap="round" fill="none" />
          )}
          <rect x="74" y={y + 2.5} width={20 + (i % 3) * 4} height="2" rx="1" fill="#CBD5E1" />
          <rect x="106" y={y + 2.5} width={14 + (i % 2) * 6} height="2" rx="1" fill="#E2E8F0" />
          <rect x="132" y={y + 2.5} width={12 + (i % 3) * 3} height="2" rx="1" fill="#E2E8F0" />
          <rect x="160" y={y + 1.5} width="18" height="5" rx="2.5" fill={i < 4 ? accentLight : "#F8FAFC"} />
          <rect x="160" y={y + 1.5} width="18" height="5" rx="2.5" stroke={i < 4 ? accentMid : "#E2E8F0"} strokeWidth="0.4" />
          <rect x="192" y={y + 2.5} width="12" height="2" rx="1" fill="#E2E8F0" />
        </g>
      ))}
    </svg>
  );
}

/* ─── Generic preview used as fallback for additional templates ─── */
export function GenericPreview({ accent, accentLight, accentMid }: PreviewProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 120" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="44" height="120" fill="#F8FAFC" />
      <rect x="10" y="12" width="24" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="10" y="22" width="24" height="2.5" rx="1.25" fill={accentMid} />
      <rect x="8" y="21" width="1.5" height="4.5" rx="0.75" fill={accent} />
      <rect x="10" y="30" width="20" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="38" width="22" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="10" y="46" width="18" height="2.5" rx="1.25" fill="#E2E8F0" />
      <rect x="52" y="10" width="46" height="4" rx="2" fill="#1E293B" opacity="0.7" />
      <rect x="52" y="18" width="30" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="52" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="34" width="20" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="58" y="40" width="14" height="6" rx="2" fill={accentLight} stroke={accentMid} strokeWidth="0.5" />
      <rect x="58" y="50" width="38" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="58" y="55" width="24" height="2" rx="1" fill="#E2E8F0" />
      <rect x="108" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="114" y="34" width="22" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="114" y="40" width="14" height="6" rx="2" fill={accentLight} stroke={accentMid} strokeWidth="0.5" />
      <rect x="114" y="50" width="38" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="114" y="55" width="30" height="2" rx="1" fill="#E2E8F0" />
      <rect x="164" y="28" width="50" height="36" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="170" y="34" width="18" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="170" y="40" width="14" height="6" rx="2" fill={accentLight} stroke={accentMid} strokeWidth="0.5" />
      <rect x="170" y="50" width="38" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="170" y="55" width="20" height="2" rx="1" fill="#E2E8F0" />
      <rect x="52" y="72" width="162" height="42" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="0.8" />
      <rect x="58" y="78" width="28" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="58" y="86" width="148" height="2" rx="1" fill="#F1F5F9" />
      <rect x="58" y="86" width="90" height="2" rx="1" fill={accentMid} />
      <rect x="58" y="93" width="148" height="2" rx="1" fill="#F1F5F9" />
      <rect x="58" y="93" width="60" height="2" rx="1" fill={accentMid} opacity="0.6" />
      <rect x="58" y="100" width="148" height="2" rx="1" fill="#F1F5F9" />
      <rect x="58" y="100" width="120" height="2" rx="1" fill={accentMid} opacity="0.45" />
    </svg>
  );
}

export const PREVIEW_MAP: Record<string, React.FC<PreviewProps>> = {
  "Warehouse Manager": WarehousePreview,
  "Finance Controller": FinancePreview,
  "Supply Chain Coordinator": SupplyChainPreview,
  "Support Agent": SupportPreview,
  "Auditor (Read-Only)": AuditorPreview,
  "Inventory Specialist": WarehousePreview,
};

export function getPreviewFor(name: string) {
  return PREVIEW_MAP[name] ?? GenericPreview;
}
