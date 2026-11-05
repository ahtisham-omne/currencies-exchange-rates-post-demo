import { useNavigate } from "react-router-dom";
import { useVendors } from "../context/VendorContext";
import { VendorForm } from "../components/vendors/VendorForm";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { toast } from "sonner";

export function VendorCreatePage() {
  const navigate = useNavigate();
  const { addVendor } = useVendors();

  const handleSubmit = (data: any) => {
    const vendor = addVendor(data);
    toast.success(`Vendor "${vendor.displayName}" created successfully`);
    navigate(`/vendors/${vendor.id}`);
  };

  return (
    <div className="p-6 lg:p-8 overflow-y-auto flex-1 bg-slate-50">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/vendors">Partners Management</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Partner</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8">
        <h1>Create New Partner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add a new partner to your partners directory. Fill in the details step by step.
        </p>
      </div>

      <VendorForm onSubmit={handleSubmit} />
    </div>
  );
}