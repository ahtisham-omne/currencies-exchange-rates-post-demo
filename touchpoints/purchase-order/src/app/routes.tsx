import { createBrowserRouter } from "react-router-dom";
import Homepage from "./components/Homepage";
import PurchaseOrdersListing from "./components/PurchaseOrdersListing";
import PurchaseOrderDraft from "./components/PurchaseOrderDraft";
import PlannerWorkspacePage from "./components/PlannerWorkspacePage";
import CartPage from "./components/CartPage";
import BusinessLogicDoc from "./components/BusinessLogicDoc";
import PurchaseRequestsPage from "./components/PurchaseRequestsPage";
import PurchaseRequestDetail from "./components/PurchaseRequestDetail";
import {
  ReceivingDocumentsPage,
  EmailsPage,
  HelpPage,
  SettingsPage,
  ItemsSubPage,
} from "./components/PlaceholderPage";

/* Route wrappers that reuse PurchaseOrdersListing but with the
   correct top-tab preselected. Each of the three tabs (Purchase
   Orders / Procurement Planning / Dashboard) now has its own
   URL — sidebar and the in-page tab strip both navigate here so
   the visible tab and the address bar never drift. */
function ProcurementPlanningPage() {
  return <PurchaseOrdersListing initialTopTab="demands" />;
}
function PODashboardPage() {
  return <PurchaseOrdersListing initialTopTab="dashboard" />;
}

/* ── Items sub-page wrappers ── */
function ItemsProducts() {
  return ItemsSubPage({ title: "Products" });
}
function ItemsBom() {
  return ItemsSubPage({ title: "Bill of Materials" });
}
function ItemsWarehouses() {
  return ItemsSubPage({ title: "Warehouses" });
}
function ItemsPricing() {
  return ItemsSubPage({ title: "Price Lists" });
}
function ItemsCategories() {
  return ItemsSubPage({ title: "Categories" });
}
function ItemsCreate() {
  return ItemsSubPage({ title: "Create Item" });
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Homepage,
  },
  {
    path: "/purchase-orders",
    children: [
      { index: true, Component: PurchaseOrdersListing },
      // Static `plan` segment is ranked above the dynamic `:id` by React
      // Router, so the full-screen Procurement Planning workspace never
      // collides with the PO-draft route.
      { path: "plan/:itemCode", Component: PlannerWorkspacePage },
      { path: ":id", Component: PurchaseOrderDraft },
    ],
  },
  /* Sibling tabs of Purchase Orders that used to live behind
     `?topTab=…` now have their own URLs so buyers can bookmark
     / deep-link straight into them from the sidebar. Same
     PurchaseOrdersListing component under the hood, just a
     different initial tab. */
  {
    path: "/procurement-planning",
    Component: ProcurementPlanningPage,
  },
  {
    path: "/dashboard",
    Component: PODashboardPage,
  },
  /* Purchase Requests — requester-side surface. Listing hosts the
     "+ New Request" center modal (so raising a PR keeps the buyer
     on the same page), and the :id route opens the detail view. */
  {
    path: "/purchase-requests",
    children: [
      { index: true, Component: PurchaseRequestsPage },
      { path: ":id", Component: PurchaseRequestDetail },
    ],
  },
  {
    path: "/cart",
    Component: CartPage,
  },
  {
    path: "/receiving-documents",
    Component: ReceivingDocumentsPage,
  },
  {
    path: "/emails",
    Component: EmailsPage,
  },
  {
    path: "/help",
    Component: HelpPage,
  },
  {
    path: "/settings",
    Component: SettingsPage,
  },
  {
    path: "/items",
    children: [
      { path: "products", Component: ItemsProducts },
      { path: "bom", Component: ItemsBom },
      { path: "warehouses", Component: ItemsWarehouses },
      { path: "pricing", Component: ItemsPricing },
      { path: "categories", Component: ItemsCategories },
      { path: "create", Component: ItemsCreate },
    ],
  },
  {
    path: "/docs/business-logic",
    Component: BusinessLogicDoc,
  },
]);