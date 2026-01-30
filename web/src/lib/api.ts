"use client";

export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type FetchOptions = RequestInit & {
  json?: unknown;
};

export const fetchJson = async <T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> => {
  const { json, headers, ...rest } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
    ...rest,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};
