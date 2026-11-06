import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router";
import { App } from "./components/App/App";

function LegacyResumeRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}

const appRoutes = ["/applications", "/profile", "/resumes", "/resumes/edit", "/resumes/view", "/resumes/import", "/workspace"] as const;
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/applications" replace /> },
  ...appRoutes.map(path => ({path,element:<App />})),
  { path: "/resume", element: <LegacyResumeRedirect to="/resumes" /> },
  { path: "/resume/edit", element: <LegacyResumeRedirect to="/resumes/edit" /> },
  { path: "/import", element: <LegacyResumeRedirect to="/resumes/import" /> },
  { path: "/resume/import", element: <LegacyResumeRedirect to="/resumes/import" /> },
  { path: "/apply/:applicationId", element: <App /> },
  { path: "*", element: <Navigate to="/applications" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
