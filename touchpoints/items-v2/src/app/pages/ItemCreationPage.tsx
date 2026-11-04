import { useNavigate } from "react-router-dom";
import { ItemCreation } from "../components/modules/ItemCreation";

export default function ItemCreationPage() {
  const navigate = useNavigate();
  return (
    <div className="overflow-y-auto w-full p-4 lg:p-8">
      <ItemCreation
        onCancel={() => navigate("/items")}
        onSave={() => navigate("/items")}
      />
    </div>
  );
}
