import { useNavigate } from "react-router-dom";
import { SalesOverviewPage } from "../components/modules/SalesOverviewPage";

export default function SalesOverviewPageRoute() {
  const navigate = useNavigate();
  return (
    <div className="overflow-y-auto w-full">
      <SalesOverviewPage onBack={() => navigate("/dashboard")} />
    </div>
  );
}
