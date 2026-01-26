// Utility to safely extract JSON payloads returned by Lovable Cloud functions.
// Supabase JS may surface non-2xx responses as `error` even when a JSON body exists.

export type EdgeFnPayload =
  | {
      success: boolean;
      code?: string;
      message?: string;
      [key: string]: unknown;
    }
  | null;

const tryParseJson = (input: unknown): any => {
  if (!input) return null;
  if (typeof input === "object") return input;
  if (typeof input !== "string") return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

/**
 * Attempts to extract the function response payload from either `data` (2xx)
 * or `error` (non-2xx), without throwing.
 */
export const extractEdgeFunctionPayload = (
  data: unknown,
  error: any
): EdgeFnPayload => {
  // 2xx path
  if (data && typeof data === "object" && "success" in (data as any)) {
    return data as any;
  }

  if (!error) return null;

  // Preferred: some runtimes attach the raw body to error.context
  const fromContextBody = tryParseJson(error?.context?.body);
  if (fromContextBody && typeof fromContextBody === "object" && "success" in fromContextBody) {
    return fromContextBody;
  }

  // Fallback: parse error.message (often like: "Edge function returned 409: Error, {...}")
  const msg: string | undefined = error?.message;
  if (typeof msg === "string") {
    const braceStart = msg.indexOf("{");
    const braceEnd = msg.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      const maybeJson = msg.slice(braceStart, braceEnd + 1);
      const parsed = tryParseJson(maybeJson);
      if (parsed && typeof parsed === "object" && "success" in parsed) {
        return parsed;
      }
    }

    // Back-compat with previous regex approach
    const jsonMatch = msg.match(/Error, (.+)$/);
    if (jsonMatch?.[1]) {
      const parsed = tryParseJson(jsonMatch[1]);
      if (parsed && typeof parsed === "object" && "success" in parsed) {
        return parsed;
      }
    }
  }

  return null;
};
