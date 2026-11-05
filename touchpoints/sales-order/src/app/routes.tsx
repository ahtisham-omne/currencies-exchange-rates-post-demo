import { createBrowserRouter, useParams } from "react-router-dom";
import { AppLayout } from "./components/so/AppLayout";
import { SalesHomePage } from "./components/so/SalesHomePage";
import { SOList } from "./components/so/SOList";
import { SODetail } from "./components/so/SODetail";
import { PartnersShellPage } from "./pages/PartnersShellPage";

/* Bug A7: SODetail reads `id` via useParams and feeds it into useState
   initializers and effects. React only runs initializers on first mount,
   so SPA navigation between two SO ids reused the prior order's state
   until a full refresh. Keying SODetail on `id` forces a clean remount
   whenever the route param changes. */
function SODetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <SODetail key={id} />;
}

export const router = createBrowserRouter([
  /* Partner Management new-tab shell — sits OUTSIDE AppLayout so the
     SO breadcrumb / nav chrome isn't drawn around it. Opener pages
     route the user here via openPartnerTab(...) with action / seed
     query params; the shell auto-opens the matching modal and posts
     the result back on save. */
  { path: "/partners", Component: PartnersShellPage },
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: SalesHomePage },
      { path: "sales-orders", Component: SOList },
      { path: "sales-orders/:id", Component: SODetailRoute },
      { path: "*", Component: SalesHomePage },
    ],
  },
]);
