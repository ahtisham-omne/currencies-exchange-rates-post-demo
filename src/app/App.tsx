import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  );
}

export default App;
