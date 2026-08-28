# Google Maps 저장 장소 연동 — 요금 0원 모드

## 운영 원칙

- 앱은 Google Places API를 호출하지 않습니다.
- Google Cloud 프로젝트, 결제 계정, API 키가 없어도 장소를 가져올 수 있습니다.
- Google Maps 계정과 삿포로 앱의 Supabase 로그인 계정은 서로 달라도 됩니다.
- Google Maps의 공개 공유 목록 링크는 로그인된 삿포로 앱의 중계 함수가 장소명·메모·주소·좌표만 읽습니다.
- Google Takeout의 CSV/JSON은 브라우저 안에서만 분석합니다.
- 주소·좌표·파일 내용으로 홋카이도임이 확인된 장소만 자동 선택합니다.
- 위치가 불확실한 장소는 Google Maps 링크를 직접 확인한 뒤 사용자가 선택합니다.
- 타지역으로 판별된 장소는 선택할 수 없습니다.

이 방식은 Google Maps Platform의 현재 무료 사용량이나 향후 가격 정책에 의존하지 않습니다. 유료 API 요청 자체를 만들지 않으므로 Google Places API 추가 요금이 발생하지 않습니다.

## 공유 목록 링크로 가져오는 방법 (권장)

1. Google Maps에서 가져올 저장 목록을 엽니다.
2. `목록 공유 → 링크 복사`를 누릅니다.
3. 삿포로 앱에 서버 로그인한 뒤 `통합 지도 → 상단 + 장소 가져오기`를 엽니다.
4. 공유 링크를 붙여 넣고 `목록 불러오기`를 누릅니다.
5. 자동 분류 결과를 확인하고 필요한 항목만 체크한 뒤 가져옵니다.

두 Google 계정은 달라도 됩니다. 공유 목록을 읽을 때 Google Places API, API 키 또는 Google Cloud 결제 계정을 사용하지 않습니다.

## Takeout 파일로 가져오는 방법 (대체 방식)

1. [Google Takeout](https://takeout.google.com/)에서 저장 장소가 포함된 CSV 또는 JSON을 내려받습니다.
2. ZIP 압축을 풉니다.
3. 삿포로 앱의 `통합 지도 → 상단 + 장소 가져오기`를 엽니다.
4. 압축을 푼 CSV 또는 JSON 파일을 선택합니다.
5. `지도 확인 후 직접 선택` 항목은 오른쪽 Google Maps 링크로 실제 위치를 확인합니다.
6. 홋카이도 장소가 맞으면 체크하고 분류를 선택한 뒤 가져옵니다.

## 자동 분류 대상

- 식당 → 맛집 DB
- 바·이자카야·펍 → 술 대시보드
- 카페, 숙소, 쇼핑, 관광지, 역·공항 → 통합 지도 후보

## Google Cloud 관련 주의사항

- 이 앱을 위해 Places API를 활성화하거나 API 키를 만들 필요가 없습니다.
- 이미 API 키를 만들었다면 키를 삭제하거나 `Places API (New)`를 사용 중지합니다.
- 이미 결제 계정을 연결했다면 다른 Google Cloud 서비스가 없는지 확인한 뒤 프로젝트의 결제 연결 해제를 검토합니다.
- 예산 알림은 지출을 자동 차단하지 않으므로 0원 보장 수단으로 사용하지 않습니다.

Google 공식 문서:

- Google Takeout: https://support.google.com/accounts/answer/3024190
- Google Cloud 예산은 사용량·지출을 자동 제한하지 않음: https://docs.cloud.google.com/billing/docs/how-to/budgets
- Google Maps Platform은 종량제이며 가격과 무료 사용량은 SKU별로 달라짐: https://developers.google.com/maps/billing-and-pricing/overview
