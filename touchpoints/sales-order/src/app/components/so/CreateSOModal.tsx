import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, Package, ArrowLeftRight, Phone, Mail, Pencil,
  Calendar, Clock, Users, Plus, Check, ArrowLeft, ArrowRight,
  Building2, MapPin, Copy, CreditCard, ChevronDown, Flag, Tag,
  Loader2, Maximize2, Minimize2, UserPlus, Info,
} from "lucide-react";
import { toast } from "sonner";
import { LocationSelectionModal, type Location as CustomerLocation } from "./LocationSelectionModal";
import { CreateSOStep2, EXTENDED_CATALOG, type SOLineItem } from "./CreateSOStep2";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { DateEditModal, type SODateType, type DateConfig } from "./ui/DateEditModal";
import { DateConfigCards } from "./DateConfigCards";
import { AddressSelectionModal, type Address, type Partner } from "./AddressSelectionModal";
import { PaymentTermsLibrary, type PaymentTerm } from "./PaymentTermsLibrary";
import { PaymentMethodSelectionModal, type PaymentMethod } from "./PaymentMethodSelectionModal";

import { RecipientsSelectionModal, type PoC as RecipientPoC } from "./RecipientsSelectionModal";
import { SalesRepSelector, type SalesRepOption, type SelectedSalesRep } from "./SalesRepSelector";
import { ConfirmDiscardModal } from "@/app/components/shared/ConfirmDiscardModal";
import { TagsField } from "@/app/components/shared/EntityTagChip";
import { SectionCard, SectionClearButton } from '@/app/components/shared/SectionCard';
import { ConfigRow as SharedConfigRow } from "@/app/components/shared/ConfigRow";
import { SO_SALES_REP_ROSTER, SO_CURRENT_USER_REP } from "./salesRepRoster";
import type { CreatedCustomerPayload } from "@/app/components/external/partners/CreateCustomerModal";
import type { CreatedContactPayload } from "@/app/components/external/partners/CreateContactModal";
import { openPartnerTab } from "@/app/components/external/partners/openPartnerTab";
import StateTransitionOverlay from "@/app/components/shared/StateTransitionOverlay";
import { SAMPLE_EMPTY_CUSTOMER, getCustomerDefaults } from "@/app/components/shared/customerDefaults";
import { FIELD_RULES, FieldErrorText, FieldLaterHint, isMissing } from "@/app/components/shared/fieldRequirements";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};
const labelStyle: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" };
const labelNormal: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" };
const labelSemi: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" };
const captionStyle: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const captionSemi: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const microStyle: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };

/* ═══ Constants ═══ */
/* Match Partner CreatePartnerModal: min(70vw, 1320px) wide, 90vh tall. */
const MODAL_WIDTH = 'min(70vw, 1320px)';
const MODAL_MAX_WIDTH = 1320;
/* Modal locks at 1020px so step 1b can show its full card stack
   (Selected Customer + Billing/Shipping/Payment + the date row +
   Priority/Tags) without internal scroll on any normal-aspect screen.
   Falls back to 94vh on shorter displays. Step 1 reserves the same
   canvas with centered flex whitespace, and step 2's line item
   catalogue grows to fill — so every step renders at the same height. */
const MODAL_HEIGHT = 'min(1020px, 94vh)';
const MODAL_MAX_HEIGHT = 'min(1020px, 94vh)';

/* ═══ Mock Data ═══ */
export interface Customer {
  id: string;
  name: string;
  initials: string;
  contactCount: number;
  address: string;
  phone: string;
  fax: string;
  email: string;
  status: string[];
  pocs: POC[];
  /** Per-customer locations. Populated by the post-pass below so the
   *  ChangeCustomer flow can drive a LocationSelectionModal just like
   *  the Quote module does. Each location carries its own roster of
   *  POCs derived from the customer's `pocs` list. */
  locations?: CustomerLocation[];
}

export interface POC {
  id: string;
  name: string;
  initials: string;
  isPrimary: boolean;
  role: string;
  phone: string;
  extension: string;
  email: string;
  /** Set during the locations post-pass so each POC anchors to a
   *  specific location. The first POC of each location is flagged
   *  `isPrimary: true`. */
  locationId?: string;
}

export interface CustomerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  isDefault: boolean;
  /** Derived during the post-pass. */
  pocCount: number;
  primaryContact: string;
  primaryContactInitials: string;
  status: 'active' | 'inactive';
  type: 'Customer';
  phone: string;
  lastUpdated?: string;
}

/* MOCK_CUSTOMERS — rewritten so each row reads as a real, self-
   consistent organisation. Rules followed:
     · Every phone (customer line + every PoC) uses the area code of
       the customer's city. Same NPA across the whole record.
     · Every email under one customer uses the same parent domain
       (e.g. all @metrocityfire.gov). The customer-level email uses a
       department/role local part on that same domain.
     · Addresses use a real city in the named state. Riverside Utility
       moves from "Santa Ana, Indiana" → Indianapolis, IN; Pacific NW
       Ambulance moves from a garbled "Corporación, Colorado" → Denver.
     · Fax shares the customer NPA — keeps the directory believable. */
export const MOCK_CUSTOMERS: Customer[] = [
  {
    /* Huntsville, AL → NPA 256 · domain metrocityfire.gov */
    id: "C-001", name: "Metro City Fire & Rescue", initials: "MC", contactCount: 131,
    address: "1000 Business Park Dr, Huntsville, Alabama 35806",
    phone: "(256) 611-6611", fax: "(256) 611-6612", email: "business@metrocityfire.gov",
    status: ["Customer", "Huntsville, AL", "Active"],
    pocs: [
      { id: "P-001", name: "Jane Ellison",       initials: "JE", isPrimary: true,  role: "Finance Director | Fire Chief",            phone: "(256) 264-8918", extension: "Ext. 8391", email: "jane.ellison@metrocityfire.gov" },
      { id: "P-002", name: "Patricia Williams",  initials: "PW", isPrimary: false, role: "Operations Chief | Maintenance Supe...",   phone: "(256) 243-5486", extension: "Ext. 3004", email: "patricia.williams@metrocityfire.gov" },
      { id: "P-003", name: "Jennifer Hooper",    initials: "JH", isPrimary: false, role: "Captain | Procurement Officer",            phone: "(256) 136-8536", extension: "Ext. 7004", email: "jennifer.hooper@metrocityfire.gov" },
      { id: "P-004", name: "Leila Wilkins",      initials: "LW", isPrimary: false, role: "Fleet Manager | Shift Director",           phone: "(256) 601-4188", extension: "Ext. 1347", email: "leila.wilkins@metrocityfire.gov" },
      { id: "P-M01", name: "Sherry Miller",      initials: "SM", isPrimary: false, role: "Logistics Coordinator",                    phone: "(256) 988-5035", extension: "Ext. 146",  email: "sherry.miller@metrocityfire.gov" },
      { id: "P-M02", name: "Peyton Miller",      initials: "PM", isPrimary: false, role: "Administrative Assistant | Captain",       phone: "(256) 672-9597", extension: "Ext. 8147", email: "peyton.miller@metrocityfire.gov" },
      { id: "P-M03", name: "Michael Miller",     initials: "MM", isPrimary: false, role: "Deputy Chief | Operations Chief",          phone: "(256) 818-7655", extension: "Ext. 6388", email: "michael.miller@metrocityfire.gov" },
      { id: "P-M04", name: "Sherry Miller",      initials: "SM", isPrimary: false, role: "Fire Chief | Operations Chief",            phone: "(256) 598-9521", extension: "Ext. 1805", email: "sherry.miller2@metrocityfire.gov" },
      { id: "P-M05", name: "Michael Miller",     initials: "MM", isPrimary: false, role: "Admin | Finance Director",                 phone: "(256) 797-1529", extension: "Ext. 9632", email: "michael.miller2@metrocityfire.gov" },
      { id: "P-M06", name: "Jennifer Miller",    initials: "JM", isPrimary: false, role: "Deputy Chief | Captain",                   phone: "(256) 460-8910", extension: "Ext. 3318", email: "jennifer.miller@metrocityfire.gov" },
      { id: "P-M07", name: "John Miller",        initials: "JM", isPrimary: true,  role: "Fire Chief | Maintenance Supervisor",      phone: "(256) 975-2730", extension: "Ext. 161",  email: "john.miller@metrocityfire.gov" },
      { id: "P-M08", name: "Robert Miller",      initials: "RM", isPrimary: false, role: "Admin | Fleet Manager",                    phone: "(256) 228-1814", extension: "Ext. 9596", email: "robert.miller@metrocityfire.gov" },
    ],
  },
  {
    /* Atlanta, GA → NPA 404 · domain tricountyems.org */
    id: "C-002", name: "Tri-County EMS Authority", initials: "TE", contactCount: 77,
    address: "1000 Business Park Dr, Atlanta, Georgia 30319",
    phone: "(404) 555-0200", fax: "(404) 555-0201", email: "orders@tricountyems.org",
    status: ["Atlanta, GA", "Active"],
    pocs: [
      { id: "P-005", name: "Braelyn Miller",   initials: "BM", isPrimary: true,  role: "EMS Director | Captain",                 phone: "(404) 530-1789", extension: "Ext. 1368", email: "braelyn.miller@tricountyems.org" },
      { id: "P-006", name: "Janna Rodriguez",  initials: "JR", isPrimary: false, role: "Captain | Engineer",                     phone: "(404) 393-8736", extension: "Ext. 1362", email: "janna.rodriguez@tricountyems.org" },
      { id: "P-007", name: "Sherry Garcia",    initials: "SG", isPrimary: false, role: "Deputy Officer | Procurement Officer",   phone: "(404) 781-4952", extension: "Ext. 564",  email: "sherry.garcia@tricountyems.org" },
      { id: "P-008", name: "Janna Davis",      initials: "JD", isPrimary: false, role: "Fire Chief | Administrative Assistant",  phone: "(404) 537-4426", extension: "Ext. 2307", email: "janna.davis@tricountyems.org" },
    ],
  },
  {
    /* Georgetown, KY → NPA 502 · domain lakewoodcommunity.org */
    id: "C-003", name: "Lakewood Community Hospital", initials: "LC", contactCount: 63,
    address: "1000 Business Park Dr, Georgetown, Kentucky 40324",
    phone: "(502) 555-0300", fax: "(502) 555-0301", email: "supply@lakewoodcommunity.org",
    status: ["Georgetown, KY", "Active", "Net 45"],
    pocs: [
      { id: "P-009", name: "Mary Miller",       initials: "MM", isPrimary: false, role: "Procurement Officer | Medical Director", phone: "(502) 489-1887", extension: "Ext. 3343", email: "mary.miller@lakewoodcommunity.org" },
      { id: "P-010", name: "Elizabeth Miller",  initials: "EM", isPrimary: false, role: "EMS Director | Deputy Chief",            phone: "(502) 391-4153", extension: "Ext. 4180", email: "elizabeth.miller@lakewoodcommunity.org" },
      { id: "P-011", name: "Patricia Miller",   initials: "PM", isPrimary: true,  role: "Finance Director | Procurement",         phone: "(502) 490-6003", extension: "Ext. 1894", email: "patricia.miller@lakewoodcommunity.org" },
    ],
  },
  {
    /* Charlotte, NC → NPA 704 · domain pinecrestvfd.org */
    id: "C-004", name: "Pinecrest Volunteer Fire Dept", initials: "PV", contactCount: 49,
    address: "1000 Business Park Dr, Charlotte, North Carolina 28202",
    phone: "(704) 555-0400", fax: "(704) 555-0401", email: "chief@pinecrestvfd.org",
    status: ["Charlotte, NC", "Active"],
    pocs: [
      { id: "P-012", name: "Robert Johnson", initials: "RJ", isPrimary: true, role: "Fire Chief | Station Commander", phone: "(704) 555-0410", extension: "Ext. 100", email: "robert.johnson@pinecrestvfd.org" },
    ],
  },
  {
    /* Huntsville, AL → NPA 256 · domain summitmed.org */
    id: "C-005", name: "Summit Regional Medical Center", initials: "SR", contactCount: 85,
    address: "1000 Business Park Dr, Huntsville, Alabama 35806",
    phone: "(256) 555-0500", fax: "(256) 555-0501", email: "purchasing@summitmed.org",
    status: ["Huntsville, AL", "Active", "Priority"],
    pocs: [
      { id: "P-013", name: "Angela Torres", initials: "AT", isPrimary: true,  role: "Director of Emergency Services", phone: "(256) 555-0510", extension: "Ext. 3200", email: "angela.torres@summitmed.org" },
      { id: "P-014", name: "Daniel Kim",    initials: "DK", isPrimary: false, role: "Procurement Manager",            phone: "(256) 555-0511", extension: "Ext. 3201", email: "daniel.kim@summitmed.org" },
    ],
  },
  {
    /* San Antonio, TX → NPA 210 · domain eaglecounty.gov */
    id: "C-006", name: "Eagle County Sheriff's Office", initials: "EC", contactCount: 66,
    address: "1000 Business Park Dr, San Antonio, Texas 78205",
    phone: "(210) 555-0600", fax: "(210) 555-0601", email: "fleet@eaglecounty.gov",
    status: ["San Antonio, TX", "Active"],
    pocs: [
      { id: "P-015", name: "Marcus Webb", initials: "MW", isPrimary: true, role: "Fleet Manager | Undersheriff", phone: "(210) 555-0610", extension: "Ext. 400", email: "marcus.webb@eaglecounty.gov" },
    ],
  },
  {
    /* Denver, CO → NPA 303 · domain pacnwamb.com.
       Previous "Corporación, Colorado 81722" was AI-corrupted; reset
       to a real Colorado address. */
    id: "C-007", name: "Pacific Northwest Ambulance Co.", initials: "PN", contactCount: 68,
    address: "1000 Business Park Dr, Denver, Colorado 80202",
    phone: "(303) 555-0700", fax: "(303) 555-0701", email: "ops@pacnwamb.com",
    status: ["Denver, CO", "Active"],
    pocs: [
      { id: "P-016", name: "Lisa Chen", initials: "LC", isPrimary: true, role: "Operations Director", phone: "(303) 555-0710", extension: "Ext. 210", email: "lisa.chen@pacnwamb.com" },
    ],
  },
  {
    /* Indianapolis, IN → NPA 317 · domain riversideud.gov.
       Previous "Santa Ana, Indiana" was AI-corrupted (Santa Ana is in
       California); reset to Indianapolis to match the 317 area code. */
    id: "C-008", name: "Riverside Utility District", initials: "RU", contactCount: 102,
    address: "1000 Business Park Dr, Indianapolis, Indiana 46204",
    phone: "(317) 555-0800", fax: "(317) 555-0801", email: "admin@riversideud.gov",
    status: ["Indianapolis, IN", "Active", "Government"],
    pocs: [
      { id: "P-017", name: "Sandra Lee", initials: "SL", isPrimary: true,  role: "District Manager | Safety Officer", phone: "(317) 555-0810", extension: "Ext. 500", email: "sandra.lee@riversideud.gov" },
      { id: "P-018", name: "James Park", initials: "JP", isPrimary: false, role: "Purchasing Agent",                  phone: "(317) 555-0811", extension: "Ext. 501", email: "james.park@riversideud.gov" },
    ],
  },
  {
    /* Mobile, AL → NPA 251 · domain heartlandairambulance.com.
       Heartland already appears as a customer of seeded SOs in
       store.tsx but didn't have an entry in MOCK_CUSTOMERS, so the
       PoC picker fell back to a synthesised roster that didn't line
       up with the search overlay. Lined up here with a hand-authored
       roster (all names unique) so both surfaces resolve to the same
       people. Sarah Johnson is included explicitly per the demo
       reference. */
    id: "C-009", name: "Heartland Air Ambulance", initials: "HA", contactCount: 78,
    address: "1000 Business Park Dr, Mobile, Alabama 36602",
    phone: "(251) 555-0900", fax: "(251) 555-0901", email: "ops@heartlandairambulance.com",
    status: ["Mobile, AL", "Active"],
    pocs: [
      /* Leah Davis is Heartland's primary PoC. Mirrors the Quote
         module so the same person reads as primary across both
         demos. Sarah Johnson is kept in the list (non-primary) as
         the "add a new contact" demo target. */
      { id: "P-019", name: "Leah Davis",        initials: "LD", isPrimary: true,  role: "Fleet Manager | Operations Director", phone: "(251) 555-0910", extension: "Ext. 600", email: "leah.davis@heartlandairambulance.com" },
      { id: "P-031", name: "Sarah Johnson",     initials: "SJ", isPrimary: false, role: "Captain | Operations Chief",          phone: "(251) 555-0911", extension: "Ext. 601", email: "sarah.johnson@heartlandairambulance.com" },
      { id: "P-020", name: "William Lowe",      initials: "WL", isPrimary: false, role: "Captain | Operations Chief",          phone: "(251) 316-8267", extension: "Ext. 7284", email: "william.lowe@heartlandairambulance.com" },
      { id: "P-021", name: "Robert Williams",   initials: "RW", isPrimary: false, role: "Supply Officer | EMS Director",       phone: "(251) 410-4983", extension: "Ext. 9971", email: "robert.williams@heartlandairambulance.com" },
      { id: "P-022", name: "Jama Wilkins",      initials: "JW", isPrimary: false, role: "EMS Director | Medical Director",     phone: "(251) 532-4552", extension: "Ext. 2832", email: "jama.wilkins@heartlandairambulance.com" },
      { id: "P-023", name: "Robert Miller",     initials: "RM", isPrimary: false, role: "Captain | Battalion Chief",           phone: "(251) 212-4544", extension: "Ext. 1298", email: "robert.miller@heartlandairambulance.com" },
      { id: "P-024", name: "Jamya Williams",    initials: "JW", isPrimary: false, role: "Logistics Coordinator | Medical Director", phone: "(251) 269-2900", extension: "Ext. 6817", email: "jamya.williams@heartlandairambulance.com" },
      { id: "P-025", name: "Patricia Rodriguez",initials: "PR", isPrimary: false, role: "Maintenance Supervisor | Deputy Chief", phone: "(251) 937-5420", extension: "Ext. 7541", email: "patricia.rodriguez@heartlandairambulance.com" },
      { id: "P-026", name: "Braelyn Garcia",    initials: "BG", isPrimary: false, role: "Finance Director | Procurement Officer", phone: "(251) 272-8779", extension: "Ext. 7416", email: "braelyn.garcia@heartlandairambulance.com" },
      { id: "P-027", name: "John Williams",     initials: "JW", isPrimary: false, role: "Battalion Chief | EMS Director",      phone: "(251) 249-9385", extension: "Ext. 1219", email: "john.williams@heartlandairambulance.com" },
      { id: "P-028", name: "Michael Miller",    initials: "MM", isPrimary: false, role: "Fire Chief | Operations Director",    phone: "(251) 599-5435", extension: "Ext. 4012", email: "michael.miller@heartlandairambulance.com" },
      { id: "P-029", name: "Elizabeth Brown",   initials: "EB", isPrimary: false, role: "Station Captain",                     phone: "(251) 764-7664", extension: "Ext. 9224", email: "elizabeth.brown@heartlandairambulance.com" },
      { id: "P-030", name: "Jama House",        initials: "JH", isPrimary: false, role: "Deputy Chief | Supply Officer",       phone: "(251) 645-8937", extension: "Ext. 1829", email: "jama.house@heartlandairambulance.com" },
    ],
  },
];

/* ═══ Location post-pass ═══
   Walks each customer and synthesizes a `locations` array deterministic
   per customer-id. Every customer ends up with 3-5 locations, each
   carrying a primary POC drawn from the customer's existing pocs list
   (looping through them so locations 1..N rotate through the customer's
   POCs). The first POC of the customer remains flagged as the SO's
   default primary; the others fan out across non-default locations.
   Matches the Quote module's pattern so the ChangeCustomer flow can
   open a LocationSelectionModal with real per-customer data. */
const LOCATION_TYPES = ['Headquarters', 'Station', 'Regional Office', 'Maintenance Facility', 'Dispatch Center', 'Training Center', 'Fleet Yard'];
const LOCATION_VARIANT = ['Main', 'North', 'South', 'East', 'West'];
function customerLocationsSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function customerLocationsRand(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function customerLocationsInt(seed: number, min: number, span: number): number {
  return min + Math.floor(customerLocationsRand(seed) * span);
}
/* Three "Ovex LLC" entries with distinct addresses so the duplicate-
   customer confirmation has a real multi-match case to demonstrate.
   Same name, different cities — the picker has to surface the
   address sub-line for the user to disambiguate. Name is short and
   easy to type so it's quick to reproduce in QA. */
const OVEX_VARIANTS: Customer[] = [
  {
    id: "c_ovex_la",
    name: "Ovex LLC",
    initials: "OL",
    contactCount: 0,
    address: "450 S Spring St, Los Angeles, CA 90013",
    phone: "+1 (213) 555-0100",
    fax: "",
    email: "la@ovex.example.com",
    status: ["Active"],
    pocs: [],
  },
  {
    id: "c_ovex_dallas",
    name: "Ovex LLC",
    initials: "OL",
    contactCount: 0,
    address: "500 N Akard St, Dallas, TX 75201",
    phone: "+1 (214) 555-0100",
    fax: "",
    email: "dallas@ovex.example.com",
    status: ["Active"],
    pocs: [],
  },
  {
    id: "c_ovex_atl",
    name: "Ovex LLC",
    initials: "OL",
    contactCount: 0,
    address: "1180 W Peachtree St NW, Atlanta, GA 30309",
    phone: "+1 (404) 555-0100",
    fax: "",
    email: "atl@ovex.example.com",
    status: ["Active"],
    pocs: [],
  },
];
MOCK_CUSTOMERS.unshift(...OVEX_VARIANTS);

/* Name-only customer. Partners only requires a name, so this record
   carries nothing else (no address, contacts, terms, method or rep)
   and is used to exercise every empty state end to end. Sits first so
   it is easy to find in the picker. See customerDefaults.ts. */
MOCK_CUSTOMERS.unshift({
  id: SAMPLE_EMPTY_CUSTOMER.id,
  name: SAMPLE_EMPTY_CUSTOMER.name,
  initials: SAMPLE_EMPTY_CUSTOMER.initials,
  contactCount: 0,
  address: "",
  phone: "",
  fax: "",
  email: "",
  status: ["Customer", "Active"],
  pocs: [],
  locations: [],
});

MOCK_CUSTOMERS.forEach((customer) => {
  /* No address on file means no locations: never synthesise them. */
  if (isMissing(customer.address)) { customer.locations = []; return; }
  const seed = customerLocationsSeed(customer.id);
  const locationCount = customerLocationsInt(seed, 3, 3); // 3-5 locations
  const pocsForCustomer = customer.pocs;
  const locs: CustomerLocation[] = [];
  /* Address parsing — pull the city/state out of the customer's
     headline address so the default (Main) location keeps the same
     city the rest of the record uses. Fallback values keep typecheck
     happy when the parser misses. */
  const parts = customer.address.split(',').map((s) => s.trim());
  const baseCity = parts[1] || 'Headquarters';
  const baseState = (parts[2] || '').split(' ').slice(0, 1).join(' ') || 'United States';
  for (let i = 0; i < locationCount; i++) {
    const typeIdx = customerLocationsInt(seed + i * 13 + 41, 0, LOCATION_TYPES.length);
    const variantIdx = customerLocationsInt(seed + i * 13 + 17, 0, LOCATION_VARIANT.length);
    const type = LOCATION_TYPES[typeIdx];
    const variant = i === 0 ? 'Main' : LOCATION_VARIANT[variantIdx];
    /* Pull the primary POC for this location by rotating through the
       customer's pocs. Loc 0 always uses the customer's own primary
       (so the headline contact remains consistent with the sidebar). */
    const pocPick = i === 0
      ? (pocsForCustomer.find((p) => p.isPrimary) ?? pocsForCustomer[0])
      : pocsForCustomer[i % Math.max(1, pocsForCustomer.length)];
    const pocCount = customerLocationsInt(seed + i * 13 + 7, 3, 6); // 3-8 POCs per location
    locs.push({
      id: `${customer.id}-loc${i}`,
      name: `${type} ${variant}`,
      city: i === 0 ? baseCity : baseCity,
      state: baseState,
      address: `${1000 + i * 100} Business Park Dr, ${baseCity}, ${baseState}`,
      isDefault: i === 0,
      pocCount,
      primaryContact: pocPick?.name || '',
      primaryContactInitials: pocPick?.initials || '',
      status: 'active',
      type: 'Customer',
      phone: customer.phone,
      lastUpdated: 'Mar 18, 2026',
    });
    /* Tag the picked POC with the location id so the Quote-style
       contact picker can scope rows by location. */
    if (pocPick) pocPick.locationId = locs[i].id;
  }
  customer.locations = locs;
});

/* ═══ Avatar — pastel squircle with CSS variable palette ═══ */
const PASTEL_PALETTE = [
  { bg: "#EDF4FF", color: "#0A77FF" },
  { bg: "#F0FDF4", color: "#16A34A" },
  { bg: "#F5F3FF", color: "#7C3AED" },
  { bg: "#FFF7ED", color: "#EA580C" },
  { bg: "#ECFEFF", color: "#0891B2" },
];

function getPastelIndex(initials: string): number {
  const hash = initials.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return hash % PASTEL_PALETTE.length;
}

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  const palette = PASTEL_PALETTE[getPastelIndex(initials)];
  return (
    <div
      style={{
        width: size, height: size, minWidth: size,
        borderRadius: "50%",
        backgroundColor: palette.bg,
        color: palette.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...font,
        fontSize: size < 28 ? "var(--text-micro)" : "var(--text-caption)",
        fontWeight: "var(--font-weight-semibold)",
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

/* ── light-blue hover helper (consistent across entire modal) ── */
const hoverBlue = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.backgroundColor = ""; },
};

/* ═══ Props ═══ */
export interface SOCreationPayload {
  customer: string;
  customerInitials: string;
  customerAddress: string;
  /** Bill to / Ship to / payment picked in step 1. "" means none on
   *  file (a name-only customer); the record keeps it empty. */
  billingAddress: string;
  shippingAddress: string;
  paymentTerms: string;
  paymentMethod: string;
  /** Partner record id so the SO can hydrate the customer's
   *  defaults later (Change Customer flow). */
  customerId: string;
  pocName: string;
  pocEmail: string;
  /** Full PoC list captured on creation. Used to seed the SO
   *  sidebar's "Point of contacts" tile instead of the prior
   *  hardcoded mock list. */
  pocs: { id: string; name: string; initials: string; title: string; email: string; phone?: string; isPrimary: boolean }[];
  primaryPocId: string;
  priority: "Low" | "Standard" | "High";
  tags: string[];
  /** Reps assigned during creation. `primary` is the rep flagged as
   *  isPrimary in the picker (or the first one). Persisted onto the
   *  SO so the detail sidebar shows the assignment instead of
   *  defaulting to "Current User". */
  salesReps: { name: string; primary: boolean }[];
  lineItems: { catalogCode: string; itemCode: string; itemName: string; itemType: "Serialized" | "Non-Serialized" | "Lot Serialized" | "Lot Non-Serialized"; unitPrice: number; qty: number }[];
}

interface CreateSOModalProps {
  open: boolean;
  onClose: () => void;
  /** `createAnother` is true when the user picked "Create & Start
   *  Another": the parent should persist the SO and toast, but keep the
   *  modal open (no close, no navigation) because the modal resets
   *  itself to a fresh step 1. */
  onContinue?: (payload: SOCreationPayload, opts?: { createAnother?: boolean }) => void;
}

export function CreateSOModal({ open, onClose, onContinue }: CreateSOModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  /* Promote the customer list to local state so the "Create a new
     point of contact" CTA in the search overlay can append a fresh PoC
     to the currently-selected customer's roster (and so a "Create
     customer" CTA can later prepend a new row). MOCK_CUSTOMERS still
     seeds the initial roster. */
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  /* Slim "Create Customer" modal (external/partners) — opens from the
     empty-state CTA and from the search-overlay's customer create
     row. Vendor records and full configuration (terms, rules, freight)
     remain in Partner Management. */
  /* Partner-tab handshake — when the new Partner Management tab posts
     back a created record, we hold the payload here so the existing
     creation pipeline still runs in the originating tab. */
  const [pendingCustomerCreation, setPendingCustomerCreation] = useState<CreatedCustomerPayload | null>(null);
  const [pendingContactCreation, setPendingContactCreation] = useState<CreatedContactPayload | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPOC, setSelectedPOC] = useState<POC | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTab, setSearchTab] = useState<"All" | "Customers" | "Point of Contact">("All");
  const [showInactive, setShowInactive] = useState(false);
  const [priority, setPriority] = useState<"Low" | "Standard" | "High">("Standard");
  const [tags, setTags] = useState<string[]>(["Engine Companies", "Hydraulics"]);
  const [tagInput, setTagInput] = useState("");
  const [selectedItems, setSelectedItems] = useState<SOLineItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Location selection state ── */
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; address: string; isDefault: boolean } | null>(null);

  /* ── New modal states ── */
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientPoC[]>([]);
  const [recipientPrimaryId, setRecipientPrimaryId] = useState<string>("");
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<string | null>(null);
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<string | null>(null);
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState<string>("Net 30");
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string>("net30");
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("ACH/Direct Deposit");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("ach");

  /* Roster sourced from the shared module so the names + "you" tag
     match what the detail sidebar's picker shows. Was a parallel
     local list that drifted (CreateSOModal marked Yahya as you,
     SOSidebar marked Sarah Chen). */
  const AVAILABLE_REPS: SalesRepOption[] = SO_SALES_REP_ROSTER.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    isCurrentUser: !!r.isYou,
    isCustomerDefault: false,
  }));
  const [selectedReps, setSelectedReps] = useState<SelectedSalesRep[]>([
    {
      id: SO_CURRENT_USER_REP.id,
      name: SO_CURRENT_USER_REP.name,
      initials: SO_CURRENT_USER_REP.initials,
      isPrimary: true,
      isCurrentUser: true,
      isCustomerDefault: false,
    },
  ]);
  /* Locked to variant 1 for now so Quote and SO render the same Step 1b
     layout. Variants 2 + 3 are kept in the file as dead code so we can
     re-enable the picker later without rewriting them. */
  const [customerVerificationVariant, setCustomerVerificationVariant] = useState<1 | 2 | 3>(1);
  const [isCreating, setIsCreating] = useState(false);
  /* Which create action is in flight, so the overlay copy matches. */
  const [creatingMode, setCreatingMode] = useState<"open" | "another">("open");
  /* Partner validation pattern: Continue / Create stay enabled at all
     times. Clicking with a required selection missing flips this on,
     which paints the offending surface red with helper text. Errors
     are derived from live state, so they clear as soon as the user
     fixes the field. */
  const [showErrors, setShowErrors] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  /* Full-view toggle mirrors the AttachmentPreviewModal pattern, the
     modal expands to fill the viewport so users can see more of the
     line-item grid / recipient picker without scrolling. */
  const [isFullView, setIsFullView] = useState(false);

  /* Reset on open/close */
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedCustomer(null);
      setSelectedPOC(null);
      setShowSearch(false);
      setSearch("");
      setSearchTab("All");
      setShowInactive(false);
      setSelectedItems([]);
      setIsCreating(false);
      setShowErrors(false);
    }
  }, [open]);

  /* Focus search when overlay opens */
  useEffect(() => {
    if (showSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [showSearch]);

  /* Build the creation payload from modal state */
  const buildPayload = useCallback((): SOCreationPayload | null => {
    /* Line items are optional at creation: the SO lands as a Draft and
       lines can be added on the detail page. */
    if (!selectedCustomer || !selectedPOC) return null;
    return {
      customer: selectedCustomer.name,
      customerInitials: selectedCustomer.initials,
      customerAddress: selectedCustomer.address,
      billingAddress: selectedBillingAddress ?? selectedCustomer.address,
      shippingAddress: selectedShippingAddress ?? selectedCustomer.address,
      paymentTerms: selectedPaymentTerms,
      paymentMethod: selectedPaymentMethod,
      customerId: selectedCustomer.id,
      pocName: selectedPOC.name,
      pocEmail: selectedPOC.email,
      /* The picked contact may come from the global directory (a
         customer with nothing on file); keep it in the saved roster. */
      pocs: (selectedCustomer.pocs.some(p => p.id === selectedPOC.id)
        ? selectedCustomer.pocs
        : [selectedPOC, ...selectedCustomer.pocs]
      ).map(p => ({
        id: p.id,
        name: p.name,
        initials: p.initials,
        title: p.role,
        email: p.email,
        phone: p.phone || undefined,
        isPrimary: p.id === selectedPOC.id,
      })),
      primaryPocId: selectedPOC.id,
      priority,
      tags,
      salesReps: selectedReps.map((r) => ({ name: r.name, primary: r.isPrimary })),
      lineItems: selectedItems.map(si => {
        const cat = EXTENDED_CATALOG.find(c => c.code === si.productId);
        return {
          catalogCode: si.productId,
          itemCode: cat?.code || si.productId,
          itemName: cat?.name || si.name,
          itemType: (cat?.type || "Non-Serialized") as "Serialized" | "Non-Serialized" | "Lot Serialized" | "Lot Non-Serialized",
          unitPrice: si.unitPrice,
          qty: si.quantity,
        };
      }),
    };
  }, [selectedCustomer, selectedPOC, selectedItems, priority, tags, selectedReps, selectedBillingAddress, selectedShippingAddress, selectedPaymentTerms, selectedPaymentMethod]);

  /* Dirty state — any user selections/entries means unsaved changes */
  const isDirty = !!selectedCustomer || !!selectedPOC || selectedItems.length > 0
    || priority !== "Standard" || tags.length !== 2 || tagInput.length > 0;

  const { guardedClose: rawGuardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  const guardedClose = useCallback(() => {
    if (isCreating) return;
    rawGuardedClose();
  }, [isCreating, rawGuardedClose]);

  /* Step 1 gate. Continue is never disabled; a click with no customer
     or point of contact shows the error on the search bar instead. */
  const handleContinue = useCallback(() => {
    if (!selectedCustomer || !selectedPOC) {
      setShowErrors(true);
      requestAnimationFrame(() => {
        /* No customer: the search bar carries the error. Customer but
           no contact: the empty point of contact row does. */
        const target = selectedCustomer
          ? document.querySelector<HTMLElement>('[data-field="poc"]')
          : searchBarRef.current;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setShowErrors(false);
    setStep(2);
  }, [selectedCustomer, selectedPOC]);

  /* Wipes every user entry so "Create & Make Another" lands on a
     clean step 1, same as opening the modal fresh. Only calls state
     setters, so a stale closure in handleCreateClick is harmless. */
  const resetForm = () => {
    performClearSelection();
    setStep(1);
    setShowSearch(false);
    setSearch("");
    setSearchTab("All");
    setShowInactive(false);
    setSelectedItems([]);
    setPriority("Standard");
    setTags(["Engine Companies", "Hydraulics"]);
    setTagInput("");
    setShowErrors(false);
    setIsCreating(false);
  };

  const handleCreateClick = useCallback((mode: "open" | "another" = "open") => {
    if (isCreating) return;
    if (!selectedCustomer || !selectedPOC) {
      setShowErrors(true);
      setStep(1);
      return;
    }
    const p = buildPayload();
    if (!p) return;
    setCreatingMode(mode);
    setIsCreating(true);
    setTimeout(() => {
      onContinue?.(p, { createAnother: mode === "another" });
      if (mode === "another") resetForm();
    }, 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating, selectedCustomer, selectedPOC, buildPayload, onContinue]);

  /* Keyboard shortcuts. Capture phase, so they run before a nested dialog
     (payment terms picker, term details) closes itself: while one is
     open the keyboard belongs to it, so Escape must not also prompt to
     discard the order. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        if (showSearch) { setShowSearch(false); setSearch(""); }
        else guardedClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (step === 1) handleContinue();
        else if (step === 2) handleCreateClick();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, showSearch, selectedCustomer, selectedPOC, selectedItems, step, guardedClose, handleContinue, handleCreateClick]);

  /* Filter customers by search. Customers with no contacts stay in
     the list: Partners only requires a name, so a name-only customer
     is a real record. Picking one lands on the selected state with an
     empty point of contact row the user must fill before continuing. */
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q) ||
      c.pocs.some(p => p.name.toLowerCase().includes(q))
    );
  }, [search, customers]);

  /* Filter POCs by search. Customers without contacts have nothing
     to list here, so they are skipped. */
  const filteredPOCGroups = useMemo(() => {
    const nonEmpty = customers.filter(c => (c.contactCount ?? c.pocs.length) > 0);
    if (!search.trim()) return nonEmpty.slice(0, 3);
    const q = search.toLowerCase();
    return nonEmpty.filter(c =>
      c.pocs.some(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    ).map(c => ({
      ...c,
      pocs: c.pocs.filter(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
    }));
  }, [search, customers]);

  /* Wire the search overlay's "Create a new ..." CTA. For the PoC
     case we mint a new entry from the search query (or a placeholder
     name if empty), attach it to the currently-selected customer's
     roster, and immediately pick it as the recipient — matching the
     "PoCs created here should be added to the customer's PoC list"
     expectation. The Customer case is left as a hook-point: parent
     listings will pick up future work; the demo doesn't have a fresh
     customer form yet, so the click just keeps the overlay open. */
  const handleCreateNewFromOverlay = useCallback((
    tab: "All" | "Customers" | "Point of Contact",
    query: string,
  ) => {
    if (tab === "Point of Contact") {
      /* Open the Partner Management new tab seeded with the typed
         search and the active customer (when one is picked) so the
         Customer dropdown lands pre-pinned. On payload return, the
         existing POC-attach + recipient-seed pipeline runs locally. */
      setShowSearch(false);
      setSearch("");
      const seedCustomer = selectedCustomer ?? customers[0];
      openPartnerTab<CreatedContactPayload>('create-poc', {
        seedName: query.trim(),
        customerId: seedCustomer?.id,
        customerName: seedCustomer?.name,
        origin: 'so',
      }).then(result => {
        if (result) setPendingContactCreation(result.payload);
      });
      return;
    }
    // tab === "Customers" or "All" — open Partner Management new tab
    // seeded with the typed search.
    setShowSearch(false);
    openPartnerTab<CreatedCustomerPayload>('create-customer', { seedName: query.trim(), origin: 'so' })
      .then(result => { if (result) setPendingCustomerCreation(result.payload); });
  }, [selectedCustomer, customers]);

  /* Project a `POC` (customer-record shape) into a `RecipientPoC` so the
     Recipients modal's `selectedRecipients` array gets the same row
     down-stream consumers expect. Keeps customer + POC identity intact
     so the picker can later pin / preserve the row. */
  const pocToRecipient = useCallback((customer: Customer, poc: POC): RecipientPoC => ({
    id: poc.id,
    name: poc.name,
    email: poc.email,
    phone: poc.phone,
    extension: poc.extension,
    role: poc.role,
    department: '',
    initials: poc.initials,
    avatarColor: '#0F62D6',
    customerId: customer.id,
    customerName: customer.name,
  }), []);

  /* Profile values a customer brings with it. Bill to / Ship to start
     on the customer's address; payment terms and method start on the
     usual defaults. A name-only customer (see customerDefaults) has
     none of these on file, so each starts empty and shows its empty
     state instead of a made-up value. */
  const seedCustomerProfile = useCallback((customer: Customer) => {
    const profile = getCustomerDefaults(customer.name);
    setSelectedLocation(null);
    setSelectedBillingAddress(customer.address || "");
    setSelectedShippingAddress(customer.address || "");
    setSelectedPaymentTerms(profile.paymentTerms ? "Net 30" : "");
    setSelectedPaymentTermId(profile.paymentTerms ? "net30" : "");
    setSelectedPaymentMethod(profile.paymentMethod ? "ACH/Direct Deposit" : "");
    setSelectedPaymentMethodId(profile.paymentMethod ? "ach" : "");
  }, []);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    seedCustomerProfile(customer);
    const primary = customer.pocs.find(p => p.isPrimary) || customer.pocs[0];
    setSelectedPOC(primary || null);
    /* Picking a customer card seeds the SO with the customer's
       primary POC as the sole recipient. The other POCs on file
       stay available behind "Manage Recipients" so the user can add
       more later. */
    if (primary) {
      setSelectedRecipients([pocToRecipient(customer, primary)]);
      setRecipientPrimaryId(primary.id);
    } else {
      setSelectedRecipients([]);
      setRecipientPrimaryId("");
    }
    setShowSearch(false);
    setSearch("");
    // Stay on step 1 so the user sees the Selected-state (a.k.a. step 1b) where
    // they can verify customer/PoC, set addresses, payment terms, sales reps,
    // priority, tags. The 3 variant layouts are toggled by the top-right
    // "Step 1b UX" select. Continue button advances to step 2.
  }, [pocToRecipient, seedCustomerProfile]);

  const handleSelectPOC = useCallback((customer: Customer, poc: POC) => {
    if (selectedCustomer?.id !== customer.id) seedCustomerProfile(customer);
    setSelectedCustomer(customer);
    setSelectedPOC(poc);
    /* Picking a specific POC via search makes that POC the sole
       recipient of the SO — NOT the customer's flagged primary. The
       rest of the customer's POCs remain visible behind "Manage
       Recipients" so the user can add more from the same customer +
       location without losing their explicit pick. */
    setSelectedRecipients([pocToRecipient(customer, poc)]);
    setRecipientPrimaryId(poc.id);
    setShowSearch(false);
    setSearch("");
    // Stay on step 1 — see comment on handleSelectCustomer.
  }, [pocToRecipient, seedCustomerProfile, selectedCustomer]);

  /* Synthesise a Customer record from the slim CreateCustomerModal
     payload and push it into local `customers` state so the rest of
     Step 1's logic can pick it. The default address seeds the single
     starter location (becomes the active ship-to + bill-to until the
     user adds more from Partner Management). */
  const handleCustomerCreated = useCallback((payload: CreatedCustomerPayload) => {
    const newId = `C-NEW-${Date.now()}`;
    const initials = ((payload.name.trim()[0] || 'A') + (payload.name.split(/\s+/)[1]?.[0] || '')).toUpperCase();
    const defaultLoc: CustomerLocation = {
      id: `${newId}-LOC-0`,
      name: 'Headquarters Main',
      city: payload.defaultAddress.city,
      state: payload.defaultAddress.state,
      address: payload.defaultAddress.full,
      isDefault: true,
      pocCount: 0,
      primaryContact: '',
      primaryContactInitials: '—',
      status: 'active',
      type: 'Customer',
      phone: payload.phone || '',
    };
    const newCustomer: Customer = {
      id: newId,
      name: payload.name,
      initials: initials || payload.logoLetter,
      contactCount: 0,
      address: payload.defaultAddress.full,
      phone: payload.phone || '',
      fax: '',
      email: payload.website ? `info@${payload.website.replace(/^https?:\/\//, '')}` : '',
      status: ['New'],
      pocs: [],
      locations: [defaultLoc],
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    setSelectedCustomer(newCustomer);
    seedCustomerProfile(newCustomer);
    setSelectedPOC(null);
    setSelectedRecipients([]);
    setShowSearch(false);
    setSearch('');
  }, [seedCustomerProfile]);

  /* Clear-all guard. The Clear All button now opens this confirmation
     modal first; only on confirm does `performClearSelection` run. The
     direct setter chain below is renamed to `performClearSelection` so
     other internal call sites (which want to clear without a prompt,
     for example after a successful creation) keep working. */
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const requestClearSelection = useCallback(() => setShowClearAllConfirm(true), []);
  const performClearSelection = () => {
    setSelectedCustomer(null);
    setSelectedPOC(null);
    setSelectedLocation(null);
    setSelectedRecipients([]);
    setRecipientPrimaryId("");
    setSelectedBillingAddress(null);
    setSelectedShippingAddress(null);
    setSelectedPaymentTerms("Net 30");
    setSelectedPaymentTermId("net30");
    setSelectedPaymentMethod("ACH/Direct Deposit");
    setSelectedPaymentMethodId("ach");
    setSelectedReps([{
      id: SO_CURRENT_USER_REP.id,
      name: SO_CURRENT_USER_REP.name,
      initials: SO_CURRENT_USER_REP.initials,
      isPrimary: true,
      isCurrentUser: true,
      isCustomerDefault: false,
    }]);
  };

  const addTag = () => {
    const t = tagInput.trim().slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 8) setTags([...tags, t]);
    setTagInput("");
  };

  if (!open) return null;

  /* A customer is enough to show the selected state. The point of
     contact is validated there (empty row turns red on Continue). */
  const hasSelection = !!selectedCustomer;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal)" as any, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(1px)" }}
        onClick={guardedClose}
      />
      {discardDialog}

      {/* Modal — sizing flips between the default Partner footprint and
         a full-viewport view when the user toggles the Full view button.
         The default surface locks at min(840px, 90vh) so every step
         renders at the same height, with short steps (customer pick)
         padding their empty state via centered flex. Big portrait
         displays no longer stretch the modal to 90% of the viewport. */}
      <div style={{
        position: "relative",
        width: isFullView ? "100vw" : MODAL_WIDTH,
        maxWidth: isFullView ? "100vw" : MODAL_MAX_WIDTH,
        height: isFullView ? "100vh" : MODAL_HEIGHT,
        maxHeight: isFullView ? "100vh" : MODAL_MAX_HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        borderRadius: isFullView ? 0 : 16,
        boxShadow: isFullView ? "none" : "0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        transition: "width 200ms ease, height 200ms ease",
      }}>
        <style>{`
          @keyframes so-create-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes so-create-fade-in { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        {isCreating && (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(4px)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              borderRadius: 16,
              animation: "so-create-fade-in 160ms ease-out",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#EFF6FF",
                border: "1px solid #DBEAFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Loader2 style={{ width: 26, height: 26, color: "#0A77FF", animation: "so-create-spin 900ms linear infinite" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Creating sales order…</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {creatingMode === "another" ? "Saving, then starting a new one." : "Taking you to the new order."}
            </div>
          </div>
        )}

        {/* ── Header — Partner CreatePartnerModal pattern ── */}
        <div className="shrink-0 bg-white" style={{ padding: "16px 20px 0", borderBottom: "1px solid #EEF2F6", borderRadius: "16px 16px 0 0" }}>
          {/* Title row */}
          <div className="flex items-start justify-between" style={{ gap: 12 }}>
            <div className="min-w-0">
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3, margin: 0 }}>Create New Sales Order</h2>
              <p style={{ fontSize: 12, fontWeight: 400, color: "#64748B", marginTop: 4 }}>
                Configure the details and line items for the new sales order.
              </p>
            </div>
            <div className="flex items-center shrink-0" style={{ gap: 6 }}>
              <button
                onClick={() => setIsFullView((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-[hsl(210,100%,96%)] hover:border-[hsl(0,0%,70%)] transition-all cursor-pointer active:scale-[0.97]"
                style={{ fontWeight: 500 }}
                aria-label={isFullView ? "Exit full view" : "Full view"}
              >
                {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullView ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={guardedClose}
                className="flex items-center justify-center transition-all hover:bg-muted"
                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8" }}
                aria-label="Close"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          {/* Step tabs flush with the header bottom border (Partner pattern) */}
          <div className="flex items-center overflow-x-auto" style={{ gap: 24, marginTop: 14, marginBottom: -1 }}>
            <StepTab stepNum={1} label="Select Recipient" active={step === 1} done={step === 2} onClick={step === 2 ? () => setStep(1) : undefined} />
            <StepTab stepNum={2} label="Add Line Items" active={step === 2} />
          </div>
        </div>

        {/* ── Body ── */}
        {step === 1 ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 48px 16px 48px", background: hasSelection ? "#FAFBFC" : "white", display: "flex", flexDirection: "column" }}>
            {/* Toggle moved to fixed viewport position */}

            {!hasSelection && (
              <>
                <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 2 }}>Select Customer and Recipient</div>
                <div style={{ ...captionNormal, color: "#6B7280", marginBottom: 14 }}>
                  Choose a contact or create a new one to create this sales order.{" "}
                  <span style={{ color: "var(--primary)", cursor: "pointer" }}>Learn more ↗</span>
                </div>
              </>
            )}

            {/* Search Bar. Turns red (Partner field-error chrome) when the
                user hits Continue without a customer and point of contact. */}
            {!hasSelection && (() => {
              const searchError = showErrors;
              const restBorder = searchError ? "#F87171" : "#E5E7EB";
              const restShadow = searchError ? "0 0 0 3px rgba(239,68,68,0.12)" : "0 1px 2px rgba(0,0,0,0.05)";
              return (
              <div ref={searchBarRef}>
              <div
                onClick={() => setShowSearch(true)}
                className="transition-all"
                role="button"
                aria-invalid={searchError}
                aria-describedby={searchError ? "create-so-recipient-error" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "0 16px", borderRadius: 8,
                  border: `1px solid ${restBorder}`,
                  background: "white",
                  cursor: "text",
                  boxShadow: restShadow,
                  height: 44,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = searchError ? "#EF4444" : "#1B6EF3"; e.currentTarget.style.boxShadow = searchError ? "0 0 0 4px rgba(239,68,68,0.18)" : "0 4px 10px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = restBorder; e.currentTarget.style.boxShadow = restShadow; }}
              >
                <Search style={{ width: 18, height: 18, color: "#9CA3AF", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 400, color: "#9CA3AF", flex: 1 }}>
                  Search for the customer or contact to create a sales order for...
                </span>
                <kbd style={{
                  fontSize: 11, fontWeight: 500, padding: "4px 10px",
                  borderRadius: 4, border: "1px solid #E5E7EB", background: "#F3F4F6",
                  color: "#6B7280",
                }}>⌘K</kbd>
              </div>
              {searchError && (
                <p id="create-so-recipient-error" role="alert" className="text-red-500 text-xs mt-1">
                  Select a customer and point of contact to continue.
                </p>
              )}
              </div>
              );
            })()}

            {/* Empty State. The "Add New Customer" affordance keeps the
                flow unblocked when the account isn't already on file.
                Wired to a coming-soon toast for now while the
                create-customer modal is being built out.

                The flex-1 wrapper soaks up the remaining vertical space
                below the search bar so the icon, copy, and button read
                as a vertically centered column rather than a stack
                hugging the top of the modal body. */}
            {!hasSelection && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Search style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.2 }} />
                  </div>
                  <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 3 }}>No Customer Selected</div>
                  <div style={{ ...captionNormal, color: "#6B7280", marginBottom: 16 }}>Select the customer you intend to create a sales order for.</div>
                  {/* Primary-blue button so the empty-state CTA is easy
                      to spot against the white modal surface. The earlier
                      outlined variant was washing out on the empty state. */}
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await openPartnerTab<CreatedCustomerPayload>('create-customer', { origin: 'so' });
                      if (result) setPendingCustomerCreation(result.payload);
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 36, padding: "0 14px", borderRadius: 8,
                      border: "none", background: "var(--primary)",
                      color: "#FFFFFF", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      transition: "background-color 150ms",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0862D0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--primary)"; }}
                  >
                    <UserPlus style={{ width: 14, height: 14, color: "#FFFFFF" }} />
                    Create New Customer
                  </button>
                </div>
              </div>
            )}

            {/* Selected State */}
            {hasSelection && selectedCustomer && (
              <SelectedState
                customer={selectedCustomer}
                poc={selectedPOC}
                customerAddress={selectedLocation?.address || selectedCustomer.address}
                onClear={requestClearSelection}
                onChangeLocation={() => setShowLocationModal(true)}
                priority={priority}
                onPriorityChange={setPriority}
                tags={tags}
                onTagsChange={setTags}
                onOpenRecipients={() => setShowRecipientsModal(true)}
                onOpenAddress={(type) => setAddressModalType(type)}
                onOpenPaymentTerms={() => setShowPaymentTerms(true)}
                onOpenPaymentMethod={() => setShowPaymentMethod(true)}
                paymentTerms={selectedPaymentTerms}
                paymentMethod={selectedPaymentMethod}
                billingAddress={selectedBillingAddress}
                shippingAddress={selectedShippingAddress}
                pocError={showErrors && !selectedPOC}
                selectedReps={selectedReps}
                availableReps={AVAILABLE_REPS}
                onRepsChange={setSelectedReps}
                variant={customerVerificationVariant}
                selectedRecipients={selectedRecipients}
                isFullView={isFullView}
              />
            )}
          </div>
        ) : (
          /* Step 2 mirrors Quote module: no parent max-width cap — the
             catalog/items split spans the full modal width so full-view
             mode actually fills the screen instead of leaving slate
             gutters on either side. */
          <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}>
            <CreateSOStep2
              lineItems={selectedItems}
              onLineItemsChange={setSelectedItems}
              hasCustomer={!!selectedCustomer}
            />
          </div>
        )}

        {/* ── Footer ── */}
        {step === 1 ? (
          <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #EEF2F6", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0, borderRadius: "0 0 16px 16px" }}>
            <button
              onClick={handleContinue}
              className="px-4 h-9 text-[13px] transition-colors flex items-center gap-2 bg-[#0A77FF] text-white hover:bg-[#0862D0] shadow-sm"
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Continue
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ) : (
          <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #EEF2F6", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderRadius: "0 0 16px 16px" }}>
            <button
              onClick={() => setStep(1)}
              className="text-[13px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{ fontWeight: 500 }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Create SO already saves the order as a Draft, so the old
                  Save Draft slot now hosts the batch-entry action. */}
              <button
                onClick={() => handleCreateClick("another")}
                disabled={isCreating}
                className="px-4 h-9 border border-[#E2E8F0] text-[13px] text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all flex items-center gap-2"
                style={{ borderRadius: 8, fontWeight: 500 }}
                type="button"
              >
                Create & Make Another
              </button>
              <button
                onClick={() => handleCreateClick("open")}
                disabled={isCreating}
                className="px-4 h-9 text-[13px] transition-all flex items-center gap-2 shadow-sm bg-[#0A77FF] text-white hover:bg-[#0862D0]"
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Create SO
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Search Overlay ═══ */}
      {showSearch && (
        <SearchOverlay
          search={search}
          onSearchChange={setSearch}
          searchTab={searchTab}
          onSearchTabChange={setSearchTab}
          filteredCustomers={filteredCustomers}
          filteredPOCGroups={filteredPOCGroups}
          onSelectCustomer={handleSelectCustomer}
          onSelectPOC={handleSelectPOC}
          onClose={() => { setShowSearch(false); setSearch(""); }}
          inputRef={searchInputRef}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          onCreateNew={handleCreateNewFromOverlay}
        />
      )}

      {/* ═══ Modal portals ═══ */}
      {showRecipientsModal && selectedCustomer && (
        <RecipientsSelectionModal
          isOpen={showRecipientsModal}
          onClose={() => setShowRecipientsModal(false)}
          currentCustomerId={selectedCustomer.id}
          currentCustomerName={selectedCustomer.name}
          /* Scope to the location the user picked in the creation
             flow's location step so the "This location only" pill
             defaults to filtering the picker to that office, matching
             the search overlay's surfaced list. */
          currentLocationId={selectedLocation?.id ?? selectedCustomer.locations?.find((l) => l.isDefault)?.id ?? selectedCustomer.locations?.[0]?.id}
          /* Forward the real POCs on file so the customer's flagged
             primary (e.g. Robert Johnson on Pinecrest VFD) shows up
             in the picker and is pre-selected on first open. */
          customerPocs={selectedCustomer.pocs}
          selectedRecipients={selectedRecipients}
          primaryPoCId={recipientPrimaryId}
          onSelect={(recipients, primaryId) => {
            setSelectedRecipients(recipients);
            setRecipientPrimaryId(primaryId);
            /* The primary recipient IS the point of contact. Sync it so
               a customer that started with no contact on file is
               unblocked once the user picks one here. */
            const primary = recipients.find((r) => r.id === primaryId) ?? recipients[0];
            if (primary) {
              const onFile = selectedCustomer.pocs.find((p) => p.id === primary.id);
              setSelectedPOC(onFile ?? {
                id: primary.id,
                name: primary.name,
                initials: primary.initials,
                isPrimary: true,
                role: primary.role || "",
                phone: primary.phone || "",
                extension: primary.extension || "",
                email: primary.email || "",
              });
            }
            setShowRecipientsModal(false);
          }}
        />
      )}

      <AddressSelectionModal
        isOpen={addressModalType !== null}
        onClose={() => setAddressModalType(null)}
        type={addressModalType || 'billing'}
        customerName={selectedCustomer?.name || ''}
        currentCustomer={{ id: selectedCustomer?.id || '', name: selectedCustomer?.name || '', type: 'Customer', location: '' }}
        currentAddress={null}
        onSelect={(address, _partner) => {
          const addrStr = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
          if (addressModalType === 'billing') setSelectedBillingAddress(addrStr);
          else setSelectedShippingAddress(addrStr);
          setAddressModalType(null);
        }}
      />

      <PaymentTermsLibrary
        isOpen={showPaymentTerms}
        onClose={() => setShowPaymentTerms(false)}
        onSelect={(term) => {
          setSelectedPaymentTerms(term.name);
          setSelectedPaymentTermId(term.id);
          setShowPaymentTerms(false);
        }}
        currentTermId={selectedPaymentTermId}
        customerName={selectedCustomer?.name || ''}
      />

      <PaymentMethodSelectionModal
        isOpen={showPaymentMethod}
        onClose={() => setShowPaymentMethod(false)}
        onSelect={(method) => {
          setSelectedPaymentMethod(method.name);
          setSelectedPaymentMethodId(method.id);
          setShowPaymentMethod(false);
        }}
        currentMethodId={selectedPaymentMethodId}
        customerName={selectedCustomer?.name || ''}
      />


      {/* Variant toggle hidden for now. Both modules ship variant 1 only
         so the Step 1b layout stays consistent across Quote + SO. The
         picker can be reinstated by re-rendering this block. */}

      {showLocationModal && selectedCustomer && (
        <LocationSelectionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onSelect={(location) => {
            setSelectedLocation({
              id: location.id,
              name: location.name,
              address: location.address,
              isDefault: location.isDefault,
            });
            setShowLocationModal(false);
          }}
          currentLocationId={selectedLocation?.id || 'loc1'}
          customerName={selectedCustomer.name}
        />
      )}

      {/* Clear All confirmation — mirrors the Partner red-themed
          discard chrome used across the suite. Copy avoids any
          em-dashes (period split instead) per the suite-wide rule. */}
      <ConfirmDiscardModal
        open={showClearAllConfirm}
        onOpenChange={(o) => { if (!o) setShowClearAllConfirm(false); }}
        title="Clear customer and contact selection?"
        description="The selected customer, point of contact, billing and shipping addresses, payment terms, and sales rep choices will be cleared. You can pick a customer again to start over."
        confirmLabel="Clear selection"
        cancelLabel="Keep selection"
        onConfirm={() => {
          setShowClearAllConfirm(false);
          performClearSelection();
        }}
      />

      {/* Continuation overlays for partner-tab payloads. The Partner
          Management tab plays its own "Adding…" arc and closes;
          these cover the brief gap before the new record lands in
          the SO creation pipeline. */}
      <StateTransitionOverlay
        isActive={pendingCustomerCreation !== null}
        heading="Adding customer"
        fromLabel="Partner Management"
        toLabel={pendingCustomerCreation?.name || 'Customer'}
        tone="success"
        meta="Bringing the customer into this order"
        duration={1200}
        onComplete={() => {
          if (pendingCustomerCreation) {
            const ex = pendingCustomerCreation as unknown as { useExisting?: boolean; existingId?: string };
            if (ex.useExisting && ex.existingId) {
              const existing = customers.find((c) => c.id === ex.existingId);
              if (existing) {
                handleSelectCustomer(existing);
                toast.success(`Using existing customer "${existing.name}"`, { position: "top-right" });
              }
            } else {
              handleCustomerCreated(pendingCustomerCreation);
              toast.success(`Customer "${pendingCustomerCreation.name}" added`, { position: "top-right" });
            }
          }
          setPendingCustomerCreation(null);
        }}
      />
      <StateTransitionOverlay
        isActive={pendingContactCreation !== null}
        heading="Adding contact"
        fromLabel="Partner Management"
        toLabel={pendingContactCreation?.name || 'Contact'}
        tone="success"
        meta="Bringing the contact into this order"
        duration={1200}
        onComplete={() => {
          if (pendingContactCreation) {
            const payload = pendingContactCreation;
            const target = (payload.companyId
              ? customers.find((c) => c.id === payload.companyId)
              : selectedCustomer) ?? customers[0];
            if (target) {
              const newPoc: POC = {
                id: payload.id,
                name: payload.name,
                initials: payload.initials,
                isPrimary: false,
                role: payload.role || 'Contact',
                phone: payload.phone || target.phone,
                extension: payload.phoneExt,
                email: payload.email || `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@${(target.email || '').split('@')[1] || 'company.com'}`,
              };
              setCustomers(prev => prev.map(c => c.id === target.id
                ? { ...c, pocs: [...c.pocs, newPoc], contactCount: c.contactCount + 1 }
                : c,
              ));
              const updatedCustomer = { ...target, pocs: [...target.pocs, newPoc], contactCount: target.contactCount + 1 };
              setSelectedCustomer(updatedCustomer);
              setSelectedPOC(newPoc);
              setSelectedRecipients([{
                id: newPoc.id,
                name: newPoc.name,
                email: newPoc.email,
                phone: newPoc.phone,
                extension: newPoc.extension,
                role: newPoc.role,
                department: '',
                initials: newPoc.initials,
                avatarColor: '#0F62D6',
                customerId: updatedCustomer.id,
                customerName: updatedCustomer.name,
              }]);
              setRecipientPrimaryId(newPoc.id);
              toast.success(`Contact "${newPoc.name}" added`, { position: "top-right" });
            }
          }
          setPendingContactCreation(null);
        }}
      />
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════
   Step Tab
   ═══════════════════════════════════════════════════════ */
function StepTab({ stepNum, label, active, done, onClick }: { stepNum: number; label: string; active: boolean; done?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`relative flex items-center gap-2 pb-3 ${done ? "cursor-pointer" : active ? "cursor-default" : "cursor-default"}`}
      onClick={onClick}
      style={{ opacity: active || done ? 1 : 0.4 }}
    >
      <div
        className="shrink-0 flex items-center justify-center transition-all duration-200"
        style={{
          width: 22, height: 22, borderRadius: "50%",
          fontSize: 12, fontWeight: 600,
          ...(done
            ? { background: "#10B981", color: "white" }
            : active
            ? { background: "#0A77FF", color: "white" }
            : { border: "1.5px solid #CBD5E1", color: "#64748B", background: "white" }),
        }}
      >
        {done ? <Check style={{ width: 12, height: 12, strokeWidth: 3 }} /> : stepNum}
      </div>
      <span
        className="whitespace-nowrap transition-colors"
        style={{
          fontSize: 13,
          fontWeight: active || done ? 600 : 500,
          color: active ? "#0A77FF" : done ? "#10B981" : "#334155",
        }}
      >
        {label}
      </span>
      {(active || done) && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-full"
          style={{ height: 2, background: done ? "#10B981" : "#0A77FF" }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════���══════════
   Search Overlay — matches modal width
   ═══════════════════════════════════════════════════════ */
interface SearchOverlayProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchTab: "All" | "Customers" | "Point of Contact";
  onSearchTabChange: (v: "All" | "Customers" | "Point of Contact") => void;
  filteredCustomers: Customer[];
  filteredPOCGroups: (Customer & { pocs: POC[] })[];
  onSelectCustomer: (c: Customer) => void;
  onSelectPOC: (c: Customer, p: POC) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  showInactive: boolean;
  onShowInactiveChange: (v: boolean) => void;
  /** Called from the fixed bottom "Create new" strip. The parent decides
      whether to create a new customer or attach a fresh PoC to the
      currently-selected customer based on the active tab + query. */
  onCreateNew?: (tab: "All" | "Customers" | "Point of Contact", query: string) => void;
}

function SearchOverlay({
  search, onSearchChange, searchTab, onSearchTabChange,
  filteredCustomers, filteredPOCGroups,
  onSelectCustomer, onSelectPOC, onClose, inputRef,
  showInactive, onShowInactiveChange, onCreateNew,
}: SearchOverlayProps) {
  const TABS: ("All" | "Customers" | "Point of Contact")[] = ["All", "Customers", "Point of Contact"];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-in fade-in duration-200"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)', zIndex: 10001 }}
        onClick={onClose}
      />

      {/* Search Overlay Container — Quotes-style split layout */}
      <div className="fixed inset-0 flex flex-col items-center pt-12 pb-12 px-4 pointer-events-none" style={{ zIndex: 10001 }}>
        <div className="w-full flex flex-col gap-3 pointer-events-auto animate-in fade-in zoom-in-95 duration-200" style={{ maxWidth: '1200px', maxHeight: 'calc(100vh - 96px)' }}>
          {/* Search Bar Section */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-lg shadow-2xl px-3 py-2" onClick={(e) => e.stopPropagation()}>
              <div className="relative flex items-center">
                <Search className="absolute left-0 w-4 h-4 text-[#9CA3AF]" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for a customer or a point of contact..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
                  className="w-full pl-8 pr-20 py-1 text-[13px] text-[#1F2937] bg-transparent focus:outline-none placeholder:text-[#9CA3AF]"
                />
                <div className="absolute right-0 px-2 py-0.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded text-[11px] text-[#6B7280]" style={{ fontWeight: 500 }}>
                  esc
                </div>
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center bg-white hover:bg-[#F9FAFB] rounded-lg shadow-2xl transition-colors"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          {/* Results Section (Separate Box) */}
          <div className="bg-white rounded-xl shadow-2xl flex flex-col flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ minHeight: '500px' }}>
            {/* Tabs */}
            <div className="px-4 pt-3 flex gap-4 border-b border-[#E5E7EB]">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => onSearchTabChange(tab)}
                  className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                    searchTab === tab
                      ? 'border-[#1B6EF3] text-[#1B6EF3]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                  style={{ fontWeight: searchTab === tab ? 600 : 400 }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Results Area — Quote-parity layout:
                  - Section headers swap from "Recently Searched X" to
                    "Showing N X containing 'query'" when search has text.
                  - The "Create a new..." CTA lives in a FIXED bottom strip
                    outside this scroller, so it never hides behind results
                    or jumps as the query changes. */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {(() => {
                  /* Count helpers — totals for the header strap. */
                  const customerCount = filteredCustomers.length;
                  const pocCount = filteredPOCGroups.reduce((sum, g) => sum + g.pocs.length, 0);
                  const trimmed = search.trim();
                  return (
                    <>
                      {/* Header strap with showing-X count + Show Inactive toggle */}
                      <div className="flex items-center justify-between mb-3 px-3">
                        <h3 className="text-[11px] text-[#9CA3AF]" style={{ fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          {trimmed
                            ? (searchTab === "Customers"
                                ? `Showing ${customerCount} customer${customerCount !== 1 ? 's' : ''} containing '${trimmed}'`
                                : searchTab === "Point of Contact"
                                  ? `Showing ${pocCount} point of contact${pocCount !== 1 ? 's' : ''} containing '${trimmed}'`
                                  : `Showing ${customerCount + pocCount} result${(customerCount + pocCount) !== 1 ? 's' : ''} containing '${trimmed}'`)
                            : (searchTab === "Point of Contact"
                                ? "Recent Point of Contacts"
                                : "Recently Searched Customers")}
                        </h3>
                        {(searchTab === "All" || searchTab === "Point of Contact") && (
                          <button
                            onClick={() => onShowInactiveChange(!showInactive)}
                            className="flex items-center gap-2 text-[13px] text-[#6B7280]"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                          >
                            Show Inactive
                            <div style={{
                              width: 30, height: 16, borderRadius: 999, padding: 2,
                              background: showInactive ? "var(--primary)" : "#E5E7EB",
                              transition: "background 200ms", display: "flex", alignItems: "center",
                            }}>
                              <div style={{
                                width: 12, height: 12, borderRadius: "50%", background: "white",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                transition: "transform 200ms",
                                transform: showInactive ? "translateX(14px)" : "translateX(0)",
                              }} />
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Customers section */}
                      {(searchTab === "All" || searchTab === "Customers") && (
                        <div className="space-y-1">
                          {filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => onSelectCustomer(c)}
                              className="w-full px-3 py-2 rounded-lg transition-colors text-left flex items-start gap-3 hover:bg-[#F9FAFB]"
                            >
                              <Avatar initials={c.initials} size={36} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <HighlightName name={c.name} search={search} style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }} />
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                                    <Users style={{ width: 11, height: 11 }} /> {c.contactCount}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[#6B7280]">{c.address || FIELD_RULES.customerAddress.emptyLabel}</p>
                              </div>
                            </button>
                          ))}
                          {trimmed && customerCount === 0 && (
                            <p className="text-[12px] text-[#9CA3AF] px-3 py-2">No customers match '{trimmed}'.</p>
                          )}
                        </div>
                      )}

                      {/* POC section */}
                      {(searchTab === "All" || searchTab === "Point of Contact") && (
                        <div className={searchTab === "All" ? "mt-5" : ""}>
                          {filteredPOCGroups.map(group => {
                            const visiblePocs = expandedGroups[group.id] ? group.pocs : group.pocs.slice(0, 4);
                            const hasMore = group.pocs.length > 4;
                            const remaining = group.pocs.length - 4;

                            return (
                              <div key={group.id} className="mb-4">
                                {/* Customer header */}
                                <div className="flex items-center gap-2.5 px-3 py-1.5 mb-1">
                                  <Avatar initials={group.initials} size={30} />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>{group.name}</span>
                                      <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                                        <Users style={{ width: 11, height: 11 }} /> {group.contactCount}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#6B7280]">{group.address}</p>
                                  </div>
                                </div>

                                {/* POC cards grid — nested under customer with left accent */}
                                <div style={{ marginLeft: 18, paddingLeft: 16 }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, paddingTop: 4 }}>
                                    {visiblePocs.map(poc => (
                                      <POCCard
                                        key={poc.id}
                                        poc={poc}
                                        search={search}
                                        onClick={() => onSelectPOC(group, poc)}
                                      />
                                    ))}
                                  </div>

                                  {hasMore && (
                                    <div className="flex justify-between items-center mt-1.5">
                                      <button
                                        onClick={() => toggleExpand(group.id)}
                                        className="text-[13px] text-[#1B6EF3] hover:opacity-80 transition-opacity"
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', fontWeight: 500 }}
                                      >
                                        {expandedGroups[group.id] ? "Show less" : `Show ${remaining} more`}
                                      </button>
                                      <span className="text-[11px] text-[#9CA3AF]">{group.pocs.length} total</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {trimmed && pocCount === 0 && (
                            <p className="text-[12px] text-[#9CA3AF] px-3 py-2">No contacts match '{trimmed}'.</p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Fixed Bottom "Create new" strip — sits outside the scroll
                area so it never shifts as results come and go. Tab-aware
                label matches the Quote overlay. */}
            <div className="p-4 border-t border-[#E5E7EB] bg-white flex-shrink-0">
              <button
                onClick={() => onCreateNew?.(searchTab, search.trim())}
                className="flex items-center gap-1.5 text-[13px] text-[#1B6EF3] hover:opacity-80 transition-opacity"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500, padding: 0 }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                {(() => {
                  const trimmed = search.trim();
                  if (searchTab === "Point of Contact") {
                    return trimmed
                      ? `Create a new point of contact '${trimmed}'`
                      : "Create a new point of contact";
                  }
                  // "All" + "Customers" tabs → customer create CTA
                  return trimmed
                    ? `Create a new customer '${trimmed}'`
                    : "Create a new customer";
                })()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   POC Card
   ═══════════════════════════════════════════════════════ */
function POCCard({ poc, search, onClick }: { poc: POC; search: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="transition-all cursor-pointer text-left relative group/card"
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #E5E7EB",
        background: "white",
        display: "flex", flexDirection: "column", gap: 4,
        minWidth: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.backgroundColor = "white"; }}
    >
      {/* PRIMARY badge - upper right */}
      {poc.isPrimary && (
        <span className="absolute top-2 right-2 inline-flex items-center px-1 py-0.5 bg-[#DBEAFE] text-[#1E40AF] rounded text-[9px]" style={{ fontWeight: 600 }}>
          PRIMARY
        </span>
      )}

      {/* Avatar + Name Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Avatar initials={poc.initials} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "#1F2937" }} title={poc.name}>
            <HighlightName name={poc.name} search={search} style={{ fontSize: 13, fontWeight: 500, color: "#1F2937" }} />
          </div>
          <div className="truncate" style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }} title={poc.role}>
            {poc.role}
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
          <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.phone}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
          <Copy style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.extension}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280", minWidth: 0 }}>
          <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.email}</span>
        </div>
      </div>
    </button>
  );
}

/* Highlight matching text in name */
function HighlightName({ name, search, style: s }: { name: string; search: string; style: React.CSSProperties }) {
  if (!search.trim()) return <span style={s}>{name}</span>;
  const idx = name.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <span style={s}>{name}</span>;
  return (
    <span style={s}>
      {name.slice(0, idx)}
      <mark style={{ backgroundColor: '#FEF08A', color: 'inherit', padding: 0, borderRadius: 2 }}>{name.slice(idx, idx + search.length)}</mark>
      {name.slice(idx + search.length)}
    </span>
  );
}

/* ═══ Date Config Cards with inline modal ═══ */
function DateConfigCardsWithModal({ priorityCard, isStacked = false }: { priorityCard?: React.ReactNode; isStacked?: boolean }) {
  const [editingDate, setEditingDate] = useState<SODateType | null>(null);
  const [requestDate, setRequestDate] = useState("03/16/2026");
  const [estShipConfig, setEstShipConfig] = useState<DateConfig>({ dateType: "absolute", absoluteValue: "03/26/2026", relativeValue: "", relativeUnit: "__disable_relative__" });

  const handleSave = (config: DateConfig) => {
    if (editingDate === "request") setRequestDate(config.absoluteValue || requestDate);
    else if (editingDate === "estShip") setEstShipConfig({ ...config, dateType: "absolute", relativeUnit: "__disable_relative__" });
    setEditingDate(null);
  };

  const getInitialConfig = (): DateConfig => {
    if (editingDate === "request") return { dateType: "absolute", absoluteValue: requestDate, relativeValue: "", relativeUnit: "days" };
    if (editingDate === "estShip") return estShipConfig;
    return { dateType: "absolute", absoluteValue: "", relativeValue: "", relativeUnit: "days" };
  };

  return (
    <>
      <DateConfigCards
        requestDateValue={requestDate}
        estShipType={estShipConfig.dateType}
        estShipValue={estShipConfig.dateType === 'absolute' ? estShipConfig.absoluteValue : estShipConfig.relativeValue}
        estShipUnit={estShipConfig.relativeUnit}
        onEdit={setEditingDate}
        trailingElement={priorityCard}
        isStacked={isStacked}
      />
      {editingDate && (
        <DateEditModal
          type={editingDate}
          isOpen={true}
          onClose={() => setEditingDate(null)}
          onSave={handleSave}
          initialConfig={getInitialConfig()}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Selected State — matches Quote module Step 2 layout
   ════════════════════════════���══════════════════════════ */
interface SelectedStateProps {
  customer: Customer;
  /** Null when the customer has no contact on file yet. */
  poc: POC | null;
  /** True after Continue / Create with no point of contact. */
  pocError?: boolean;
  variant: 1 | 2 | 3;
  customerAddress: string;
  onClear: () => void;
  onChangeLocation: () => void;
  priority: "Low" | "Standard" | "High";
  onPriorityChange: (p: "Low" | "Standard" | "High") => void;
  tags: string[];
  /* One callback: the shared tag field owns its own draft, so the parent only
     needs the resulting list. */
  onTagsChange: (next: string[]) => void;
  /* Modal triggers */
  onOpenRecipients: () => void;
  onOpenAddress: (type: 'billing' | 'shipping') => void;
  onOpenPaymentTerms: () => void;
  onOpenPaymentMethod: () => void;
  /* Display values */
  paymentTerms: string;
  paymentMethod: string;
  billingAddress: string | null;
  shippingAddress: string | null;
  /* Sales rep */
  selectedReps: SelectedSalesRep[];
  availableReps: SalesRepOption[];
  onRepsChange: (reps: SelectedSalesRep[]) => void;
  /* Actual recipients picked for THIS SO — distinct from the
     customer's full POC roster. The overlapping-circles widget reads
     from this so we don't make every customer contact look like a
     recipient when the user has only picked one. */
  selectedRecipients: RecipientPoC[];
  /* When the parent modal is in full-view mode, Step 2 reflows the
     bottom rows (date cards + tags) into a right-side column.
     Single-column stack otherwise. */
  isFullView?: boolean;
}

function SelectedState({
  customer, poc, variant, customerAddress, onClear, onChangeLocation,
  priority, onPriorityChange,
  tags, onTagsChange,
  onOpenRecipients, onOpenAddress, onOpenPaymentTerms, onOpenPaymentMethod,
  paymentTerms, paymentMethod,
  billingAddress, shippingAddress,
  selectedReps, availableReps, onRepsChange,
  selectedRecipients,
  isFullView = false,
  pocError = false,
}: SelectedStateProps) {
  const hasLocations = (customer.locations?.length ?? 0) > 0;
  const billTo = billingAddress ?? customer.address;
  const shipTo = shippingAddress ?? customer.address;
  if (variant === 1) {
    return (
      <div
        style={{
          display: "grid",
          // Two columns in full view, one column otherwise.
          gridTemplateColumns: isFullView ? "minmax(0, 1fr) minmax(280px, 360px)" : "minmax(0, 1fr)",
          gap: isFullView ? 16 : 12,
          alignItems: "start",
          paddingBottom: 16,
          /* On ultrawide / full-view displays the left column expands
             without bound, which leaves the customer card and config
             sections stretched across thousands of pixels and breaks
             the reading rhythm. Cap the inner grid so content stays
             readable while the right-side dates rail stays anchored. */
          width: "100%",
          maxWidth: 1400,
          marginInline: "auto",
        }}
      >
        {/* Left column — customer + billing/shipping/payment cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionCard
          icon={Users}
          title="Selected Customer and Point of Contact"
          actions={<SectionClearButton onClick={onClear} />}
        >
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.4 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 4 }}>{customer.name}</div>
                  {/* Address + Change link + status chips — same row treatment
                      as the compact view so both layouts read alike. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ ...captionNormal, color: customerAddress ? "var(--muted-foreground)" : "#94A3B8" }}>
                      {customerAddress || FIELD_RULES.customerAddress.emptyLabel}
                    </span>
                    {/* No locations on file means nothing to switch to. */}
                    {hasLocations && (
                    <button
                      onClick={onChangeLocation}
                      className="flex-shrink-0"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                        color: "var(--primary)", border: "none",
                        background: "transparent", cursor: "pointer", padding: 0,
                        borderBottom: "1px dotted var(--primary)",
                      }}
                    >
                      <ArrowLeftRight style={{ width: 11, height: 11 }} /> Change
                    </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(customer.status || []).map((tag) => {
                      const isActive = tag === "Active";
                      return (
                        <span
                          key={tag}
                          className={isActive ? undefined : "bg-primary/8 text-primary"}
                          style={{
                            display: "inline-flex", alignItems: "center",
                            fontSize: 10, fontWeight: 600,
                            padding: "2px 6px", borderRadius: 6,
                            whiteSpace: "nowrap",
                            ...(isActive ? { backgroundColor: "#ECFDF5", color: "#065F46" } : null),
                          }}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Match Quote: contact info sits next to the customer-info
                  block as a sibling — flex-start, not flex-end. flex-shrink
                  0 + min-width keep it from collapsing when the parent grid
                  switches to a narrower column. */}
              {/* Contact lines render only when on file. A name-only
                  customer has neither, so the column is dropped. */}
              {(customer.phone || customer.email) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", flexShrink: 0, minWidth: 240 }}>
                {customer.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, ...captionNormal, color: "var(--muted-foreground)" }}>
                  <Phone style={{ width: 13, height: 13, flexShrink: 0, color: "var(--muted-foreground)" }} />
                  <span>{customer.phone}</span>
                </div>
                )}
                {customer.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, ...captionNormal, color: "var(--muted-foreground)" }}>
                  <Mail style={{ width: 13, height: 13, flexShrink: 0, color: "var(--muted-foreground)" }} />
                  <span>{customer.email}</span>
                </div>
                )}
              </div>
              )}
            </div>

            {/* Point of contacts Row — mirrors the Quote module's
                Step2Configuration row so both creation flows read the
                same. Replaces the prior "Manage Point of Contacts"
                link affordance: the entire row is now the click target,
                with a label + primary contact pill + secondary avatar
                stack + pencil edit icon. */}
            {!poc ? (
              /* Empty point of contact row. Same chrome as the Quote
                 module's empty row; turns red after Continue / Create. */
              <div data-field="poc" style={{ marginTop: 10 }}>
                <div
                  role="button"
                  aria-invalid={pocError}
                  aria-describedby={pocError ? "create-so-poc-error" : undefined}
                  className={`group cursor-pointer transition-all flex items-center gap-3 p-3 rounded-md border ${
                    pocError
                      ? "border-red-400 hover:border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                      : "border-border hover:border-primary hover:bg-[var(--primary-hover-bg)]"
                  }`}
                  style={{ background: "var(--card)" }}
                  onClick={onOpenRecipients}
                >
                  <span style={{ ...font, fontSize: "13px", fontWeight: 400, color: "var(--muted-foreground)" }}>Point of contacts</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#94A3B8" }}>{FIELD_RULES.poc.emptyLabel}</span>
                  <Pencil className="text-slate-300 group-hover:text-primary transition-colors" style={{ width: 14, height: 14 }} />
                </div>
                {pocError && (
                  <FieldErrorText id="create-so-poc-error">{FIELD_RULES.poc.missingMessage}</FieldErrorText>
                )}
              </div>
            ) : (
            <div
              className="group cursor-pointer transition-all"
              onClick={onOpenRecipients}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                marginTop: 10,
                background: "var(--card)",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ ...font, fontSize: "13px", fontWeight: 400, color: "var(--muted-foreground)" }}>Point of contacts</span>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                {/* Primary contact pill — fully rounded */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 12px 6px 6px",
                  borderRadius: 999,
                  background: "var(--muted)",
                }}>
                  <Avatar initials={poc.initials} size={32} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{poc.name}</span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: "2px 10px", borderRadius: 999,
                        fontSize: 11, fontWeight: 500,
                        backgroundColor: "var(--primary)", color: "#FFFFFF",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>Primary</span>
                    </div>
                    <span style={{ ...font, fontSize: 11, fontWeight: 400, color: "var(--muted-foreground)" }}>
                      {(poc.role || "").split("|")[0].trim()}
                    </span>
                  </div>
                </div>

                {/* Secondary contact overlapping circles — up to 3 then +N */}
                {(() => {
                  const others = selectedRecipients.filter(p => p.id !== poc.id);
                  if (others.length === 0) return null;
                  const MAX_SHOWN = 3;
                  const shown = others.slice(0, MAX_SHOWN);
                  const overflowCount = others.length - MAX_SHOWN;
                  return (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {shown.map((p, i) => {
                        const initials = p.initials || (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const pal = PASTEL_PALETTE[getPastelIndex(initials)];
                        return (
                          <div key={p.id} title={`${p.name} - ${p.role || ''}`} style={{
                            width: 32, height: 32, borderRadius: "50%",
                            backgroundColor: pal.bg, color: pal.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            ...font, fontSize: 11, fontWeight: 600,
                            boxShadow: "0 0 0 2px var(--card)",
                            marginLeft: i === 0 ? 0 : -10,
                            position: "relative",
                            zIndex: MAX_SHOWN - i,
                          }}>
                            {initials}
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          backgroundColor: "var(--primary)", color: "#FFFFFF",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          ...font, fontSize: 11, fontWeight: 600,
                          border: "2px solid var(--card)",
                          marginLeft: -10,
                          position: "relative",
                          zIndex: MAX_SHOWN + 1,
                        }}>
                          +{overflowCount}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Pencil aligned with sidebar HoverEditRow + Partner
                  Management convention: slate-300 default, primary
                  on row hover. */}
              <Pencil className="text-slate-300 group-hover:text-primary transition-colors" style={{ width: 14, height: 14 }} />
            </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={CreditCard} title="Billing, Shipping & Payment Configurations">
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <AddressCard label="BILL TO" fieldKey="billTo" name={customer.name} address={billTo} isDefault={!!billTo && billTo === customer.address} onClick={() => onOpenAddress('billing')} />
              <AddressCard label="SHIP TO" fieldKey="shipTo" name={customer.name} address={shipTo} isDefault={!!shipTo && shipTo === customer.address} onClick={() => onOpenAddress('shipping')} />
            </div>
            <ConfigRow label="Payment terms" value={paymentTerms} placeholder={FIELD_RULES.paymentTerms.emptyLabel} onClick={onOpenPaymentTerms} />
            <ConfigRow label="Payment method" value={paymentMethod} placeholder={FIELD_RULES.paymentMethod.emptyLabel} hasIcon onClick={onOpenPaymentMethod} />
            <SharedConfigRow label="Sales Representative" pencil={false}>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
              <SalesRepSelector selectedReps={selectedReps} availableReps={availableReps} onSelectedRepsChange={onRepsChange} label="" affordance="pencil" />
            </div>
          </SharedConfigRow>
          </div>
        </SectionCard>
        </div>
        {/* Right column — date trio + priority + tags. Stacks under the
            left column when isFullView is false (single-column grid). */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} isStacked={isFullView} />
        <TagsCard tags={tags} onTagsChange={onTagsChange} />
        </div>
      </div>
    );
  }

  if (variant === 2) {
    const primaryPoc = poc;
    /* Same fix as variant 3 — show the actual chosen recipients, not
       every POC on file for this customer. */
    const otherPocs = selectedRecipients.filter(p => p.id !== poc.id);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {/* Section 1: Customer & Contacts */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ ...labelSemi, color: "var(--foreground)" }}>Customer & Contacts</span>
            <button onClick={onClear} className="transition-colors" style={{ display: "flex", alignItems: "center", gap: 4, ...captionStyle, color: "var(--destructive)", border: "none", background: "transparent", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--destructive-hover-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
            >
              <X style={{ width: 11, height: 11 }} /> Clear All
            </button>
          </div>

          {/* Customer row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--secondary)", borderRadius: 8, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)" }}>
              <Building2 style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.35 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 2 }}>{customer.name}</div>
              <div style={{ ...captionNormal, color: "var(--muted-foreground)" }}>{customerAddress}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <div style={{ ...captionNormal, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                <Phone style={{ width: 11, height: 11, color: "var(--muted-foreground)" }} /> {customer.phone}
              </div>
              <button onClick={onChangeLocation} style={{ border: "none", background: "transparent", color: "var(--primary)", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                <ArrowLeftRight style={{ width: 10, height: 10 }} /> Change location
              </button>
            </div>
          </div>

          {/* Primary PoC + other PoCs row */}
          <div
            className="group cursor-pointer transition-all"
            onClick={onOpenRecipients}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", transition: "all 150ms ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {/* Primary */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <Avatar initials={primaryPoc.initials} size={28} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...captionSemi, color: "var(--foreground)" }}>{primaryPoc.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, backgroundColor: "#DBEAFE", color: "#1E40AF" }}>PRIMARY</span>
                </div>
                <div style={{ ...captionNormal, color: "#6B7280" }}>{primaryPoc.role.split("|")[0].trim()}</div>
              </div>
            </div>

            {/* Overlapping other PoC circles */}
            {otherPocs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {otherPocs.slice(0, 3).map((p, i) => {
                  const initials = p.initials || (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  const pal = PASTEL_PALETTE[getPastelIndex(initials)];
                  return (
                    <div key={p.id} style={{
                      width: 26, height: 26, borderRadius: "50%",
                      backgroundColor: pal.bg, color: pal.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 600,
                      border: "2px solid var(--card)",
                      marginLeft: i > 0 ? -6 : 0,
                      position: "relative", zIndex: 3 - i,
                    }}>
                      {initials}
                    </div>
                  );
                })}
                {otherPocs.length > 3 && (
                  <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 500, marginLeft: 4 }}>+{otherPocs.length - 3} more</span>
                )}
              </div>
            )}

            <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
          </div>
        </div>

        {/* Section 2: Order Configuration */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 10 }}>Order Configuration</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <AddressCard label="BILL TO" fieldKey="billTo" name={customer.name} address={billingAddress || customer.address} isDefault={!billingAddress} onClick={() => onOpenAddress('billing')} />
            <AddressCard label="SHIP TO" fieldKey="shipTo" name={customer.name} address={shippingAddress || customer.address} isDefault={!shippingAddress} onClick={() => onOpenAddress('shipping')} />
          </div>
          <ConfigRow label="Payment terms" value={paymentTerms} onClick={onOpenPaymentTerms} />
          <ConfigRow label="Payment method" value={paymentMethod} hasIcon onClick={onOpenPaymentMethod} />
          <SharedConfigRow label="Sales Representative" pencil={false}>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
              <SalesRepSelector selectedReps={selectedReps} availableReps={availableReps} onSelectedRepsChange={onRepsChange} label="" affordance="pencil" />
            </div>
          </SharedConfigRow>
          <div style={{ marginTop: 10 }}>
            <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} />
          </div>
          <div style={{ marginTop: 10 }}>
            <TagsCard tags={tags} onTagsChange={onTagsChange} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        // Two columns when there's horizontal space, one otherwise.
        gridTemplateColumns: isFullView ? "minmax(0, 1fr) minmax(280px, 360px)" : "minmax(0, 1fr)",
        gap: isFullView ? 16 : 12,
        alignItems: "start",
        paddingBottom: 16,
        /* Cap the inner grid width on ultrawide displays so the
           main customer/billing/shipping card doesn't stretch to
           thousands of pixels and lose its reading rhythm. Dates
           rail stays anchored at the right of the capped grid. */
        width: "100%",
        maxWidth: 1400,
        marginInline: "auto",
      }}
    >
      {/* Left column — main customer/billing/shipping/payment card */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        <SectionCard
          icon={Users}
          title="Selected Customer and Point of Contact"
          actions={<SectionClearButton onClick={onClear} />}
        >
          <div>
            {/* Customer Details Row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
              {/* Left: Icon + Company */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                {/* Building icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: "calc(var(--radius) - 4px)",
                  background: "var(--secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Building2 style={{ width: 20, height: 20, color: "var(--foreground)", opacity: 0.35 }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Customer name */}
                  <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 4 }}>
                    {customer.name}
                  </div>
                  {/* Address + Change link */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ ...captionNormal, color: "#6B7280" }}>
                      {customerAddress}
                    </span>
                    <button
                      onClick={onChangeLocation}
                      className="flex-shrink-0"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                        color: "var(--primary)", border: "none",
                        background: "transparent", cursor: "pointer", padding: 0,
                        borderBottom: "1px dotted var(--primary)",
                      }}
                    >
                      <ArrowLeftRight style={{ width: 11, height: 11 }} /> Change
                    </button>
                  </div>
                  {/* Status tags — pastel */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {customer.status.map(s => {
                      const isActive = s === "Active";
                      return (
                        <span
                          key={s}
                          className={isActive ? undefined : "bg-primary/8 text-primary"}
                          style={{
                            display: "inline-flex", alignItems: "center",
                            fontSize: 10, fontWeight: 600,
                            padding: "2px 6px", borderRadius: 6,
                            whiteSpace: "nowrap",
                            ...(isActive ? { backgroundColor: "#ECFDF5", color: "#065F46" } : null),
                          }}
                        >
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Contact Info — Match Quote: sibling next to the
                  customer-info block (flex-start), not floated to the far
                  right edge. flexShrink 0 + minWidth keep it stable when
                  the parent grid switches to a narrower column. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", flexShrink: 0, minWidth: 240 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "var(--muted-foreground)" }}>
                  <Phone style={{ width: 12, height: 12, flexShrink: 0, color: "var(--muted-foreground)" }} />
                  <span>{customer.phone}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "var(--muted-foreground)" }}>
                  <Phone style={{ width: 12, height: 12, flexShrink: 0, color: "var(--muted-foreground)" }} />
                  <span>{customer.fax}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "var(--muted-foreground)" }}>
                  <Mail style={{ width: 12, height: 12, flexShrink: 0, color: "var(--muted-foreground)" }} />
                  <span>{customer.email}</span>
                </div>
              </div>
            </div>

            {/* Point of contacts Row — visually aligned with the Quote
                module's equivalent row in Step2Configuration so both
                modules read the same. Label renamed from "Recipients"
                to "Point of contacts" per the suite-wide terminology
                pass. Larger 32px avatars, fully-rounded primary pill,
                and up to 3 secondary slots before the +N overflow. */}
            <div
              className="group cursor-pointer transition-all"
              onClick={onOpenRecipients}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                marginTop: 4,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ ...font, fontSize: "13px", fontWeight: 400, color: "var(--muted-foreground)" }}>Point of contacts</span>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                {/* Primary contact pill — fully rounded */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 12px 6px 6px",
                  borderRadius: 999,
                  background: "var(--muted)",
                }}>
                  <Avatar initials={poc.initials} size={32} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{poc.name}</span>
                      {poc.isPrimary && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: "2px 10px", borderRadius: 999,
                          fontSize: 11, fontWeight: 500,
                          backgroundColor: "var(--primary)", color: "#FFFFFF",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}>Primary</span>
                      )}
                    </div>
                    <span style={{ ...font, fontSize: 11, fontWeight: 400, color: "var(--muted-foreground)" }}>
                      {(poc.role || "").split("|")[0].trim()}
                    </span>
                  </div>
                </div>

                {/* Secondary contact overlapping circles — up to 3 then +N */}
                {(() => {
                  const others = selectedRecipients.filter(p => p.id !== poc.id);
                  if (others.length === 0) return null;
                  const MAX_SHOWN = 3;
                  const shown = others.slice(0, MAX_SHOWN);
                  const overflowCount = others.length - MAX_SHOWN;
                  return (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {shown.map((p, i) => {
                        const initials = p.initials || (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const pal = PASTEL_PALETTE[getPastelIndex(initials)];
                        return (
                          <div key={p.id} title={`${p.name} - ${p.role || ''}`} style={{
                            width: 32, height: 32, borderRadius: "50%",
                            backgroundColor: pal.bg, color: pal.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            ...font, fontSize: 11, fontWeight: 600,
                            boxShadow: "0 0 0 2px var(--card)",
                            marginLeft: i === 0 ? 0 : -10,
                            position: "relative",
                            zIndex: MAX_SHOWN - i,
                          }}>
                            {initials}
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          backgroundColor: "var(--primary)", color: "#FFFFFF",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          ...font, fontSize: 11, fontWeight: 600,
                          border: "2px solid var(--card)",
                          marginLeft: -10,
                          position: "relative",
                          zIndex: MAX_SHOWN + 1,
                        }}>
                          +{overflowCount}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Pencil aligned with sidebar HoverEditRow + Partner
                  Management convention: slate-300 default, primary
                  on row hover. */}
              <Pencil className="text-slate-300 group-hover:text-primary transition-colors" style={{ width: 14, height: 14 }} />
            </div>
          </div>
        </SectionCard>


        <SectionCard icon={CreditCard} title="Billing, Shipping & Payment Configurations">
          <div>

            {/* Bill To / Ship To grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <AddressCard label="BILL TO" fieldKey="billTo" name={customer.name} address={billingAddress || customer.address} isDefault={!billingAddress} onClick={() => onOpenAddress('billing')} />
              <AddressCard label="SHIP TO" fieldKey="shipTo" name={customer.name} address={shippingAddress || customer.address} isDefault={!shippingAddress} onClick={() => onOpenAddress('shipping')} />
            </div>

            {/* Config rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <ConfigRow label="Payment terms" value={paymentTerms} onClick={onOpenPaymentTerms} />
              <ConfigRow label="Payment method" value={paymentMethod} hasIcon onClick={onOpenPaymentMethod} />
              <SalesRepSelector
                selectedReps={selectedReps}
                availableReps={availableReps}
                onSelectedRepsChange={onRepsChange}
              />
            </div>
          </div>
        </SectionCard>

      </div>
      {/* Right column — date trio + priority + tags. Stacks under the
          left column when isFullView is false (single-column grid). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Date Cards + Priority — 3-column grid (stacks 1-col in full view) ── */}
      <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} isStacked={isFullView} />

      {/* ── Tags — full width bottom row ── */}
      <TagsCard tags={tags} onTagsChange={onTagsChange} />
      </div>
    </div>
  );
}

/* ── Address Card — Partner Management style: icon label, initials avatar, clickable map link ── */
function AddressCard({ label, fieldKey, name, address, isDefault, onClick }: {
  label: string; fieldKey: "billTo" | "shipTo"; name: string; address: string; isDefault?: boolean; onClick?: () => void;
}) {
  const rule = FIELD_RULES[fieldKey];
  const hasAddress = !isMissing(address);
  const isBilling = label === "BILL TO";
  const displayLabel = isBilling ? "Bill To" : "Ship To";
  const LabelIcon = isBilling ? CreditCard : Package;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = isBilling ? "#6366F1" : "#6366F1";

  return (
    <div
      className="group cursor-pointer transition-all"
      onClick={onClick}
      style={{
        borderRadius: 12,
        background: "var(--card)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        border: "1px solid var(--border)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 40%, transparent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* Header row: icon + label + info + pencil */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <LabelIcon style={{ width: 13, height: 13, color: "#94A3B8", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>{displayLabel}</span>
          <Info className="text-slate-300" style={{ width: 12, height: 12 }} />
        </div>
        <Pencil className="text-slate-300 group-hover:text-primary transition-colors" style={{ width: 12, height: 12 }} />
      </div>

      {/* Avatar + Name. Hidden when no address is on file, so the
          empty card reads exactly like the Quote module's. */}
      {hasAddress && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF" }}>{initials}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="truncate" title={name}>{name}</span>
      </div>
      )}

      {/* Empty: the field's empty label, plus the release hint for a
          field that becomes required later (Ship to). The card stays
          clickable, so the address modal is the Add affordance. */}
      {!hasAddress ? (
        <div style={{ display: "flex", flexDirection: "column" }} data-field={fieldKey}>
          <span className="text-[12px] text-muted-foreground">{rule.emptyLabel}</span>
          {rule.laterHint && <FieldLaterHint>{rule.laterHint}</FieldLaterHint>}
        </div>
      ) : (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-start gap-1.5 transition-colors hover:text-[#0A77FF] group/map"
        style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, textDecoration: "none" }}
      >
        <MapPin style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: "#94A3B8" }} />
        <span className="group-hover/map:underline break-words">{address}</span>
      </a>
      )}
      {hasAddress && isDefault && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary mt-1.5" style={{ fontWeight: 600 }}>
          Default
        </span>
      )}
    </div>
  );
}

/* ── Config Row — hoverable with pencil, no border between rows ── */
function ConfigRow({ label, value, placeholder, isAvatar, avatarInitials, hasIcon, onClick }: {
  label: string; value: string; placeholder?: string; isAvatar?: boolean; avatarInitials?: string; hasIcon?: boolean; onClick?: () => void;
}) {
  /* The shared row, so these read the same as the Quote module's. */
  return (
    <SharedConfigRow
      label={label}
      value={value}
      placeholder={placeholder}
      leading={
        isAvatar && avatarInitials
          ? <Avatar initials={avatarInitials} size={22} />
          : hasIcon
            ? <CreditCard style={{ width: 14, height: 14, color: "var(--primary)" }} />
            : undefined
      }
      onClick={onClick}
    />
  );
}

/* ── Date Card — editable style with pencil icon ── */
function DateCard({ label, date, icon }: {
  label: string; date: string; icon?: "calendar" | "clock";
}) {
  const IconComp = icon === "clock" ? Clock : Calendar;
  return (
    <div
      className="group cursor-pointer transition-all"
      style={{
        borderRadius: "calc(var(--radius) - 2px)",
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 4,
        boxShadow: "var(--elevation-1)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IconComp style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.35 }} />
          <span style={{ ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any, color: "#6B7280", textTransform: "none" }}>{label}</span>
        </div>
        <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
      </div>
      <span style={{ ...labelSemi, color: "var(--foreground)" }}>{date}</span>
    </div>
  );
}

/* ── Priority Card — Quotes-style dropdown ── */
function PriorityCard({ priority, onPriorityChange }: {
  priority: "Low" | "Standard" | "High";
  onPriorityChange: (p: "Low" | "Standard" | "High") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /* Anchor rect for the portalled drop-up so it can be positioned
     via fixed coordinates relative to the trigger card. */
  const triggerRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      /* The dropdown is portalled out of the container subtree, so
         a plain `ref.contains` test would close the menu on its own
         clicks. Exempt the portalled root by tag. */
      const target = e.target as HTMLElement | null;
      if (ref.current && ref.current.contains(target)) return;
      if (target?.closest('[data-priority-portal="1"]')) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setAnchorRect(null); return; }
    if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        ref={triggerRef}
        className="group cursor-pointer transition-all"
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; }}
        style={{
          borderRadius: "calc(var(--radius) - 2px)",
          background: "var(--card)",
          border: open ? "1px solid var(--primary)" : "1px solid var(--border)",
          padding: "10px 12px",
          boxShadow: "var(--elevation-1)",
          transition: "all 150ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Flag style={{ width: 12, height: 12, color: "#9CA3AF" }} />
            <span style={{ ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any, color: "#6B7280" }}>Priority</span>
          </div>
          <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
        </div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11, fontWeight: 500,
                    padding: "4px 10px", borderRadius: 4,
                    backgroundColor: priority === "High" ? "#FEE2E2" : priority === "Standard" ? "#DBEAFE" : "#F3F4F6",
                    color: priority === "High" ? "#991B1B" : priority === "Standard" ? "#1E40AF" : "#374151",
                  }}
                >
                  {priority}
                </span>
      </div>

      {/* Drop-up — portalled so the modal body's overflow:auto can't
          clip it. Anchored above the trigger via the captured rect. */}
      {open && anchorRect && createPortal(
        <div
          data-priority-portal="1"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: anchorRect.left,
            bottom: window.innerHeight - anchorRect.top + 4,
            minWidth: Math.max(140, anchorRect.width),
            maxHeight: `calc(100vh - 16px)`,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "calc(var(--radius) - 2px)",
            boxShadow: "0 12px 32px -8px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 12500,
            overflow: "hidden",
          }}
        >
          {(["High", "Standard", "Low"] as const).map(p => (
            <button
              key={p}
              onClick={() => { onPriorityChange(p); setOpen(false); }}
              className="transition-colors"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "8px 12px",
                border: "none",
                background: priority === p ? (p === "High" ? "#FEF2F2" : p === "Standard" ? "#EFF6FF" : "#F9FAFB") : "transparent",
                cursor: "pointer",
                borderBottom: "1px solid #E5E7EB",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = priority === p ? (p === "High" ? "#FEF2F2" : p === "Standard" ? "#EFF6FF" : "#F9FAFB") : "transparent"; }}
            >
              <span style={{
                fontSize: 11, fontWeight: 500,
                padding: "4px 10px", borderRadius: 4,
                backgroundColor: p === "High" ? "#FEE2E2" : p === "Standard" ? "#DBEAFE" : "#F3F4F6",
                color: p === "High" ? "#991B1B" : p === "Standard" ? "#1E40AF" : "#374151",
              }}>
                {p}
              </span>
              {priority === p && <Check style={{ width: 14, height: 14, color: p === "High" ? "#991B1B" : p === "Standard" ? "#1E40AF" : "#374151" }} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Tags Card — Quotes-style view/edit toggle ── */
function TagsCard({ tags, onTagsChange }: {
  tags: string[];
  onTagsChange: (next: string[]) => void;
}) {
  /* The module's shared tag field: chip, limits and helper line all come from
     `EntityTagChip`, so this reads the same as the detail strip and the
     importer. */
  return <TagsField tags={tags} label="Tags" onChange={onTagsChange} />;
}

export default CreateSOModal;
