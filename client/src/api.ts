const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2: health check only. Issue 4 will extend this to also fetch
// `${API_URL}/api/categories` and replace the empty array below.
export async function checkSystem(): Promise<SystemStatus> {
  try {
    const healthRes = await fetch(`${API_URL}/api/health`);
    if (!healthRes.ok) {
      throw new Error("Unable to connect to TokTickIT API");
    }
  } catch {
    // Catches both non-OK responses above and network-level failures
    // (e.g. backend not running, DNS/connection refused).
    throw new Error("Unable to connect to TokTickIT API");
  }

  // TODO(Issue 4): fetch `${API_URL}/api/categories`, throw if !res.ok,
  // and return the real categories here instead of [].
  return { online: true, categories: [] };
}