import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExpandableTextarea } from "../components/vendors/ExpandableTextarea";
import { useVendors } from "../context/VendorContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Vendor,
  VendorCategory,
  VendorStatus,
  PaymentTerms,
  CATEGORY_LABELS,
  PAYMENT_TERMS_LABELS,
} from "../data/vendors";
import {
  ArrowLeft,
  Save,
  X,
  Building2,
  User,
  MapPin,
  DollarSign,
  Globe,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Users,
  Truck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { toAAAColor } from "../utils/colors";

type EditSection = "basic" | "contact" | "address" | "financial" | "config";

export function VendorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getVendor, updateVendor } = useVendors();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<EditSection>("basic");

  const vendor = getVendor(id!);

  if (!vendor) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Partner not found.</p>
        <Button variant="outline" onClick={() => navigate("/vendors")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Partners
        </Button>
      </div>
    );
  }

  const hasConfigData = !!vendor.configData;

  // Form state — initialized from vendor
  const [companyName, setCompanyName] = useState(vendor.companyName);
  const [displayName, setDisplayName] = useState(vendor.displayName);
  const [category, setCategory] = useState<VendorCategory>(vendor.category);
  const [status, setStatus] = useState<VendorStatus>(vendor.status);
  const [website, setWebsite] = useState(vendor.website);
  const [emailAddress, setEmailAddress] = useState(vendor.emailAddress);
  const [country, setCountry] = useState(vendor.country);
  const [services, setServices] = useState(vendor.services);
  const [vendorType, setVendorType] = useState(vendor.vendorType);
  const [notes, setNotes] = useState(vendor.notes);

  // Contact
  const [contactName, setContactName] = useState(vendor.primaryContact.name);
  const [contactEmail, setContactEmail] = useState(vendor.primaryContact.email);
  const [contactPhone, setContactPhone] = useState(vendor.primaryContact.phone);
  const [contactDesignation, setContactDesignation] = useState(vendor.primaryContact.designation);

  // Address
  const [street, setStreet] = useState(vendor.billingAddress.street);
  const [city, setCity] = useState(vendor.billingAddress.city);
  const [state, setState] = useState(vendor.billingAddress.state);
  const [zipCode, setZipCode] = useState(vendor.billingAddress.zipCode);
  const [addressCountry, setAddressCountry] = useState(vendor.billingAddress.country);

  // Financial
  const [taxId, setTaxId] = useState(vendor.taxId);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(vendor.paymentTerms);
  const [creditLimit, setCreditLimit] = useState(vendor.creditLimit);
  const [defaultCarrierVendor, setDefaultCarrierVendor] = useState(vendor.defaultCarrierVendor);
  const [defaultCarrierCustomer, setDefaultCarrierCustomer] = useState(vendor.defaultCarrierCustomer);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const SIDEBAR_ITEMS: { id: EditSection; label: string; icon: typeof Building2 }[] = [
    { id: "basic", label: "Basic information", icon: Building2 },
    { id: "contact", label: "Primary contact", icon: User },
    { id: "address", label: "Billing address", icon: MapPin },
    { id: "financial", label: "Financial details", icon: DollarSign },
    ...(hasConfigData ? [{ id: "config" as EditSection, label: "Configuration", icon: Tag }] : []),
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Company name is required";
    if (!displayName.trim()) e.displayName = "Display name is required";
    if (!contactName.trim()) e.contactName = "Contact name is required";
    if (!street.trim()) e.street = "Street is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      // Navigate to the section with the first error
      if (errors.companyName || errors.displayName) setActiveSection("basic");
      else if (errors.contactName) setActiveSection("contact");
      else if (errors.street) setActiveSection("address");
      return;
    }

    const updates: Partial<Vendor> = {
      companyName,
      displayName,
      category,
      status,
      website,
      emailAddress,
      country,
      services,
      vendorType,
      notes,
      primaryContact: {
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        designation: contactDesignation,
      },
      billingAddress: {
        street,
        city,
        state,
        zipCode,
        country: addressCountry,
      },
      taxId,
      paymentTerms,
      creditLimit,
      defaultCarrierVendor,
      defaultCarrierCustomer,
    };

    updateVendor(vendor.id, updates);
    toast.success(`Partner "${displayName}" updated successfully`);
    navigate(`/vendors/${vendor.id}`);
  };

  const renderFieldError = (key: string) => {
    if (!errors[key]) return null;
    return <p className="text-destructive text-xs mt-1">{errors[key]}</p>;
  };

  const cfg = vendor.configData;

  return (
    <div className="p-6 lg:p-8 overflow-y-auto flex-1 bg-[#F8FAFC]">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/vendors">Partners Management</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/vendors/${vendor.id}`}>
              {vendor.displayName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Edit Partner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update details for {vendor.displayName} ({vendor.code})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDiscardDialogOpen(true)}>
            <X className="w-4 h-4 mr-1.5" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Two-column layout: sidebar + form */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0 hidden lg:block">
          <nav className="space-y-1 sticky top-6">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeSection === item.id
                    ? "bg-[#EDF4FF] text-[#0A77FF]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                style={{ fontWeight: activeSection === item.id ? 500 : 400 }}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Form content */}
        <div className="flex-1 min-w-0 max-w-3xl">
          {activeSection === "basic" && (
            <Card className="p-6 gap-0">
              <h3 className="mb-1">Basic Information</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Company details and classification
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Company name *</Label>
                    <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5 bg-white" />
                    {renderFieldError("companyName")}
                  </div>
                  <div>
                    <Label htmlFor="displayName" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Display name *</Label>
                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5 bg-white" />
                    {renderFieldError("displayName")}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
                      <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[250]">
                        {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as VendorStatus)}>
                      <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[250]">
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="website" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Website</Label>
                    <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1.5 bg-white" placeholder="https://example.com" />
                  </div>
                  <div>
                    <Label htmlFor="emailAddress" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Email address</Label>
                    <Input id="emailAddress" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} className="mt-1.5 bg-white" placeholder="contact@company.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Country</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="vendorType" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Vendor type</Label>
                    <Input id="vendorType" value={vendorType} onChange={(e) => setVendorType(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="services" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Services</Label>
                  <Input id="services" value={services} onChange={(e) => setServices(e.target.value)} className="mt-1.5 bg-white" placeholder="e.g. Laser cutting" />
                </div>
                <ExpandableTextarea
                  label="Notes"
                  value={notes}
                  onChange={setNotes}
                  placeholder="Any additional notes..."
                />
              </div>
            </Card>
          )}

          {activeSection === "contact" && (
            <Card className="p-6 gap-0">
              <h3 className="mb-1">Primary Contact</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Main point of contact for this partner
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactName" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Full name *</Label>
                    <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1.5 bg-white" />
                    {renderFieldError("contactName")}
                  </div>
                  <div>
                    <Label htmlFor="contactDesignation" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Designation</Label>
                    <Input id="contactDesignation" value={contactDesignation} onChange={(e) => setContactDesignation(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Email</Label>
                    <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Phone</Label>
                    <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>

                {/* Show configured POCs (read-only) if available */}
                {cfg?.pointsOfContact && cfg.pointsOfContact.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-[13px] text-[#0F172A] mb-3" style={{ fontWeight: 600 }}>
                        Additional points of contact ({cfg.pointsOfContact.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cfg.pointsOfContact.map((poc) => {
                          const initials = poc.name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().substring(0, 2);
                          return (
                            <div key={poc.id} className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] px-3 py-2">
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                                style={{ backgroundColor: toAAAColor(poc.avatarColor), fontWeight: 600 }}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm truncate" style={{ fontWeight: 500 }}>{poc.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{poc.department}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Points of contact are managed through the partner creation modal.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {activeSection === "address" && (
            <Card className="p-6 gap-0">
              <h3 className="mb-1">Billing Address</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Partner's billing address information
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="street" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Street address *</Label>
                  <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="mt-1.5 bg-white" />
                  {renderFieldError("street")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="state" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>State</Label>
                    <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>ZIP code</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="addressCountry" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Country</Label>
                    <Input id="addressCountry" value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeSection === "financial" && (
            <Card className="p-6 gap-0">
              <h3 className="mb-1">Financial Details</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Payment terms, tax, and credit configuration
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="taxId" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Tax ID / EIN</Label>
                    <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="mt-1.5 bg-white" placeholder="XX-XXXXXXX" />
                  </div>
                  <div>
                    <Label className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Payment terms</Label>
                    <Select value={paymentTerms} onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}>
                      <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[250]">
                        {Object.entries(PAYMENT_TERMS_LABELS).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="creditLimit" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Credit limit ($)</Label>
                  <Input id="creditLimit" type="number" value={creditLimit || ""} onChange={(e) => setCreditLimit(Number(e.target.value))} className="mt-1.5 bg-white" placeholder="100000" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="defaultCarrierVendor" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Default carrier (vendor)</Label>
                    <Input id="defaultCarrierVendor" value={defaultCarrierVendor} onChange={(e) => setDefaultCarrierVendor(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="defaultCarrierCustomer" className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>Default carrier (customer)</Label>
                    <Input id="defaultCarrierCustomer" value={defaultCarrierCustomer} onChange={(e) => setDefaultCarrierCustomer(e.target.value)} className="mt-1.5 bg-white" />
                  </div>
                </div>

                {/* Show applied payment term & pricing rules (read-only) */}
                {cfg?.paymentTermConfig && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <p className="text-[13px] text-[#0F172A] mb-2" style={{ fontWeight: 600 }}>Applied payment term</p>
                      <div className="rounded-lg border border-[#E2E8F0] p-3 flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-white"
                          style={{ fontWeight: 600, backgroundColor: cfg.paymentTermConfig.type === "NET" ? "#0A77FF" : cfg.paymentTermConfig.type === "Pre" ? "#7C3AED" : "#D97706" }}
                        >
                          {cfg.paymentTermConfig.type}
                        </span>
                        <span className="text-sm" style={{ fontWeight: 500 }}>{cfg.paymentTermConfig.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Managed via creation modal
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {cfg?.paymentMethods && cfg.paymentMethods.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <p className="text-[13px] text-[#0F172A] mb-2" style={{ fontWeight: 600 }}>
                        Payment methods ({cfg.paymentMethods.length})
                      </p>
                      <div className="space-y-2">
                        {cfg.paymentMethods.map((pm) => (
                          <div key={pm.id} className="rounded-lg border border-[#E2E8F0] px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm" style={{ fontWeight: 500 }}>{pm.typeLabel}</span>
                            </div>
                            {pm.bankName && <span className="text-xs text-muted-foreground">{pm.bankName}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {activeSection === "config" && hasConfigData && (
            <Card className="p-6 gap-0">
              <h3 className="mb-1">Configuration Summary</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Step 3 configuration data captured during partner creation. These settings are managed through the creation modal.
              </p>
              <div className="space-y-5">
                {/* Pricing Rules */}
                {cfg?.pricingRules && cfg.pricingRules.length > 0 && (
                  <div>
                    <p className="text-[13px] text-[#0F172A] mb-3" style={{ fontWeight: 600 }}>
                      Pricing rules ({cfg.pricingRules.length})
                    </p>
                    <div className="space-y-2">
                      {cfg.pricingRules.map((rule) => (
                        <div key={rule.id} className="rounded-lg border border-[#E2E8F0] p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-white"
                              style={{ fontWeight: 600, backgroundColor: rule.type === "discount" ? "#059669" : "#D97706" }}
                            >
                              {rule.type === "discount" ? "Discount" : "Premium"}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{rule.basis}</Badge>
                            <span className="text-sm ml-1" style={{ fontWeight: 500 }}>{rule.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping Config */}
                {cfg?.shippingConfig && (
                  <div>
                    <p className="text-[13px] text-[#0F172A] mb-3" style={{ fontWeight: 600 }}>
                      Shipping configuration
                    </p>
                    {cfg.shippingConfig.carrierServices.map((cs, idx) => (
                      <div key={idx} className="rounded-lg border border-[#E2E8F0] p-3 mb-2 flex items-center justify-between">
                        <div>
                          <span className="text-sm" style={{ fontWeight: 500 }}>{cs.name}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{cs.minDays}–{cs.maxDays} business days</p>
                        </div>
                        {cs.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Credit Limit Config */}
                {cfg?.creditLimitConfig && (
                  <div>
                    <p className="text-[13px] text-[#0F172A] mb-3" style={{ fontWeight: 600 }}>
                      Credit limit settings
                    </p>
                    <div className="rounded-lg border border-[#E2E8F0] p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency</span>
                        <span style={{ fontWeight: 500 }}>{cfg.creditLimitConfig.currency || "USD"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Enforcement</span>
                        <span style={{ fontWeight: 500 }}>
                          {cfg.creditLimitConfig.enforcement === "hard_block" ? "Hard block" :
                           cfg.creditLimitConfig.enforcement === "soft_warning" ? "Soft warning" : "No enforcement"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-2">
                  To modify these configuration settings, use the partner creation or configuration modals.
                </p>
              </div>
            </Card>
          )}

          {/* Bottom save bar */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setDiscardDialogOpen(true)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1.5" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Discard confirmation */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes will be lost. Are you sure you want to go back?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, continue editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/vendors/${vendor.id}`)}>
              Yes, discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
