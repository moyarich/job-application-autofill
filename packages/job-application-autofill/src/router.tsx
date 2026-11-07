import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { App } from "./components/App/App";
import { routes, pageRoutes } from "./routes";

export const router = createBrowserRouter([
  { path: routes.home, element: <Navigate to={routes.applications} replace /> },
  ...pageRoutes.map((path) => ({ path, element: <App /> })),
  { path: routes.applicationReview, element: <App /> },
  { path: routes.notFound, element: <Navigate to={routes.applications} replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
