"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { api, explainApiError } from "@/lib/api";
import { formatApiUtcAsLocal } from "@/lib/datetime";
import { t } from "@/lib/i18n";

type ConnectionsListResponse = {
  workspace_id: string;
  connections: Connection[];
  impact_weekly_snapshot_scheduler_enabled?: boolean;
  impact_weekly_snapshot_interval_hours?: number;
  impact_weekly_snapshot_tick_interval_hours?: number;
};

type ProviderId = "clickup";

type TeamRow = {
  team_id?: number | string;
  id?: number | string;
  name?: string;
};

type SpaceRow = {
  id: string | number;
  name?: string;
};

type MappingRow = {
  source_status: string;
  normalized_status: string;
};

type Connection = {
  id: string;
  workspace_id: string;
  provider: string;
  name: string;
  clickup_user_label: string | null;
  setup_status: string;
  scope_type: string | null;
  scope_id: string | null;
  scope_name: string | null;
  clickup_team_id: string | null;
  last_synced_at: string | null;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  sync_scheduler_enabled: boolean;
  sync_interval_minutes: number | null;
  sync_is_stale: boolean;
  sync_stale_after_at: string | null;
  created_at: string;
  updated_at: string;
};

const NORMALIZED_OPTIONS = [
  "Not Started",
  "Ready",
  "In Progress",
  "Review",
  "QA",
  "Blocked",
  "Done",
  "Cancelled"
];

function resolveWorkspaceId(inputState: string): string {
  const a = inputState.trim();
  if (a) return a;
  if (typeof window !== "undefined") return (localStorage.getItem("teamup_workspace_id") || "").trim();
  return "";
}

function tid(team: TeamRow): string {
  const raw = team.team_id ?? team.id;
  return raw !== undefined && raw !== null ? String(raw) : "";
}

function backdropStyle(open: boolean): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 10_020,
    background: open ? "rgba(0,0,0,0.6)" : "transparent",
    display: open ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backdropFilter: open ? "blur(2px)" : "none"
  };
}

function panelStyle(): CSSProperties {
  return {
    width: "min(780px, 100%)",
    maxHeight: "min(92vh, 740px)",
    overflow: "auto",
    background: "var(--panel-soft)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "20px 22px",
    boxShadow: "0 24px 80px rgba(0,0,0,.35)"
  };
}

function autoMapStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (/(done|готов|закрыт|release|deploy)/.test(s)) return "Done";
  if (/(cancel|отмен|won't|wont)/.test(s)) return "Cancelled";
  if (/(block|blocked|заблок|waiting|ожид)/.test(s)) return "Blocked";
  if (/(qa|тест|uat|acceptance)/.test(s)) return "QA";
  if (/(review|ревью|проверк)/.test(s)) return "Review";
  if (/(todo|backlog|очеред|not started|new)/.test(s)) return "Not Started";
  if (/(ready|готово к|analysis done)/.test(s)) return "Ready";
  return "In Progress";
}

export default function IntegrationsSettingsClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [impactWeeklyMeta, setImpactWeeklyMeta] = useState({
    enabled: false,
    intervalHours: 168,
    tickHours: 24
  });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageMessage, setPageMessage] = useState("");
  const [documentReady, setDocumentReady] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<"add" | "edit">("add");
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardProvider] = useState<ProviderId>("clickup");
  const [wizardConnectionId, setWizardConnectionId] = useState<string>("");
  const [wizardConnectionName, setWizardConnectionName] = useState("ClickUp");
  const [wizardToken, setWizardToken] = useState("");
  const [wizardHint, setWizardHint] = useState("");
  const [wizardTeamId, setWizardTeamId] = useState("");
  const [wizardTeams, setWizardTeams] = useState<TeamRow[]>([]);
  const [wizardSpaceId, setWizardSpaceId] = useState("");
  const [wizardSpaces, setWizardSpaces] = useState<SpaceRow[]>([]);
  const [wizardScopeType, setWizardScopeType] = useState<"space" | "list">("space");
  const [wizardScopeId, setWizardScopeId] = useState("");
  const [wizardMappingRows, setWizardMappingRows] = useState<MappingRow[]>([]);
  /** Step 1: token verify / save — separate labels so each button shows its own spinner */
  const [credentialAction, setCredentialAction] = useState<null | "verify" | "saveToken">(null);
  /** Step 2: refresh teams/spaces / save scope */
  const [scopeAction, setScopeAction] = useState<null | "teams" | "spaces" | "save">(null);
  /** Step 3: save status mapping */
  const [mappingAction, setMappingAction] = useState<null | "save">(null);
  /** List / wizard: POST import in progress — shows spinner on the active sync button */
  const [importingConnectionId, setImportingConnectionId] = useState<string | null>(null);

  useEffect(() => setDocumentReady(true), []);

  const resetWizard = useCallback(() => {
    setWizardStep(0);
    setWizardConnectionId("");
    setWizardConnectionName("ClickUp");
    setWizardToken("");
    setWizardHint("");
    setWizardTeamId("");
    setWizardTeams([]);
    setWizardSpaceId("");
    setWizardSpaces([]);
    setWizardScopeType("space");
    setWizardScopeId("");
    setWizardMappingRows([]);
    setCredentialAction(null);
    setScopeAction(null);
    setMappingAction(null);
  }, []);

  const closeWizard = useCallback(() => {
    setModalOpen(false);
    resetWizard();
    setWizardMode("add");
  }, [resetWizard]);

  useEffect(() => {
    if (!modalOpen || !documentReady) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWizard();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen, documentReady, closeWizard]);

  const loadConnections = useCallback(async () => {
    const wid = resolveWorkspaceId("");
    if (!wid) {
      setConnections([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await api<ConnectionsListResponse>(
        `/api/integrations/clickup/connections/${encodeURIComponent(wid)}`
      );
      setConnections(res.connections || []);
      setImpactWeeklyMeta({
        enabled: Boolean(res.impact_weekly_snapshot_scheduler_enabled),
        intervalHours: res.impact_weekly_snapshot_interval_hours ?? 168,
        tickHours: res.impact_weekly_snapshot_tick_interval_hours ?? 24
      });
      setPageMessage("");
    } catch (e: unknown) {
      setConnections([]);
      setPageMessage(explainApiError(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  async function verifyTokenOnly() {
    if (!wizardToken.trim()) {
      setWizardHint(t("integrations.enterTokenFirst"));
      return;
    }
    setCredentialAction("verify");
    setWizardHint("");
    try {
      const r = await api<{ ok: boolean; clickup_email: string | null }>("/api/integrations/clickup/verify-token", {
        method: "POST",
        body: JSON.stringify({ api_token: wizardToken.trim() })
      });
      setWizardHint(r.clickup_email ? t("integrations.verifyOkWithEmail").replace("{email}", r.clickup_email) : t("integrations.verifyOk"));
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setCredentialAction(null);
    }
  }

  async function loadTeamsForConnection(connectionId: string, opts?: { preferTeamId?: string }) {
    const res = await api<{ teams: TeamRow[] }>(`/api/integrations/clickup/connections/${encodeURIComponent(connectionId)}/scopes`);
    const teams = res.teams || [];
    setWizardTeams(teams);

    if (opts && Object.prototype.hasOwnProperty.call(opts, "preferTeamId")) {
      const p = (opts.preferTeamId ?? "").trim();
      if (!p) {
        setWizardTeamId("");
        return;
      }
      const ok = teams.some((team) => tid(team) === p);
      setWizardTeamId(ok ? p : "");
      return;
    }
    if (!wizardTeamId && teams.length === 1) setWizardTeamId(tid(teams[0]));
  }

  const loadSpacesForConnection = useCallback(
    async (connectionId: string, teamId: string, opts?: { preferSpaceId?: string }) => {
      if (!teamId) {
        setWizardSpaces([]);
        setWizardSpaceId("");
        return;
      }
      const res = await api<{ spaces: SpaceRow[] }>(
        `/api/integrations/clickup/connections/${encodeURIComponent(connectionId)}/scopes?team_id=${encodeURIComponent(teamId)}`
      );
      const spaces = res.spaces || [];
      setWizardSpaces(spaces);

      if (opts && Object.prototype.hasOwnProperty.call(opts, "preferSpaceId")) {
        const safe = (opts.preferSpaceId ?? "").trim();
        setWizardSpaceId(safe !== "" && spaces.some((s) => String(s.id) === safe) ? safe : "");
        return;
      }
      const cur = wizardSpaceId.trim();
      setWizardSpaceId(cur !== "" && spaces.some((s) => String(s.id) === cur) ? cur : "");
    },
    [wizardSpaceId]
  );

  useEffect(() => {
    if (!modalOpen || wizardStep !== 2 || !wizardConnectionId || !wizardTeamId) return;
    void loadSpacesForConnection(wizardConnectionId, wizardTeamId).catch(() => {
      setWizardSpaces([]);
      setWizardSpaceId("");
      setWizardHint("Не удалось загрузить список Space.");
    });
  }, [modalOpen, wizardStep, wizardConnectionId, wizardTeamId, loadSpacesForConnection]);

  async function saveCredentialsAndContinue() {
    const wid = resolveWorkspaceId("").trim();
    if (!wid) {
      setWizardHint(t("integrations.workspaceRequired"));
      return;
    }
    if (!wizardConnectionId && !wizardToken.trim()) {
      setWizardHint(t("integrations.enterTokenFirst"));
      return;
    }
    setCredentialAction("saveToken");
    setWizardHint("");
    try {
      let connectionId = wizardConnectionId;
      if (!connectionId) {
        const created = await api<Connection>("/api/integrations/clickup/connections", {
          method: "POST",
          body: JSON.stringify({
            workspace_id: wid,
            api_token: wizardToken.trim(),
            name: wizardConnectionName.trim() || "ClickUp"
          })
        });
        connectionId = created.id;
        setWizardConnectionId(connectionId);
      } else if (wizardToken.trim()) {
        await api<Connection>(`/api/integrations/clickup/connections/${encodeURIComponent(connectionId)}/credentials`, {
          method: "PUT",
          body: JSON.stringify({
            api_token: wizardToken.trim(),
            name: wizardConnectionName.trim() || "ClickUp"
          })
        });
      }
      await loadTeamsForConnection(connectionId);
      setWizardStep(2);
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setCredentialAction(null);
    }
  }

  async function refreshWizardTeams() {
    if (!wizardConnectionId) return;
    setScopeAction("teams");
    setWizardHint("");
    try {
      if (wizardTeamId.trim()) await loadTeamsForConnection(wizardConnectionId, { preferTeamId: wizardTeamId });
      else await loadTeamsForConnection(wizardConnectionId);
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setScopeAction(null);
    }
  }

  async function refreshWizardSpaces() {
    if (!wizardConnectionId || !wizardTeamId) return;
    setScopeAction("spaces");
    setWizardHint("");
    try {
      if (wizardSpaceId.trim()) await loadSpacesForConnection(wizardConnectionId, wizardTeamId, { preferSpaceId: wizardSpaceId });
      else await loadSpacesForConnection(wizardConnectionId, wizardTeamId);
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setScopeAction(null);
    }
  }

  async function saveScopeAndContinue() {
    if (!wizardConnectionId) {
      setWizardHint("Сначала сохраните токен.");
      return;
    }
    const space = wizardSpaces.find((s) => String(s.id) === wizardSpaceId);
    if (!wizardTeamId || !space) {
      setWizardHint(t("integrations.needTeamAndSpace"));
      return;
    }
    setScopeAction("save");
    setWizardHint("");
    try {
      const scopeId = String(space.id);
      const scopeName = space.name || `Space ${scopeId}`;
      await api<Connection>(`/api/integrations/clickup/connections/${encodeURIComponent(wizardConnectionId)}/scope`, {
        method: "POST",
        body: JSON.stringify({
          connection_id: wizardConnectionId,
          scope_type: "space",
          scope_id: scopeId,
          scope_name: scopeName,
          clickup_team_id: wizardTeamId
        })
      });

      setWizardScopeType("space");
      setWizardScopeId(scopeId);

      const statusesRes = await api<{ statuses: string[]; scope_type: "space" | "list"; scope_id: string }>(
        `/api/integrations/clickup/connections/${encodeURIComponent(wizardConnectionId)}/statuses`
      );
      const existing = await api<{ mappings: { source_status: string; normalized_status: string }[] }>(
        `/api/integrations/clickup/connections/${encodeURIComponent(wizardConnectionId)}/mapping`
      );
      const existingMap = new Map((existing.mappings || []).map((m) => [m.source_status, m.normalized_status]));
      const rows = (statusesRes.statuses || []).map((s) => ({
        source_status: s,
        normalized_status: existingMap.get(s) || autoMapStatus(s)
      }));
      setWizardMappingRows(rows);
      setWizardStep(3);
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setScopeAction(null);
    }
  }

  async function saveMappingAndFinish() {
    if (!wizardConnectionId || !wizardScopeId || wizardMappingRows.length === 0) {
      setWizardHint("Нет данных для сохранения маппинга.");
      return;
    }
    setMappingAction("save");
    setWizardHint("");
    try {
      await api<{ message: string }>(`/api/integrations/clickup/connections/${encodeURIComponent(wizardConnectionId)}/mapping`, {
        method: "POST",
        body: JSON.stringify({
          connection_id: wizardConnectionId,
          scope_type: wizardScopeType,
          scope_id: wizardScopeId,
          mappings: wizardMappingRows
        })
      });
      await loadConnections();
      setWizardStep(4);
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setMappingAction(null);
    }
  }

  async function syncConnection(connectionId: string, syncMode: "auto" | "full" = "auto") {
    setBusy(true);
    setImportingConnectionId(connectionId);
    setPageMessage("");
    try {
      const qs = new URLSearchParams({ sync_mode: syncMode });
      const res = await api<{ message: string }>(
        `/api/integrations/clickup/connections/${encodeURIComponent(connectionId)}/import?${qs.toString()}`,
        {
          method: "POST"
        }
      );
      setPageMessage(res.message);
      await loadConnections();
    } catch (e: unknown) {
      setPageMessage(explainApiError(e));
    } finally {
      setBusy(false);
      setImportingConnectionId(null);
    }
  }

  async function syncConnectionFull(connectionId: string) {
    if (typeof window !== "undefined" && !window.confirm(t("integrations.confirmFullSync"))) return;
    await syncConnection(connectionId, "full");
  }

  async function deleteConnection(connectionId: string) {
    if (typeof window !== "undefined" && !window.confirm(t("integrations.confirmDisconnect"))) return;
    setBusy(true);
    try {
      const res = await api<{ message: string }>(`/api/integrations/clickup/connections/${encodeURIComponent(connectionId)}`, {
        method: "DELETE"
      });
      setPageMessage(res.message);
      await loadConnections();
      if (wizardConnectionId === connectionId) closeWizard();
    } catch (e: unknown) {
      setPageMessage(explainApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function openAddWizard() {
    resetWizard();
    setWizardMode("add");
    setWizardStep(0);
    setModalOpen(true);
  }

  async function openEditWizard(conn: Connection) {
    resetWizard();
    setWizardMode("edit");
    setWizardConnectionId(conn.id);
    setWizardConnectionName(conn.name || "ClickUp");
    setWizardTeamId(conn.clickup_team_id || "");
    setWizardSpaceId(conn.scope_id || "");
    setWizardScopeId(conn.scope_id || "");
    setWizardScopeType((conn.scope_type as "space" | "list") || "space");
    setWizardStep(1);
    setModalOpen(true);
    setBusy(true);
    setWizardHint("");
    try {
      try {
        const secret = await api<{ api_token: string }>(
          `/api/integrations/clickup/connections/${encodeURIComponent(conn.id)}/credentials`
        );
        setWizardToken(secret.api_token);
      } catch (e: unknown) {
        setWizardHint(explainApiError(e));
      }
      if (conn.clickup_team_id) {
        await loadTeamsForConnection(conn.id, { preferTeamId: conn.clickup_team_id });
        await loadSpacesForConnection(conn.id, conn.clickup_team_id, {
          preferSpaceId: conn.scope_id ?? ""
        });
      } else {
        await loadTeamsForConnection(conn.id);
      }
    } catch (e: unknown) {
      setWizardHint(explainApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const wizardModal = modalOpen ? (
    <div style={backdropStyle(true)} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeWizard()}>
      <div role="dialog" aria-modal="true" aria-labelledby="integration-wizard-title" style={panelStyle()} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h3 id="integration-wizard-title" style={{ margin: 0 }}>{t("integrations.wizard.title")}</h3>
          <button type="button" className="btn" onClick={closeWizard} aria-label={t("integrations.wizard.close")}>×</button>
        </div>

        <p className="muted" style={{ margin: "10px 0 16px 0", fontSize: 12 }}>
          <strong>{t("integrations.wizard.phaseLabel")}</strong>{" "}
          {wizardStep === 0
            ? t("integrations.wizard.stepProvider")
            : wizardStep === 1
              ? t("integrations.wizard.stepCredentials")
              : wizardStep === 2
                ? t("integrations.wizard.stepScope")
                : wizardStep === 3
                  ? "Маппинг статусов"
                  : t("integrations.wizard.stepDone")}
        </p>

        {wizardHint ? <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap" }}>{wizardHint}</p> : null}

        {wizardStep === 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button className="btn" type="button" disabled={busy} onClick={() => setWizardStep(1)}>ClickUp</button>
            <button className="btn" type="button" disabled>{t("integrations.provider.jira.name")} ({t("integrations.soon")})</button>
          </div>
        ) : null}

        {wizardStep === 1 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input value={wizardConnectionName} onChange={(e) => setWizardConnectionName(e.target.value)} placeholder="Название подключения" disabled={credentialAction !== null || busy} />
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {wizardMode === "edit" ? t("integrations.wizard.tokenMaskedEdit") : t("integrations.wizard.credentialsHelp")}
            </p>
            {wizardMode === "edit" ? (
              <input
                type="password"
                value={wizardToken}
                onChange={(e) => setWizardToken(e.target.value)}
                placeholder="pk_..."
                autoComplete="off"
                spellCheck={false}
                disabled={credentialAction !== null || busy}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: 13,
                  padding: "10px 12px",
                  background: "var(--panel-soft)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)"
                }}
              />
            ) : (
              <textarea value={wizardToken} onChange={(e) => setWizardToken(e.target.value)} rows={5} placeholder="pk_..." style={{ fontFamily: "monospace", fontSize: 13 }} disabled={credentialAction !== null || busy} />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="btn" type="button" disabled={busy || credentialAction !== null} onClick={() => setWizardStep(0)}>{t("integrations.wizard.back")}</button>
              <button
                className="btn"
                type="button"
                disabled={busy || credentialAction !== null}
                aria-busy={credentialAction === "verify"}
                onClick={() => void verifyTokenOnly()}
              >
                {credentialAction === "verify" ? <span className="btnSpinner" aria-hidden /> : null}
                {t("integrations.testConnection")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy || credentialAction !== null}
                aria-busy={credentialAction === "saveToken"}
                onClick={() => void saveCredentialsAndContinue()}
              >
                {credentialAction === "saveToken" ? <span className="btnSpinner" aria-hidden /> : null}
                {t("integrations.saveAndContinue")}
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 2 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("integrations.scopeExplanation")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                type="button"
                disabled={busy || scopeAction !== null || !wizardConnectionId}
                aria-busy={scopeAction === "teams"}
                onClick={() => void refreshWizardTeams()}
              >
                {scopeAction === "teams" ? <span className="btnSpinner" aria-hidden /> : null}
                Обновить команды
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy || scopeAction !== null || !wizardConnectionId || !wizardTeamId}
                aria-busy={scopeAction === "spaces"}
                onClick={() => void refreshWizardSpaces()}
              >
                {scopeAction === "spaces" ? <span className="btnSpinner" aria-hidden /> : null}
                {t("integrations.refreshSpaces")}
              </button>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("integrations.clickupTeam")}</span>
              <select value={wizardTeamId} onChange={(e) => setWizardTeamId(e.target.value)} disabled={busy || scopeAction !== null}>
                <option value="">{t("integrations.selectPlaceholder")}</option>
                {wizardTeams.map((team) => {
                  const id = tid(team);
                  return <option key={id} value={id}>{team.name || id}</option>;
                })}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("integrations.clickupSpace")}</span>
              <select value={wizardSpaceId} onChange={(e) => setWizardSpaceId(e.target.value)} disabled={!wizardTeamId || busy || scopeAction !== null}>
                <option value="">{t("integrations.selectPlaceholder")}</option>
                {wizardSpaces.map((space) => <option key={String(space.id)} value={String(space.id)}>{space.name || `Space ${space.id}`}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" type="button" disabled={busy || scopeAction !== null} onClick={() => setWizardStep(1)}>{t("integrations.wizard.back")}</button>
              <button
                className="btn"
                type="button"
                disabled={busy || scopeAction !== null}
                aria-busy={scopeAction === "save"}
                onClick={() => void saveScopeAndContinue()}
              >
                {scopeAction === "save" ? <span className="btnSpinner" aria-hidden /> : null}
                {t("integrations.saveScopeContinue")}
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 3 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Сопоставьте статусы ClickUp с нормализованными статусами TeamUp. Шаг обязателен для завершения подключения.
            </p>
            {wizardMappingRows.map((row, idx) => (
              <div className="card" key={`${row.source_status}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>{row.source_status}</div>
                <select
                  value={row.normalized_status}
                  disabled={busy || mappingAction !== null}
                  onChange={(e) =>
                    setWizardMappingRows((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, normalized_status: e.target.value } : item))
                    )
                  }
                >
                  {NORMALIZED_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" type="button" disabled={busy || mappingAction !== null} onClick={() => setWizardStep(2)}>{t("integrations.wizard.back")}</button>
              <button
                className="btn"
                type="button"
                disabled={busy || mappingAction !== null || wizardMappingRows.length === 0}
                aria-busy={mappingAction === "save"}
                onClick={() => void saveMappingAndFinish()}
              >
                {mappingAction === "save" ? <span className="btnSpinner" aria-hidden /> : null}
                Сохранить маппинг и завершить
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 4 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0 }}>Подключение готово. Можно сразу запустить синхронизацию.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                type="button"
                disabled={busy || !wizardConnectionId}
                aria-busy={importingConnectionId !== null && importingConnectionId === wizardConnectionId}
                onClick={() => void syncConnection(wizardConnectionId, "auto")}
              >
                {importingConnectionId === wizardConnectionId ? <span className="btnSpinner" aria-hidden /> : null}
                {t("integrations.runHistoricalImport")}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={closeWizard}>{t("integrations.wizard.close")}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  if (!loaded) return <p className="muted">{t("common.loading")}</p>;

  return (
    <>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 700 }}>{t("integrations.connectionsHeading")}</h2>
          <button className="btn" type="button" disabled={busy} onClick={() => void openAddWizard()}>{t("integrations.addConnection")}</button>
        </div>
        {impactWeeklyMeta.enabled ? (
          <div className="card" style={{ padding: "10px 12px", fontSize: 13 }}>
            <p className="muted" style={{ margin: 0 }}>
              {t("integrations.impactWeeklySchedulerOn").replace("{hours}", String(impactWeeklyMeta.intervalHours))}
              {" · "}
              {t("integrations.impactWeeklySchedulerTick").replace("{hours}", String(impactWeeklyMeta.tickHours))}
            </p>
          </div>
        ) : null}
        {connections.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "20px 14px" }}>
            <p className="muted" style={{ margin: 0 }}>{t("integrations.emptyState")}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {connections.map((c) => {
              const hasClickUpScope = Boolean(String(c.scope_id ?? "").trim());
              return (
              <div key={c.id} className="card" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{c.name || "ClickUp"}</strong>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {c.clickup_user_label ? `ClickUp: ${c.clickup_user_label}` : "ClickUp"} · {c.scope_name ? `Scope: ${c.scope_name}` : "Scope не выбран"}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Статус: {c.setup_status === "ready" ? "готово" : "нужно завершить настройку"}
                      {c.last_synced_at ? ` · последний sync: ${formatApiUtcAsLocal(c.last_synced_at)}` : ""}
                      {c.last_sync_attempt_at && (!c.last_synced_at || c.last_sync_attempt_at !== c.last_synced_at)
                        ? ` · последняя попытка: ${formatApiUtcAsLocal(c.last_sync_attempt_at)}`
                        : ""}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {c.sync_scheduler_enabled
                        ? t("integrations.schedulerEnabled").replace("{minutes}", String(c.sync_interval_minutes ?? "—"))
                        : t("integrations.schedulerDisabled")}
                      {c.sync_stale_after_at ? ` · ${t("integrations.schedulerStaleAfter")}: ${formatApiUtcAsLocal(c.sync_stale_after_at)}` : ""}
                    </span>
                    {c.sync_is_stale ? (
                      <span className="muted" style={{ fontSize: 12, color: "#fb923c" }}>
                        {t("integrations.syncStaleWarning")}
                      </span>
                    ) : null}
                    {c.last_sync_error ? (
                      <span className="muted" style={{ fontSize: 12, color: "#fb923c", whiteSpace: "pre-wrap" }}>
                        {t("integrations.lastSyncError")}: {c.last_sync_error}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      type="button"
                      disabled={busy || importingConnectionId !== null || !hasClickUpScope}
                      title={!hasClickUpScope ? t("integrations.syncNeedsScope") : t("integrations.syncIncrementalTitle")}
                      aria-busy={importingConnectionId === c.id}
                      onClick={() => void syncConnection(c.id, "auto")}
                    >
                      {importingConnectionId === c.id ? <span className="btnSpinner" aria-hidden /> : null}
                      {t("integrations.syncIncremental")}
                    </button>
                    <button
                      className="btn btnGhost"
                      type="button"
                      disabled={busy || importingConnectionId !== null || !hasClickUpScope}
                      title={!hasClickUpScope ? t("integrations.syncNeedsScope") : t("integrations.syncFullTitle")}
                      aria-busy={importingConnectionId === c.id}
                      onClick={() => void syncConnectionFull(c.id)}
                    >
                      {importingConnectionId === c.id ? <span className="btnSpinner" aria-hidden /> : null}
                      {t("integrations.syncFull")}
                    </button>
                    <button className="btn" type="button" disabled={busy} onClick={() => void openEditWizard(c)}>
                      Редактировать
                    </button>
                    <button className="btn" type="button" disabled={busy} onClick={() => void deleteConnection(c.id)}>
                      {t("integrations.disconnect")}
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {pageMessage ? <p style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>{pageMessage}</p> : null}
      </div>
      {documentReady && modalOpen ? createPortal(wizardModal, document.body) : null}
    </>
  );
}
