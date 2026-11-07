import type { Dispatch, SetStateAction } from "react";
import { exportResume, type ResumeExportFormat } from "../files/export-resume";
import type { CandidateProfile } from "../../index";
import {
  readState, createLocalProfile, renameLocalProfile, deleteLocalProfile,
  createResumeVersion, renameResumeVersion, deleteResumeVersion,
  DEFAULT_PROFILE_ID, type LocalProfile, type ResumeVersion,
} from "../api/client";
type Update<T> = Dispatch<SetStateAction<T>>;
export type ProfileResumeActionsContext = {
  applicationId: string | null;
  applyBusy: boolean;
  sessionActive: boolean;
  activeProfileId: string;
  activeResumeId: string | null;
  pathname: string;
  profile: CandidateProfile;
  profiles: LocalProfile[];
  resumeVersions: ResumeVersion[];
  flushPending: () => Promise<void>;
  setMessage: Update<string>;
  setProfiles: Update<LocalProfile[]>;
  setResumeVersions: Update<ResumeVersion[]>;
};
/** Profile/resume commands, without React state or effects. */
export function createProfileResumeActions({
  applicationId, applyBusy, sessionActive, activeProfileId, activeResumeId,
  pathname, profile, profiles, resumeVersions, flushPending, setMessage,
  setProfiles, setResumeVersions,
}: ProfileResumeActionsContext) {
  function navigateTo(
    nextPerson: string,
    nextResume?: string,
    destination = "/workspace",
  ) {
    const url = new URL(window.location.href);
    url.searchParams.set("profile", nextPerson);
    if (nextResume) url.searchParams.set("resume", nextResume);
    else url.searchParams.delete("resume");
    url.pathname = destination;
    window.location.assign(url.href);
  }
  async function switchProfile(next: string) {
    if (applicationId || applyBusy || sessionActive) return;
    if (next === activeProfileId) return;
    try {
      await flushPending();
      navigateTo(next);
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function switchResume(next: string) {
    if (applicationId || applyBusy || sessionActive || next === activeResumeId)
      return;
    try {
      await flushPending();
      // Switching versions must not unexpectedly leave the resume editor/preview.
      const destination =
        pathname === "/resumes/edit" ||
        pathname === "/resumes/view" ||
        pathname === "/resumes"
          ? pathname
          : "/workspace";
      navigateTo(activeProfileId, next, destination);
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function createPerson() {
    const value = window.prompt("Name for the new local profile");
    if (!value) return;
    try {
      await flushPending();
      const result = await createLocalProfile(value);
      navigateTo(result.id);
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function renamePerson() {
    const value = window.prompt(
      "Rename local profile",
      profiles.find((item) => item.id === activeProfileId)?.name,
    );
    if (!value) return;
    try {
      const result = await renameLocalProfile(activeProfileId, value);
      setProfiles((items) =>
        items.map((item) => (item.id === result.id ? result : item)),
      );
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function removePerson() {
    if (
      activeProfileId === DEFAULT_PROFILE_ID ||
      !window.confirm(
        "Permanently delete this person, all resume versions, and all saved applications?",
      )
    )
      return;
    try {
      await deleteLocalProfile(activeProfileId);
      navigateTo(DEFAULT_PROFILE_ID);
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function exportResumeVersion(
    resumeId: string,
    format: ResumeExportFormat,
  ) {
    try {
      await flushPending();
      const selected = resumeVersions.find((item) => item.id === resumeId);
      if (!selected) throw new Error("Resume no longer exists.");
      const state =
        resumeId === activeResumeId
          ? null
          : await readState(activeProfileId, resumeId);
      const value = state ? state.profile : profile;
      if (!value) throw new Error("This resume has no content to export.");
      await exportResume(
        value,
        selected.name,
        format,
        activeProfileId,
        resumeId,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }
  async function openResume(resumeId: string, mode: "view" | "edit" = "edit") {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      navigateTo(activeProfileId, resumeId, "/resumes/" + mode);
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function createResume(name: string, copyId?: string) {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      const created = await createResumeVersion(activeProfileId, name, copyId);
      navigateTo(activeProfileId, created.id, "/resumes/edit");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  async function renameResume(resumeId: string, name: string) {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      const changed = await renameResumeVersion(
        activeProfileId,
        resumeId,
        name,
      );
      setResumeVersions((items) =>
        items.map((item) => (item.id === changed.id ? changed : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  async function removeResume(resumeId: string) {
    if (applicationId || applyBusy || sessionActive || resumeVersions.length <= 1)
      return;
    try {
      await flushPending();
      await deleteResumeVersion(activeProfileId, resumeId);
      if (resumeId === activeResumeId) {
        const remaining = resumeVersions.find((item) => item.id !== resumeId);
        navigateTo(activeProfileId, remaining?.id, "/resumes");
      } else {
        setResumeVersions((items) =>
          items.filter((item) => item.id !== resumeId),
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  return { switchProfile, switchResume, createPerson, renamePerson, removePerson, createResume, renameResume, removeResume, openResume, exportResumeVersion };
}
