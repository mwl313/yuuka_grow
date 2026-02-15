const en: Record<string, string> = {
  // Global / menu
  "app.title": "Grow Yuuka (temp)",
  "menu.start": "Start",
  "menu.options": "Options",

  // Lobby screen
  "lobby.title": "Grow Yuuka (temp)",
  "lobby.btnStart": "Start",
  "lobby.btnSettings": "Options",
  "lobby.btnLeaderboard": "Leaderboard",
  "lobby.leaderboardStub": "Leaderboard is coming soon.",
  "lobby.disclaimer": "This game is an unofficial fan game and is not affiliated with the official IP.",
  "lobby.version": "Version {version}",
  "lobby.credits": "Creator: {author}",
  "lobby.ip": "Original IP: {ip}",

  // Settings / options panel
  "options.title": "Options",
  "options.language.label": "Language",
  "options.language.ko": "한국어",
  "options.language.en": "English",
  "options.language.ja": "日本語",
  "settings.title": "Options",
  "settings.bgm": "BGM",
  "settings.sfx": "SFX",
  "settings.theme": "Theme",
  "settings.language": "Language",
  "settings.close": "Close",
  "settings.themeDefault": "Default",

  // HUD / resources
  "hud.day": "Day {day}",
  "hud.credits": "Credits: {credits}",
  "hud.stress": "Stress {stress}/100",
  "hud.thigh": "Thigh Circumference {thigh}cm",
  "hud.thighCm": "Thigh Circumference {thigh}cm",
  "hud.stage": "Stage {stage}",
  "hud.actions": "Actions Left {actions}/3",

  // In-game action buttons (bottom panel)
  "game.action.work": "Work",
  "game.action.eat": "Eat",
  "game.action.guest": "Guest",
  "action.work": "Work",
  "action.eat": "Eat",
  "action.guest": "Guest",

  // Log panel
  "log.title": "Log",
  "log.empty": "No records yet.",
  "log.work": "Worked: Credits +{credits} / Stress +{stress}",
  "log.workNoa": "Worked (Noa): Credits +{credits} / Stress +{stress} / Noa charges left {charges}",
  "log.eat": "Ate a meal: Credits -{credits} / Thigh +{thigh}cm / Stress -{stress}",
  "log.noMeal": "No meal today: Thigh -5%",
  "log.guest": "A guest arrived: {name} -> {effect}",

  // Guest names/effects
  "guest.teacher.name": "Teacher (temp)",
  "guest.momoi.name": "Momoi (temp)",
  "guest.aris.name": "Aris (temp)",
  "guest.rio.name": "Rio (temp)",
  "guest.noa.name": "Noa (temp)",
  "guest.maki.name": "Maki (temp)",
  "guest.koyuki.name": "Koyuki (temp)",
  "guest.effect.teacher": "Thigh +8% / Stress -15",
  "guest.effect.momoi": "Thigh +10% / Stress +10",
  "guest.effect.aris": "Thigh +12% / Credits +15%",
  "guest.effect.rio": "Credits +12% / Stress +12",
  "guest.effect.noa": "Credits +5% / Stress -5 / Work buff x3",
  "guest.effect.maki.success": "Big win: Thigh +14% / Credits +15% / Stress +10",
  "guest.effect.maki.slip": "Unexpected result: Thigh -8% / Credits +10% / Stress -5",
  "guest.effect.koyuki.jackpot": "Jackpot: Credits +80% / Stress +20",
  "guest.effect.koyuki.loss": "Unexpected result: Credits -50% / Thigh +6% / Stress +20",

  // Endings
  "ending.normal.title": "Normal Ending (temp)",
  "ending.bankrupt.title": "Bankruptcy Ending (temp)",
  "ending.stress.title": "Stress Ending (temp)",
  "ending.normal.desc": "You survived 100 days. Record saved.",
  "ending.bankrupt.desc": "Credits ran out. Time to plan again.",
  "ending.stress.desc": "You pushed too hard. Time to rest.",
  "ending.continue": "Continue",

  // Result screen
  "result.title": "Result",
  "result.ending": "Ending",
  "result.finalThigh": "Final Thigh Circumference",
  "result.dayReached": "Day Reached",
  "result.finalCredits": "Final Credits",
  "result.finalStress": "Final Stress",
  "result.share": "Share Result",
  "score.title": "Result",
  "score.ending": "Ending",
  "score.finalThigh": "Final Thigh Circumference",
  "score.dayReached": "Day Reached",
  "score.finalCredits": "Final Credits",
  "score.finalStress": "Final Stress",
  "score.btnRetry": "Retry",
  "score.btnBack": "Back to Lobby",
  "score.btnShare": "Share Result",

  // Share page
  "share.title": "Shared Result",
  "share.invalid": "This share link is invalid.",
  "share.playCta": "Play Now",
  "share.score": "Score",
  "share.btnPlay": "Play Now",
  "share.cardTitle": "Score",

  // Formatting
  "format.cm": "{value}cm",
  "format.day": "Day {value}",
  "format.credits": "{value} Credits",

  // Renderer labels / compare names
  "render.labelYuuka": "Yuuka (temp)",
  "render.stage": "Stage {stage}",
  "render.thigh": "Thigh {thigh}cm",

  // Debug / fallback message
  "errors.missingKey": "[[missing:{key}]]",
};

export default en;
