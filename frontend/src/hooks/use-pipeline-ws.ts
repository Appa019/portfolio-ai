"use client";

import { useEffect, useRef, useState } from "react";
import { createPipelineSocket, type PipelineEvent, type RoundInfo } from "@/lib/api";

export type AgentStatusMap = Record<
  string,
  { status: string; data?: Record<string, unknown>; roundInfo?: RoundInfo }
>;

const AGENT_NAMES = [
  "market_data",
  "macro_analyst",
  "sector_analyst",
  "portfolio_balancer",
  "b3_screener",
  "crypto_screener",
  "candidate_data",
  "deep_research_b3",
  "deep_research_crypto",
  "risk_analyst",
  "sentiment_analyst",
  "consolidator",
] as const;

function buildInitialAgents(): AgentStatusMap {
  const initial: AgentStatusMap = {};
  for (const name of AGENT_NAMES) {
    initial[name] = { status: "pending" };
  }
  return initial;
}

export function usePipelineWs(contributionId: string | null) {
  const [agents, setAgents] = useState<AgentStatusMap>(buildInitialAgents);
  const [pipelineStatus, setPipelineStatus] = useState<string>("idle");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!contributionId) return;

    setAgents(buildInitialAgents());
    const ws = createPipelineSocket(contributionId);
    wsRef.current = ws;

    ws.onopen = () => {
      setPipelineStatus("running");
    };

    ws.onmessage = (event) => {
      const data: PipelineEvent = JSON.parse(event.data);
      if (data.type === "ping") return;

      if (data.agent === "pipeline") {
        setPipelineStatus(data.status);
        return;
      }

      setAgents((prev) => ({
        ...prev,
        [data.agent]: {
          status: data.status,
          data: data.data,
          roundInfo: data.round_info,
        },
      }));
    };

    ws.onerror = () => {
      setPipelineStatus("error");
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [contributionId]);

  return { agents, pipelineStatus, AGENT_NAMES };
}
