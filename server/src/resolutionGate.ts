// specification.md BR-11/BR-12 — the resolution gate: a Ticket may move to
// RESOLVED only when at least one Action Taken exists and none of them has
// an open follow-up. Pure and side-effect free (no Prisma/HTTP) so it can be
// unit-tested directly; server/src/app.ts supplies the Actions Taken already
// loaded from the database.

export interface GateAction {
  id: number;
  description: string;
  followUpRequired: boolean;
}

export interface ResolutionGateResult {
  blocked: boolean;
  reason: "NO_ACTIONS" | "OPEN_FOLLOW_UP" | null;
  blockingActions: { id: number; description: string }[];
}

export function evaluateResolutionGate(actions: GateAction[]): ResolutionGateResult {
  if (actions.length === 0) {
    return { blocked: true, reason: "NO_ACTIONS", blockingActions: [] };
  }
  const openFollowUps = actions.filter((a) => a.followUpRequired);
  if (openFollowUps.length > 0) {
    return {
      blocked: true,
      reason: "OPEN_FOLLOW_UP",
      blockingActions: openFollowUps.map((a) => ({ id: a.id, description: a.description })),
    };
  }
  return { blocked: false, reason: null, blockingActions: [] };
}
