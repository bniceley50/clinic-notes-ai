"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readErrorMessage } from "@/lib/errors/codes";

export type FetchState = {
  loading: boolean;
  error: string | null;
  fields: Record<string, string> | null;
  generatedAt: string | null;
};

type CareLogicFieldsResponse =
  | {
      fields?: Record<string, string>;
      generated_at?: string;
      error?: { code?: string; message?: string } | string;
    }
  | null;

const LOAD_ERROR_MESSAGE = "Unable to load structured fields from this transcript.";

const INITIAL_STATE: FetchState = {
  loading: true,
  error: null,
  fields: null,
  generatedAt: null,
};

function buildFieldsUrl(jobId: string, regenerate = false): string {
  return regenerate
    ? `/api/jobs/${jobId}/carelogic-fields?regenerate=true`
    : `/api/jobs/${jobId}/carelogic-fields`;
}

export function useCareLogicFields(jobId: string) {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const regeneratingRef = useRef(false);

  const generatedAt = useMemo(() => {
    if (!state.generatedAt) {
      return null;
    }

    return new Date(state.generatedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [state.generatedAt]);

  const loadFields = useCallback(
    async (regenerate = false) => {
      if (!jobId) {
        setState({
          loading: false,
          error: null,
          fields: null,
          generatedAt: null,
        });
        return;
      }

      setState({
        loading: true,
        error: null,
        fields: null,
        generatedAt: null,
      });

      try {
        const response = await fetch(buildFieldsUrl(jobId, regenerate));
        const payload = (await response.json().catch(() => null)) as CareLogicFieldsResponse;

        if (!response.ok || !payload?.fields) {
          setState({
            loading: false,
            error: readErrorMessage(payload) ?? LOAD_ERROR_MESSAGE,
            fields: null,
            generatedAt: null,
          });
          return;
        }

        setState({
          loading: false,
          error: null,
          fields: payload.fields,
          generatedAt: payload.generated_at ?? null,
        });
      } catch {
        setState({
          loading: false,
          error: LOAD_ERROR_MESSAGE,
          fields: null,
          generatedAt: null,
        });
      }
    },
    [jobId],
  );

  const regenerate = useCallback(async () => {
    if (!jobId || regeneratingRef.current || !state.fields) {
      return;
    }

    regeneratingRef.current = true;
    setIsRegenerating(true);
    setState((current) => ({
      ...current,
      error: null,
    }));

    try {
      const response = await fetch(buildFieldsUrl(jobId, true));
      const payload = (await response.json().catch(() => null)) as CareLogicFieldsResponse;

      if (!response.ok || !payload?.fields) {
        setState((current) => ({
          ...current,
          error: readErrorMessage(payload) ?? LOAD_ERROR_MESSAGE,
        }));
        return;
      }

      setState({
        loading: false,
        error: null,
        fields: payload.fields,
        generatedAt: payload.generated_at ?? null,
      });
    } catch {
      setState((current) => ({
        ...current,
        error: LOAD_ERROR_MESSAGE,
      }));
    } finally {
      regeneratingRef.current = false;
      setIsRegenerating(false);
    }
  }, [jobId, state.fields]);

  useEffect(() => {
    if (!jobId) {
      setState({
        loading: false,
        error: null,
        fields: null,
        generatedAt: null,
      });
      return;
    }

    void loadFields();
  }, [jobId, loadFields]);

  return {
    state,
    generatedAt,
    regenError: state.fields ? state.error : null,
    isRegenerating,
    loadFields,
    regenerate,
  };
}
