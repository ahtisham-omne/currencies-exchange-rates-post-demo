import React from "react";
import {
  MapPin,
  CreditCard,
  DollarSign,
  Receipt,
  ChartColumn,
  Ship,
  UserPlus,
  Globe,
  ShoppingCart,
  Store,
  Wrench,
  Cog,
  Truck,
  Building2,
  UserCheck,
  Briefcase,
  Handshake,
  CircleDollarSign,
  Landmark,
  Wallet,
  Banknote,
  FileText,
} from "lucide-react";

// ── Partner Group Data ──
export interface PartnerGroup {
  id: string;
  name: string;
  description: string;
  country: string;
  countryFlag: string;
  memberCount: number;
}

const PARTNER_GROUPS_BASE: PartnerGroup[] = [
  { id: "PG-1-1", name: "Americas", description: "This group includes fastener's vendors from the EU landscape.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 187 },
  { id: "PG-1-2", name: "Europe West", description: "Western European suppliers and distributors.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 156 },
  { id: "PG-1-3", name: "Asia Pacific", description: "APAC region partners for raw materials and manufacturing.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 143 },
  { id: "PG-1-4", name: "Middle East", description: "Partners operating in the MENA region.", country: "UAE", countryFlag: "\u{1F1E6}\u{1F1EA}", memberCount: 112 },
  { id: "PG-2-1", name: "Domestic Suppliers", description: "Local US-based suppliers for quick turnaround.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 198 },
  { id: "PG-2-2", name: "UK & Ireland", description: "Partners based in the United Kingdom and Ireland.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 134 },
  { id: "PG-2-3", name: "South America", description: "Latin American suppliers and logistics partners.", country: "Brazil", countryFlag: "\u{1F1E7}\u{1F1F7}", memberCount: 109 },
  { id: "PG-2-4", name: "Canada Region", description: "Canadian suppliers and cross-border vendors.", country: "Canada", countryFlag: "\u{1F1E8}\u{1F1E6}", memberCount: 121 },
  { id: "PG-3-1", name: "Southeast Asia", description: "SEA region manufacturing and sourcing partners.", country: "Singapore", countryFlag: "\u{1F1F8}\u{1F1EC}", memberCount: 167 },
  { id: "PG-3-2", name: "Africa", description: "African continent suppliers and service providers.", country: "South Africa", countryFlag: "\u{1F1FF}\u{1F1E6}", memberCount: 103 },
  { id: "PG-3-3", name: "Europe East", description: "Eastern European vendors and logistics companies.", country: "Poland", countryFlag: "\u{1F1F5}\u{1F1F1}", memberCount: 145 },
  { id: "PG-3-4", name: "Oceania", description: "Australia and New Zealand based partners.", country: "Australia", countryFlag: "\u{1F1E6}\u{1F1FA}", memberCount: 118 },
  { id: "PG-4-1", name: "Nordic Countries", description: "Suppliers across Sweden, Norway, Denmark, Finland, and Iceland.", country: "Sweden", countryFlag: "\u{1F1F8}\u{1F1EA}", memberCount: 92 },
  { id: "PG-4-2", name: "Central America", description: "Partners in Guatemala, Honduras, Costa Rica, and Panama.", country: "Mexico", countryFlag: "\u{1F1F2}\u{1F1FD}", memberCount: 67 },
  { id: "PG-4-3", name: "Iberian Peninsula", description: "Spanish and Portuguese manufacturing partners.", country: "Spain", countryFlag: "\u{1F1EA}\u{1F1F8}", memberCount: 88 },
  { id: "PG-4-4", name: "DACH Region", description: "Germany, Austria, and Switzerland industrial suppliers.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 175 },
  { id: "PG-5-1", name: "Indian Subcontinent", description: "India, Pakistan, Bangladesh, and Sri Lanka sourcing partners.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 203 },
  { id: "PG-5-2", name: "Greater China", description: "Mainland China, Hong Kong, Macau, and Taiwan suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 312 },
  { id: "PG-5-3", name: "Korea & Japan", description: "East Asian high-tech and precision manufacturing partners.", country: "South Korea", countryFlag: "\u{1F1F0}\u{1F1F7}", memberCount: 128 },
  { id: "PG-5-4", name: "Caribbean Islands", description: "Island-based logistics and distribution partners.", country: "Jamaica", countryFlag: "\u{1F1EF}\u{1F1F2}", memberCount: 45 },
  { id: "PG-6-1", name: "West Africa", description: "Nigeria, Ghana, and Senegal based suppliers.", country: "Nigeria", countryFlag: "\u{1F1F3}\u{1F1EC}", memberCount: 78 },
  { id: "PG-6-2", name: "East Africa", description: "Kenya, Tanzania, and Ethiopia sourcing partners.", country: "Kenya", countryFlag: "\u{1F1F0}\u{1F1EA}", memberCount: 64 },
  { id: "PG-6-3", name: "North Africa", description: "Morocco, Tunisia, and Egypt manufacturing partners.", country: "Morocco", countryFlag: "\u{1F1F2}\u{1F1E6}", memberCount: 91 },
  { id: "PG-6-4", name: "Southern Africa", description: "South Africa, Botswana, and Namibia suppliers.", country: "South Africa", countryFlag: "\u{1F1FF}\u{1F1E6}", memberCount: 72 },
  { id: "PG-7-1", name: "Benelux", description: "Belgium, Netherlands, and Luxembourg trade partners.", country: "Netherlands", countryFlag: "\u{1F1F3}\u{1F1F1}", memberCount: 113 },
  { id: "PG-7-2", name: "Baltic States", description: "Estonia, Latvia, and Lithuania logistics partners.", country: "Estonia", countryFlag: "\u{1F1EA}\u{1F1EA}", memberCount: 53 },
  { id: "PG-7-3", name: "Balkans", description: "Serbia, Croatia, Bosnia, and Montenegro vendors.", country: "Serbia", countryFlag: "\u{1F1F7}\u{1F1F8}", memberCount: 61 },
  { id: "PG-7-4", name: "Mediterranean", description: "Italy, Greece, Malta, and Cyprus sourcing partners.", country: "Italy", countryFlag: "\u{1F1EE}\u{1F1F9}", memberCount: 137 },
  { id: "PG-8-1", name: "GCC States", description: "Saudi Arabia, Oman, Kuwait, Bahrain, and Qatar suppliers.", country: "Saudi Arabia", countryFlag: "\u{1F1F8}\u{1F1E6}", memberCount: 96 },
  { id: "PG-8-2", name: "Levant", description: "Jordan, Lebanon, and Iraq-based partners.", country: "Jordan", countryFlag: "\u{1F1EF}\u{1F1F4}", memberCount: 42 },
  { id: "PG-8-3", name: "Central Asia", description: "Kazakhstan, Uzbekistan, and Turkmenistan vendors.", country: "Kazakhstan", countryFlag: "\u{1F1F0}\u{1F1FF}", memberCount: 38 },
  { id: "PG-8-4", name: "Caucasus Region", description: "Georgia, Armenia, and Azerbaijan suppliers.", country: "Georgia", countryFlag: "\u{1F1EC}\u{1F1EA}", memberCount: 29 },
  { id: "PG-9-1", name: "Pacific Islands", description: "Fiji, Papua New Guinea, and Samoa logistics partners.", country: "Fiji", countryFlag: "\u{1F1EB}\u{1F1EF}", memberCount: 22 },
  { id: "PG-9-2", name: "New Zealand", description: "New Zealand domestic suppliers and exporters.", country: "New Zealand", countryFlag: "\u{1F1F3}\u{1F1FF}", memberCount: 87 },
  { id: "PG-9-3", name: "Indochina", description: "Vietnam, Cambodia, Laos, and Myanmar manufacturing.", country: "Vietnam", countryFlag: "\u{1F1FB}\u{1F1F3}", memberCount: 154 },
  { id: "PG-9-4", name: "Malay Archipelago", description: "Malaysia, Indonesia, Philippines, and Brunei partners.", country: "Malaysia", countryFlag: "\u{1F1F2}\u{1F1FE}", memberCount: 189 },
  { id: "PG-10-1", name: "Andean Region", description: "Colombia, Peru, Ecuador, and Bolivia suppliers.", country: "Colombia", countryFlag: "\u{1F1E8}\u{1F1F4}", memberCount: 76 },
  { id: "PG-10-2", name: "Southern Cone", description: "Argentina, Chile, Uruguay, and Paraguay partners.", country: "Argentina", countryFlag: "\u{1F1E6}\u{1F1F7}", memberCount: 94 },
  { id: "PG-10-3", name: "US Northeast", description: "New England and Mid-Atlantic regional suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 163 },
  { id: "PG-10-4", name: "US Southeast", description: "Florida, Georgia, Carolinas manufacturing partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 141 },
  { id: "PG-11-1", name: "US Midwest", description: "Illinois, Ohio, Michigan industrial suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 178 },
  { id: "PG-11-2", name: "US West Coast", description: "California, Oregon, Washington tech and logistics.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 215 },
  { id: "PG-11-3", name: "US Southwest", description: "Texas, Arizona, New Mexico border trade partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 132 },
  { id: "PG-11-4", name: "US Mountain", description: "Colorado, Utah, Montana, Idaho based suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 59 },
  { id: "PG-12-1", name: "France Domestic", description: "French domestic manufacturing and distribution.", country: "France", countryFlag: "\u{1F1EB}\u{1F1F7}", memberCount: 147 },
  { id: "PG-12-2", name: "Italy Domestic", description: "Italian artisan and industrial suppliers.", country: "Italy", countryFlag: "\u{1F1EE}\u{1F1F9}", memberCount: 168 },
  { id: "PG-12-3", name: "UK Domestic", description: "United Kingdom local manufacturing partners.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 152 },
  { id: "PG-12-4", name: "Spain Domestic", description: "Spanish local production and assembly partners.", country: "Spain", countryFlag: "\u{1F1EA}\u{1F1F8}", memberCount: 99 },
  { id: "PG-13-1", name: "Automotive OEM", description: "Original equipment manufacturers for automotive sector.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 234 },
  { id: "PG-13-2", name: "Aerospace Suppliers", description: "Certified aerospace component and material vendors.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 87 },
  { id: "PG-13-3", name: "Electronics Components", description: "Semiconductor and electronic parts distributors.", country: "Taiwan", countryFlag: "\u{1F1F9}\u{1F1FC}", memberCount: 276 },
  { id: "PG-13-4", name: "Pharmaceutical Partners", description: "Pharma raw materials and packaging suppliers.", country: "Switzerland", countryFlag: "\u{1F1E8}\u{1F1ED}", memberCount: 112 },
  { id: "PG-14-1", name: "Food & Beverage", description: "Food ingredients, packaging, and processing partners.", country: "Netherlands", countryFlag: "\u{1F1F3}\u{1F1F1}", memberCount: 193 },
  { id: "PG-14-2", name: "Textile & Apparel", description: "Fabric mills, garment manufacturers, and trim suppliers.", country: "Bangladesh", countryFlag: "\u{1F1E7}\u{1F1E9}", memberCount: 167 },
  { id: "PG-14-3", name: "Construction Materials", description: "Building materials, cement, steel, and lumber vendors.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 145 },
  { id: "PG-14-4", name: "Chemical Suppliers", description: "Industrial and specialty chemical distributors.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 108 },
  { id: "PG-15-1", name: "Renewable Energy", description: "Solar, wind, and battery technology suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 156 },
  { id: "PG-15-2", name: "Medical Devices", description: "Medical equipment and device manufacturing partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 124 },
  { id: "PG-15-3", name: "Packaging Solutions", description: "Custom packaging, labels, and container suppliers.", country: "Sweden", countryFlag: "\u{1F1F8}\u{1F1EA}", memberCount: 138 },
  { id: "PG-15-4", name: "Logistics & Freight", description: "Third-party logistics, freight, and warehousing.", country: "Singapore", countryFlag: "\u{1F1F8}\u{1F1EC}", memberCount: 211 },
  { id: "PG-16-1", name: "Raw Metals", description: "Steel, aluminum, copper, and alloy suppliers.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 182 },
  { id: "PG-16-2", name: "Plastics & Polymers", description: "Resin, plastic molding, and polymer suppliers.", country: "South Korea", countryFlag: "\u{1F1F0}\u{1F1F7}", memberCount: 97 },
  { id: "PG-16-3", name: "Wood & Paper", description: "Timber, pulp, and paper product manufacturers.", country: "Canada", countryFlag: "\u{1F1E8}\u{1F1E6}", memberCount: 73 },
  { id: "PG-16-4", name: "Glass & Ceramics", description: "Glass fabricators and ceramic component suppliers.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 56 },
  { id: "PG-17-1", name: "IT Services", description: "IT consulting, managed services, and infrastructure.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 287 },
  { id: "PG-17-2", name: "Software Vendors", description: "SaaS, enterprise software, and licensing partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 198 },
  { id: "PG-17-3", name: "Cloud Infrastructure", description: "Cloud hosting, CDN, and data center partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 64 },
  { id: "PG-17-4", name: "Cybersecurity", description: "Security solutions, auditing, and compliance vendors.", country: "Israel", countryFlag: "\u{1F1EE}\u{1F1F1}", memberCount: 81 },
  { id: "PG-18-1", name: "Office Supplies", description: "Stationery, furniture, and office equipment vendors.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 115 },
  { id: "PG-18-2", name: "Professional Services", description: "Consulting, legal, accounting, and advisory partners.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 92 },
  { id: "PG-18-3", name: "Marketing Agencies", description: "Digital marketing, PR, and creative agency partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 76 },
  { id: "PG-18-4", name: "Staffing & HR", description: "Recruitment, staffing, and HR outsourcing partners.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 58 },
  { id: "PG-19-1", name: "Agriculture", description: "Farming supplies, fertilizer, and agritech vendors.", country: "Brazil", countryFlag: "\u{1F1E7}\u{1F1F7}", memberCount: 134 },
  { id: "PG-19-2", name: "Mining & Minerals", description: "Mineral extraction equipment and raw ore suppliers.", country: "Australia", countryFlag: "\u{1F1E6}\u{1F1FA}", memberCount: 67 },
  { id: "PG-19-3", name: "Oil & Gas", description: "Petroleum, natural gas, and petrochemical partners.", country: "Saudi Arabia", countryFlag: "\u{1F1F8}\u{1F1E6}", memberCount: 103 },
  { id: "PG-19-4", name: "Water & Utilities", description: "Water treatment, utility infrastructure suppliers.", country: "France", countryFlag: "\u{1F1EB}\u{1F1F7}", memberCount: 48 },
  { id: "PG-20-1", name: "Luxury Goods", description: "Premium materials and luxury brand component suppliers.", country: "France", countryFlag: "\u{1F1EB}\u{1F1F7}", memberCount: 71 },
  { id: "PG-20-2", name: "Consumer Electronics", description: "Consumer gadgets, accessories, and device suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 245 },
  { id: "PG-20-3", name: "Heavy Machinery", description: "Industrial machinery and heavy equipment vendors.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 119 },
  { id: "PG-20-4", name: "Precision Tools", description: "CNC tooling, measurement, and calibration suppliers.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 83 },
  { id: "PG-21-1", name: "Safety Equipment", description: "PPE, fire safety, and industrial safety vendors.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 91 },
  { id: "PG-21-2", name: "Electrical Components", description: "Wiring, switches, transformers, and panel suppliers.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 127 },
  { id: "PG-21-3", name: "HVAC Systems", description: "Heating, ventilation, and air conditioning partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 74 },
  { id: "PG-21-4", name: "Plumbing & Piping", description: "Pipes, valves, fittings, and plumbing suppliers.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 103 },
  { id: "PG-22-1", name: "Marine & Shipping", description: "Ship components, marine logistics, and port services.", country: "Singapore", countryFlag: "\u{1F1F8}\u{1F1EC}", memberCount: 88 },
  { id: "PG-22-2", name: "Rail Transport", description: "Railway equipment, rolling stock, and signal systems.", country: "France", countryFlag: "\u{1F1EB}\u{1F1F7}", memberCount: 52 },
  { id: "PG-22-3", name: "Aviation Parts", description: "Aircraft components, MRO, and avionics suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 95 },
  { id: "PG-22-4", name: "EV & Battery", description: "Electric vehicle components and battery cell vendors.", country: "South Korea", countryFlag: "\u{1F1F0}\u{1F1F7}", memberCount: 143 },
  { id: "PG-23-1", name: "Robotics & Automation", description: "Industrial robots, PLCs, and automation systems.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 107 },
  { id: "PG-23-2", name: "3D Printing", description: "Additive manufacturing materials and equipment.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 39 },
  { id: "PG-23-3", name: "IoT Devices", description: "Sensors, connectivity modules, and IoT platforms.", country: "Taiwan", countryFlag: "\u{1F1F9}\u{1F1FC}", memberCount: 82 },
  { id: "PG-23-4", name: "AI & Data Analytics", description: "AI solutions, ML models, and data partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 61 },
  { id: "PG-24-1", name: "Fasteners & Hardware", description: "Bolts, nuts, screws, and industrial hardware.", country: "Taiwan", countryFlag: "\u{1F1F9}\u{1F1FC}", memberCount: 196 },
  { id: "PG-24-2", name: "Adhesives & Sealants", description: "Industrial glues, tapes, and sealant manufacturers.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 67 },
  { id: "PG-24-3", name: "Paints & Coatings", description: "Industrial coatings, powder paint, and finishing.", country: "Netherlands", countryFlag: "\u{1F1F3}\u{1F1F1}", memberCount: 84 },
  { id: "PG-24-4", name: "Lubricants", description: "Industrial oils, greases, and lubricant suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 43 },
  { id: "PG-25-1", name: "Textiles Raw Materials", description: "Cotton, wool, silk, and synthetic fiber suppliers.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 129 },
  { id: "PG-25-2", name: "Leather & Tanning", description: "Leather hides, tanning, and finished leather vendors.", country: "Italy", countryFlag: "\u{1F1EE}\u{1F1F9}", memberCount: 51 },
  { id: "PG-25-3", name: "Rubber Products", description: "Natural and synthetic rubber suppliers.", country: "Thailand", countryFlag: "\u{1F1F9}\u{1F1ED}", memberCount: 68 },
  { id: "PG-25-4", name: "Composite Materials", description: "Carbon fiber, fiberglass, and composite vendors.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 47 },
  { id: "PG-26-1", name: "Printing & Labels", description: "Commercial printing, labels, and tag suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 102 },
  { id: "PG-26-2", name: "Cleaning & Janitorial", description: "Industrial cleaning products and janitorial supplies.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 57 },
  { id: "PG-26-3", name: "Lab Equipment", description: "Laboratory instruments, glassware, and reagents.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 74 },
  { id: "PG-26-4", name: "Testing & Inspection", description: "Quality testing, calibration, and inspection services.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 66 },
  { id: "PG-27-1", name: "Furniture Manufacturing", description: "Commercial and industrial furniture suppliers.", country: "Poland", countryFlag: "\u{1F1F5}\u{1F1F1}", memberCount: 88 },
  { id: "PG-27-2", name: "Uniforms & Workwear", description: "Corporate uniforms, PPE clothing, and workwear.", country: "Bangladesh", countryFlag: "\u{1F1E7}\u{1F1E9}", memberCount: 95 },
  { id: "PG-27-3", name: "Signage & Display", description: "Commercial signage, displays, and POP materials.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 63 },
  { id: "PG-27-4", name: "Event Services", description: "Event management, AV equipment, and staging vendors.", country: "UAE", countryFlag: "\u{1F1E6}\u{1F1EA}", memberCount: 41 },
  { id: "PG-28-1", name: "Translation Services", description: "Localization, translation, and language partners.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 34 },
  { id: "PG-28-2", name: "Insurance Providers", description: "Business insurance, liability, and risk partners.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 28 },
  { id: "PG-28-3", name: "Financial Services", description: "Banking, factoring, and trade finance partners.", country: "Switzerland", countryFlag: "\u{1F1E8}\u{1F1ED}", memberCount: 53 },
  { id: "PG-28-4", name: "Real Estate", description: "Commercial real estate and facility management.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 46 },
  { id: "PG-29-1", name: "Telecom Partners", description: "Telecommunications equipment and service providers.", country: "Finland", countryFlag: "\u{1F1EB}\u{1F1EE}", memberCount: 79 },
  { id: "PG-29-2", name: "Semiconductor Fabs", description: "Wafer fabrication and semiconductor foundries.", country: "Taiwan", countryFlag: "\u{1F1F9}\u{1F1FC}", memberCount: 35 },
  { id: "PG-29-3", name: "Display Technology", description: "LCD, OLED, and display panel manufacturers.", country: "South Korea", countryFlag: "\u{1F1F0}\u{1F1F7}", memberCount: 48 },
  { id: "PG-29-4", name: "Connectors & Cables", description: "Electrical connectors, cable assemblies, and harnesses.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 114 },
  { id: "PG-30-1", name: "Optical Components", description: "Lenses, fiber optics, and optical equipment suppliers.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 62 },
  { id: "PG-30-2", name: "PCB Manufacturers", description: "Printed circuit board fabrication and assembly.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 187 },
  { id: "PG-30-3", name: "Power Supplies", description: "AC/DC converters, UPS, and power management.", country: "Taiwan", countryFlag: "\u{1F1F9}\u{1F1FC}", memberCount: 73 },
  { id: "PG-30-4", name: "Test & Measurement", description: "Oscilloscopes, multimeters, and test equipment.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 55 },
  { id: "PG-31-1", name: "Welding Supplies", description: "Welding equipment, rods, wire, and gas suppliers.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 68 },
  { id: "PG-31-2", name: "Hydraulics & Pneumatics", description: "Hydraulic pumps, cylinders, and pneumatic systems.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 91 },
  { id: "PG-31-3", name: "Bearings & Seals", description: "Ball bearings, roller bearings, and seal suppliers.", country: "Sweden", countryFlag: "\u{1F1F8}\u{1F1EA}", memberCount: 77 },
  { id: "PG-31-4", name: "Springs & Stampings", description: "Spring manufacturers and metal stamping vendors.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 84 },
  { id: "PG-32-1", name: "Forgings & Castings", description: "Metal forging, die casting, and investment casting.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 142 },
  { id: "PG-32-2", name: "Sheet Metal", description: "Sheet metal fabrication, laser cutting, and bending.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 168 },
  { id: "PG-32-3", name: "Wire & Cable Mfg", description: "Wire drawing, cable production, and insulation.", country: "Turkey", countryFlag: "\u{1F1F9}\u{1F1F7}", memberCount: 96 },
  { id: "PG-32-4", name: "Surface Treatment", description: "Plating, anodizing, and surface finishing vendors.", country: "Japan", countryFlag: "\u{1F1EF}\u{1F1F5}", memberCount: 59 },
  { id: "PG-33-1", name: "Injection Molding", description: "Plastic injection molding and tooling suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 213 },
  { id: "PG-33-2", name: "Extrusion Partners", description: "Aluminum and plastic extrusion manufacturers.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 87 },
  { id: "PG-33-3", name: "Die & Mold Making", description: "Precision mold and die manufacturing vendors.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 156 },
  { id: "PG-33-4", name: "CNC Machining", description: "Precision CNC turning, milling, and grinding.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 134 },
  { id: "PG-34-1", name: "Heat Treatment", description: "Hardening, tempering, and thermal processing.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 42 },
  { id: "PG-34-2", name: "Powder Metallurgy", description: "Sintered parts and metal powder suppliers.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 31 },
  { id: "PG-34-3", name: "Rapid Prototyping", description: "Prototype development, SLA, SLS, and FDM services.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 54 },
  { id: "PG-34-4", name: "Assembly Services", description: "Contract assembly, kitting, and sub-assembly.", country: "Mexico", countryFlag: "\u{1F1F2}\u{1F1FD}", memberCount: 116 },
  { id: "PG-35-1", name: "Contract Manufacturing", description: "Full turnkey contract manufacturing partners.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 278 },
  { id: "PG-35-2", name: "White Label Partners", description: "Private label and white label product suppliers.", country: "China", countryFlag: "\u{1F1E8}\u{1F1F3}", memberCount: 192 },
  { id: "PG-35-3", name: "Refurbishment", description: "Product refurbishment, repair, and recycling.", country: "India", countryFlag: "\u{1F1EE}\u{1F1F3}", memberCount: 63 },
  { id: "PG-35-4", name: "Waste Management", description: "Industrial waste disposal and recycling partners.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 47 },
  { id: "PG-36-1", name: "Cold Chain Logistics", description: "Temperature-controlled storage and transport.", country: "Netherlands", countryFlag: "\u{1F1F3}\u{1F1F1}", memberCount: 73 },
  { id: "PG-36-2", name: "Customs Brokers", description: "Customs clearance, duties, and trade compliance.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 56 },
  { id: "PG-36-3", name: "Last Mile Delivery", description: "Last mile, courier, and parcel delivery partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 89 },
  { id: "PG-36-4", name: "Freight Forwarders", description: "International freight forwarding and shipping.", country: "Singapore", countryFlag: "\u{1F1F8}\u{1F1EC}", memberCount: 114 },
  { id: "PG-37-1", name: "Warehousing", description: "Fulfillment centers, 3PL warehousing services.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 137 },
  { id: "PG-37-2", name: "Pallet & Crating", description: "Pallets, wooden crates, and shipping containers.", country: "Canada", countryFlag: "\u{1F1E8}\u{1F1E6}", memberCount: 44 },
  { id: "PG-37-3", name: "Hazmat Logistics", description: "Dangerous goods handling and hazmat transport.", country: "Germany", countryFlag: "\u{1F1E9}\u{1F1EA}", memberCount: 32 },
  { id: "PG-37-4", name: "Bulk Materials", description: "Bulk powder, grain, and liquid transport vendors.", country: "Australia", countryFlag: "\u{1F1E6}\u{1F1FA}", memberCount: 51 },
  { id: "PG-38-1", name: "Turkey Suppliers", description: "Turkish industrial and textile manufacturing.", country: "Turkey", countryFlag: "\u{1F1F9}\u{1F1F7}", memberCount: 148 },
  { id: "PG-38-2", name: "Egypt Partners", description: "Egyptian cotton, chemicals, and construction.", country: "Egypt", countryFlag: "\u{1F1EA}\u{1F1EC}", memberCount: 79 },
  { id: "PG-38-3", name: "Thailand Vendors", description: "Thai electronics, auto parts, and food processing.", country: "Thailand", countryFlag: "\u{1F1F9}\u{1F1ED}", memberCount: 121 },
  { id: "PG-38-4", name: "Chile Suppliers", description: "Chilean mining, agriculture, and fisheries.", country: "Chile", countryFlag: "\u{1F1E8}\u{1F1F1}", memberCount: 63 },
  { id: "PG-39-1", name: "Czech Republic", description: "Czech automotive, glass, and machinery vendors.", country: "Czech Republic", countryFlag: "\u{1F1E8}\u{1F1FF}", memberCount: 87 },
  { id: "PG-39-2", name: "Hungary Partners", description: "Hungarian electronics and automotive suppliers.", country: "Hungary", countryFlag: "\u{1F1ED}\u{1F1FA}", memberCount: 69 },
  { id: "PG-39-3", name: "Romania Suppliers", description: "Romanian IT services and manufacturing.", country: "Romania", countryFlag: "\u{1F1F7}\u{1F1F4}", memberCount: 83 },
  { id: "PG-39-4", name: "Ukraine Vendors", description: "Ukrainian agriculture and IT outsourcing partners.", country: "Ukraine", countryFlag: "\u{1F1FA}\u{1F1E6}", memberCount: 71 },
  { id: "PG-40-1", name: "Nigeria Partners", description: "Nigerian oil, gas, and consumer goods suppliers.", country: "Nigeria", countryFlag: "\u{1F1F3}\u{1F1EC}", memberCount: 58 },
  { id: "PG-40-2", name: "Ethiopia Vendors", description: "Ethiopian coffee, textile, and leather partners.", country: "Ethiopia", countryFlag: "\u{1F1EA}\u{1F1F9}", memberCount: 37 },
  { id: "PG-40-3", name: "Tanzania Suppliers", description: "Tanzanian mining, agriculture, and tourism vendors.", country: "Tanzania", countryFlag: "\u{1F1F9}\u{1F1FF}", memberCount: 29 },
  { id: "PG-40-4", name: "Mozambique", description: "Mozambican energy, mining, and agriculture partners.", country: "Mozambique", countryFlag: "\u{1F1F2}\u{1F1FF}", memberCount: 22 },
  { id: "PG-41-1", name: "Ivory Coast", description: "Cocoa, palm oil, and commodity suppliers.", country: "Ivory Coast", countryFlag: "\u{1F1E8}\u{1F1EE}", memberCount: 33 },
  { id: "PG-41-2", name: "Senegal Partners", description: "Senegalese fisheries and agriculture vendors.", country: "Senegal", countryFlag: "\u{1F1F8}\u{1F1F3}", memberCount: 26 },
  { id: "PG-41-3", name: "DR Congo Minerals", description: "Cobalt, copper, and mineral extraction partners.", country: "DR Congo", countryFlag: "\u{1F1E8}\u{1F1E9}", memberCount: 18 },
  { id: "PG-41-4", name: "Angola Energy", description: "Angolan oil, gas, and energy sector suppliers.", country: "Angola", countryFlag: "\u{1F1E6}\u{1F1F4}", memberCount: 24 },
  { id: "PG-42-1", name: "Peru Mining", description: "Peruvian copper, gold, and silver mining partners.", country: "Peru", countryFlag: "\u{1F1F5}\u{1F1EA}", memberCount: 54 },
  { id: "PG-42-2", name: "Ecuador Exports", description: "Ecuadorian shrimp, banana, and flower suppliers.", country: "Ecuador", countryFlag: "\u{1F1EA}\u{1F1E8}", memberCount: 41 },
  { id: "PG-42-3", name: "Venezuela Oil", description: "Venezuelan petroleum and petrochemical suppliers.", country: "Venezuela", countryFlag: "\u{1F1FB}\u{1F1EA}", memberCount: 19 },
  { id: "PG-42-4", name: "Bolivia Resources", description: "Bolivian lithium, tin, and natural gas partners.", country: "Bolivia", countryFlag: "\u{1F1E7}\u{1F1F4}", memberCount: 16 },
  { id: "PG-43-1", name: "Sri Lanka Textiles", description: "Sri Lankan garments, tea, and spice suppliers.", country: "Sri Lanka", countryFlag: "\u{1F1F1}\u{1F1F0}", memberCount: 72 },
  { id: "PG-43-2", name: "Nepal Handicrafts", description: "Nepalese handmade products and textile partners.", country: "Nepal", countryFlag: "\u{1F1F3}\u{1F1F5}", memberCount: 27 },
  { id: "PG-43-3", name: "Myanmar Exports", description: "Myanmar jade, timber, and garment suppliers.", country: "Myanmar", countryFlag: "\u{1F1F2}\u{1F1F2}", memberCount: 34 },
  { id: "PG-43-4", name: "Cambodia Garments", description: "Cambodian garment and footwear manufacturers.", country: "Cambodia", countryFlag: "\u{1F1F0}\u{1F1ED}", memberCount: 89 },
  { id: "PG-44-1", name: "Portugal Partners", description: "Portuguese cork, wine, and textile suppliers.", country: "Portugal", countryFlag: "\u{1F1F5}\u{1F1F9}", memberCount: 64 },
  { id: "PG-44-2", name: "Greece Vendors", description: "Greek olive oil, marble, and shipping partners.", country: "Greece", countryFlag: "\u{1F1EC}\u{1F1F7}", memberCount: 53 },
  { id: "PG-44-3", name: "Cyprus Services", description: "Cypriot financial and shipping service providers.", country: "Cyprus", countryFlag: "\u{1F1E8}\u{1F1FE}", memberCount: 31 },
  { id: "PG-44-4", name: "Malta Tech", description: "Maltese fintech, gaming, and tech vendors.", country: "Malta", countryFlag: "\u{1F1F2}\u{1F1F9}", memberCount: 23 },
  { id: "PG-45-1", name: "Austria Industrial", description: "Austrian machinery, metals, and wood products.", country: "Austria", countryFlag: "\u{1F1E6}\u{1F1F9}", memberCount: 97 },
  { id: "PG-45-2", name: "Switzerland Precision", description: "Swiss watches, pharma, and precision engineering.", country: "Switzerland", countryFlag: "\u{1F1E8}\u{1F1ED}", memberCount: 86 },
  { id: "PG-45-3", name: "Denmark Clean Tech", description: "Danish wind energy, biotech, and green technology.", country: "Denmark", countryFlag: "\u{1F1E9}\u{1F1F0}", memberCount: 71 },
  { id: "PG-45-4", name: "Norway Maritime", description: "Norwegian oil platforms, fisheries, and shipping.", country: "Norway", countryFlag: "\u{1F1F3}\u{1F1F4}", memberCount: 65 },
  { id: "PG-46-1", name: "Finland Tech", description: "Finnish telecommunications and cleantech vendors.", country: "Finland", countryFlag: "\u{1F1EB}\u{1F1EE}", memberCount: 58 },
  { id: "PG-46-2", name: "Iceland Energy", description: "Icelandic geothermal and fisheries partners.", country: "Iceland", countryFlag: "\u{1F1EE}\u{1F1F8}", memberCount: 14 },
  { id: "PG-46-3", name: "Ireland Tech Hub", description: "Irish tech, pharma, and financial services.", country: "Ireland", countryFlag: "\u{1F1EE}\u{1F1EA}", memberCount: 107 },
  { id: "PG-46-4", name: "Scotland Suppliers", description: "Scottish whisky, energy, and engineering partners.", country: "UK", countryFlag: "\u{1F1EC}\u{1F1E7}", memberCount: 48 },
  { id: "PG-47-1", name: "Mongolia Resources", description: "Mongolian mining and cashmere suppliers.", country: "Mongolia", countryFlag: "\u{1F1F2}\u{1F1F3}", memberCount: 17 },
  { id: "PG-47-2", name: "Uzbekistan Cotton", description: "Uzbek cotton, gold, and natural gas partners.", country: "Uzbekistan", countryFlag: "\u{1F1FA}\u{1F1FF}", memberCount: 25 },
  { id: "PG-47-3", name: "Pakistan Textiles", description: "Pakistani textiles, leather, and sports goods.", country: "Pakistan", countryFlag: "\u{1F1F5}\u{1F1F0}", memberCount: 136 },
  { id: "PG-47-4", name: "Bangladesh Garments", description: "Bangladeshi ready-made garment manufacturers.", country: "Bangladesh", countryFlag: "\u{1F1E7}\u{1F1E9}", memberCount: 214 },
  { id: "PG-48-1", name: "Philippines BPO", description: "Filipino BPO, electronics, and food processing.", country: "Philippines", countryFlag: "\u{1F1F5}\u{1F1ED}", memberCount: 143 },
  { id: "PG-48-2", name: "Indonesia Mining", description: "Indonesian palm oil, mining, and manufacturing.", country: "Indonesia", countryFlag: "\u{1F1EE}\u{1F1E9}", memberCount: 167 },
  { id: "PG-48-3", name: "Laos Hydropower", description: "Laotian hydroelectric and timber partners.", country: "Laos", countryFlag: "\u{1F1F1}\u{1F1E6}", memberCount: 12 },
  { id: "PG-48-4", name: "Brunei Energy", description: "Bruneian oil and gas sector suppliers.", country: "Brunei", countryFlag: "\u{1F1E7}\u{1F1F3}", memberCount: 11 },
  { id: "PG-49-1", name: "Kuwait Oil & Gas", description: "Kuwaiti petroleum and construction partners.", country: "Kuwait", countryFlag: "\u{1F1F0}\u{1F1FC}", memberCount: 38 },
  { id: "PG-49-2", name: "Qatar Construction", description: "Qatari infrastructure and LNG suppliers.", country: "Qatar", countryFlag: "\u{1F1F6}\u{1F1E6}", memberCount: 45 },
  { id: "PG-49-3", name: "Bahrain Finance", description: "Bahraini financial services and aluminum.", country: "Bahrain", countryFlag: "\u{1F1E7}\u{1F1ED}", memberCount: 27 },
  { id: "PG-49-4", name: "Oman Industrial", description: "Omani petrochemical and logistics partners.", country: "Oman", countryFlag: "\u{1F1F4}\u{1F1F2}", memberCount: 33 },
  { id: "PG-50-1", name: "Lebanon Trade", description: "Lebanese banking, agriculture, and services.", country: "Lebanon", countryFlag: "\u{1F1F1}\u{1F1E7}", memberCount: 21 },
  { id: "PG-50-2", name: "Iraq Reconstruction", description: "Iraqi infrastructure and oil sector vendors.", country: "Iraq", countryFlag: "\u{1F1EE}\u{1F1F6}", memberCount: 36 },
  { id: "PG-50-3", name: "Israel High Tech", description: "Israeli cybersecurity, defense, and agritech.", country: "Israel", countryFlag: "\u{1F1EE}\u{1F1F1}", memberCount: 93 },
  { id: "PG-50-4", name: "Global Strategic", description: "Worldwide strategic alliance and JV partners.", country: "USA", countryFlag: "\u{1F1FA}\u{1F1F8}", memberCount: 312 },
];

export const PARTNER_GROUPS: PartnerGroup[] = PARTNER_GROUPS_BASE;

// ── Mock vendors per partner group (for quick view) ──
export interface GroupVendor {
  id: string;
  name: string;
  address: string;
  status: "Active" | "Inactive";
}

// Helper to generate large vendor sets for realistic testing
function generateVendors(prefix: string, startIdx: number, vendors: { name: string; address: string; status: GroupVendor["status"] }[]): GroupVendor[] {
  return vendors.map((v, i) => ({
    id: `${prefix}-${String(startIdx + i).padStart(3, "0")}`,
    name: v.name,
    address: v.address,
    status: v.status,
  }));
}

const US_DOMESTIC_VENDORS: GroupVendor[] = generateVendors("VND", 1, [
  { name: "Acme Industrial Supply Co.", address: "1200 Commerce Blvd, Chicago, IL 60601", status: "Active" },
  { name: "Global Fasteners Inc.", address: "455 Market St, San Francisco, CA 94105", status: "Active" },
  { name: "Northeast Hardware Dist.", address: "78 Federal St, Boston, MA 02110", status: "Active" },
  { name: "Summit Components LLC", address: "320 Elk Ave, Crested Butte, CO 81224", status: "Inactive" },
  { name: "Pacific Rim Trading", address: "900 Harbor Dr, San Diego, CA 92101", status: "Active" },
  { name: "Midwest Steel Supply", address: "1501 Lake Shore Dr, Cleveland, OH 44114", status: "Active" },
  { name: "Texas Bolt & Nut Co.", address: "2200 Industrial Blvd, Dallas, TX 75207", status: "Active" },
  { name: "Great Lakes Hardware", address: "850 Woodward Ave, Detroit, MI 48226", status: "Active" },
  { name: "California Components", address: "1100 Innovation Way, Irvine, CA 92618", status: "Inactive" },
  { name: "Rocky Mountain Fasteners", address: "740 Peak View Dr, Denver, CO 80202", status: "Active" },
  { name: "Southeast Industrial", address: "3100 Peachtree Rd, Atlanta, GA 30305", status: "Inactive" },
  { name: "Liberty Metal Works", address: "425 Independence Blvd, Philadelphia, PA 19106", status: "Active" },
  { name: "Cascade Precision Parts", address: "1650 Cascade Ave, Portland, OR 97201", status: "Active" },
  { name: "Sunbelt Distributors", address: "8800 Citrus Park Dr, Tampa, FL 33625", status: "Active" },
  { name: "Patriot Supply Group", address: "200 Constitution Ave, Washington, DC 20001", status: "Active" },
  { name: "Delta Manufacturing Corp.", address: "3400 River Rd, New Orleans, LA 70121", status: "Inactive" },
  { name: "Frontier Industrial LLC", address: "1200 Frontier Way, Phoenix, AZ 85004", status: "Active" },
  { name: "Keystone Bearings Inc.", address: "560 Steel Rd, Pittsburgh, PA 15222", status: "Active" },
  { name: "Prairie Wind Supply", address: "430 Wheat Field Ln, Omaha, NE 68102", status: "Active" },
  { name: "Northern Star Components", address: "1800 Lakeview Dr, Minneapolis, MN 55401", status: "Active" },
  { name: "Blue Ridge Tooling", address: "275 Mountain View Rd, Asheville, NC 28801", status: "Inactive" },
  { name: "Harbor Point Logistics", address: "900 Dock St, Baltimore, MD 21202", status: "Active" },
  { name: "Silverline Electronics", address: "3200 Tech Blvd, Austin, TX 78701", status: "Active" },
  { name: "Pinnacle Hardware Co.", address: "1450 Summit Dr, Salt Lake City, UT 84101", status: "Active" },
  { name: "Crown Industrial Parts", address: "680 Royal Oak Ave, Kansas City, MO 64106", status: "Inactive" },
  { name: "Eagle Creek Metals", address: "510 Eagle Way, Indianapolis, IN 46204", status: "Active" },
  { name: "Bayshore Supply Corp.", address: "2100 Bay Area Blvd, Houston, TX 77058", status: "Active" },
  { name: "Granite State Hardware", address: "140 Main St, Manchester, NH 03101", status: "Active" },
  { name: "Magnolia Components", address: "820 Magnolia Ave, Birmingham, AL 35203", status: "Active" },
  { name: "Coral Springs Dist.", address: "3600 Sample Rd, Coral Springs, FL 33065", status: "Inactive" },
  { name: "Heartland Fasteners", address: "290 Heartland Dr, Des Moines, IA 50309", status: "Active" },
  { name: "Tidewater Industrial", address: "1100 Waterside Dr, Norfolk, VA 23510", status: "Active" },
  { name: "Lone Star Precision", address: "4200 Lone Star Blvd, San Antonio, TX 78205", status: "Active" },
  { name: "Redwood Supply Chain", address: "720 Redwood Hwy, Mill Valley, CA 94941", status: "Active" },
  { name: "Copper Canyon Mfg.", address: "350 Canyon Rd, Tucson, AZ 85701", status: "Inactive" },
  { name: "Appalachian Valve Co.", address: "180 Valley Rd, Charleston, WV 25301", status: "Active" },
  { name: "Mesa Industrial Group", address: "1900 Mesa Dr, Scottsdale, AZ 85251", status: "Active" },
  { name: "Ocean Gate Hardware", address: "475 Ocean Ave, Long Beach, CA 90802", status: "Active" },
  { name: "Iron Range Supply", address: "320 Iron Ore Rd, Duluth, MN 55802", status: "Active" },
  { name: "Golden Gate Bearings", address: "1 Ferry Building, San Francisco, CA 94111", status: "Active" },
  { name: "Peachtree Components", address: "2500 Peachtree Ln, Savannah, GA 31401", status: "Inactive" },
  { name: "Capitol City Metals", address: "800 Capitol Ave, Sacramento, CA 95814", status: "Active" },
  { name: "Thunder Basin Supply", address: "150 Thunder Rd, Casper, WY 82601", status: "Inactive" },
  { name: "Palmetto Industrial", address: "1300 Palmetto Blvd, Charleston, SC 29401", status: "Active" },
  { name: "Whitewater Machining", address: "620 River Falls Dr, Chattanooga, TN 37402", status: "Active" },
  { name: "Ozark Tool & Die", address: "430 Ozark Trail, Springfield, MO 65801", status: "Active" },
  { name: "Cedar Rapids Coatings", address: "1100 Cedar Blvd, Cedar Rapids, IA 52401", status: "Active" },
  { name: "Chestnut Hill Plastics", address: "80 Chestnut St, Newton, MA 02464", status: "Active" },
  { name: "Willamette Valley MFG", address: "960 Valley River Dr, Eugene, OR 97401", status: "Inactive" },
  { name: "Chesapeake Hardware", address: "2400 Chesapeake Blvd, Virginia Beach, VA 23451", status: "Active" },
  { name: "Summit Peak Alloys", address: "1700 Peak Rd, Colorado Springs, CO 80903", status: "Active" },
  { name: "Bluegrass Precision", address: "340 Bluegrass Pkwy, Louisville, KY 40202", status: "Active" },
  { name: "Alamo City Fasteners", address: "575 Alamo Plaza, San Antonio, TX 78205", status: "Active" },
  { name: "Emerald Coast Supply", address: "1400 Emerald Way, Pensacola, FL 32501", status: "Inactive" },
  { name: "Hudson River Trading", address: "250 River St, Troy, NY 12180", status: "Active" },
  { name: "Sonoran Desert Metals", address: "880 Desert Sun Blvd, Tempe, AZ 85281", status: "Active" },
  { name: "Puget Sound Components", address: "1250 Puget Way, Tacoma, WA 98402", status: "Active" },
  { name: "Great Plains Hardware", address: "700 Plains Rd, Wichita, KS 67202", status: "Inactive" },
  { name: "Glacier Bay Machining", address: "100 Glacier Hwy, Juneau, AK 99801", status: "Active" },
  { name: "Shenandoah Valley Mfg.", address: "460 Valley Pike, Harrisonburg, VA 22801", status: "Active" },
  { name: "Rio Grande Industrial", address: "2300 Rio Grande Blvd, Albuquerque, NM 87104", status: "Active" },
  { name: "Finger Lakes Tooling", address: "185 Lakeview Dr, Ithaca, NY 14850", status: "Active" },
  { name: "Olympic Peninsula Parts", address: "330 Olympic Way, Olympia, WA 98501", status: "Active" },
  { name: "Flatiron Manufacturing", address: "1600 Flatiron Pkwy, Boulder, CO 80301", status: "Active" },
  { name: "Cumberland Gap Supply", address: "210 Gap Rd, Middlesboro, KY 40965", status: "Inactive" },
  { name: "Mission Valley Dist.", address: "4800 Mission Blvd, San Diego, CA 92120", status: "Active" },
  { name: "Catawba River Metals", address: "550 River Walk, Charlotte, NC 28202", status: "Active" },
  { name: "Snake River Components", address: "720 Snake River Ave, Boise, ID 83702", status: "Inactive" },
  { name: "Susquehanna Hardware", address: "390 Market St, Harrisburg, PA 17101", status: "Active" },
  { name: "Wind River Precision", address: "140 Wind River Ln, Lander, WY 82520", status: "Active" },
  { name: "Tombigbee Industrial", address: "860 Commerce St, Tuscaloosa, AL 35401", status: "Active" },
  { name: "Narragansett Supply", address: "225 Thames St, Newport, RI 02840", status: "Active" },
  { name: "Kalamazoo Castings", address: "1100 Portage Rd, Kalamazoo, MI 49007", status: "Active" },
  { name: "Savannah River Alloys", address: "3200 River Rd, Augusta, GA 30901", status: "Inactive" },
  { name: "Bitterroot Manufacturing", address: "480 Bitterroot Dr, Missoula, MT 59801", status: "Active" },
  { name: "Lehigh Valley Tooling", address: "750 Hamilton Blvd, Allentown, PA 18101", status: "Active" },
  { name: "Fox River Hardware", address: "320 Fox River Dr, Appleton, WI 54911", status: "Active" },
  { name: "Wabash Industrial", address: "190 Wabash Ave, Terre Haute, IN 47807", status: "Inactive" },
  { name: "Ouachita Mountain Parts", address: "540 Mountain View, Hot Springs, AR 71901", status: "Active" },
  { name: "Kennebec River Supply", address: "110 Water St, Augusta, ME 04330", status: "Active" },
  { name: "Platte River Metals", address: "880 River Front Dr, North Platte, NE 69101", status: "Active" },
  { name: "Guadalupe Peak Mfg.", address: "420 Peak Dr, El Paso, TX 79901", status: "Inactive" },
  { name: "Okefenokee Hardware", address: "260 Swamp Rd, Waycross, GA 31501", status: "Active" },
  { name: "Yellowstone Supply Co.", address: "150 Yellowstone Ave, Billings, MT 59101", status: "Active" },
  { name: "Enchanted Mesa Parts", address: "730 Mesa Verde Dr, Santa Fe, NM 87501", status: "Active" },
  { name: "Teton Range Fasteners", address: "340 Teton Blvd, Jackson, WY 83001", status: "Active" },
  { name: "Vermillion Bay Supply", address: "520 Vermillion Rd, Lafayette, LA 70501", status: "Active" },
  { name: "Kanawha Valley Metals", address: "690 Valley Dr, South Charleston, WV 25303", status: "Inactive" },
  { name: "Scioto River Components", address: "1400 Scioto Mile, Columbus, OH 43215", status: "Active" },
  { name: "Flathead Lake Trading", address: "280 Lakeside Dr, Kalispell, MT 59901", status: "Active" },
  { name: "Cape Fear Industrial", address: "910 Cape Fear Blvd, Wilmington, NC 28401", status: "Active" },
  { name: "Brazos River Hardware", address: "1750 Brazos St, Waco, TX 76701", status: "Inactive" },
  { name: "Black Hills Precision", address: "450 Mount Rushmore Rd, Rapid City, SD 57701", status: "Active" },
  { name: "Sandia Peak Components", address: "380 Sandia Dr, Albuquerque, NM 87110", status: "Active" },
  { name: "Cuyahoga Supply Corp.", address: "1200 Cuyahoga St, Akron, OH 44308", status: "Active" },
  { name: "Nantucket Hardware Co.", address: "15 Broad St, Nantucket, MA 02554", status: "Active" },
  { name: "Crater Lake Machining", address: "620 Crater Lake Hwy, Medford, OR 97501", status: "Active" },
  { name: "Monongahela Metals", address: "840 Mon Valley Rd, Morgantown, WV 26501", status: "Inactive" },
  { name: "Painted Desert Supply", address: "310 Desert View Dr, Holbrook, AZ 86025", status: "Active" },
  { name: "Allegheny River Parts", address: "570 Allegheny Ave, Warren, PA 16365", status: "Active" },
  { name: "Blue Water Components", address: "1050 Blue Water Hwy, Port Huron, MI 48060", status: "Inactive" },
]);

export const GROUP_VENDORS: Record<string, GroupVendor[]> = {
  "PG-1-1": US_DOMESTIC_VENDORS,
  "PG-1-2": generateVendors("VND", 200, [
    { name: "Berlin Technik GmbH", address: "Friedrichstraße 120, 10117 Berlin, Germany", status: "Active" },
    { name: "Lyon Industrial SARL", address: "45 Rue de la République, 69002 Lyon, France", status: "Active" },
    { name: "Dutch Supply BV", address: "Keizersgracht 280, 1016 EV Amsterdam, Netherlands", status: "Inactive" },
    { name: "Milano Components SRL", address: "Via Montenapoleone 8, 20121 Milano, Italy", status: "Active" },
    { name: "Stockholm Precision AB", address: "Kungsgatan 44, 111 35 Stockholm, Sweden", status: "Active" },
  ]),
  "PG-1-3": generateVendors("VND", 300, [
    { name: "Tokyo Materials Corp.", address: "1-7-1 Yurakucho, Chiyoda, Tokyo 100-0006, Japan", status: "Active" },
    { name: "Shanghai Metal Works", address: "88 Century Ave, Pudong, Shanghai 200120, China", status: "Active" },
    { name: "Seoul Precision Parts", address: "100 Cheonggyecheon-ro, Jung-gu, Seoul 04542, South Korea", status: "Active" },
    { name: "Osaka Electronics Ltd.", address: "3-1-1 Umeda, Kita-ku, Osaka 530-0001, Japan", status: "Inactive" },
    { name: "Taipei Component Works", address: "No. 7, Sec. 5, Xinyi Rd, Xinyi Dist, Taipei 110, Taiwan", status: "Active" },
    { name: "Mumbai Industrial Pvt.", address: "Bandra Kurla Complex, Mumbai 400051, India", status: "Active" },
  ]),
  "PG-1-4": generateVendors("VND", 400, [
    { name: "Dubai Trading Enterprises", address: "DIFC Gate Village, Dubai, UAE", status: "Active" },
    { name: "Al Raha Industrial", address: "Al Raha Beach, Abu Dhabi, UAE", status: "Active" },
    { name: "Riyadh Manufacturing Co.", address: "King Fahd Rd, Riyadh 11564, Saudi Arabia", status: "Active" },
  ]),
  "PG-2-1": generateVendors("VND", 500, [
    { name: "Midwest Steel Supply", address: "1501 Lake Shore Dr, Cleveland, OH 44114", status: "Active" },
    { name: "Texas Bolt & Nut Co.", address: "2200 Industrial Blvd, Dallas, TX 75207", status: "Active" },
    { name: "Great Lakes Hardware", address: "850 Woodward Ave, Detroit, MI 48226", status: "Active" },
    { name: "California Components", address: "1100 Innovation Way, Irvine, CA 92618", status: "Inactive" },
    { name: "Rocky Mountain Fasteners", address: "740 Peak View Dr, Denver, CO 80202", status: "Active" },
    { name: "Southeast Industrial", address: "3100 Peachtree Rd, Atlanta, GA 30305", status: "Inactive" },
  ]),
  "PG-2-2": generateVendors("VND", 600, [
    { name: "London Engineering Ltd.", address: "30 St Mary Axe, London EC3A 8BF, UK", status: "Active" },
    { name: "Dublin Supply Chain Co.", address: "Grand Canal Dock, Dublin D02, Ireland", status: "Active" },
    { name: "Manchester Metal Works", address: "Piccadilly Gardens, Manchester M1 1RG, UK", status: "Inactive" },
  ]),
  "PG-2-3": generateVendors("VND", 700, [
    { name: "São Paulo Industrial SA", address: "Av. Paulista 1578, São Paulo 01310-200, Brazil", status: "Active" },
    { name: "Buenos Aires Logistics", address: "Av. 9 de Julio 1200, Buenos Aires C1043, Argentina", status: "Active" },
  ]),
  "PG-2-4": generateVendors("VND", 800, [
    { name: "Toronto Parts Warehouse", address: "100 Queen St W, Toronto, ON M5H 2N2, Canada", status: "Active" },
    { name: "Vancouver Supply Co.", address: "200 Burrard St, Vancouver, BC V6C 3L6, Canada", status: "Active" },
    { name: "Montreal Industrial", address: "1000 Rue Sherbrooke O, Montréal, QC H3A 3G4, Canada", status: "Inactive" },
  ]),
  "PG-3-1": generateVendors("VND", 900, [
    { name: "Singapore Electronics Pte.", address: "1 Raffles Place, Singapore 048616", status: "Active" },
    { name: "Bangkok Manufacturing", address: "Sukhumvit Rd, Khlong Toei, Bangkok 10110, Thailand", status: "Active" },
    { name: "Ho Chi Minh Trading", address: "Le Loi Blvd, District 1, HCMC 700000, Vietnam", status: "Active" },
  ]),
  "PG-3-2": generateVendors("VND", 950, [
    { name: "Cape Town Engineering", address: "V&A Waterfront, Cape Town 8002, South Africa", status: "Active" },
    { name: "Nairobi Industrial Ltd.", address: "Kenyatta Ave, Nairobi 00100, Kenya", status: "Inactive" },
  ]),
  "PG-3-3": generateVendors("VND", 970, [
    { name: "Warsaw Metal Works", address: "ul. Marszałkowska 100, 00-026 Warsaw, Poland", status: "Active" },
    { name: "Prague Components sro", address: "Václavské nám. 1, 110 00 Praha 1, Czech Republic", status: "Active" },
  ]),
  "PG-3-4": generateVendors("VND", 990, [
    { name: "Sydney Hardware Pty Ltd.", address: "200 George St, Sydney NSW 2000, Australia", status: "Active" },
    { name: "Auckland Supply NZ", address: "Queen St, Auckland CBD, Auckland 1010, New Zealand", status: "Inactive" },
  ]),
};

// ── Vendor sub-types ──
export interface VendorSubType {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const VENDOR_SUB_TYPES: VendorSubType[] = [
  { id: "seller_items", label: "Seller (Items)", icon: <ShoppingCart className="w-5 h-5" /> },
  { id: "carrier", label: "Carrier", icon: <Truck className="w-5 h-5" /> },
  { id: "online_vendor", label: "Online Vendor", icon: <Globe className="w-5 h-5" /> },
  { id: "in_store_vendor", label: "In-Store Vendor", icon: <Store className="w-5 h-5" /> },
  { id: "sub_contractor", label: "Sub Contractor", icon: <Wrench className="w-5 h-5" /> },
  { id: "service_provider", label: "Service Provider", icon: <Cog className="w-5 h-5" /> },
];

export const CUSTOMER_SUB_TYPES: VendorSubType[] = [
  { id: "retail_buyer", label: "Retail Buyer", icon: <ShoppingCart className="w-5 h-5" /> },
  { id: "wholesale_buyer", label: "Wholesale Buyer", icon: <Building2 className="w-5 h-5" /> },
  { id: "distributor", label: "Distributor", icon: <Truck className="w-5 h-5" /> },
  { id: "end_consumer", label: "End Consumer", icon: <UserCheck className="w-5 h-5" /> },
  { id: "b2b_client", label: "B2B Client", icon: <Briefcase className="w-5 h-5" /> },
  { id: "reseller", label: "Reseller", icon: <Handshake className="w-5 h-5" /> },
];

// ── Vendor config sections ──
export interface ConfigSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  learnMore?: boolean;
}

export const VENDOR_CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: "billing_shipping",
    title: "Billing & Shipping",
    description: "Addresses, currency, and funding defaults.",
    icon: <MapPin className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "payment_methods",
    title: "Payment Methods",
    description: "ACH, Wire, Credit Card details.",
    icon: <CreditCard className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "credit_limit",
    title: "Credit Limit",
    description: "Credit limit and utilization rules.",
    icon: <DollarSign className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "payment_terms",
    title: "Payment Terms",
    description: "Default payment terms for orders.",
    icon: <Receipt className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "pricing_rules",
    title: "Pricing Rules",
    description: "Tier-based discounts and pricing.",
    icon: <ChartColumn className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "shipping_methods",
    title: "Shipping Methods",
    description: "Carrier services and delivery methods.",
    icon: <Ship className="w-4 h-4" />,
    learnMore: true,
  },

];

export const CUSTOMER_CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: "customer_billing",
    title: "Billing & Shipping",
    description: "Default billing and shipping addresses.",
    icon: <MapPin className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "customer_payment",
    title: "Payment Methods",
    description: "Accepted payment methods and terms.",
    icon: <CreditCard className="w-4 h-4" />,
    learnMore: true,
  },
  {
    id: "customer_credit",
    title: "Credit Limit",
    description: "Credit limit and utilization for customer.",
    icon: <DollarSign className="w-4 h-4" />,
    learnMore: true,
  },
];

// ── Partner / Location data for dropdowns ──
export interface PartnerLocationItem {
  id: string;
  name: string;
  type: "partner" | "location";
  logoColor: string;
  logoText: string;
  logoUrl?: string;
  isDefault?: boolean;
  location?: string;
}

const L = (domain: string) => `https://logo.clearbit.com/${domain}`;

export const PARTNER_LOCATION_ITEMS: PartnerLocationItem[] = [
  { id: "pl-7", name: "FR Conversions", type: "partner", logoColor: "#6B5CE7", logoText: "FR", logoUrl: L("frconversions.com"), isDefault: true, location: "8200 Turnpike Dr, Suite 200, Westminster, CO 80234, USA" },
  { id: "pl-3", name: "Toyota International", type: "partner", logoColor: "#374151", logoText: "T", logoUrl: L("toyota.com"), location: "6565 Headquarters Dr, Plano, TX 75024, USA" },
  { id: "pl-4", name: "Ford Motor Company USA", type: "partner", logoColor: "#1E40AF", logoText: "F", logoUrl: L("ford.com"), location: "1 American Rd, Dearborn, MI 48126, USA" },
  { id: "pl-5", name: "General Motors (GM)", type: "partner", logoColor: "#1D4ED8", logoText: "GM", logoUrl: L("gm.com"), location: "300 Renaissance Center, Detroit, MI 48265, USA" },
  { id: "pl-6", name: "Tesla, Inc.", type: "partner", logoColor: "#DC2626", logoText: "T", logoUrl: L("tesla.com"), location: "13101 Harold Green Rd, Austin, TX 78725, USA" },
  { id: "pl-8", name: "Chrysler (Stellantis N.V.)", type: "partner", logoColor: "#1E3A5F", logoText: "C", logoUrl: L("stellantis.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-9", name: "Rivian Automotive", type: "partner", logoColor: "#0A6B3D", logoText: "R", logoUrl: L("rivian.com"), location: "14600 Myford Rd, Irvine, CA 92618, USA" },
  { id: "pl-10", name: "BMW Group", type: "partner", logoColor: "#0066B1", logoText: "BMW", logoUrl: L("bmw.com"), location: "Petuelring 130, 80809 Munich, Bavaria, Germany" },
  { id: "pl-11", name: "Mercedes-Benz AG", type: "partner", logoColor: "#333333", logoText: "MB", logoUrl: L("mercedes-benz.com"), location: "Mercedesstraße 120, 70372 Stuttgart, Baden-Württemberg, Germany" },
  { id: "pl-12", name: "Volkswagen AG", type: "partner", logoColor: "#001E50", logoText: "VW", logoUrl: L("volkswagen.com"), location: "Berliner Ring 2, 38440 Wolfsburg, Lower Saxony, Germany" },
  { id: "pl-13", name: "Honda Motor Co.", type: "partner", logoColor: "#CC0000", logoText: "H", logoUrl: L("honda.com"), location: "2-1-1 Minami-Aoyama, Minato-ku, Tokyo 107-8556, Japan" },
  { id: "pl-14", name: "Nissan Motor Corp.", type: "partner", logoColor: "#C3002F", logoText: "N", logoUrl: L("nissan-global.com"), location: "1-1 Takashima, Nishi-ku, Yokohama, Kanagawa 220-8623, Japan" },
  { id: "pl-15", name: "Hyundai Motor Company", type: "partner", logoColor: "#002C5F", logoText: "HY", logoUrl: L("hyundai.com"), location: "12 Heolleung-ro, Seocho-gu, Seoul 06797, South Korea" },
  { id: "pl-16", name: "Kia Corporation", type: "partner", logoColor: "#05141F", logoText: "K", logoUrl: L("kia.com"), location: "12 Heolleung-ro, Seocho-gu, Seoul 06797, South Korea" },
  { id: "pl-17", name: "Subaru Corporation", type: "partner", logoColor: "#013B7C", logoText: "SB", logoUrl: L("subaru.com"), location: "1-20-8 Ebisu, Shibuya-ku, Tokyo 150-8554, Japan" },
  { id: "pl-18", name: "Mazda Motor Corp.", type: "partner", logoColor: "#910A2E", logoText: "MZ", logoUrl: L("mazda.com"), location: "3-1 Shinchi, Fuchu-cho, Aki-gun, Hiroshima 730-8670, Japan" },
  { id: "pl-19", name: "Volvo Cars", type: "partner", logoColor: "#003057", logoText: "VO", logoUrl: L("volvocars.com"), location: "Assar Gabrielssons Väg 9, 405 31 Gothenburg, Sweden" },
  { id: "pl-20", name: "Audi AG", type: "partner", logoColor: "#BB0A30", logoText: "AU", logoUrl: L("audi.com"), location: "Auto-Union-Straße 1, 85045 Ingolstadt, Bavaria, Germany" },
  { id: "pl-21", name: "Porsche AG", type: "partner", logoColor: "#A6192E", logoText: "P", logoUrl: L("porsche.com"), location: "Porscheplatz 1, 70435 Stuttgart, Baden-Württemberg, Germany" },
  { id: "pl-22", name: "Jaguar Land Rover", type: "partner", logoColor: "#1B4D3E", logoText: "JLR", logoUrl: L("jaguarlandrover.com"), location: "Abbey Rd, Whitley, Coventry CV3 4LF, United Kingdom" },
  { id: "pl-23", name: "Lucid Motors", type: "partner", logoColor: "#1A1A2E", logoText: "LU", logoUrl: L("lucidmotors.com"), location: "7373 Gateway Blvd, Newark, CA 94560, USA" },
  { id: "pl-24", name: "Polestar Automotive", type: "partner", logoColor: "#D4AA00", logoText: "PS", logoUrl: L("polestar.com"), location: "Assar Gabrielssons Väg 9, 405 31 Gothenburg, Sweden" },
  { id: "pl-25", name: "BYD Company Ltd.", type: "partner", logoColor: "#0052CC", logoText: "BYD", logoUrl: L("byd.com"), location: "No. 3009 BYD Rd, Pingshan, Shenzhen, Guangdong 518118, China" },
  { id: "pl-26", name: "NIO Inc.", type: "partner", logoColor: "#2E5AAC", logoText: "NIO", logoUrl: L("nio.com"), location: "56 Antuo Rd, Jiading District, Shanghai 201804, China" },
  { id: "pl-27", name: "Fisker Inc.", type: "partner", logoColor: "#1C1C1C", logoText: "FI", logoUrl: L("fiskerinc.com"), location: "1888 Rosecrans Ave, Manhattan Beach, CA 90266, USA" },
  { id: "pl-28", name: "Maserati S.p.A.", type: "partner", logoColor: "#00205B", logoText: "MA", logoUrl: L("maserati.com"), location: "Viale Ciro Menotti 322, 41121 Modena, Emilia-Romagna, Italy" },
  { id: "pl-29", name: "Ferrari N.V.", type: "partner", logoColor: "#DC0000", logoText: "FE", logoUrl: L("ferrari.com"), location: "Via Abetone Inferiore 4, 41053 Maranello, Emilia-Romagna, Italy" },
  { id: "pl-30", name: "Lamborghini S.p.A.", type: "partner", logoColor: "#DAA520", logoText: "LB", logoUrl: L("lamborghini.com"), location: "Via Modena 12, 40019 Sant'Agata Bolognese, Emilia-Romagna, Italy" },
  { id: "pl-31", name: "Bentley Motors Ltd.", type: "partner", logoColor: "#333333", logoText: "BT", logoUrl: L("bentleymotors.com"), location: "Pyms Lane, Crewe CW1 3PL, United Kingdom" },
  { id: "pl-32", name: "Rolls-Royce Motor Cars", type: "partner", logoColor: "#1A1A2E", logoText: "RR", logoUrl: L("rolls-roycemotorcars.com"), location: "The Drive, Westhampnett, Chichester PO18 0SH, United Kingdom" },
  { id: "pl-33", name: "Aston Martin", type: "partner", logoColor: "#005A2B", logoText: "AM", logoUrl: L("astonmartin.com"), location: "Banbury Rd, Gaydon, Warwickshire CV35 0DB, United Kingdom" },
  { id: "pl-34", name: "McLaren Automotive", type: "partner", logoColor: "#FF6600", logoText: "MC", logoUrl: L("mclaren.com"), location: "McLaren Technology Centre, Chertsey Rd, Woking GU21 4YH, United Kingdom" },
  { id: "pl-35", name: "Geely Auto Group", type: "partner", logoColor: "#003DA5", logoText: "GL", logoUrl: L("geely.com"), location: "1760 Jiangling Rd, Binjiang District, Hangzhou, Zhejiang 310000, China" },
  { id: "pl-36", name: "Tata Motors Ltd.", type: "partner", logoColor: "#002F5F", logoText: "TM", logoUrl: L("tatamotors.com"), location: "Bombay House, 24 Homi Mody St, Fort, Mumbai, Maharashtra 400001, India" },
  { id: "pl-37", name: "Suzuki Motor Corp.", type: "partner", logoColor: "#003DA5", logoText: "SZ", logoUrl: L("suzuki.com"), location: "300 Takatsuka-cho, Minami-ku, Hamamatsu, Shizuoka 432-8611, Japan" },
  { id: "pl-38", name: "Mitsubishi Motors", type: "partner", logoColor: "#CC0000", logoText: "MI", logoUrl: L("mitsubishi-motors.com"), location: "1-21 Shibaura, Minato-ku, Tokyo 108-8410, Japan" },
  { id: "pl-39", name: "Lexus (Toyota)", type: "partner", logoColor: "#1A1A2E", logoText: "LX", logoUrl: L("lexus.com"), location: "1 Toyota-cho, Toyota City, Aichi 471-8571, Japan" },
  { id: "pl-40", name: "Infiniti Motor Co.", type: "partner", logoColor: "#1C1C1C", logoText: "IN", logoUrl: L("infinitiusa.com"), location: "1-1 Takashima, Nishi-ku, Yokohama, Kanagawa 220-8623, Japan" },
  { id: "pl-41", name: "Acura (Honda)", type: "partner", logoColor: "#333333", logoText: "AC", logoUrl: L("acura.com"), location: "1919 Torrance Blvd, Torrance, CA 90501, USA" },
  { id: "pl-42", name: "Genesis Motor", type: "partner", logoColor: "#1C1C1C", logoText: "GN", logoUrl: L("genesis.com"), location: "12 Heolleung-ro, Seocho-gu, Seoul 06797, South Korea" },
  { id: "pl-43", name: "Buick (GM)", type: "partner", logoColor: "#1D4ED8", logoText: "BK", logoUrl: L("buick.com"), location: "300 Renaissance Center, Detroit, MI 48265, USA" },
  { id: "pl-44", name: "Cadillac (GM)", type: "partner", logoColor: "#A6192E", logoText: "CD", logoUrl: L("cadillac.com"), location: "300 Renaissance Center, Detroit, MI 48265, USA" },
  { id: "pl-45", name: "Lincoln Motor Co.", type: "partner", logoColor: "#003057", logoText: "LN", logoUrl: L("lincoln.com"), location: "1 American Rd, Dearborn, MI 48126, USA" },
  { id: "pl-46", name: "RAM Trucks (Stellantis)", type: "partner", logoColor: "#1E3A5F", logoText: "RM", logoUrl: L("ramtrucks.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-47", name: "Jeep (Stellantis)", type: "partner", logoColor: "#3B5E3B", logoText: "JP", logoUrl: L("jeep.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-48", name: "Dodge (Stellantis)", type: "partner", logoColor: "#BA0C2F", logoText: "DG", logoUrl: L("dodge.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-49", name: "Alfa Romeo (Stellantis)", type: "partner", logoColor: "#8B0000", logoText: "AR", logoUrl: L("alfaromeousa.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-50", name: "MINI (BMW)", type: "partner", logoColor: "#333333", logoText: "MN", logoUrl: L("mini.com"), location: "Petuelring 130, 80809 Munich, Bavaria, Germany" },
  { id: "pl-51", name: "Peugeot (Stellantis)", type: "partner", logoColor: "#003DA5", logoText: "PG", logoUrl: L("peugeot.com"), location: "7 Rue Henri Sainte-Claire Deville, 92500 Rueil-Malmaison, France" },
  { id: "pl-52", name: "Citroën (Stellantis)", type: "partner", logoColor: "#AC162C", logoText: "CT", logoUrl: L("citroen.com"), location: "7 Rue Henri Sainte-Claire Deville, 92500 Rueil-Malmaison, France" },
  // ── Locations ──
  { id: "pl-1", name: "FR Conversions, Westminster", type: "location", logoColor: "#6B5CE7", logoText: "FR", logoUrl: L("frconversions.com"), location: "8200 Turnpike Dr, Suite 200, Westminster, CO 80234, USA" },
  { id: "pl-2", name: "Toyota Location 206", type: "location", logoColor: "#374151", logoText: "T", logoUrl: L("toyota.com"), location: "1001 Cherry Blossom Way, Georgetown, KY 40324, USA" },
  { id: "pl-53", name: "FR Conversions, Denver HQ", type: "location", logoColor: "#6B5CE7", logoText: "FR", logoUrl: L("frconversions.com"), location: "1700 Lincoln St, Suite 4400, Denver, CO 80203, USA" },
  { id: "pl-54", name: "Ford Dearborn Plant", type: "location", logoColor: "#1E40AF", logoText: "F", logoUrl: L("ford.com"), location: "3001 Miller Rd, Dearborn, MI 48120, USA" },
  { id: "pl-55", name: "Ford Louisville Assembly", type: "location", logoColor: "#1E40AF", logoText: "F", logoUrl: L("ford.com"), location: "3001 Chamberlain Ln, Louisville, KY 40216, USA" },
  { id: "pl-56", name: "GM Spring Hill Assembly", type: "location", logoColor: "#1D4ED8", logoText: "GM", logoUrl: L("gm.com"), location: "100 Saturn Pkwy, Spring Hill, TN 37174, USA" },
  { id: "pl-57", name: "Tesla Fremont Factory", type: "location", logoColor: "#DC2626", logoText: "T", logoUrl: L("tesla.com"), location: "45500 Fremont Blvd, Fremont, CA 94538, USA" },
  { id: "pl-58", name: "Tesla Gigafactory Texas", type: "location", logoColor: "#DC2626", logoText: "T", logoUrl: L("tesla.com"), location: "13101 Harold Green Rd, Austin, TX 78725, USA" },
  { id: "pl-59", name: "BMW Spartanburg Plant", type: "location", logoColor: "#0066B1", logoText: "BMW", logoUrl: L("bmw.com"), location: "1400 Highway 101 S, Greer, SC 29651, USA" },
  { id: "pl-60", name: "Mercedes Tuscaloosa Plant", type: "location", logoColor: "#333333", logoText: "MB", logoUrl: L("mercedes-benz.com"), location: "11 Mercedes Dr, Vance, AL 35490, USA" },
  { id: "pl-61", name: "Honda Marysville Plant", type: "location", logoColor: "#CC0000", logoText: "H", logoUrl: L("honda.com"), location: "24000 Honda Pkwy, Marysville, OH 43040, USA" },
  { id: "pl-62", name: "Hyundai Montgomery Plant", type: "location", logoColor: "#002C5F", logoText: "HY", logoUrl: L("hyundai.com"), location: "700 Hyundai Blvd, Montgomery, AL 36105, USA" },
  { id: "pl-63", name: "Rivian Normal Factory", type: "location", logoColor: "#0A6B3D", logoText: "R", logoUrl: L("rivian.com"), location: "100 N Rivian Motorway, Normal, IL 61761, USA" },
  { id: "pl-64", name: "Toyota San Antonio Plant", type: "location", logoColor: "#374151", logoText: "T", logoUrl: L("toyota.com"), location: "1 Soledad St, San Antonio, TX 78219, USA" },
  { id: "pl-65", name: "Nissan Smyrna Plant", type: "location", logoColor: "#C3002F", logoText: "N", logoUrl: L("nissan-global.com"), location: "983 Nissan Dr, Smyrna, TN 37167, USA" },
  { id: "pl-66", name: "Subaru Lafayette Plant", type: "location", logoColor: "#013B7C", logoText: "SB", logoUrl: L("subaru.com"), location: "5500 State Rd 38 E, Lafayette, IN 47905, USA" },
  { id: "pl-67", name: "Volvo Charleston Plant", type: "location", logoColor: "#003057", logoText: "VO", logoUrl: L("volvocars.com"), location: "1800 Volvo Car Dr, Ridgeville, SC 29472, USA" },
  { id: "pl-68", name: "VW Chattanooga Plant", type: "location", logoColor: "#001E50", logoText: "VW", logoUrl: L("volkswagen.com"), location: "8001 Volkswagen Dr, Chattanooga, TN 37416, USA" },
];

export const FUNDED_BY_ITEMS: PartnerLocationItem[] = [
  { id: "pl-7", name: "FR Conversions", type: "partner", logoColor: "#6B5CE7", logoText: "FR", logoUrl: L("frconversions.com"), isDefault: true, location: "8200 Turnpike Dr, Suite 200, Westminster, CO 80234, USA" },
  { id: "pl-3", name: "Toyota International", type: "partner", logoColor: "#374151", logoText: "T", logoUrl: L("toyota.com"), location: "6565 Headquarters Dr, Plano, TX 75024, USA" },
  { id: "pl-4", name: "Ford Motor Company USA", type: "partner", logoColor: "#1E40AF", logoText: "F", logoUrl: L("ford.com"), location: "1 American Rd, Dearborn, MI 48126, USA" },
  { id: "pl-5", name: "General Motors (GM)", type: "partner", logoColor: "#1D4ED8", logoText: "GM", logoUrl: L("gm.com"), location: "300 Renaissance Center, Detroit, MI 48265, USA" },
  { id: "pl-6", name: "Tesla, Inc.", type: "partner", logoColor: "#DC2626", logoText: "T", logoUrl: L("tesla.com"), location: "13101 Harold Green Rd, Austin, TX 78725, USA" },
  { id: "pl-8", name: "Chrysler (Stellantis N.V.)", type: "partner", logoColor: "#1E3A5F", logoText: "C", logoUrl: L("stellantis.com"), location: "1000 Chrysler Dr, Auburn Hills, MI 48326, USA" },
  { id: "pl-9", name: "Rivian Automotive", type: "partner", logoColor: "#0A6B3D", logoText: "R", logoUrl: L("rivian.com"), location: "14600 Myford Rd, Irvine, CA 92618, USA" },
  { id: "pl-10", name: "BMW Group", type: "partner", logoColor: "#0066B1", logoText: "BMW", logoUrl: L("bmw.com"), location: "Petuelring 130, 80809 Munich, Bavaria, Germany" },
  { id: "pl-11", name: "Mercedes-Benz AG", type: "partner", logoColor: "#333333", logoText: "MB", logoUrl: L("mercedes-benz.com"), location: "Mercedesstraße 120, 70372 Stuttgart, Baden-Württemberg, Germany" },
  { id: "pl-15", name: "Hyundai Motor Company", type: "partner", logoColor: "#002C5F", logoText: "HY", logoUrl: L("hyundai.com"), location: "12 Heolleung-ro, Seocho-gu, Seoul 06797, South Korea" },
];

export const CURRENCY_OPTIONS: { id: string; label: string; symbol: string; flag: string }[] = [
  // Major currencies
  { id: "usd", label: "USD — US Dollar", symbol: "$", flag: "🇺🇸" },
  { id: "eur", label: "EUR — Euro", symbol: "€", flag: "🇪🇺" },
  { id: "gbp", label: "GBP — British Pound", symbol: "£", flag: "🇬🇧" },
  { id: "jpy", label: "JPY — Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { id: "chf", label: "CHF — Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  { id: "cad", label: "CAD — Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { id: "aud", label: "AUD — Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { id: "cny", label: "CNY — Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  // Asia Pacific
  { id: "inr", label: "INR — Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { id: "krw", label: "KRW — South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { id: "sgd", label: "SGD — Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { id: "hkd", label: "HKD — Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { id: "twd", label: "TWD — Taiwan Dollar", symbol: "NT$", flag: "🇹🇼" },
  { id: "thb", label: "THB — Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { id: "myr", label: "MYR — Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { id: "idr", label: "IDR — Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { id: "php", label: "PHP — Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { id: "vnd", label: "VND — Vietnamese Dong", symbol: "₫", flag: "🇻🇳" },
  { id: "nzd", label: "NZD — New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { id: "pkr", label: "PKR — Pakistani Rupee", symbol: "₨", flag: "🇵🇰" },
  { id: "bdt", label: "BDT — Bangladeshi Taka", symbol: "৳", flag: "🇧🇩" },
  { id: "lkr", label: "LKR — Sri Lankan Rupee", symbol: "Rs", flag: "🇱🇰" },
  { id: "mmk", label: "MMK — Myanmar Kyat", symbol: "K", flag: "🇲🇲" },
  { id: "khr", label: "KHR — Cambodian Riel", symbol: "៛", flag: "🇰🇭" },
  { id: "lak", label: "LAK — Lao Kip", symbol: "₭", flag: "🇱🇦" },
  { id: "fjd", label: "FJD — Fijian Dollar", symbol: "FJ$", flag: "🇫🇯" },
  { id: "pgk", label: "PGK — Papua New Guinean Kina", symbol: "K", flag: "🇵🇬" },
  // Americas
  { id: "mxn", label: "MXN — Mexican Peso", symbol: "MX$", flag: "🇲🇽" },
  { id: "brl", label: "BRL — Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { id: "ars", label: "ARS — Argentine Peso", symbol: "AR$", flag: "🇦🇷" },
  { id: "clp", label: "CLP — Chilean Peso", symbol: "CL$", flag: "🇨🇱" },
  { id: "cop", label: "COP — Colombian Peso", symbol: "CO$", flag: "🇨🇴" },
  { id: "pen", label: "PEN — Peruvian Sol", symbol: "S/.", flag: "🇵🇪" },
  { id: "uyu", label: "UYU — Uruguayan Peso", symbol: "UY$", flag: "🇺🇾" },
  { id: "jmd", label: "JMD — Jamaican Dollar", symbol: "J$", flag: "🇯🇲" },
  // Europe
  { id: "sek", label: "SEK — Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { id: "nok", label: "NOK — Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  { id: "dkk", label: "DKK — Danish Krone", symbol: "kr", flag: "🇩🇰" },
  { id: "pln", label: "PLN — Polish Zloty", symbol: "zł", flag: "🇵🇱" },
  { id: "czk", label: "CZK — Czech Koruna", symbol: "Kč", flag: "🇨🇿" },
  { id: "huf", label: "HUF — Hungarian Forint", symbol: "Ft", flag: "🇭🇺" },
  { id: "ron", label: "RON — Romanian Leu", symbol: "lei", flag: "🇷🇴" },
  { id: "bgn", label: "BGN — Bulgarian Lev", symbol: "лв", flag: "🇧🇬" },
  { id: "hrk", label: "HRK — Croatian Kuna", symbol: "kn", flag: "🇭🇷" },
  { id: "rsd", label: "RSD — Serbian Dinar", symbol: "din", flag: "🇷🇸" },
  { id: "try", label: "TRY — Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { id: "rub", label: "RUB — Russian Ruble", symbol: "₽", flag: "🇷🇺" },
  { id: "uah", label: "UAH — Ukrainian Hryvnia", symbol: "₴", flag: "🇺🇦" },
  { id: "isk", label: "ISK — Icelandic Króna", symbol: "kr", flag: "🇮🇸" },
  // Middle East & Africa
  { id: "aed", label: "AED — UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { id: "sar", label: "SAR — Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
  { id: "qar", label: "QAR — Qatari Riyal", symbol: "﷼", flag: "🇶🇦" },
  { id: "kwd", label: "KWD — Kuwaiti Dinar", symbol: "د.ك", flag: "🇰🇼" },
  { id: "bhd", label: "BHD — Bahraini Dinar", symbol: "BD", flag: "🇧🇭" },
  { id: "omr", label: "OMR — Omani Rial", symbol: "﷼", flag: "🇴🇲" },
  { id: "jod", label: "JOD — Jordanian Dinar", symbol: "JD", flag: "🇯🇴" },
  { id: "ils", label: "ILS — Israeli Shekel", symbol: "₪", flag: "🇮🇱" },
  { id: "egp", label: "EGP — Egyptian Pound", symbol: "E£", flag: "🇪🇬" },
  { id: "zar", label: "ZAR — South African Rand", symbol: "R", flag: "🇿🇦" },
  { id: "ngn", label: "NGN — Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { id: "kes", label: "KES — Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  { id: "ghs", label: "GHS — Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭" },
  { id: "mad", label: "MAD — Moroccan Dirham", symbol: "MAD", flag: "🇲🇦" },
  { id: "tnd", label: "TND — Tunisian Dinar", symbol: "DT", flag: "🇹🇳" },
  // Central Asia
  { id: "kzt", label: "KZT — Kazakhstani Tenge", symbol: "₸", flag: "🇰🇿" },
  { id: "gel", label: "GEL — Georgian Lari", symbol: "₾", flag: "🇬🇪" },
];

// Country → Currency mapping (used to auto-select currency from partner group)
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "USA": "usd", "United States": "usd",
  "UK": "gbp", "United Kingdom": "gbp",
  "Germany": "eur", "France": "eur", "Italy": "eur", "Spain": "eur", "Netherlands": "eur",
  "Belgium": "eur", "Austria": "eur", "Ireland": "eur", "Portugal": "eur", "Greece": "eur",
  "Finland": "eur", "Estonia": "eur", "Malta": "eur", "Cyprus": "eur",
  "Japan": "jpy",
  "Switzerland": "chf",
  "Canada": "cad",
  "Australia": "aud",
  "China": "cny",
  "India": "inr",
  "South Korea": "krw",
  "Singapore": "sgd",
  "Taiwan": "twd",
  "Thailand": "thb",
  "Malaysia": "myr",
  "Indonesia": "idr",
  "Philippines": "php",
  "Vietnam": "vnd",
  "New Zealand": "nzd",
  "Pakistan": "pkr",
  "Bangladesh": "bdt",
  "Sri Lanka": "lkr",
  "Myanmar": "mmk",
  "Cambodia": "khr",
  "Laos": "lak",
  "Fiji": "fjd",
  "Papua New Guinea": "pgk",
  "Mexico": "mxn",
  "Brazil": "brl",
  "Argentina": "ars",
  "Chile": "clp",
  "Colombia": "cop",
  "Peru": "pen",
  "Uruguay": "uyu",
  "Jamaica": "jmd",
  "Sweden": "sek",
  "Norway": "nok",
  "Denmark": "dkk",
  "Poland": "pln",
  "Czech Republic": "czk",
  "Hungary": "huf",
  "Romania": "ron",
  "Bulgaria": "bgn",
  "Croatia": "hrk",
  "Serbia": "rsd",
  "Turkey": "try",
  "Russia": "rub",
  "Ukraine": "uah",
  "Iceland": "isk",
  "UAE": "aed",
  "Saudi Arabia": "sar",
  "Qatar": "qar",
  "Kuwait": "kwd",
  "Bahrain": "bhd",
  "Oman": "omr",
  "Jordan": "jod",
  "Israel": "ils",
  "Egypt": "egp",
  "South Africa": "zar",
  "Nigeria": "ngn",
  "Kenya": "kes",
  "Ghana": "ghs",
  "Morocco": "mad",
  "Tunisia": "tnd",
  "Kazakhstan": "kzt",
  "Georgia": "gel",
  "Venezuela": "usd",
};

// ── Payment Method Types ──
export type PaymentMethodType = "ach" | "wire" | "card" | "digital_wallet" | "check" | "cash" | "other";

export type PaymentTypeCategory = "Bank" | "Card" | "Digital" | "Traditional" | "Other";

export const PAYMENT_TYPE_CARDS: { id: PaymentMethodType; label: string; description: string; icon: React.ElementType; category: PaymentTypeCategory }[] = [
  { id: "ach", label: "ACH / Direct Deposit", description: "Electronic bank transfer through the ACH network. Common for US-based vendors.", icon: CircleDollarSign, category: "Bank" },
  { id: "wire", label: "Wire Transfer", description: "Direct bank-to-bank transfer. Suitable for domestic or international payments where ACH is not available.", icon: Landmark, category: "Bank" },
  { id: "card", label: "Credit / Debit Card", description: "Card payment via Visa, Mastercard, Amex, or other card networks.", icon: CreditCard, category: "Card" },
  { id: "digital_wallet", label: "Digital Wallet", description: "Payment through platforms such as PayPal, Venmo, Stripe, Apple Pay, or Google Pay.", icon: Wallet, category: "Digital" },
  { id: "check", label: "Check (Paper)", description: "Physical paper check sent by mail. Used when electronic payment is not accepted.", icon: Receipt, category: "Traditional" },
  { id: "cash", label: "Cash", description: "Physical cash payment collected at a designated collection point.", icon: Banknote, category: "Traditional" },
  { id: "other", label: "Other (Record Only)", description: "A custom payment method for record-keeping only. No transaction is processed through the system.", icon: FileText, category: "Other" },
];

// ── Payment Terms Presets ──
export type PaymentTermCategory = "all" | "net" | "prepayment" | "split";

export interface PaymentTermPreset {
  id: string;
  name: string;
  category: PaymentTermCategory;
  typeBadge: string;
  badgeColor: string;
  trigger: string;
  description: string;
  vendorsApplied: number;
  duration?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  discountMode?: "percent" | "fixed";
  discountPeriod?: string;
}

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  { id: "pt-1", name: "Net 10", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Invoice Date", description: "Payment is due 10 days after the invoice date.", vendorsApplied: 4, duration: "10" },
  { id: "pt-2", name: "Net 15", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Invoice Date", description: "Payment is due 15 days after the invoice date.", vendorsApplied: 6, duration: "15" },
  { id: "pt-3", name: "Net 20", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Invoice Date", description: "Payment is due 20 days after the invoice date.", vendorsApplied: 3, duration: "20" },
  { id: "pt-4", name: "Net 30 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Shipping", description: "Full payment is due 30 days after the goods are shipped.", vendorsApplied: 5, duration: "30" },
  { id: "pt-5", name: "Net 45 Post Delivery", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Delivery", description: "Payment is due 45 days after goods are delivered.", vendorsApplied: 2, duration: "45" },
  { id: "pt-6", name: "Net 60 Post Production End", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Production End", description: "Payment is due 60 days after production is completed.", vendorsApplied: 3, duration: "60" },
  { id: "pt-7", name: "Full Advance Payment: Order Confirmation", category: "prepayment", typeBadge: "Pre", badgeColor: "#7C3AED", trigger: "Order Confirmation", description: "100% of the total amount is paid when the order is confirmed.", vendorsApplied: 4 },
  { id: "pt-8", name: "Full Advance Payment: Production Begins", category: "prepayment", typeBadge: "Pre", badgeColor: "#7C3AED", trigger: "Production Start", description: "A (X)% prepayment is required when production begins.", vendorsApplied: 2 },
  { id: "pt-9", name: "30/70 Split: Production Start & Delivery", category: "split", typeBadge: "Split", badgeColor: "#D97706", trigger: "Production Start", description: "30% is due at production start, 70% on delivery.", vendorsApplied: 5 },
  { id: "pt-10", name: "Order Confirmation & Delivery", category: "split", typeBadge: "Split", badgeColor: "#D97706", trigger: "Order Confirmation", description: "50% due at order confirmation, 50% on delivery.", vendorsApplied: 3 },
  { id: "pt-11", name: "Production & Shipping Payment", category: "split", typeBadge: "Split", badgeColor: "#D97706", trigger: "Production Start", description: "40% at production start, 60% on shipping.", vendorsApplied: 2 },
  { id: "pt-12", name: "2/10 Net 30", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Invoice Date", description: "2% discount if paid in 10 days, otherwise net 30.", vendorsApplied: 7, duration: "30", applyDiscount: true, discountPercent: "2", discountPeriod: "10" },
  // Custom payment terms (created by users)
  { id: "pt-custom-1", name: "Net 25 Post QC Approval", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "QC Approval", description: "Payment is due 25 days after quality control approval is granted.", vendorsApplied: 3, duration: "25" },
  { id: "pt-custom-2", name: "Advance: Before Material Procurement", category: "prepayment", typeBadge: "Pre", badgeColor: "#7C3AED", trigger: "Material Procurement", description: "Full prepayment required before raw materials are procured.", vendorsApplied: 1 },
  { id: "pt-custom-3", name: "40/60 Split: QC & Final Delivery", category: "split", typeBadge: "Split", badgeColor: "#D97706", trigger: "QC Approval", description: "40% due at QC approval, 60% upon final delivery.", vendorsApplied: 2 },
  { id: "pt-custom-4", name: "Net 90 Extended", category: "net", typeBadge: "NET", badgeColor: "#0A77FF", trigger: "Invoice Date", description: "Extended 90-day payment window for high-volume partners.", vendorsApplied: 4, duration: "90" },
  { id: "pt-custom-5", name: "20/30/50 Milestone Split", category: "split", typeBadge: "Split", badgeColor: "#D97706", trigger: "Order Confirmation", description: "20% at order, 30% at production midpoint, 50% on delivery.", vendorsApplied: 1 },
];

export const PAYMENT_TERM_SIDEBAR: { label: string; id: string; isHeader?: boolean }[] = [
  { label: "Recently used", id: "recent" },
  { label: "Predefined Templates", id: "_header_predefined", isHeader: true },
  { label: "All Terms", id: "all" },
  { label: "NET Terms", id: "net" },
  { label: "Prepayment Terms", id: "prepayment" },
  { label: "Split Terms", id: "split" },
  { label: "Made by FR Conversions", id: "_header_made", isHeader: true },
  { label: "In Use", id: "vendors_applied" },
  { label: "Created by me", id: "created_by_me" },
  { label: "Created by others", id: "created_by_others" },
];

export const CREATE_PT_TYPES = [
  { id: "net", label: "NET Terms (After X Days of a Certain Event)" },
  { id: "prepayment", label: "Prepayment Terms (Before or After Confirm the Order)" },
  { id: "split", label: "Split Terms" },
] as const;

export const CREATE_PT_TRIGGERS = [
  { id: "order_confirmation", label: "Order Confirmation" },
  { id: "production_start", label: "Production Start" },
  { id: "production_end", label: "Production End" },
  { id: "shipping", label: "Shipping" },
  { id: "delivery", label: "Delivery" },
];

export const CREATE_PT_DURATIONS = [
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "60", label: "60 days" },
  { id: "90", label: "90 days" },
  { id: "180", label: "180 days" },
  { id: "365", label: "365 days" },
  { id: "custom", label: "Custom" },
];

export const CREATE_PT_DISCOUNT_PERIODS = [
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "10", label: "10 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "60", label: "60 days" },
  { id: "custom", label: "Custom" },
];

// ── Pricing Rule Presets ──
export type PricingRuleCategory = "all" | "discount" | "premium";
export type PricingRuleBasis = "value" | "volume";

export interface PricingRuleTier {
  minValue: string;
  maxValue: string;
  discount: string;
}

export interface PricingRulePreset {
  id: string;
  name: string;
  category: PricingRuleCategory;
  basis: PricingRuleBasis;
  tierType: "single" | "multiple";
  totalTiers: number;
  description: string;
  tiers: PricingRuleTier[];
  vendorsApplied: number;
  aboutText?: string;
}

export const PRICING_RULE_PRESETS: PricingRulePreset[] = [
  // ── PRESET DISCOUNTS ──
  {
    id: "pr-1", name: "Standard Discount – Value (Single-Tier)", category: "discount", basis: "value", tierType: "single", totalTiers: 1,
    description: "10% off on orders over $1,000",
    tiers: [{ minValue: "$1,000", maxValue: "$32,000", discount: "10%" }],
    vendorsApplied: 5,
    aboutText: "The Standard Discount – Value (Single-Tier) pricing rule is a straightforward, commonly used model in ERP systems where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold.",
  },
  {
    id: "pr-2", name: "Standard Discount – Volume (Single-Tier)", category: "discount", basis: "volume", tierType: "single", totalTiers: 1,
    description: "15% off on orders of 100+ units",
    tiers: [{ minValue: "100 EA", maxValue: "300 EA", discount: "15%" }],
    vendorsApplied: 3,
    aboutText: "A volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold.",
  },
  {
    id: "pr-3", name: "Tiered Discount – Value (Multi-Tier)", category: "discount", basis: "value", tierType: "multiple", totalTiers: 4,
    description: "5% off over $500, 10% over $2K, 15% over $5K, 20% over $15K",
    tiers: [
      { minValue: "$500", maxValue: "$1,999", discount: "5%" },
      { minValue: "$2,000", maxValue: "$4,999", discount: "10%" },
      { minValue: "$5,000", maxValue: "$14,999", discount: "15%" },
      { minValue: "$15,000", maxValue: "$50,000", discount: "20%" },
    ],
    vendorsApplied: 4,
    aboutText: "A multi-tier value-based discount model where different discount percentages are applied at various purchase value thresholds. Encourages larger order values with increasing savings.",
  },
  {
    id: "pr-4", name: "Tiered Discount – Volume (Multi-Tier)", category: "discount", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "5% off 50+ units, 10% over 200, 18% over 500",
    tiers: [
      { minValue: "50 EA", maxValue: "199 EA", discount: "5%" },
      { minValue: "200 EA", maxValue: "499 EA", discount: "10%" },
      { minValue: "500 EA", maxValue: "1,000 EA", discount: "18%" },
    ],
    vendorsApplied: 2,
    aboutText: "A multi-tier volume-based discount model offering increasing discounts at higher quantity breakpoints. Perfect for incentivizing large batch orders.",
  },
  // ── PRESET PREMIUMS ──
  {
    id: "pr-5", name: "Standard Premium – Value (Single-Tier)", category: "premium", basis: "value", tierType: "single", totalTiers: 1,
    description: "30% surcharge on exclusive orders over $200",
    tiers: [{ minValue: "$200", maxValue: "$12,000", discount: "30%" }],
    vendorsApplied: 3,
    aboutText: "A value-based premium surcharge applied to exclusive product lines and VIP offerings. Automate pricing increases to enhance exclusivity and maximize profitability.",
  },
  {
    id: "pr-6", name: "Standard Premium – Volume (Single-Tier)", category: "premium", basis: "volume", tierType: "single", totalTiers: 1,
    description: "16% markup for orders of 10–400 units",
    tiers: [{ minValue: "10 EA", maxValue: "400 EA", discount: "16%" }],
    vendorsApplied: 2,
    aboutText: "A volume-based premium surcharge applied to small-to-medium order quantities. Ensures profitability on orders that don't qualify for bulk pricing.",
  },
  {
    id: "pr-7", name: "Tiered Premium – Value (Multi-Tier)", category: "premium", basis: "value", tierType: "multiple", totalTiers: 3,
    description: "22% under $200, 15% under $500, 8% under $1.5K",
    tiers: [
      { minValue: "$100", maxValue: "$199", discount: "22%" },
      { minValue: "$200", maxValue: "$499", discount: "15%" },
      { minValue: "$500", maxValue: "$1,500", discount: "8%" },
    ],
    vendorsApplied: 1,
    aboutText: "A multi-tier value-based premium model where different surcharges are applied at decreasing purchase value thresholds. Protects margins on smaller deals.",
  },
  {
    id: "pr-8", name: "Tiered Premium – Volume (Multi-Tier)", category: "premium", basis: "volume", tierType: "multiple", totalTiers: 4,
    description: "25% for <25 units, 15% for <50, 8% for <100, 3% for <250",
    tiers: [
      { minValue: "1 EA", maxValue: "24 EA", discount: "25%" },
      { minValue: "25 EA", maxValue: "49 EA", discount: "15%" },
      { minValue: "50 EA", maxValue: "99 EA", discount: "8%" },
      { minValue: "100 EA", maxValue: "250 EA", discount: "3%" },
    ],
    vendorsApplied: 1,
    aboutText: "A multi-tier volume-based premium model where surcharges are applied at lower order quantity brackets. Encourages customers to order in larger quantities.",
  },
  // ── CUSTOM DISCOUNTS ──
  {
    id: "pr-custom-1", name: "Q2 Loyalty Value Discount", category: "discount", basis: "value", tierType: "single", totalTiers: 1,
    description: "12% off on orders over $2,500 for loyal partners",
    tiers: [{ minValue: "$2,500", maxValue: "$45,000", discount: "12%" }],
    vendorsApplied: 6,
    aboutText: "A custom single-tier value-based discount created for Q2 2025 to reward long-standing partners who consistently place high-value orders.",
  },
  {
    id: "pr-custom-2", name: "Bulk Fastener Discount", category: "discount", basis: "volume", tierType: "single", totalTiers: 1,
    description: "20% off on fastener orders of 250+ units",
    tiers: [{ minValue: "250 EA", maxValue: "2,000 EA", discount: "20%" }],
    vendorsApplied: 9,
    aboutText: "Custom volume discount targeting fastener and hardware categories. Applied automatically when order quantity exceeds the minimum threshold for eligible SKUs.",
  },
  {
    id: "pr-custom-3", name: "Annual Value-Based Savings Plan", category: "discount", basis: "value", tierType: "multiple", totalTiers: 3,
    description: "Progressive savings: 3% at $750, 8% at $3K, 14% at $10K",
    tiers: [
      { minValue: "$750", maxValue: "$2,999", discount: "3%" },
      { minValue: "$3,000", maxValue: "$9,999", discount: "8%" },
      { minValue: "$10,000", maxValue: "$25,000", discount: "14%" },
    ],
    vendorsApplied: 12,
    aboutText: "A comprehensive multi-tier value-based savings program designed for annual contracts. Each tier offers increasing discounts to incentivize higher purchase commitments.",
  },
  {
    id: "pr-custom-4", name: "Seasonal Volume Boost", category: "discount", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "7% at 75+ units, 12% at 300+, 22% at 1K+",
    tiers: [
      { minValue: "75 EA", maxValue: "299 EA", discount: "7%" },
      { minValue: "300 EA", maxValue: "999 EA", discount: "12%" },
      { minValue: "1,000 EA", maxValue: "5,000 EA", discount: "22%" },
    ],
    vendorsApplied: 4,
    aboutText: "Custom seasonal multi-tier volume discount to incentivize bulk ordering during peak periods.",
  },
  // ── CUSTOM PREMIUMS ──
  {
    id: "pr-custom-5", name: "Rush Order Premium", category: "premium", basis: "value", tierType: "single", totalTiers: 1,
    description: "18% surcharge on rush orders under $5,000",
    tiers: [{ minValue: "$100", maxValue: "$5,000", discount: "18%" }],
    vendorsApplied: 7,
    aboutText: "A custom premium surcharge applied to rush and expedited orders to cover additional processing and logistics costs.",
  },
  {
    id: "pr-custom-6", name: "Small Batch Handling Fee", category: "premium", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "30% for <10 units, 15% for <50, 5% for <150",
    tiers: [
      { minValue: "1 EA", maxValue: "9 EA", discount: "30%" },
      { minValue: "10 EA", maxValue: "49 EA", discount: "15%" },
      { minValue: "50 EA", maxValue: "149 EA", discount: "5%" },
    ],
    vendorsApplied: 3,
    aboutText: "Custom multi-tier premium for small batch orders that require disproportionate handling and setup costs.",
  },
];

export const PRICING_RULE_SIDEBAR: { label: string; id: string; isHeader?: boolean }[] = [
  { label: "Recently used", id: "recent" },
  { label: "Favourites", id: "favourites" },
  { label: "Predefined Templates", id: "_header_predefined", isHeader: true },
  { label: "All rules", id: "all" },
  { label: "Discounts", id: "discount" },
  { label: "Premium", id: "premium" },
  { label: "Made by FR Conversions", id: "_header_made", isHeader: true },
  { label: "In Use", id: "vendors_applied" },
  { label: "Created by me", id: "created_by_me" },
  { label: "Created by others", id: "created_by_others" },
];

// ── Payment Method Entry ──
export interface PaymentMethodEntry {
  id: string;
  type: PaymentMethodType;
  expanded: boolean;
  isSaved: boolean;
  isPrimary: boolean;
  nickname: string;
  // Bank fields (ACH / Wire)
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  accountType: string; // "checking" | "savings" | "money_market" | "cd" | "loan"
  // Card fields
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  billingAddress: string;
  // Digital wallet
  walletProvider: string;
  walletId: string;
  // Check
  payeeName: string;
  mailingAddress: string;
  // Cash
  recipientName: string;
  collectionPoint: string;
  // Other (record only)
  methodName: string;
  description: string;
  documentLink: string;
  // Common
  phone: string;
  countryCode: string;
  specialInstructions: string;
  applyDiscount: boolean;
  discountPercent: string;
  discountMode: "percent" | "fixed"; // % or $
  additionalCharges: string;
  additionalChargesMode: "percent" | "fixed"; // % or $
}

// ── Contact Dictionary (Point of Contact) ──
export interface ContactPhone {
  id: string;
  type: "Office" | "Mobile" | "Landline" | "Fax" | "Other";
  code: string; // e.g. "+1"
  number: string;
  ext: string;
}

export interface ContactEmail {
  id: string;
  type: "Work" | "Personal" | "Secondary" | "Other";
  address: string;
}

export interface ContactSocial {
  id: string;
  type: "LinkedIn" | "Twitter / X" | "Website" | "Skype" | "WhatsApp" | "Other";
  url: string;
}

export interface ContactPerson {
  id: string;
  name: string;
  company: string;
  department: string;
  phone: string;
  phoneExt: string;
  secondaryPhone: string;
  secondaryPhoneExt: string;
  email: string;
  avatarColor: string;
  // New fields
  role?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  socials?: ContactSocial[];
  departments?: string[];
  companies?: string[];
  profileImage?: string;
}

export const CONTACT_DICTIONARY: ContactPerson[] = [
  { id: "C-001", name: "Issac Archer", company: "Service-Provider", department: "Sales", phone: "(419) 548-1532", phoneExt: "", secondaryPhone: "(523) 314-3233", secondaryPhoneExt: "123", email: "issacarcher@toyota.technical.com", avatarColor: "#0A77FF" },
  { id: "C-002", name: "Braelyn Lowe", company: "Administrative and Support", department: "Supply Chain Management", phone: "(390) 412-9029", phoneExt: "", secondaryPhone: "(928) 630-9272", secondaryPhoneExt: "789", email: "braelynlowe@toyota.technical.com", avatarColor: "#7C3AED" },
  { id: "C-003", name: "Leah Wilkins", company: "Gasoline Stations", department: "Finance", phone: "(404) 296-5888", phoneExt: "", secondaryPhone: "(326) 419-3996", secondaryPhoneExt: "456", email: "leahwilkins@toyota.technical.com", avatarColor: "#0A77FF" },
  { id: "C-004", name: "Jamya House", company: "Furniture and Furnishings", department: "Sales", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(537) 547-6401", secondaryPhoneExt: "3515", email: "mrdvt@hotmail.com", avatarColor: "#059669" },
  { id: "C-005", name: "Peyton Ellison", company: "Manufacturing", department: "Supply Chain Management", phone: "(578) 277-4989", phoneExt: "", secondaryPhone: "(704) 443-1841", secondaryPhoneExt: "3515", email: "bester@me.com", avatarColor: "#D97706" },
  { id: "C-006", name: "Jimena Morrow", company: "Real Estate", department: "Finance", phone: "(472) 605-8134", phoneExt: "", secondaryPhone: "(710) 263-0555", secondaryPhoneExt: "3515", email: "carreras@gmail.com", avatarColor: "#7C3AED" },
  { id: "C-007", name: "Jackson Mahoney", company: "Health Services", department: "Supply Chain Management", phone: "(678) 333-6085", phoneExt: "", secondaryPhone: "(858) 577-3477", secondaryPhoneExt: "3515", email: "salesgeek@hotmail.com", avatarColor: "#0A77FF" },
  { id: "C-008", name: "Kelvin Levy", company: "Health and Personal Care", department: "Sales", phone: "(632) 362-5257", phoneExt: "", secondaryPhone: "(309) 645-6861", secondaryPhoneExt: "3515", email: "sopwith@msn.com", avatarColor: "#059669" },
  { id: "C-009", name: "Jesse Donovan", company: "Gasoline Stations", department: "Finance", phone: "(858) 577-3477", phoneExt: "", secondaryPhone: "(566) 237-4687", secondaryPhoneExt: "3515", email: "lstaf@me.com", avatarColor: "#D97706" },
  { id: "C-010", name: "Sonia Bean", company: "Health Services", department: "Supply Chain Management", phone: "(372) 588-9852", phoneExt: "", secondaryPhone: "(896) 675-9493", secondaryPhoneExt: "3515", email: "mrdvt@icloud.com", avatarColor: "#7C3AED" },
  { id: "C-011", name: "Angie Webb", company: "Nonmetallic Mineral Product...", department: "Sales", phone: "(590) 887-7526", phoneExt: "", secondaryPhone: "(377) 289-4752", secondaryPhoneExt: "3515", email: "cparis@optonline.net", avatarColor: "#0A77FF" },
  { id: "C-012", name: "Jay Massey", company: "Couriers and Messengers", department: "Finance", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(751) 496-6500", secondaryPhoneExt: "3515", email: "bryam@me.com", avatarColor: "#059669" },
  { id: "C-013", name: "Issac Archer", company: "Service-Providing Industries", department: "Sales", phone: "(419) 548-1532", phoneExt: "", secondaryPhone: "(523) 314-3233", secondaryPhoneExt: "3515", email: "philb@outlook.com", avatarColor: "#0A77FF" },
  { id: "C-014", name: "Braelyn Lowe", company: "Administrative and Support", department: "Supply Chain Management", phone: "(390) 412-9029", phoneExt: "", secondaryPhone: "(928) 630-9272", secondaryPhoneExt: "3515", email: "hwestiii@aol.com", avatarColor: "#7C3AED" },
  { id: "C-015", name: "Leah Wilkins", company: "Gasoline Stations", department: "Finance", phone: "(404) 296-5888", phoneExt: "", secondaryPhone: "(326) 419-3996", secondaryPhoneExt: "3515", email: "aardo@yahoo.com", avatarColor: "#0A77FF" },
  { id: "C-016", name: "Jamya House", company: "Furniture and Furnishings", department: "Sales", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(537) 547-6401", secondaryPhoneExt: "3515", email: "mrdvt@hotmail.com", avatarColor: "#059669" },
  { id: "C-017", name: "Peyton Ellison", company: "Manufacturing", department: "Supply Chain Management", phone: "(578) 277-4989", phoneExt: "", secondaryPhone: "(704) 443-1841", secondaryPhoneExt: "3515", email: "bester@me.com", avatarColor: "#D97706" },
  { id: "C-018", name: "Jimena Morrow", company: "Real Estate", department: "Finance", phone: "(472) 605-8134", phoneExt: "", secondaryPhone: "(710) 263-0555", secondaryPhoneExt: "3515", email: "carreras@gmail.com", avatarColor: "#7C3AED" },
  { id: "C-019", name: "Jackson Mahoney", company: "Health Services", department: "Supply Chain Management", phone: "(678) 333-6085", phoneExt: "", secondaryPhone: "(858) 577-3477", secondaryPhoneExt: "3515", email: "salesgeek@hotmail.com", avatarColor: "#0A77FF" },
  { id: "C-020", name: "Kelvin Levy", company: "Health and Personal Care", department: "Sales", phone: "(632) 362-5257", phoneExt: "", secondaryPhone: "(309) 645-6861", secondaryPhoneExt: "3515", email: "sopwith@msn.com", avatarColor: "#059669" },
  { id: "C-021", name: "Marcus Chen", company: "Technology Services", department: "Supply Chain Management", phone: "(415) 882-3344", phoneExt: "", secondaryPhone: "(415) 882-3345", secondaryPhoneExt: "200", email: "mchen@techsvc.com", avatarColor: "#7C3AED" },
  { id: "C-022", name: "Diana Ross", company: "Logistics Corp", department: "Finance", phone: "(312) 555-0198", phoneExt: "", secondaryPhone: "(312) 555-0199", secondaryPhoneExt: "1010", email: "dross@logicorp.com", avatarColor: "#D97706" },
  { id: "C-023", name: "Tyler Brooks", company: "Construction Materials", department: "Sales", phone: "(602) 444-7788", phoneExt: "", secondaryPhone: "(602) 444-7789", secondaryPhoneExt: "500", email: "tbrooks@constmat.com", avatarColor: "#059669" },
  { id: "C-024", name: "Sofia Martinez", company: "Electronics Distribution", department: "Supply Chain Management", phone: "(713) 999-2211", phoneExt: "", secondaryPhone: "(713) 999-2212", secondaryPhoneExt: "3515", email: "smartinez@elecdist.com", avatarColor: "#0A77FF" },
];

// ── Helper: deterministic hash from string ──
function _contactHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

// ── Pools for generated contact fields ──
const _ROLE_POOL = ["Procurement Manager", "Sales Director", "Account Executive", "Logistics Coordinator", "Operations Manager", "VP of Partnerships", "Supply Chain Lead", "Business Development", "Finance Controller", "Quality Inspector", "Project Manager", "Technical Lead"];
const _PHONE_TYPES: ContactPhone["type"][] = ["Office", "Mobile", "Landline"];
const _PHONE_CODES = ["+1", "+44", "+91", "+49"];
const _EMAIL_TYPES: ContactEmail["type"][] = ["Work", "Personal"];
const _SOCIAL_TYPES: ContactSocial["type"][] = ["LinkedIn", "Twitter / X", "Website"];
const _ALL_DEPTS_GEN = ["Sales", "Supply Chain Management", "Finance", "Operations", "Procurement", "Logistics"];
const _ALL_COMPANIES_GEN = ["Toyota International", "Ford Motor Company", "Tesla, Inc.", "General Motors (GM)", "BMW Group", "Honda Motor Co.", "Rivian Automotive", "Lucid Motors", "Volvo Cars", "Hyundai Motor", "Nissan Motor", "Stellantis NV"];

function _enrichContactFields(c: ContactPerson): void {
  const h = _contactHash(c.id);

  // Role
  c.role = _ROLE_POOL[h % _ROLE_POOL.length];

  // Phones: 1-3 rows. First matches existing phone field for backward compat.
  const phoneCount = 1 + (h % 3);
  const phones: ContactPhone[] = [];
  // First phone from existing field
  phones.push({ id: `${c.id}-ph-0`, type: "Office", code: "+1", number: c.phone, ext: c.phoneExt || "" });
  for (let p = 1; p < phoneCount; p++) {
    const ph2 = (h + p * 37) % 10000;
    phones.push({
      id: `${c.id}-ph-${p}`,
      type: _PHONE_TYPES[(h + p) % _PHONE_TYPES.length],
      code: _PHONE_CODES[(h + p * 3) % _PHONE_CODES.length],
      number: `(${300 + (ph2 % 700)}) ${100 + (ph2 % 900)}-${1000 + (ph2 % 9000)}`,
      ext: p % 3 === 0 ? String(100 + (ph2 % 900)) : "",
    });
  }
  c.phones = phones;

  // Emails: 1-2 rows. First matches existing email field.
  const emailCount = 1 + (h % 2);
  const emails: ContactEmail[] = [];
  emails.push({ id: `${c.id}-em-0`, type: "Work", address: c.email });
  if (emailCount > 1) {
    const namePart = c.name.toLowerCase().replace(/\s+/g, ".");
    emails.push({ id: `${c.id}-em-1`, type: "Personal", address: `${namePart}@gmail.com` });
  }
  c.emails = emails;

  // Socials: 0-2 rows
  const socialCount = h % 3; // 0, 1, or 2
  const socials: ContactSocial[] = [];
  const namePart = c.name.toLowerCase().replace(/\s+/g, "");
  for (let s = 0; s < socialCount; s++) {
    const sType = _SOCIAL_TYPES[(h + s * 5) % _SOCIAL_TYPES.length];
    let url = "";
    if (sType === "LinkedIn") url = `https://linkedin.com/in/${namePart}`;
    else if (sType === "Twitter / X") url = `https://x.com/${namePart}`;
    else url = `https://${namePart}.com`;
    socials.push({ id: `${c.id}-so-${s}`, type: sType, url });
  }
  c.socials = socials;

  // Departments: 1-2
  const deptCount = 1 + (h % 2);
  const departments: string[] = [c.department];
  for (let d = 1; d < deptCount; d++) {
    const dept = _ALL_DEPTS_GEN[(h + d * 11) % _ALL_DEPTS_GEN.length];
    if (!departments.includes(dept)) departments.push(dept);
  }
  c.departments = departments;

  // Companies: 1-2
  const compCount = 1 + (h % 2);
  const companies: string[] = [c.company];
  for (let co = 1; co < compCount; co++) {
    const comp = _ALL_COMPANIES_GEN[(h + co * 13) % _ALL_COMPANIES_GEN.length];
    if (!companies.includes(comp)) companies.push(comp);
  }
  c.companies = companies;
}

// ── Generate 500 contacts total ──
(() => {
  const firstNames = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Quinn","Blake","Drew","Avery","Cameron","Dakota","Emery","Finley","Harper","Jamie","Kai","Logan","Micah","Noel","Parker","Reese","Sage","Skyler","Toby","Val","Wren","Ash","Bay","Cleo","Darcy","Ellis","Frankie","Gray","Haven","Indie","Jules","Kit","Lane","Marley","Nico","Oakley","Peyton","Remy","Sam","Tatum","Uri","Winter","Zara","Ari","Briar","Cruz","Devin","Eden","Flynn","Greer","Hollis","Ira","Joss","Kira","Lee","Milan","Nash","Onyx","Phoenix","Rae","Shea","True","Uma","Vega","West","Xen","Yael","Zion"];
  const lastNames = ["Anderson","Baker","Clark","Davis","Edwards","Foster","Garcia","Harris","Irving","Jones","Kim","Lewis","Miller","Nelson","Owens","Patel","Quinn","Roberts","Smith","Taylor","Upton","Vargas","Williams","Xiao","Young","Zhang","Abbott","Bennett","Coleman","Dixon","Evans","Fletcher","Grant","Hayes","Ingram","Jackson","Knight","Lambert","Morrison","Nash","Ortiz","Palmer","Reed","Stevens","Tucker","Underwood","Vincent","Walsh","York","Zimmer"];
  const companies = ["Acme Corp","TechVault","NexGen Solutions","Apex Industries","Summit Group","Vertex Labs","Pioneer Systems","Atlas Logistics","Beacon Analytics","Cascade Networks","Delta Manufacturing","Echo Enterprises","Falcon Dynamics","Granite Holdings","Horizon Partners","Ionic Solutions","Jade Innovations","Keystone Global","Lumen Corp","Metro Supply"];
  const depts = ["Sales", "Supply Chain Management", "Finance"];
  const colors = ["#0A77FF", "#7C3AED", "#059669", "#D97706"];
  const existing = CONTACT_DICTIONARY.length;
  for (let i = existing; i < 500; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const h = (i * 31 + 7) % 10000;
    CONTACT_DICTIONARY.push({
      id: `C-${String(i + 1).padStart(3, "0")}`,
      name: `${fn} ${ln}`,
      company: companies[i % companies.length],
      department: depts[i % depts.length],
      phone: `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`,
      phoneExt: i % 4 === 0 ? String(100 + (h % 900)) : "",
      secondaryPhone: i % 3 === 0 ? `(${400 + (h % 600)}) ${200 + (h % 800)}-${2000 + (h % 8000)}` : "",
      secondaryPhoneExt: i % 5 === 0 ? String(200 + (h % 800)) : "",
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${companies[i % companies.length].toLowerCase().replace(/\s+/g, "")}.com`,
      avatarColor: colors[i % colors.length],
    });
  }
  // Enrich all contacts with new fields
  CONTACT_DICTIONARY.forEach(_enrichContactFields);
})();

// ── System Users (all users in the system for notifications/alerts) ──
export type LicenseType = "Full Access" | "Field User" | "Read Only";
export type UserStatus = "Active" | "Disabled";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatarColor: string;
  licenseType: LicenseType;
  status: UserStatus;
}

export const SYSTEM_USERS: SystemUser[] = [
  { id: "U-001", name: "Sarah Johnson", email: "sjohnson@company.com", role: "Procurement Manager", department: "Procurement", avatarColor: "#0A77FF", licenseType: "Full Access", status: "Active" },
  { id: "U-002", name: "Michael Torres", email: "mtorres@company.com", role: "Finance Director", department: "Finance", avatarColor: "#7C3AED", licenseType: "Full Access", status: "Active" },
  { id: "U-003", name: "Emily Chen", email: "echen@company.com", role: "Supply Chain Lead", department: "Supply Chain", avatarColor: "#059669", licenseType: "Full Access", status: "Active" },
  { id: "U-004", name: "David Kim", email: "dkim@company.com", role: "Account Manager", department: "Sales", avatarColor: "#D97706", licenseType: "Full Access", status: "Active" },
  { id: "U-005", name: "Rachel Adams", email: "radams@company.com", role: "CFO", department: "Finance", avatarColor: "#DC2626", licenseType: "Full Access", status: "Active" },
  { id: "U-006", name: "James Wilson", email: "jwilson@company.com", role: "Buyer", department: "Procurement", avatarColor: "#0A77FF", licenseType: "Full Access", status: "Active" },
  { id: "U-007", name: "Lisa Park", email: "lpark@company.com", role: "Operations Manager", department: "Operations", avatarColor: "#7C3AED", licenseType: "Full Access", status: "Active" },
  { id: "U-008", name: "Robert Garcia", email: "rgarcia@company.com", role: "Warehouse Lead", department: "Logistics", avatarColor: "#059669", licenseType: "Field User", status: "Active" },
  { id: "U-009", name: "Amanda Foster", email: "afoster@company.com", role: "Compliance Officer", department: "Legal", avatarColor: "#D97706", licenseType: "Full Access", status: "Active" },
  { id: "U-010", name: "Kevin Wright", email: "kwright@company.com", role: "AP Specialist", department: "Finance", avatarColor: "#0A77FF", licenseType: "Full Access", status: "Disabled" },
  { id: "U-011", name: "Maria Rodriguez", email: "mrodriguez@company.com", role: "Category Manager", department: "Procurement", avatarColor: "#7C3AED", licenseType: "Full Access", status: "Active" },
  { id: "U-012", name: "Chris Taylor", email: "ctaylor@company.com", role: "IT Admin", department: "IT", avatarColor: "#059669", licenseType: "Full Access", status: "Active" },
  { id: "U-013", name: "Jessica Lee", email: "jlee@company.com", role: "VP Procurement", department: "Procurement", avatarColor: "#DC2626", licenseType: "Full Access", status: "Active" },
  { id: "U-014", name: "Andrew Scott", email: "ascott@company.com", role: "Inventory Analyst", department: "Supply Chain", avatarColor: "#D97706", licenseType: "Field User", status: "Active" },
  { id: "U-015", name: "Nicole Brown", email: "nbrown@company.com", role: "Controller", department: "Finance", avatarColor: "#0A77FF", licenseType: "Full Access", status: "Active" },
  { id: "U-016", name: "Thomas Miller", email: "tmiller@company.com", role: "Sourcing Specialist", department: "Procurement", avatarColor: "#7C3AED", licenseType: "Read Only", status: "Active" },
  { id: "U-017", name: "Stephanie White", email: "swhite@company.com", role: "Risk Analyst", department: "Finance", avatarColor: "#059669", licenseType: "Full Access", status: "Active" },
  { id: "U-018", name: "Daniel Harris", email: "dharris@company.com", role: "Logistics Coordinator", department: "Logistics", avatarColor: "#D97706", licenseType: "Field User", status: "Disabled" },
  { id: "U-019", name: "Karen Martinez", email: "kmartinez@company.com", role: "Quality Manager", department: "Operations", avatarColor: "#0A77FF", licenseType: "Full Access", status: "Active" },
  { id: "U-020", name: "Brian Clark", email: "bclark@company.com", role: "Accounts Payable Manager", department: "Finance", avatarColor: "#DC2626", licenseType: "Full Access", status: "Active" },
];

// ── System Roles (derived from users) ──
export interface SystemRole {
  id: string;
  name: string;
  description: string;
  department: string;
  userCount: number;
  color: string;
  licenseType: LicenseType;
  status: UserStatus;
  activeUsers: number;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Procurement Manager": "Manages vendor relationships, purchase orders, and procurement workflows.",
  "Finance Director": "Oversees financial operations, budgets, and fiscal strategy.",
  "Supply Chain Lead": "Coordinates supply chain logistics and vendor fulfillment.",
  "Account Manager": "Manages client accounts and commercial relationships.",
  "CFO": "Chief Financial Officer — executive financial oversight.",
  "Buyer": "Handles day-to-day purchasing and order placement.",
  "Operations Manager": "Manages operational processes and team productivity.",
  "Warehouse Lead": "Oversees warehouse operations, inventory, and shipping.",
  "Compliance Officer": "Ensures regulatory compliance and risk mitigation.",
  "AP Specialist": "Handles accounts payable processing and invoice management.",
  "Category Manager": "Manages product categories and vendor negotiations.",
  "IT Admin": "Administers system access, integrations, and IT infrastructure.",
  "VP Procurement": "Vice President of Procurement — strategic sourcing leadership.",
  "Inventory Analyst": "Analyzes inventory levels, forecasts, and stock optimization.",
  "Controller": "Oversees accounting operations and financial reporting.",
  "Sourcing Specialist": "Identifies and evaluates new vendor sources.",
  "Risk Analyst": "Assesses financial and operational risk exposure.",
  "Logistics Coordinator": "Coordinates shipping, freight, and delivery schedules.",
  "Quality Manager": "Manages quality assurance and inspection processes.",
  "Accounts Payable Manager": "Manages AP team and payment processing workflows.",
};

export const SYSTEM_ROLES: SystemRole[] = (() => {
  const roleMap = new Map<string, { department: string; count: number; color: string; licenseTypes: Set<LicenseType>; activeCount: number; hasDisabled: boolean }>();
  SYSTEM_USERS.forEach((u) => {
    const existing = roleMap.get(u.role);
    if (existing) {
      existing.count++;
      existing.licenseTypes.add(u.licenseType);
      if (u.status === "Active") existing.activeCount++;
      if (u.status === "Disabled") existing.hasDisabled = true;
    } else {
      roleMap.set(u.role, { department: u.department, count: 1, color: u.avatarColor, licenseTypes: new Set([u.licenseType]), activeCount: u.status === "Active" ? 1 : 0, hasDisabled: u.status === "Disabled" });
    }
  });
  return Array.from(roleMap.entries()).map(([name, data], i) => ({
    id: `R-${String(i + 1).padStart(3, "0")}`,
    name,
    description: ROLE_DESCRIPTIONS[name] || "",
    department: data.department,
    userCount: data.count,
    color: data.color,
    licenseType: data.licenseTypes.has("Full Access") ? "Full Access" : data.licenseTypes.has("Field User") ? "Field User" : "Read Only",
    status: (data.activeCount > 0 ? "Active" : "Disabled") as UserStatus,
    activeUsers: data.activeCount,
  }));
})();