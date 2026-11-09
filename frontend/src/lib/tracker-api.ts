const API_URL = process.env.NEXT_PUBLIC_TRACKER_API_URL;

export class ApiError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}, public status = 0) {
    super(message);
  }
}

let verifiedService: Promise<void> | undefined;

async function verifyService() {
  if (!API_URL) throw new ApiError("The tracker API is not configured. Set NEXT_PUBLIC_TRACKER_API_URL and restart the frontend.");
  if (!verifiedService) {
    verifiedService = fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(10000), cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || (await response.json()).service !== "application-tracker") {
          throw new ApiError("This address is not the standalone tracker API. Check the development configuration.");
        }
      }).catch((error) => { verifiedService = undefined; throw error; });
  }
  return verifiedService;
}

export async function trackerApi<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    await verifyService();
    const response = await fetch(`${API_URL}${path}`, {
      ...options, cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(body?.error?.message ?? "The request could not be completed. Please try again.", body?.error?.fields, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
      throw new ApiError("The request timed out. Your inputs are still here; try again.");
    }
    throw new ApiError("Cannot reach the tracker. Check that the local backend is running, then try again. Your inputs have been kept.");
  }
}
