import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { routes, tabForPath, tabRoutes, type WorkspaceTab } from "../routes";
import {
  ACTIVE_PROFILE_STORAGE_KEY, DEFAULT_PROFILE_ID,
  readProfiles, readResumes, type LocalProfile, type ResumeVersion,
} from "../utils/api/client";

/** Route, profile and resume selection only. No resume or jobs data. */
export function useProfileSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const applicationId = useParams().applicationId ?? null;
  const query = new URLSearchParams(location.search);
  const activeProfileId = query.get("profile") ||
    localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || DEFAULT_PROFILE_ID;
  const requestedResumeId = query.get("resume") || undefined;
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(requestedResumeId ?? null);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  const tab = tabForPath(location.pathname);
  function setTab(next: WorkspaceTab) {
    navigate({ pathname: tabRoutes[next], search: location.search });
  }

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    readProfiles().then(async (available) => {
      const selectedId = available.profiles.some((item) => item.id === activeProfileId)
        ? activeProfileId : available.defaultProfileId;
      const resumes = await readResumes(selectedId);
      const wanted = location.pathname === routes.resumeImport ? null : selectedId === activeProfileId && requestedResumeId &&
        resumes.some((item) => item.id === requestedResumeId)
        ? requestedResumeId : resumes[0]?.id;
      if (cancelled) return;
      if (selectedId !== activeProfileId ||
          (requestedResumeId && wanted !== requestedResumeId)) {
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedId);
        const params = new URLSearchParams(location.search);
        params.set("profile", selectedId);
        if (wanted) params.set("resume", wanted);
        else params.delete("resume");
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
        return;
      }
      setProfiles(available.profiles);
      setResumeVersions(resumes);
      setActiveResumeId(wanted ?? null);
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedId);
      setHydrated(true);
    }).catch((error) => {
      if (!cancelled) setMessage("Could not load profiles and resumes: " + String(error));
    });
    return () => { cancelled = true; };
  }, [activeProfileId, requestedResumeId, location.pathname]);

  return {
    applicationId, activeProfileId, activeResumeId, profiles, setProfiles,
    resumeVersions, setResumeVersions, tab, setTab,
    hydrated, message, setMessage,
  };
}
