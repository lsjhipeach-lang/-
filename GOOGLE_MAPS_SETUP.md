# Google Maps 저장 장소 연동 설정

## 적용된 비용 안전장치

- Takeout CSV/JSON 분석은 브라우저 안에서만 실행합니다.
- Places API 키는 Supabase Edge Function의 `GOOGLE_MAPS_API_KEY` secret에만 저장합니다.
- 서버 로그인 사용자의 요청만 허용합니다.
- 한 요청은 최대 20개, 한 달 전체 API 호출은 최대 500회입니다.
- 조회 결과는 30일간 `places_cache`에 저장해 같은 장소를 다시 과금하지 않습니다.
- 기본 조회 필드는 이름, 주소, 좌표, 장소 유형, Google Maps 링크로 제한합니다.
- 평점·영업시간 등 상위 과금 필드는 기본 요청에서 제외합니다.

## 1. Google Cloud 설정

1. Google Cloud Console에서 이 앱 전용 프로젝트를 만듭니다.
2. 결제 계정을 연결하고 `Places API (New)`만 사용 설정합니다.
3. 서버용 API 키를 만듭니다.
4. API 제한을 `Places API (New)`로 설정합니다.
5. 월 예산을 `$1`로 만들고 50%, 90%, 100% 이메일 알림을 설정합니다.
6. Places API 할당량도 낮게 설정합니다. 앱 내부 제한은 월 500회이며, Google Cloud에는 가능한 가장 낮은 일일 요청 한도를 추가합니다.

API 키는 Git 또는 프런트엔드 파일에 넣지 않습니다.

## 2. Supabase 설정

프로젝트 루트에서 기존 Supabase 프로젝트에 연결한 후 다음을 실행합니다.

```powershell
npx supabase login
npx supabase link --project-ref rwmkfgnjsjfbipeybqqk
npx supabase db push
npx supabase secrets set GOOGLE_MAPS_API_KEY=발급받은_서버_API_키
npx supabase functions deploy places-enrich
```

`GOOGLE_MAPS_API_KEY` 값은 대화, 소스 코드, 커밋에 남기지 않고 위 명령 또는 Supabase Dashboard의 Edge Function Secrets에서 직접 등록합니다.

## 3. 앱 사용

1. Google Takeout에서 Google Maps의 `Saved` 데이터를 내보냅니다.
2. ZIP 압축을 풉니다.
3. 앱의 `설정 → Google Maps 장소 가져오기`에서 CSV 또는 JSON 파일을 선택합니다.
4. 주소·좌표로 홋카이도임이 확인된 장소만 자동 선택됩니다.
5. `지역 확인 필요` 항목은 서버 로그인 후 `홋카이도 지역 자동 확인`을 실행합니다.
6. 자동 분류를 검토하고 선택 장소를 가져옵니다.

## 자동 분류 대상

- 식당 → 맛집 DB
- 바·이자카야·펍 → 술 대시보드
- 카페, 숙소, 쇼핑, 관광지, 역·공항 → 통합 지도 후보

타지역으로 확인된 장소와 지역을 확인할 수 없는 장소는 가져오기 대상에서 제외합니다.
