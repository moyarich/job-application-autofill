/** Canonical frontend paths. Define route URLs here, not in components or actions. */
export const routes = {
  home: "/",
  applications: "/applications",
  applicationReview: "/apply/:applicationId",
  applicationViewer: "/application-viewer",
  profile: "/profile",
  contacts: "/contacts",
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
  routes.contacts,
  routes.resumes,
  routes.resumeEditor,
  routes.resumeView,
  routes.resumeImport,
  routes.workspace,
] as const;

export const tabRoutes: Record<string, string> = {
  applications: routes.applications,
  profile: routes.resumeEditor,
  view: routes.resumeView,
  resumes: routes.resumes,
  personal: routes.profile,
  contacts: routes.contacts,
  parser: routes.resumeImport,
  workspace: routes.workspace,
};

export type WorkspaceTab = keyof typeof tabRoutes;

export function tabForPath(pathname: string): WorkspaceTab {
  const entry = (Object.entries(tabRoutes) as [WorkspaceTab, string][]).find(
    ([, path]) => path === pathname,
  );
  return entry?.[0] ?? "applications";
}

export function applicationReviewPath(applicationId: string): string {
  return routes.applicationReview.replace(
    ":applicationId",
    encodeURIComponent(applicationId),
  );
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
