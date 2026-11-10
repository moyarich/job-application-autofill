/* -------------------------------------------------------------------------
 * Answers state: load on change, manual refresh, save from employer form
 * ---------------------------------------------------------------------- */

import { useState, useCallback, useEffect } from "react";

import { fetchAnswers } from "../api/client";
import { saveEmployerFormAnswers } from "../api/answers";
import { AnswerMap, AnswersResponse } from "../types/api-types";
import { ApplicationQnA } from "../types/application-q-n-a";

export interface ApplicationAnswers {
  savedAnswers: AnswerMap;
  ApplicationQnAs: ApplicationQnA[];
  currentAnswerRecords: ApplicationQnA[];
  message: string;
  saving: boolean;
  refresh: () => Promise<void>;
  saveFromEmployerForm: (sessionId: string) => Promise<void>;
}
export function useApplicationAnswers(
  applicationId: string | null | undefined,
  profileId: string,
  resumeId: string | null | undefined,
): ApplicationAnswers {
  const [savedAnswers, setSavedAnswers] = useState<AnswerMap>({});
  const [ApplicationQnAs, setApplicationQnAs] = useState<ApplicationQnA[]>([]);
  const [currentAnswerRecords, setCurrentAnswerRecords] = useState<
    ApplicationQnA[]
  >([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = useCallback((data: AnswersResponse) => {
    setSavedAnswers(data.answers ?? {});
    setApplicationQnAs(data.examples ?? []);
    setCurrentAnswerRecords(data.currentRecords ?? []);
  }, []);

  // Reset, then load whenever the application or profile changes.
  useEffect(() => {
    apply({});
    if (!applicationId) return;

    const abort = new AbortController();
    fetchAnswers(applicationId, profileId, abort.signal)
      .then(apply)
      .catch(() => {
        /* Optional context: stay on the reset state. */
      });
    return () => abort.abort();
  }, [applicationId, profileId, apply]);

  const refresh = useCallback(async () => {
    if (!applicationId) return;
    apply(await fetchAnswers(applicationId, profileId));
  }, [applicationId, profileId, apply]);

  const saveFromEmployerForm = useCallback(
    async (sessionId: string) => {
      setSaving(true);
      try {
        const result = await saveEmployerFormAnswers(sessionId, profileId, resumeId ?? undefined);
        setSavedAnswers(result.answers);
        setMessage(
          result.count
            ? "Saved answers from the employer form to this application."
            : "No completed custom answers detected on the current employer page.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to save answers.",
        );
      } finally {
        setSaving(false);
      }
    },
    [profileId, resumeId],
  );

  return {
    savedAnswers,
    ApplicationQnAs,
    currentAnswerRecords,
    message,
    saving,
    refresh,
    saveFromEmployerForm,
  };
}
