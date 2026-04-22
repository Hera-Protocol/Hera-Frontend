import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { heraApi, type HeraClientConfig } from "@/lib/hera-api";
import { useHeraConfig } from "@/lib/hera-config";

function useClientConfig(): HeraClientConfig {
  const { apiBaseUrl, apiKey } = useHeraConfig();

  return {
    apiBaseUrl,
    apiKey,
  };
}

export function useWorkspacesQuery() {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "workspaces", config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listWorkspaces(config),
    enabled: isConfigured,
  });
}

export function useActiveWorkspace() {
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useHeraConfig();
  const workspacesQuery = useWorkspacesQuery();
  const workspaces = workspacesQuery.data ?? [];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0] ??
    null;

  useEffect(() => {
    if (!selectedWorkspaceId && activeWorkspace?.id) {
      setSelectedWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, selectedWorkspaceId, setSelectedWorkspaceId]);

  return {
    ...workspacesQuery,
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id ?? "",
  };
}

export function useWorkspaceCasesQuery(workspaceId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "cases", workspaceId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listCases(config, workspaceId),
    enabled: isConfigured && Boolean(workspaceId),
  });
}

export function useCaseDetailQuery(caseId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "case", caseId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.getCase(config, caseId),
    enabled: isConfigured && Boolean(caseId),
    refetchInterval: 3000,
  });
}

export function useCaseEventsQuery(caseId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "case-events", caseId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listCaseEvents(config, caseId),
    enabled: isConfigured && Boolean(caseId),
  });
}

export function useWorkspaceReportsQuery(workspaceId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "reports", workspaceId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listReports(config, workspaceId),
    enabled: isConfigured && Boolean(workspaceId),
  });
}

export function useWorkspaceKeysQuery(workspaceId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "keys", workspaceId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listViewKeys(config, workspaceId),
    enabled: isConfigured && Boolean(workspaceId),
  });
}

export function useWorkspaceAuditLogsQuery(workspaceId: string) {
  const config = useClientConfig();
  const { isConfigured } = useHeraConfig();

  return useQuery({
    queryKey: ["hera", "audit", workspaceId, config.apiBaseUrl, config.apiKey],
    queryFn: () => heraApi.listAuditLogs(config, workspaceId),
    enabled: isConfigured && Boolean(workspaceId),
  });
}

export function useCreateWorkspaceMutation() {
  const config = useClientConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string }) => heraApi.createWorkspace(config, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hera", "workspaces"] });
    },
  });
}
