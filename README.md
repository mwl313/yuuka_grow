# 유우카 키우기 MVP

정적 배포 전용(HTML/CSS/JS) 프로젝트다.

- 게임 본편: `index.html`
- 공유 결과 페이지: `share.html`

## 주요 기능
- Phaser 렌더 + DOM UI 기반 턴제 플레이
- 게스트 연출, Eat/Work VFX, 단계별 사운드/배경 전환
- 설정에서 `BGM / SFX / VOICE / Language` 조절
- HUD 미니 버튼
- `L`: 로비 복귀 확인 모달
- `S`: 전체 오디오 채널 마스터 음소거 토글
- 공유 링크(`share.html?...`) 생성 및 결과 페이지 렌더

## 로컬 실행
1. `npm install`
2. 에셋을 변경했으면 manifest를 갱신한다: `npm run build:assets-manifests`
3. 개발 서버를 실행한다: `npm run dev`

## 에셋 Manifest 명령어
- 전체 갱신: `npm run build:assets-manifests`
- 게스트만 갱신: `npm run build:guests-manifest`
- 음식만 갱신: `npm run build:food-manifest`
- 업무만 갱신: `npm run build:work-manifest`

## 빌드
1. 에셋을 변경했으면 `npm run build:assets-manifests`를 먼저 실행한다.
2. `npm run build`
3. 결과물은 `dist/`에 생성된다.
4. `dist/index.html`과 `dist/share.html`이 함께 포함된다.

## 정적 호스팅 배포
1. `npm run build`로 `dist/`를 생성한다.
2. `dist/` 전체를 정적 호스팅에 업로드한다.
3. 별도 서버 없이 동작한다.

## 구현 메모
- 설정 저장 키는 `yuuka_settings_v1`을 사용한다.
- 구버전 설정 데이터는 하위호환으로 로드한다.
- 공유 링크에는 언어 파라미터를 포함하지 않는다.
