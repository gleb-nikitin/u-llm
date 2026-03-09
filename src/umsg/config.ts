export const UMSG_BASE_URL =
  process.env.UMSG_BASE_URL || "http://chain-api.u-msg.local:18080";

export const UMSG_PARTICIPANT_ID =
  process.env.UMSG_PARTICIPANT_ID || "u-llm";

export const UMSG_WS_URL =
  UMSG_BASE_URL.replace(/^http/, "ws") +
  `/ws/stream?participant=${UMSG_PARTICIPANT_ID}`;
