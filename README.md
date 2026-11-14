# 석재 가계부 (daejeon-rental-app)

장부 · 세무 · 캐릭터 성장이 한 앱에. 안드로이드 APK와 PC용 웹 버전을 깃허브가 자동으로 만든다.

## 설치 (안드로이드)
1. [Releases](https://github.com/instrantal-ux/daejeon-rental-app/releases/latest) 에서 `daejeon-ledger-vX.Y.Z.apk` 받기
2. 파일 열기 → 설치. 처음이면 "출처를 알 수 없는 앱 허용"을 켜야 함
3. 이후에는 앱을 켤 때 새 버전이 있으면 위에 안내줄이 뜨고, 거기서 바로 받아 설치

## PC에서 쓰기
- 웹 버전: https://instrantal-ux.github.io/daejeon-rental-app/ (저장소 설정에서 Pages 가 켜진 뒤부터)
- 폰과 PC 데이터는 아직 따로 저장됨 (2차: 동기화). 옮길 땐 더보기 → 백업 파일 → 다른 기기에서 불러오기

## 서버 (Supabase) 처음 설정 — 한 번만
1. SQL Editor 에서 `supabase/schema.sql` 내용 실행 (표·보안 규칙 생성)
2. Authentication → Sign In / Providers → Email 에서 "Confirm email" 끄기 (안 끄면 가입 때 확인 메일을 눌러야 함)
3. 앱 접속 정보는 `www/js/config.js` (publishable 키는 공개용)

## 구조
```
www/            앱 화면 (순수 HTML/JS, 번들러 없음)
  js/data.js      상수 · 세금 계산 (순수 함수)
  js/store.js     기기 저장 (localStorage)  ← 나중에 동기화 붙일 자리
  js/ledger.js    장부 화면
  js/tax.js       세무 화면
  js/home.js      캐릭터 · 레벨 · 퀘스트
  js/game.js      경험치 규칙 (순수 함수)
  js/calendar.js  달력
  js/exportx.js   엑셀 · 백업 · 복원
  js/update.js    새 버전 확인 (깃허브 릴리스)
scripts/        빌드 보조 (버전 파일, 안드로이드 서명 설정, 릴리스 노트)
resources/      아이콘 · 스플래시 원본
android-signing/ 서명키 (개인용 앱이라 저장소에 둠 — 비밀값 KEYSTORE_B64 를 넣으면 그걸 우선 씀)
.github/workflows/android.yml   push → APK 빌드 → 릴리스 → Pages 배포
```

## 버전 올리기
`package.json` 의 `version` 과 `CHANGELOG.md` 맨 위 항목을 고치고 main 에 push 하면 끝.

## 로컬 확인
```
node scripts/smoke.mjs   # 헤드리스 크롬으로 화면 오류 검사 + _smoke/ 에 스크린샷
```
