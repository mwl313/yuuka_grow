# 유우카 키우기 MVP

정적 배포 전용(HTML/CSS/JS)으로 만든 MVP다.  
`index.html`은 게임 본편, `share.html`은 공유 결과 페이지다.

## 로컬 실행
1. `npm install`
2. 에셋을 바꿨다면 `npm run build:assets-manifests`로 manifest를 갱신한다.
3. 개별 갱신도 가능하다.
   - `npm run build:guests-manifest`
   - `npm run build:food-manifest`
   - `npm run build:work-manifest`
4. `npm run dev`

## 빌드
1. 에셋 변경 시 먼저 `npm run build:assets-manifests`를 실행한다.
2. `npm run build`
3. 결과물은 `dist/`에 생성된다.
4. `dist/index.html`과 `dist/share.html`이 함께 생성된다.

## 정적 호스팅 배포
1. `npm run build`로 `dist/`를 만든다.
2. Cloudflare Pages, Netlify, GitHub Pages 같은 정적 호스팅에 `dist/` 전체를 업로드한다.
3. 서버 설정 없이 바로 동작한다.

## 구현 메모(보수적 해석)
1. 저장 데이터가 파산 상태로 남아 있으면 자동으로 새 게임 상태로 초기화했다.
2. 공유 버튼은 상대경로(`share.html?...`)를 복사 시도한 뒤 새 탭으로 연다.
3. 테마 JSON은 제공했지만 이미지 파일은 의도적으로 비워 두었다. 이미지가 없어도 CSS 폴백 UI로 전체 플레이가 가능하다.
