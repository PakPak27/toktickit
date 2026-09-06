const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface RequesterDto {
  id: number;
  name: string;
  email: string;
}

export async function fetchActiveRequesters(): Promise<RequesterDto[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error("Unable to load requesters");
  }
  return res.json();
}