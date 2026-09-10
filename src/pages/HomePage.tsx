import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import TagChip from "../components/TagChip";
import Button from "../components/Button";
import RegionCard from "../components/RegionCard";
import StepDots from "../components/StepDots";
import { REGIONS } from "../data/regions";
import type { Region } from "../types";
import { useApp } from "../store/AppContext";
import {
  getTravelOptions,
  recommendRegions,
  type OptionItem,
  type RegionRecommendation,
  type TravelOptionsResponse,
} from "../lib/recommendationApi";
import { ApiError } from "../lib/apiClient";

// 태그 코드(백엔드 PreferenceTag) → 이모지. travel-options가 신규 코드를 내려도
// 안 깨지도록 기본 이모지로 폴백한다.
const TAG_EMOJI: Record<string, string> = {
  HANOK_CONFUCIANISM: "🏯",
  NATURE: "🌲",
  SEA: "🌊",
  WALKING: "🥾",
  HEALING: "🍃",
  FOOD: "🍚",
  BICYCLE: "🚲",
  HISTORY: "🏛️",
  NIGHT_SKY: "✨",
};
const DEFAULT_TAG_EMOJI = "📍";

const COMPANION_EMOJI: Record<string, string> = {
  SOLO: "🧍",
  FAMILY: "👨‍👩‍👧",
  COUPLE: "💑",
  FRIENDS: "👯",
};
const DEFAULT_COMPANION_EMOJI = "🙂";

const STEPS: { key: "tags" | "nights" | "companion" | "result"; index: number }[] = [
  { key: "tags", index: 0 },
  { key: "nights", index: 1 },
  { key: "companion", index: 2 },
  { key: "result", index: 3 },
];

type Step = "tags" | "nights" | "companion" | "result";

/**
 * 추천 API 응답(regionName 등)을 기존 mock REGIONS(지역 상세 목업)와 이름으로 매칭해
 * RegionCard가 기대하는 전체 Region 형태를 구성한다.
 * 지역 상세 정보 자체는 다른 파트(③ 지역 스토리 API)의 영역이라, 매칭 실패 시에는
 * 추천 API가 준 필드만으로 최소한의 표시용 Region을 만들어 화면이 깨지지 않게 한다.
 */
function toDisplayRegion(rec: RegionRecommendation): Region {
  const matched = REGIONS.find((r) => r.name === rec.regionName || r.shortName === rec.regionName);
  if (matched) return matched;

  return {
    id: `api-${rec.regionId}`,
    name: rec.regionName,
    shortName: rec.regionName,
    identityLine: rec.identityStatement,
    summary: rec.recommendationReason,
    description: rec.recommendationReason,
    tags: [],
    travelStyle: "",
    localTip: "",
    heroPalette: ["#4a6b52", "#93a86b"],
    heroImage: rec.thumbnailUrl ?? undefined,
    isVerifiedHub: false,
    representativeSpots: rec.representativePlaces,
  };
}

export default function HomePage() {
  const { user, setSelection } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("tags");

  const [options, setOptions] = useState<TravelOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [tagCodes, setTagCodes] = useState<string[]>([]);
  const [nights, setNights] = useState<number>(2);
  const [customNights, setCustomNights] = useState("");
  const [companionCode, setCompanionCode] = useState<string | null>(null);

  const [results, setResults] = useState<RegionRecommendation[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // 화면 진입 시 여행 조건 옵션(태그/동행/체류일 범위)을 서버에서 받아온다 — 공개 API
  useEffect(() => {
    getTravelOptions()
      .then((res) => {
        setOptions(res);
        setNights(res.stayDuration.minimumNights);
      })
      .catch((e) => setOptionsError(e instanceof ApiError ? e.message : "여행 조건을 불러오지 못했어요."));
  }, []);

  const stepIndex = STEPS.find((s) => s.key === step)?.index ?? 0;
  const maxTags = options?.preferenceSelection.maximum ?? 3;
  const nightOptions = options
    ? Array.from(
        { length: Math.min(options.stayDuration.maximumNights, 7) - options.stayDuration.minimumNights + 1 },
        (_, i) => options.stayDuration.minimumNights + i
      )
    : [1, 2, 3, 4, 5, 6, 7];

  const toggleTag = (code: string) => {
    setTagCodes((prev) => {
      if (prev.includes(code)) return prev.filter((x) => x !== code);
      if (prev.length >= maxTags) return prev;
      return [...prev, code];
    });
  };

  const runMatch = async (finalCompanionCode: string) => {
    setMatching(true);
    setMatchError(null);
    try {
      const res = await recommendRegions({
        preferenceTags: tagCodes,
        companionType: finalCompanionCode,
        nights,
      });
      setResults(res.recommendations);
      // 다른 화면(일정 생성 등)에서 참고할 수 있도록 로컬 태그 코드 기준으로 최근 선택을 남겨둔다.
      setSelection([], nights, "alone");
      setStep("result");
    } catch (e) {
      setMatchError(e instanceof ApiError ? e.message : "지역 추천에 실패했어요. 다시 시도해주세요.");
    } finally {
      setMatching(false);
    }
  };

  const reset = () => {
    setStep("tags");
    setTagCodes([]);
    setNights(options?.stayDuration.minimumNights ?? 2);
    setCompanionCode(null);
    setResults([]);
    setMatchError(null);
  };

  const companionOptions: OptionItem[] = options?.companionTypes ?? [];
  const tagOptions: OptionItem[] = options?.preferenceTags ?? [];

  return (
    <>
      <TopBar
        title={step === "result" ? "추천 지역" : "머물;경"}
        onBack={step !== "tags" && step !== "result"}
        right={
          step !== "tags" ? (
            <button
              onClick={reset}
              className="text-[11.5px] font-bold tap"
              style={{ color: "var(--color-ink-muted)" }}
            >
              처음부터
            </button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
        {step !== "result" && <StepDots total={3} current={stepIndex} />}

        {optionsError && (
          <p className="text-[12px] font-semibold mb-3" style={{ color: "#c0392b" }}>
            {optionsError}
          </p>
        )}

        {/* ── STEP 1: 취향 태그 ── */}
        {step === "tags" && (
          <div className="animate-in">
            <p
              className="text-[13px] font-bold mb-2"
              style={{ color: "var(--color-accent)" }}
            >
              {user.nickname}님, 반가워요 👋
            </p>
            <h2
              className="text-[27px] font-extrabold mb-1.5 leading-tight tracking-tight"
              style={{ color: "var(--color-ink)" }}
            >
              오늘의 취향을
              <br />
              골라주세요
            </h2>
            <p
              className="text-[13px] mb-5 font-medium"
              style={{ color: "var(--color-ink-soft)" }}
            >
              최대 {maxTags}개까지 선택할 수 있어요 · {tagCodes.length}/{maxTags}
            </p>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((t) => (
                <TagChip
                  key={t.code}
                  label={t.label}
                  emoji={TAG_EMOJI[t.code] ?? DEFAULT_TAG_EMOJI}
                  active={tagCodes.includes(t.code)}
                  disabled={!tagCodes.includes(t.code) && tagCodes.length >= maxTags}
                  onClick={() => toggleTag(t.code)}
                />
              ))}
            </div>
            <Button
              fullWidth
              variant="accent"
              className="mt-10"
              disabled={tagCodes.length === 0}
              onClick={() => setStep("nights")}
            >
              다음 →
            </Button>
          </div>
        )}

        {/* ── STEP 2: 박수 선택 ── */}
        {step === "nights" && (
          <div className="animate-in">
            <h2
              className="text-[27px] font-extrabold mb-1.5 leading-tight tracking-tight"
              style={{ color: "var(--color-ink)" }}
            >
              며칠 머무를까요?
            </h2>
            <p
              className="text-[13px] mb-5 font-medium"
              style={{ color: "var(--color-ink-soft)" }}
            >
              {options?.stayDuration.minimumNights ?? 1}박부터 {options?.stayDuration.maximumNights ?? 7}박까지 선택할 수 있어요
            </p>
            <div className="grid grid-cols-4 gap-2">
              {nightOptions.map((n) => {
                const isActive = nights === n && !customNights;
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setNights(n);
                      setCustomNights("");
                    }}
                    className="py-4 rounded-2xl text-[14px] font-bold tap"
                    style={
                      isActive
                        ? {
                            background: "linear-gradient(135deg, #3b82f6, var(--color-accent-dark))",
                            color: "white",
                            boxShadow: "0 6px 18px -6px rgba(43,108,224,0.52)",
                          }
                        : {
                            background: "white",
                            color: "var(--color-ink)",
                            boxShadow: "0 1px 2px rgba(28,26,22,0.04), 0 6px 16px -8px rgba(28,26,22,0.08)",
                          }
                    }
                  >
                    {n}박
                  </button>
                );
              })}
            </div>
            {options && options.stayDuration.maximumNights > 7 && (
              <div className="mt-5">
                <p
                  className="text-[13px] mb-2 font-semibold"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  8박 이상 머무르시나요?
                </p>
                <input
                  type="number"
                  min={8}
                  max={options.stayDuration.maximumNights}
                  value={customNights}
                  onChange={(e) => {
                    setCustomNights(e.target.value);
                    if (e.target.value) setNights(Number(e.target.value));
                  }}
                  placeholder="직접 입력 (예: 10)"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none font-semibold"
                  style={{
                    background: "white",
                    color: "var(--color-ink)",
                    border: "1.5px solid var(--color-line)",
                    boxShadow: "0 1px 2px rgba(28,26,22,0.04)",
                  }}
                />
              </div>
            )}
            <Button fullWidth variant="accent" className="mt-10" onClick={() => setStep("companion")}>
              다음 →
            </Button>
          </div>
        )}

        {/* ── STEP 3: 동행 ── */}
        {step === "companion" && (
          <div className="animate-in">
            <h2
              className="text-[27px] font-extrabold mb-1.5 leading-tight tracking-tight"
              style={{ color: "var(--color-ink)" }}
            >
              누구와 함께
              <br />
              가시나요?
            </h2>
            <p
              className="text-[13px] mb-5 font-medium"
              style={{ color: "var(--color-ink-soft)" }}
            >
              동행 형태에 맞춰 지역을 추천해드려요
            </p>
            <div className="grid grid-cols-2 gap-3">
              {companionOptions.map((c) => {
                const isActive = companionCode === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => setCompanionCode(c.code)}
                    className="py-7 rounded-3xl flex flex-col items-center gap-2 tap"
                    style={
                      isActive
                        ? {
                            background: "linear-gradient(135deg, #3b82f6, var(--color-accent-dark))",
                            color: "white",
                            boxShadow: "0 10px 28px -10px rgba(43,108,224,0.58)",
                          }
                        : {
                            background: "white",
                            color: "var(--color-ink)",
                            boxShadow: "0 1px 2px rgba(28,26,22,0.04), 0 8px 20px -8px rgba(28,26,22,0.1)",
                          }
                    }
                  >
                    <span className="text-3xl">{COMPANION_EMOJI[c.code] ?? DEFAULT_COMPANION_EMOJI}</span>
                    <div className="text-center">
                      <p className="text-[14px] font-bold leading-none">{c.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {matchError && (
              <p className="text-[12px] font-semibold mt-4" style={{ color: "#c0392b" }}>
                {matchError}
              </p>
            )}
            <Button
              fullWidth
              variant="accent"
              className="mt-10"
              disabled={!companionCode || matching}
              onClick={() => companionCode && runMatch(companionCode)}
            >
              {matching ? "추천 받는 중…" : "지역 추천 받기"}
            </Button>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && (
          <div className="animate-in space-y-3">
            <div className="mb-4">
              <p
                className="text-[13px] font-bold mb-1"
                style={{ color: "var(--color-accent)" }}
              >
                {user.nickname}님을 위한 맞춤 추천
              </p>
              <h2
                className="text-[24px] font-extrabold tracking-tight"
                style={{ color: "var(--color-ink)" }}
              >
                추천 지역 {results.length}곳
              </h2>
              <p
                className="text-[13px] mt-1"
                style={{ color: "var(--color-ink-soft)" }}
              >
                선택한 조건과 가장 잘 맞는 순서예요
              </p>
            </div>
            {results.map((rec) => (
              <RegionCard
                key={rec.regionId}
                region={toDisplayRegion(rec)}
                reason={rec.recommendationReason}
                onClick={() =>
                  navigate(
                    `/itinerary/${toDisplayRegion(rec).id}?nights=${nights}&companion=${companionCode}&backendRegionId=${rec.regionId}&tags=${encodeURIComponent(tagCodes.join(","))}`
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}
