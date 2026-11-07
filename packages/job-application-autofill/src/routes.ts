/** Canonical frontend paths. Define route URLs here, not in components or actions. */
export const routes = {
  home: "/",
  applications: "/applications",
  applicationReview: "/apply/:applicationId",
  applicationViewer: "/application-viewer.html",
  profile: "/profile",
  resumes: "/resumes",
  resumeEditor: "/resumes/edit",
  resumeView: "/resumes/view",
  resumeImport: "/resumes/import",
  workspace: "/workspace",
  notFound: "*",
} as const;

export const pageRoutes = [
  routes.applications,
  routes.profile,
  routes.resumes,
  routes.resumeEditor,
  routes.resumeView,
  routes.resumeImport,
  routes.workspace,
] as const;

export type WorkspaceTab =
  | "applications"
  | "profile"
  | "view"
  | "resumes"
  | "personal"
  | "parser"
  | "workspace";

export const tabRoutes: Record<WorkspaceTab, string> = {
  applications: routes.applications,
  profile: routes.resumeEditor,
  view: routes.resumeView,
  resumes: routes.resumes,
  personal: routes.profile,
  parser: routes.resumeImport,
  workspace: routes.workspace,
};

export function tabForPath(pathname: string): WorkspaceTab {
  const entry = Object.entries(tabRoutes).find(([, path]) => path === pathname);
  return (entry?.[0] as WorkspaceTab | undefined) ?? "applications";
}

export function applicationReviewPath(applicationId: string): string {
  return routes.applicationReview.replace(":applicationId", encodeURIComponent(applicationId));
}

export function resumePath(mode: "view" | "edit"): string {
  return mode === "view" ? routes.resumeView : routes.resumeEditor;
}

export function resumeSwitchPath(pathname: string): string {
  return pathname === routes.resumeEditor ||
    pathname === routes.resumeView ||
    pathname === routes.resumes
    ? pathname
    : routes.workspace;
}
