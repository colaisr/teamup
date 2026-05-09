import { api } from "@/lib/api";

export type AttentionExplainResult = {
  run_id: string;
  workspace_id: string;
  source_task_id: string;
  model_id: string;
  summary: string;
  takeaways: string[];
  recommended_actions: string[];
  evidence_refs: string[];
  limitations: string;
};

export async function explainAttentionTask(
  workspaceId: string,
  sourceTaskId: string,
  modelId?: string,
  includeSubtasks = false
): Promise<AttentionExplainResult> {
  return api<AttentionExplainResult>(`/api/ai/attention/${workspaceId}/explain-task`, {
    method: "POST",
    body: JSON.stringify({
      source_task_id: sourceTaskId,
      model_id: modelId?.trim() || null,
      include_subtasks: includeSubtasks
    })
  });
}
