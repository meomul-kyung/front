# 머물;경 (Meomulgyeong) — 프론트엔드 MVP

경상북도 15개 인구감소지역 체류형 여행 추천 서비스 「머물경」의 프론트엔드 MVP입니다.
2026 관광데이터 활용 공모전 제출용으로, 현재 단계에서는 **모든 데이터가 mock**이며 백엔드(Spring Boot) API 명세서/ERD가 확정되면 `src/lib`, `src/data` 를 실제 API 호출로 교체하는 구조로 설계했습니다.

## 실행 방법

```bash
npm install
npm run dev       # 개발 서버 (기본 http://localhost:5173)
npm run build     # 프로덕션 빌드 (dist/ 생성)
npm run preview   # 빌드 결과 미리보기
```

## 기술 스택

- React 19 + TypeScript + Vite
- React Router (SPA 라우팅)
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인)
- 전역 상태: React Context (`src/store/AppContext.tsx`), `localStorage`로 새로고침 시에도 로그인/여행 데이터 유지

## 폴더 구조

```
src/
  types/          도메인 타입 (Region, Itinerary, UserProfile 등)
  data/            mock 데이터 — 15개 지역, 태그
  lib/             핵심 로직 — 지역 추천 매칭, 일정 생성, 지역 기여도 계산
  store/           전역 상태(로그인, 온보딩, 저장 일정, 스탬프)
  components/      공용 UI (버튼, 카드, 모달, 하단 네비 등)
  pages/           화면별 페이지
```

## 화면 구성 (제안서 4대 기능 + 로그인/온보딩)

| 라우트 | 화면 | 대응 기능 |
|---|---|---|
| `/login` | 소셜 로그인(구글·카카오·네이버) | 회원관리 |
| `/onboarding` | 닉네임 입력 | 회원관리 |
| `/home` | 취향→기간→동행 선택 → 지역 추천 | ① 사용자 조건 기반 지역 추천 |
| `/itinerary/:regionId` | Day별 일정, 날씨, 장소교체, 재생성, 저장, 여행완료 | ② 체류형 여행 일정 자동 생성 |
| `/explore`, `/region/:regionId` | 15개 지역 목록·상세 스토리 | ③ 지역 스토리 및 관광 정보 제공 |
| `/trip-result/:id`, `/my` | 지역 기여도 결과, 스탬프, 저장 일정 | ④ 여행 결과 기반 지역 기여도 확인 |

## 실제 API 연동 시 교체 지점

1. **`src/data/regions.ts`** → 한국관광공사 TourAPI 기반 15개 지역 데이터로 교체 (백엔드 `/api/regions` 등)
2. **`src/lib/match.ts`** → 현재는 rule-based 가중합을 프론트에서 계산. 백엔드가 추천 API를 제공하면 이 함수를 fetch 호출로 교체
3. **`src/lib/itinerary.ts`** → TourAPI + 카카오지도 + 기상청 API 연동 결과로 대체될 부분. `generateItinerary`, `regeneratePlaceItem`, `regenerateItinerary` 함수 시그니처를 유지한 채 내부를 API 호출로 바꾸면 화면 코드는 그대로 재사용 가능
4. **`src/lib/contribution.ts`** → 백엔드가 계산한 지역 기여도 응답으로 교체
5. **`src/store/AppContext.tsx`** → 로그인은 현재 mock. 실제 소셜 로그인 연동(OAuth) 후 토큰 저장 로직 추가 필요

## 알려진 제약 (MVP 단계)

- 이미지: 실제 관광 사진 대신 지역별 그라디언트 아트로 대체 (저작권 이슈 회피, `components/RegionArt.tsx`)
- 이동 동선: 실시간 카카오 지도 API 대신 근사 정렬(같은 권역 우선순위)로 단순화
- 날씨: 기상청 API 대신 mock 값
- API 명세서/ERD 미확정 상태이므로 백엔드팀 작업 완료 후 위 "교체 지점"을 기준으로 연동 작업 진행 권장

  ## 트러블슈팅 — 로그인 콜백 404 (Vercel)

| 항목 | 내용 |
|---|---|
| 증상 | 소셜 로그인 후 `https://meomulgyeong-frontend-one.vercel.app/oauth/callback?accessToken=...`로 리다이렉트되지만 **404 NOT_FOUND**(Vercel Edge, `icn1::` 트레이스 ID) 페이지가 뜸 |
| 원인 | 백엔드 OAuth 로그인 자체는 정상 동작(응답에 `accessToken`이 정상적으로 붙어서 돌아옴). 문제는 백엔드가 `window.location.href` 방식의 **풀 페이지 리다이렉트**로 `/oauth/callback`을 호출하는데, 이는 React Router가 처리하는 클라이언트 사이드 라우팅이 아니라 **브라우저가 서버(Vercel)에 실제 파일을 요청하는 방식**임. Vercel은 정적 파일로 `index.html`만 갖고 있고 `/oauth/callback` 경로에 대응하는 파일이 없어 404를 반환함. (React Router의 `<Link>`/`navigate()`로 이동할 때는 발생하지 않고, 새로고침·외부 리다이렉트·직접 URL 접근처럼 서버에 새 요청이 갈 때만 발생) |
| 해결 | 저장소 루트에 `vercel.json` 추가 — 모든 경로 요청을 `index.html`로 rewrite해서 React Router가 라우팅을 이어받도록 처리 |
| 적용 코드 | ```json\n{\n  "rewrites": [\n    { "source": "/(.*)", "destination": "/index.html" }\n  ]\n}\n``` |
| 부수 효과 | `/oauth/callback`뿐 아니라 `/onboarding`, `/home` 등 다른 클라이언트 라우트를 새로고침하거나 URL로 직접 접근할 때 발생하던 동일한 404도 함께 해결됨 |
| 상태 | ✅ 해결 (vercel.json 커밋 후 재배포 확인 필요) |
