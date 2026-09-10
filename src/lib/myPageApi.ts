import { apiFetch } from "./apiClient";

export type MyPageRegion = {
  regionId: number;
  regionName: string;
};

export type StampsResponse = {
  stamps: Array<{
    regionId: number;
    regionName: string;
    collected: boolean;
  }>;
};

export type CompletedTripsResponse = {
  completedTrips: Array<{
    itineraryId: number;
    region: MyPageRegion;
    nights: number;
    partySize: number;
    completedAt: string;
  }>;
};

export function getMyStamps(): Promise<StampsResponse> {
  return apiFetch<StampsResponse>("/api/users/me/stamps");
}

export function getCompletedTrips(): Promise<CompletedTripsResponse> {
  return apiFetch<CompletedTripsResponse>("/api/users/me/completed-trips");
}
