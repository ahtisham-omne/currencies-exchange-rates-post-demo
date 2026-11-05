/**
 * Partner & location dataset used by Pay To / Ship To / Funded By
 * pickers on the PO Detail page.
 *
 * Mirrors the canonical list maintained in the Partners application so
 * the picker here renders the same searchable accordion the user
 * configured partners with — same names, same logos, same primary
 * marker. Keep this file in sync with `partnerConstants.tsx` in the
 * Partners app when the master list changes.
 */

export interface PartnerLocationItem {
  id: string;
  name: string;
  type: "partner" | "location";
  logoColor: string;
  logoText: string;
  logoUrl?: string;
  isDefault?: boolean;
  location?: string;
  /** Row title override (e.g. "Our Company"); `name` is still what gets stored. */
  displayName?: string;
}

/* Our own company (the tenant). Funded By defaults to it and can be
   overridden to any partner (ERP-4790 AC 4/6/13). Stored by name so the
   sidebar keeps resolving it through FUNDED_BY_VENDORS. */
export const OUR_COMPANY_ITEM: PartnerLocationItem = {
  id: "our-company",
  name: "Omne Manufacturing Corp.",
  displayName: "Our Company",
  type: "partner",
  logoColor: "#0A77FF",
  logoText: "OM",
  isDefault: true,
  location: "1000 Enterprise Way, Pasadena, OK",
};

const L = (domain: string) => `https://logo.clearbit.com/${domain}`;

export const PARTNER_LOCATION_ITEMS: PartnerLocationItem[] = [
  { id: "pl-7", name: "FR Conversions", type: "partner", logoColor: "#6B5CE7", logoText: "FR", logoUrl: L("frconversions.com"), isDefault: true, location: "8200 Turnpike Dr, Suite 200, Westminster, CO 80234, USA" },
  { id: "pl-3", name: "Toyota International", type: "partner", logoColor: "#374151", logoText: "T", logoUrl: L("toyota.com"), location: "6565 Headquarters Dr, Plano, TX 75024, USA" },
  { id: "pl-4", name: "Ford Motor Company USA", type: "partner", logoColor: "#1E40AF", logoText: "F", logoUrl: L("ford.com"), location: "1 American Rd, Dearborn, MI 48126, USA" },
  { id: "pl-5", name: "General Motors (GM)", type: "partner", logoColor: "#1D4ED8", logoText: "GM", logoUrl: L("gm.com"), location: "300 Renaissance Center, Detroit, MI 48265, USA" },
  { id: "pl-6", name: "Tesla, Inc.", type: "partner", logoColor: "hsl(var(--destructive))", logoText: "T", logoUrl: L("tesla.com"), location: "13101 Harold Green Rd, Austin, TX 78725, USA" },
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
  { id: "pl-57", name: "Tesla Fremont Factory", type: "location", logoColor: "hsl(var(--destructive))", logoText: "T", logoUrl: L("tesla.com"), location: "45500 Fremont Blvd, Fremont, CA 94538, USA" },
  { id: "pl-58", name: "Tesla Gigafactory Texas", type: "location", logoColor: "hsl(var(--destructive))", logoText: "T", logoUrl: L("tesla.com"), location: "13101 Harold Green Rd, Austin, TX 78725, USA" },
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
