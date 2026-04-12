import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function safeJsonParse(response: Response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }
  const text = await response.text();
  console.error("Non-JSON response received:", text);
  throw new Error(`Expected JSON but received ${contentType || "unknown content type"}. The server might have returned an error page.`);
}
