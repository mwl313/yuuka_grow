# 유우카 키우기 (Yuuka Grow)

턴제 육성 게임 + 리더보드/공유 기능을 가진 웹 프로젝트입니다.  
프론트는 `Vite + Phaser + DOM UI`, 백엔드는 `Cloudflare Workers + D1`로 구성되어 있습니다.

## 프로젝트 개요
- 목표: 100일 생존과 허벅지 수치 성장
- 플레이 방식: 하루 3턴(일하기/밥먹기/게스트) 선택형 턴제
- 결과: 엔딩 선택, 점수 집계, 리더보드 업로드/공유

## 핵심 기능
- **턴제 시뮬레이션 루프**: 스탯(크레딧/스트레스/허벅지) 기반 진행
- **엔딩 시스템 + 엔딩 도감**: 우선순위 기반 엔딩 선택, 수집 상태 저장
- **랜덤 버프 카드 시스템**: 스테이지 구간별 선택형 버프/디버프
- **오디오 시스템**: BGM 카테고리 전환, 설정 연동(볼륨/음소거)
- **온라인 연동**: 리더보드 제출, 공유 페이지(`/share/:shareId`)
- **운영 도구**: `/admin`에서 점수 관리/메트릭 조회

## 기술 스택
- Frontend: `TypeScript`, `Vite`, `Phaser`
- Backend: `Cloudflare Workers`, `D1 (SQLite)`
- Deploy: static frontend + Worker API

## 로컬 실행 (핵심만)
1. 루트에서 설치/실행
```bash
npm install
npm run dev
```
2. 백엔드 서버 실행 (`server/`)
```bash
cd server
npm install
npm run dev
```

## 빌드
```bash
npm run build
```
- 산출물: `dist/`

## 서버/배포 참고
- 서버 상세 설정 및 D1 마이그레이션: `server/README.md`
- 주요 API:
  - `POST /api/submit`
  - `POST /api/rank-preview`
  - `GET /api/leaderboard`
  - `GET /share/:shareId`
