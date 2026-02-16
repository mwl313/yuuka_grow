# 유우카 키우기

프론트(Vite + Phaser)와 리더보드 백엔드(Cloudflare Workers + D1)로 구성한 프로젝트다.

- 게임 본편: `index.html`
- 정적 공유 페이지: `share.html`
- 서버 OG 공유 페이지: `/share/:shareId`

## 주요 기능
- Phaser 렌더 + DOM UI 기반 턴제 플레이
- 게스트 연출, Eat/Work VFX, 단계별 사운드/배경 전환
- 설정: `BGM / SFX / VOICE / Language / Nickname`
- 결과 화면 `업로드 & 공유` 단일 버튼 플로우
- 같은 run 중복 업로드 방지(`runId` 기반, 클라이언트 + 서버 idempotency)
- 리더보드 화면(크레딧/허벅지 정렬 토글, Top 100)

## 프론트 로컬 실행
1. `npm install`
2. 에셋을 변경했으면 manifest 갱신: `npm run build:assets-manifests`
3. 개발 서버 실행: `npm run dev`

## 에셋 Manifest 명령어
- 전체 갱신: `npm run build:assets-manifests`
- 게스트만 갱신: `npm run build:guests-manifest`
- 음식만 갱신: `npm run build:food-manifest`
- 업무만 갱신: `npm run build:work-manifest`

## 프론트 빌드
1. 에셋을 변경했으면 `npm run build:assets-manifests` 실행
2. `npm run build`
3. `dist/` 생성
4. `dist/index.html`, `dist/share.html` 포함

## 서버(리더보드 API)
- 위치: `server/`
- 문서: `server/README.md`
- 주요 엔드포인트:
  - `POST /api/submit`
  - `GET /api/leaderboard?sort=credit|thigh&limit=100`
  - `GET /share/:shareId`

## 배포 메모
- 프론트만 정적 호스팅으로도 동작한다.
- 리더보드 업로드/조회/`/share/:shareId`는 Worker 배포가 필요하다.
- 로컬에서 프론트(`vite`)만 실행하면 `/api/*`는 연결되지 않으니, Worker를 함께 띄우거나 프록시 구성이 필요하다.

## 구현 메모
- 설정 저장 키: `yuuka_settings_v1`
- 구버전 설정 데이터 하위호환 로드
- 언어 파라미터는 공유 링크에 넣지 않는다.
