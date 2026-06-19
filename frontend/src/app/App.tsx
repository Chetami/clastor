import { RouterProvider } from "react-router-dom";
import { AppProvider } from "./provider/app-provider";
import { router } from "@/routes";

export function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
