import { apiFetch } from "./apiClient";
import type { CompanionType, DayPlan, Itinerary, PlaceItem, TripCompletion } from "../types";
import { REGIONS } from "../data/regions";

// ────────────────────────────────────────────────────────────
// 백엔드 ERD 기반 타입 — 실제 스펙이 나오면 TODO 부분을 수정한다.
// ────────────────────────────────────────────────────────────

/** ERD itinerary_item.item_type 열거값 */
export type BackendItemType =
  | "ARRIVAL"
  | "TOURIST_SPOT"
  | "RESTAURANT"
  | "EXPERIENCE"
  | "FESTIVAL"
  | "REST"
  | "DEPARTURE";

// TODO: 백엔드 실제 스펙 확인 필요 — companion_type 열거값 (FRIENDS vs FRIEND 등)
export type BackendCompanionType = "SOLO" | "COUPLE" | "FRIENDS" | "FAMILY";

export interface CreateItineraryRequest {
  regionId: number;
  companionType: BackendCompanionType;
  nights: number;
  startDate: string; // "YYYY-MM-DD"
  preferenceTags: string[];
}

export interface ItineraryItemResponse {
  itemId: number;
  sequence: number;
  type: BackendItemType;
  title: string;
  reason: string | null;
}

export interface ItineraryDayResponse {
  dayNumber: number;
  date: string; // "YYYY-MM-DD"
  weather: {
    condition: string | null;
    minimumTemperature: number | null;
    maximumTemperature: number | null;
  };
  items: ItineraryItemResponse[];
}

export interface ItineraryResponse {
  itineraryId: number;
  region: { regionId: number; regionName: string };
  companionType: BackendCompanionType;
  nights: number;
  startDate: string;
  status: string;
  bookmarked: boolean;
  days: ItineraryDayResponse[];
}

export interface ReplaceItemRequest {
  excludePreviouslyRecommended?: boolean;
}

export interface ReplaceItemResponse {
  itineraryId: number;
  replacedItemId: number;
  newItem: ItineraryItemResponse;
  generationVersion: number;
}

export interface CompleteItineraryRequest {
  stayHours: number;
  partySize: number;
  totalSpent: number;
}

export interface CompleteItineraryResponse {
  completedTripId: number;
  itineraryId: number;
  region: { regionId: number; regionName: string };
  completedAt: string;
}

// ────────────────────────────────────────────────────────────
// 프론트엔드 타입 → 백엔드 코드 매핑
// ────────────────────────────────────────────────────────────

/** 프론트엔드 CompanionType → 백엔드 companionType 변환
 *  저장된 일정(구 코드: alone/couple/friend/family)과
 *  신규 홈(백엔드 코드: SOLO/COUPLE/FRIENDS/FAMILY) 양쪽을 지원한다. */
export function toBackendCompanion(companion: string): BackendCompanionType {
  const MAP: Record<string, BackendCompanionType> = {
    alone: "SOLO",
    couple: "COUPLE",
    friend: "FRIENDS",
    family: "FAMILY",
    SOLO: "SOLO",
    COUPLE: "COUPLE",
    FRIENDS: "FRIENDS",
    FAMILY: "FAMILY",
  };
  return MAP[companion] ?? "SOLO";
}

const ITEM_CATEGORY_MAP: Record<BackendItemType, PlaceItem["category"]> = {
  TOURIST_SPOT: "attraction",
  FESTIVAL: "attraction",
  RESTAURANT: "food",
  EXPERIENCE: "experience",
  ARRIVAL: "stay",
  REST: "stay",
  DEPARTURE: "stay",
};

// TODO: 백엔드 실제 스펙 확인 필요 — 백엔드가 시간 필드를 주지 않으면 sequence_no 기반 추정값을 사용
const SEQUENCE_TIMES: Record<number, string> = {
  1: "09:00",
  2: "11:00",
  3: "13:00",
  4: "15:00",
  5: "17:00",
  6: "19:00",
  7: "21:00",
};

function toFrontendItem(item: ItineraryItemResponse, regionId: string): PlaceItem {
  return {
    id: String(item.itemId),
    regionId,
    name: item.title,
    category: ITEM_CATEGORY_MAP[item.type] ?? "stay",
    time: SEQUENCE_TIMES[item.sequence] ?? "09:00",
    description: item.reason ?? "",
  };
}

function toFrontendDay(day: ItineraryDayResponse, regionId: string): DayPlan {
  return {
    day: day.dayNumber,
    date: day.date,
    // TODO: 백엔드 실제 스펙 확인 필요 — 날씨 정보 제공 여부. 현재는 placeholder
    weather: { temp: day.weather.maximumTemperature ?? 23, condition: day.weather.condition ?? "정보 없음" },
    items: day.items.map((it) => toFrontendItem(it, regionId)),
  };
}

/**
 * 백엔드 regionName → 프론트엔드 region id(예: "andong") 변환
 * REGIONS 배열과 name/shortName으로 매칭하고, 실패하면 regionId를 문자열로 폴백한다.
 */
export function resolveFrontendRegionId(regionName: string, backendRegionId?: number): string {
  const matched = REGIONS.find((r) => r.name === regionName || r.shortName === regionName);
  if (matched) return matched.id;
  return backendRegionId ? `api-${backendRegionId}` : `api-${regionName}`;
}

/** 백엔드 ItineraryResponse → 프론트엔드 Itinerary 변환 */
export function toFrontendItinerary(res: ItineraryResponse, frontendRegionId: string): Itinerary {
  const companionLegacyMap: Record<BackendCompanionType, CompanionType> = {
    SOLO: "alone",
    COUPLE: "couple",
    FRIENDS: "friend",
    FAMILY: "family",
  };
  return {
    id: String(res.itineraryId),
    regionId: frontendRegionId,
    backendItineraryId: res.itineraryId,
    nights: res.nights,
    companion: companionLegacyMap[res.companionType] ?? "alone",
    days: res.days.map((d) => toFrontendDay(d, frontendRegionId)),
  };
}

// ────────────────────────────────────────────────────────────
// API 함수 (8개)
// ────────────────────────────────────────────────────────────

/** 1. 일정 생성 */
export async function createItinerary(req: CreateItineraryRequest): Promise<ItineraryResponse> {
  return apiFetch<ItineraryResponse>("/api/itineraries", {
    method: "POST",
    body: req,
  });
}

/** 2. 일정 조회 */
export async function getItinerary(itineraryId: number): Promise<ItineraryResponse> {
  return apiFetch<ItineraryResponse>(`/api/itineraries/${itineraryId}`);
}

/** 3. 일정 아이템 교체 (교체 ↻ 버튼) */
// TODO: 백엔드 실제 스펙 확인 필요 — HTTP 메서드(PATCH/POST), 요청 바디 형식, 응답 형식 확인
export async function replaceItineraryItem(
  itineraryId: number,
  itemId: number,
  req: ReplaceItemRequest = {}
): Promise<ReplaceItemResponse> {
  return apiFetch<ReplaceItemResponse>(`/api/itineraries/${itineraryId}/items/${itemId}/replace`, {
    method: "POST",
    body: req,
  });
}

/** 4. 전체 일정 재생성 */
// TODO: 백엔드 실제 스펙 확인 필요 — 요청 바디 필요 여부, 응답 형식 확인
export async function regenerateFullItinerary(itineraryId: number): Promise<ItineraryResponse> {
  return apiFetch<ItineraryResponse>(`/api/itineraries/${itineraryId}/regenerate`, {
    method: "POST",
  });
}

/** 5. 일정 북마크 추가 */
// TODO: 백엔드 실제 스펙 확인 필요 — 엔드포인트(bookmark vs save), 응답 형식 확인
export async function bookmarkItinerary(itineraryId: number): Promise<void> {
  await apiFetch<null>(`/api/itineraries/${itineraryId}/bookmark`, {
    method: "PUT",
  });
}

/** 6. 일정 북마크 해제 */
export async function unbookmarkItinerary(itineraryId: number): Promise<void> {
  await apiFetch<null>(`/api/itineraries/${itineraryId}/bookmark`, {
    method: "DELETE",
  });
}

/** 7. 여행 완료 등록 */
export async function completeItinerary(
  itineraryId: number,
  req: CompleteItineraryRequest
): Promise<CompleteItineraryResponse> {
  return apiFetch<CompleteItineraryResponse>(`/api/itineraries/${itineraryId}/completion`, {
    method: "POST",
    body: req,
  });
}

/** 8. 내 저장 일정 목록 조회. 서버는 목록 요약만 반환하므로 상세를 이어서 조회한다. */
export async function listBookmarkedItineraries(): Promise<ItineraryResponse[]> {
  const bookmarks = await apiFetch<{ itineraries: { itineraryId: number }[] }>(
    "/api/users/me/bookmarked-itineraries",
  );
  return Promise.all(bookmarks.itineraries.map(({ itineraryId }) => getItinerary(itineraryId)));
}

/** 완료 응답으로 TripCompletion 객체 생성 */
export function toTripCompletion(
  res: CompleteItineraryResponse,
  frontendRegionId: string,
  visitedDays: number,
  visitors: number
): TripCompletion {
  return {
    itineraryId: String(res.itineraryId),
    regionId: frontendRegionId,
    visitedDays,
    visitors,
    completedAt: res.completedAt,
  };
}
