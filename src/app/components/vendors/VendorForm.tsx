import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExpandableTextarea } from "./ExpandableTextarea";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card } from "../ui/card";
import {
  Vendor,
  VendorCategory,
  PaymentTerms,
  VendorStatus,
  CATEGORY_LABELS,
  PAYMENT_TERMS_LABELS,
} from "../../data/vendors";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

type VendorFormData = Omit<
  Vendor,
  "id" | "code" | "createdAt" | "updatedAt" | "totalOrders" | "totalSpent" | "outstandingBalance" | "rating"
>;

interface VendorFormProps {
  initialData?: Vendor;
  onSubmit: (data: VendorFormData) => void;
  isEdit?: boolean;
}

const steps = [
  { id: 1, label: "Basic Info", description: "Company details" },
  { id: 2, label: "Contact", description: "Primary contact person" },
  { id: 3, label: "Address", description: "Billing & shipping" },
  { id: 4, label: "Financial", description: "Payment & credit" },
];

export function VendorForm({ initialData, onSubmit, isEdit = false }: VendorFormProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<VendorFormData>({
    companyName: initialData?.companyName ?? "",
    displayName: initialData?.displayName ?? "",
    partnerTypes: initialData?.partnerTypes ?? ["vendor"],
    vendorType: initialData?.vendorType ?? "",
    itemCodes: initialData?.itemCodes ?? [],
    partnerLocations: initialData?.partnerLocations ?? [],
    globalPointOfContacts: initialData?.globalPointOfContacts ?? [],
    partnerGroup: initialData?.partnerGroup ?? "PG-1-1",
    netProfitMargin: initialData?.netProfitMargin ?? 0,
    creditUtilization: initialData?.creditUtilization ?? 0,
    services: initialData?.services ?? "",
    defaultCarrierVendor: initialData?.defaultCarrierVendor ?? "",
    defaultCarrierCustomer: initialData?.defaultCarrierCustomer ?? "",
    country: initialData?.country ?? "USA",
    countryFlag: initialData?.countryFlag ?? "🇺🇸",
    emailAddress: initialData?.emailAddress ?? "",
    createdByContact: initialData?.createdByContact ?? { initials: "AA", name: "Admin User", bgColor: "#4338CA" },
    category: initialData?.category ?? "raw_materials",
    status: initialData?.status ?? "active",
    primaryContact: {
      name: initialData?.primaryContact?.name ?? "",
      email: initialData?.primaryContact?.email ?? "",
      phone: initialData?.primaryContact?.phone ?? "",
      designation: initialData?.primaryContact?.designation ?? "",
    },
    billingAddress: {
      street: initialData?.billingAddress?.street ?? "",
      city: initialData?.billingAddress?.city ?? "",
      state: initialData?.billingAddress?.state ?? "",
      zipCode: initialData?.billingAddress?.zipCode ?? "",
      country: initialData?.billingAddress?.country ?? "United States",
    },
    taxId: initialData?.taxId ?? "",
    paymentTerms: initialData?.paymentTerms ?? "net_30",
    creditLimit: initialData?.creditLimit ?? 0,
    website: initialData?.website ?? "",
    notes: initialData?.notes ?? "",
  });

  const updateField = (path: string, value: string | number) => {
    setFormData((prev) => {
      const keys = path.split(".");
      const updated = { ...prev } as any;
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
    if (errors[path]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.companyName.trim()) newErrors["companyName"] = "Company name is required";
      if (!formData.displayName.trim()) newErrors["displayName"] = "Display name is required";
    }
    if (step === 2) {
      if (!formData.primaryContact.name.trim()) newErrors["primaryContact.name"] = "Contact name is required";
      if (!formData.primaryContact.email.trim()) newErrors["primaryContact.email"] = "Email is required";
      if (!formData.primaryContact.phone.trim()) newErrors["primaryContact.phone"] = "Phone is required";
    }
    if (step === 3) {
      if (!formData.billingAddress.street.trim()) newErrors["billingAddress.street"] = "Street is required";
      if (!formData.billingAddress.city.trim()) newErrors["billingAddress.city"] = "City is required";
      if (!formData.billingAddress.state.trim()) newErrors["billingAddress.state"] = "State is required";
      if (!formData.billingAddress.zipCode.trim()) newErrors["billingAddress.zipCode"] = "ZIP code is required";
    }
    if (step === 4) {
      if (!formData.taxId.trim()) newErrors["taxId"] = "Tax ID is required";
      if (formData.creditLimit <= 0) newErrors["creditLimit"] = "Credit limit must be greater than 0";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      onSubmit(formData);
    }
  };

  const renderFieldError = (path: string) => {
    if (!errors[path]) return null;
    return <p className="text-destructive text-xs mt-1">{errors[path]}</p>;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 transition-colors ${
                  currentStep > step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </div>
              <div className="hidden sm:block">
                <p
                  className={`text-sm ${
                    currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                  style={{ fontWeight: currentStep === step.id ? 500 : 400 }}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-4 ${
                  currentStep > step.id ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Steps */}
      <Card className="p-6 gap-0">
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="mb-1">Basic Information</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the partner's company details and classification.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="e.g. Toyota International"
                  className="mt-1.5"
                />
                {renderFieldError("companyName")}
              </div>
              <div>
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => updateField("displayName", e.target.value)}
                  placeholder="e.g. Toyota International"
                  className="mt-1.5"
                />
                {renderFieldError("displayName")}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) =>
                    updateField("category", val as VendorCategory)
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isEdit && (
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) =>
                      updateField("status", val as VendorStatus)
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="emailAddress">Email Address</Label>
                <Input
                  id="emailAddress"
                  value={formData.emailAddress}
                  onChange={(e) => updateField("emailAddress", e.target.value)}
                  placeholder="contact@company.com"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  placeholder="USA"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="services">Services</Label>
                <Input
                  id="services"
                  value={formData.services}
                  onChange={(e) => updateField("services", e.target.value)}
                  placeholder="e.g. Laser cutting"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <h3 className="mb-1">Primary Contact</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add the main point of contact for this partner.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactName">Full Name *</Label>
                <Input
                  id="contactName"
                  value={formData.primaryContact.name}
                  onChange={(e) =>
                    updateField("primaryContact.name", e.target.value)
                  }
                  placeholder="John Smith"
                  className="mt-1.5"
                />
                {renderFieldError("primaryContact.name")}
              </div>
              <div>
                <Label htmlFor="contactDesignation">Designation</Label>
                <Input
                  id="contactDesignation"
                  value={formData.primaryContact.designation}
                  onChange={(e) =>
                    updateField("primaryContact.designation", e.target.value)
                  }
                  placeholder="Sales Manager"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactEmail">Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.primaryContact.email}
                  onChange={(e) =>
                    updateField("primaryContact.email", e.target.value)
                  }
                  placeholder="john@company.com"
                  className="mt-1.5"
                />
                {renderFieldError("primaryContact.email")}
              </div>
              <div>
                <Label htmlFor="contactPhone">Phone *</Label>
                <Input
                  id="contactPhone"
                  value={formData.primaryContact.phone}
                  onChange={(e) =>
                    updateField("primaryContact.phone", e.target.value)
                  }
                  placeholder="+1 (555) 000-0000"
                  className="mt-1.5"
                />
                {renderFieldError("primaryContact.phone")}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5">
            <h3 className="mb-1">Billing Address</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the partner's billing address information.
            </p>
            <div>
              <Label htmlFor="street">Street Address *</Label>
              <Input
                id="street"
                value={formData.billingAddress.street}
                onChange={(e) =>
                  updateField("billingAddress.street", e.target.value)
                }
                placeholder="123 Main Street, Suite 100"
                className="mt-1.5"
              />
              {renderFieldError("billingAddress.street")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.billingAddress.city}
                  onChange={(e) =>
                    updateField("billingAddress.city", e.target.value)
                  }
                  placeholder="New York"
                  className="mt-1.5"
                />
                {renderFieldError("billingAddress.city")}
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.billingAddress.state}
                  onChange={(e) =>
                    updateField("billingAddress.state", e.target.value)
                  }
                  placeholder="NY"
                  className="mt-1.5"
                />
                {renderFieldError("billingAddress.state")}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zip">ZIP Code *</Label>
                <Input
                  id="zip"
                  value={formData.billingAddress.zipCode}
                  onChange={(e) =>
                    updateField("billingAddress.zipCode", e.target.value)
                  }
                  placeholder="10001"
                  className="mt-1.5"
                />
                {renderFieldError("billingAddress.zipCode")}
              </div>
              <div>
                <Label htmlFor="addressCountry">Country</Label>
                <Input
                  id="addressCountry"
                  value={formData.billingAddress.country}
                  onChange={(e) =>
                    updateField("billingAddress.country", e.target.value)
                  }
                  placeholder="United States"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-5">
            <h3 className="mb-1">Financial Details</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure payment terms, tax information, and credit limits.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxId">Tax ID / EIN *</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateField("taxId", e.target.value)}
                  placeholder="XX-XXXXXXX"
                  className="mt-1.5"
                />
                {renderFieldError("taxId")}
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select
                  value={formData.paymentTerms}
                  onValueChange={(val) =>
                    updateField("paymentTerms", val as PaymentTerms)
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TERMS_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="creditLimit">Credit Limit ($) *</Label>
              <Input
                id="creditLimit"
                type="number"
                value={formData.creditLimit || ""}
                onChange={(e) =>
                  updateField("creditLimit", Number(e.target.value))
                }
                placeholder="100000"
                className="mt-1.5"
              />
              {renderFieldError("creditLimit")}
            </div>
            <ExpandableTextarea
              label="Notes"
              value={formData.notes}
              onChange={(val) => updateField("notes", val)}
              placeholder="Any additional notes about this partner..."
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
          <Button
            variant="outline"
            onClick={() => (currentStep === 1 ? navigate(-1) : handleBack())}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {currentStep < 4 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Check className="w-4 h-4 mr-1" />
                {isEdit ? "Save Changes" : "Create Partner"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}