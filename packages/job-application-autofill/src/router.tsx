import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { App } from "./components/App/App";

const appRoutes = ["/applications", "/profile", "/resume", "/import", "/workspace"] as const;
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/applications" replace /> },
  ...appRoutes.map(path => ({path,element:<App />})),
  { path: "/apply/:applicationId", element: <App /> },
  { path: "*", element: <Navigate to="/applications" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
