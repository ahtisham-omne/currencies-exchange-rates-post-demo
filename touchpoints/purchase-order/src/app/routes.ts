import { createBrowserRouter } from "react-router-dom";
import Homepage from "./components/Homepage";
import PurchaseOrdersListing from "./components/PurchaseOrdersListing";
import PurchaseOrderDraft from "./components/PurchaseOrderDraft";
import CartPage from "./components/CartPage";
import BusinessLogicDoc from "./components/BusinessLogicDoc";
import {
  ReceivingDocumentsPage,
  EmailsPage,
  HelpPage,
  SettingsPage,
  ItemsSubPage,
} from "./components/PlaceholderPage";

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
      { path: ":id", Component: PurchaseOrderDraft },
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
], { basename: import.meta.env.BASE_URL });
