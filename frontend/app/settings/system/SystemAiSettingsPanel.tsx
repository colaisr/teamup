"use client";

import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "@/lib/api";
import { formatApiUtcAsLocal } from "@/lib/datetime";
import { t } from "@/lib/i18n";

type AiSettingsResp = {
  api_key: string;
  model_id: string;
  updated_at?: string | null;
};

type ModelRow = {
  id: string;
  name: string;
};

type ModelsResp = {
  models: ModelRow[];
};

type TestResp = {
  ok: boolean;
  message?: string;
};

export default function SystemAiSettingsPanel() {
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api<AiSettingsResp>("/api/admin/ai/settings");
      setApiKey(data.api_key || "");
      setModelId(data.model_id || "");
      setUpdatedAt(data.updated_at ?? null);
    } catch (e: unknown) {
      setError(explainApiError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const optionalKeyPayload = (): string => JSON.stringify({ api_key: apiKey.trim() ? apiKey.trim() : null });

  const onRefreshModels = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api<ModelsResp>("/api/admin/ai/models/list", {
        method: "POST",
        body: optionalKeyPayload()
      });
      setModels(res.models || []);
      setMessage(t("settings.system.ai.modelsLoaded"));
      if (
        modelId &&
        !(res.models || []).some((m) => m.id === modelId) &&
        (res.models || []).length > 0
      ) {
        setModelId("");
      }
    } catch (e: unknown) {
      setError(explainApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onTestConnection = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<TestResp>("/api/admin/ai/test-connection", {
        method: "POST",
        body: optionalKeyPayload()
      });
      setMessage(t("settings.system.ai.testOk"));
    } catch (e: unknown) {
      setError(explainApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api<AiSettingsResp>("/api/admin/ai/settings", {
        method: "PUT",
        body: JSON.stringify({ api_key: apiKey, model_id: modelId })
      });
      setApiKey(data.api_key || "");
      setModelId(data.model_id || "");
      setUpdatedAt(data.updated_at ?? null);
      setMessage(t("settings.system.ai.saved"));
    } catch (e: unknown) {
      setError(explainApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 640 }}>
      <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
        {t("settings.system.ai.intro")}
      </p>

      {updatedAt ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t("settings.system.ai.updatedAtPrefix")}: {formatApiUtcAsLocal(updatedAt)}
        </p>
      ) : null}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600 }}>{t("settings.system.ai.apiKeyLabel")}</span>
        <input
          type="password"
          autoComplete="new-password"
          placeholder={t("settings.system.ai.apiKeyPlaceholder")}
          value={apiKey}
          disabled={busy}
          onChange={(e) => setApiKey(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb"
          }}
        />
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void onRefreshModels()}>
          {t("settings.system.ai.refreshModels")}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void onTestConnection()}>
          {t("settings.system.ai.testConnection")}
        </button>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600 }}>{t("settings.system.ai.modelLabel")}</span>
        <select
          disabled={busy}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb",
            cursor: busy ? "not-allowed" : "pointer"
          }}
        >
          <option value="">{models.length === 0 ? t("settings.system.ai.modelEmptyHint") : t("integrations.selectPlaceholder")}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {(m.name && m.name !== m.id ? `${m.name} — ${m.id}` : m.id).slice(0, 240)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn"
        disabled={busy}
        style={{ justifySelf: "start", background: "#1e40af", borderColor: "#3b82f6" }}
        onClick={() => void onSave()}
      >
        {t("common.save")}
      </button>

      {message ? (
        <p style={{ margin: 0, color: "#93c5fd", fontSize: 14 }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
