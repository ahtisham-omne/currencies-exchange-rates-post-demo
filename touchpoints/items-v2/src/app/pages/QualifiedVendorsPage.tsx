import { useNavigate } from "react-router-dom";
import { QualifiedVendorsConfiguration } from "../components/modules/QualifiedVendorsConfiguration";

export default function QualifiedVendorsPage() {
  const navigate = useNavigate();
  return (
    <div className="overflow-y-auto w-full p-4 lg:p-8">
      <QualifiedVendorsConfiguration onBack={() => navigate("/dashboard")} />
    </div>
  );
}
