# 연결 기능 회귀 검증

Windows의 Edge와 Node.js를 사용한다. 프로젝트 루트에서 다음 명령을 실행한다.

```powershell
npm.cmd install --no-save --package-lock=false --prefix .qa playwright leaflet@1.9.4
python -m http.server 8080
```

다른 터미널에서:

```powershell
node tests/connected-workflow.cjs
node tests/data-preservation.cjs
node --check script.js
node --check connections.js
node --check service-worker.js
git diff --check
```

각 검증은 임시 브라우저 프로필을 사용하고 외부 요청을 차단한다. Leaflet은 설치된 로컬 파일로 공급하며 Supabase와 실제 사용자 브라우저 저장소에 접근하지 않는다. 지도 배경 타일은 표시되지 않는다.

- `connected-workflow.cjs`: 메뉴, 장소→일정→예약→지출, 예약 취소, 날짜·장소 변경, 비용 기준, 미리보기 무저장, 360·390·1280px 가로 넘침, 지도 실행
- `data-preservation.cjs`: 분류 변경, 자정 통과, 여러 예약의 상태 집계, 삭제 후 기록 보존, 각자 결제, 키보드 장소 검색, 기존 예약 연결 해제, 로컬 재접속, 뒤로가기

캡처와 의존성은 Git에서 제외된 `.qa/`에 저장한다. 실제 계정의 서버 동기화 및 실기기 PWA 설치 검증은 별도로 진행해야 한다.
