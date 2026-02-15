const ko: Record<string, string> = {
  // Global / menu
  "app.title": "유우카 키우기",
  "menu.start": "게임 시작",
  "menu.options": "설정",

  // Lobby screen
  "lobby.title": "유우카 키우기",
  "lobby.btnStart": "게임 시작",
  "lobby.btnSettings": "설정",
  "lobby.btnLeaderboard": "리더보드",
  "lobby.leaderboardStub": "리더보드는 준비 중이다.",
  "lobby.disclaimer": "본 게임은 비공식 팬게임이며, 원작 및 공식과 무관하다.",
  "lobby.version": "버전 {version}",
  "lobby.credits": "제작: {author}",
  "lobby.ip": "원작/IP: {ip}",

  // Settings / options panel
  "options.title": "설정",
  "options.language.label": "언어",
  "options.language.ko": "한국어",
  "options.language.en": "English",
  "options.language.ja": "日本語",
  "settings.title": "설정",
  "settings.bgm": "BGM",
  "settings.sfx": "SFX",
  "settings.theme": "테마",
  "settings.language": "언어",
  "settings.close": "닫기",
  "settings.themeDefault": "기본",

  // HUD / resources
  "hud.day": "{day}일차",
  "hud.credits": "크레딧: {credits}",
  "hud.stress": "스트레스 {stress}/100",
  "hud.thigh": "허벅지 둘레 {thigh}cm",
  "hud.thighCm": "허벅지 둘레 {thigh}cm",
  "hud.stage": "스테이지 {stage}",
  "hud.actions": "남은 행동 {actions}/3",

  // In-game action buttons (bottom panel)
  "game.action.work": "일하기",
  "game.action.eat": "밥먹기",
  "game.action.guest": "게스트",
  "action.work": "업무하기",
  "action.eat": "밥먹기",
  "action.guest": "게스트",

  // Log panel
  "log.title": "기록",
  "log.empty": "아직 기록이 없다.",
  "log.work": "업무를 했다: 크레딧 +{credits} / 스트레스 +{stress}",
  "log.workNoa": "업무를 했다(노아): 크레딧 +{credits} / 스트레스 +{stress} / 남은 노아 {charges}회",
  "log.eat": "밥을 먹었다: 크레딧 -{credits} / 허벅지 +{thigh}cm / 스트레스 -{stress}",
  "log.noMeal": "오늘은 한 끼도 못 먹었다: 허벅지 -5%",
  "log.guest": "게스트가 왔다: {name} -> {effect}",

  // Guest names/effects
  "guest.teacher.name": "선생님",
  "guest.momoi.name": "모모이",
  "guest.aris.name": "아리스",
  "guest.rio.name": "리오",
  "guest.noa.name": "노아",
  "guest.maki.name": "마키",
  "guest.koyuki.name": "코유키",
  "guest.effect.teacher": "허벅지 +8% / 스트레스 -15",
  "guest.effect.momoi": "허벅지 +10% / 스트레스 +10",
  "guest.effect.aris": "허벅지 +12% / 크레딧 +15%",
  "guest.effect.rio": "크레딧 +12% / 스트레스 +12",
  "guest.effect.noa": "크레딧 +5% / 스트레스 -5 / 업무 3회 강화",
  "guest.effect.maki.success": "대박이 났다: 허벅지 +14% / 크레딧 +15% / 스트레스 +10",
  "guest.effect.maki.slip": "예상과 달랐다: 허벅지 -8% / 크레딧 +10% / 스트레스 -5",
  "guest.effect.koyuki.jackpot": "대박이 났다: 크레딧 +80% / 스트레스 +20",
  "guest.effect.koyuki.loss": "예상과 달랐다: 크레딧 -50% / 허벅지 +6% / 스트레스 +20",

  // Endings
  "ending.normal.title": "일반 엔딩",
  "ending.bankrupt.title": "파산 엔딩",
  "ending.stress.title": "스트레스 엔딩",
  "ending.normal.desc": "100일을 버텼다. 기록을 남겼다.",
  "ending.bankrupt.desc": "크레딧이 바닥났다. 다시 계획을 세웠다.",
  "ending.stress.desc": "무리했다. 휴식이 필요했다.",
  "ending.continue": "계속",

  // Result screen
  "result.title": "결과",
  "result.ending": "엔딩",
  "result.finalThigh": "최종 허벅지 둘레",
  "result.dayReached": "도달 일차",
  "result.finalCredits": "최종 크레딧",
  "result.finalStress": "최종 스트레스",
  "result.share": "결과 공유",
  "score.title": "결과",
  "score.ending": "엔딩",
  "score.finalThigh": "최종 허벅지 둘레",
  "score.dayReached": "도달 일차",
  "score.finalCredits": "최종 크레딧",
  "score.finalStress": "최종 스트레스",
  "score.btnRetry": "다시 하기",
  "score.btnBack": "로비로",
  "score.btnShare": "결과 공유하기",

  // Share page
  "share.title": "공유 결과",
  "share.invalid": "유효하지 않은 공유 링크다.",
  "share.playCta": "플레이해보기",
  "share.score": "이번 기록",
  "share.btnPlay": "플레이해보기",
  "share.cardTitle": "이번 기록",

  // Formatting
  "format.cm": "{value}cm",
  "format.day": "{value}일차",
  "format.credits": "{value}크레딧",

  // Renderer labels / compare names
  "render.labelYuuka": "유우카",
  "render.stage": "스테이지 {stage}",
  "render.thigh": "허벅지 {thigh}cm",

  // Debug / fallback message
  "errors.missingKey": "[[missing:{key}]]",
};

export default ko;
