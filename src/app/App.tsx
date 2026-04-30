import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { RateProvider } from "./context/RateContext";

export default function App() {
  return (
    <RateProvider>
      <RouterProvider router={router} />
    </RateProvider>
  );
}
