import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/so/AppLayout";
import { SalesHomePage } from "./components/so/SalesHomePage";
import { SOList } from "./components/so/SOList";
import { SODetail } from "./components/so/SODetail";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: SalesHomePage },
      { path: "sales-orders", Component: SOList },
      { path: "sales-orders/:id", Component: SODetail },
      { path: "*", Component: SalesHomePage },
    ],
  },
]);
