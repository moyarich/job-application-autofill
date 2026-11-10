import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { tabForPath, tabRoutes, type WorkspaceTab } from "../routes";
import { LocalProfile, ResumeVersion } from "../types/api-types";
import {
  ACTIVE_PROFILE_STORAGE_KEY,
  DEFAULT_PROFILE_ID,
  readProfiles,
  readResumes,
} from "../utils/api/client";

/** Query-string keys used for selection. */
const PARAM = { profile: "profile", resume: "resume" } as const;

/** Route, profile and resume selection only. No resume or jobs data. */
export function useProfileSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const applicationId = useParams().applicationId ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const activeProfileId =
    searchParams.get(PARAM.profile) ||
    localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ||
    DEFAULT_PROFILE_ID;
  const requestedResumeId = searchParams.get(PARAM.resume) || undefined;

  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(
    requestedResumeId ?? null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  const tab = tabForPath(location.pathname);
  const setTab = (next: WorkspaceTab) =>
    navigate({ pathname: tabRoutes[next], search: searchParams.toString() });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setHydrated(false);
      try {
        const available = await readProfiles();
        const selectedId = available.profiles.some(
          (profile) => profile.id === activeProfileId,
        )
          ? activeProfileId
          : available.defaultProfileId;
        const resumes = await readResumes(selectedId);

        // The parser tab starts without a resume; otherwise honor the
        // requested one only if it belongs to the profile we ended up with.
        const requestedIsUsable =
          selectedId === activeProfileId &&
          !!requestedResumeId &&
          resumes.some((resume) => resume.id === requestedResumeId);
        const wanted =
          tab === "parser"
            ? null
            : requestedIsUsable
              ? requestedResumeId!
              : (resumes[0]?.id ?? null);

        if (cancelled) return;

        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedId);

        // URL disagrees with what we resolved: fix it and let the effect re-run.
        const urlIsStale =
          selectedId !== activeProfileId ||
          (!!requestedResumeId && wanted !== requestedResumeId);
        if (urlIsStale) {
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.set(PARAM.profile, selectedId);
              if (wanted) next.set(PARAM.resume, wanted);
              else next.delete(PARAM.resume);
              return next;
            },
            { replace: true },
          );
          return;
        }

        setProfiles(available.profiles);
        setResumeVersions(resumes);
        setActiveResumeId(wanted);
        setHydrated(true);
      } catch (error) {
        if (!cancelled)
          setMessage(`Could not load profiles and resumes: ${String(error)}`);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, requestedResumeId, location.pathname]);

  return {
    applicationId,
    activeProfileId,
    activeResumeId,
    profiles,
    setProfiles,
    resumeVersions,
    setResumeVersions,
    tab,
    setTab,
    hydrated,
    message,
    setMessage,
  };
}
