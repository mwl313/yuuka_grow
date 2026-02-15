const ja: Record<string, string> = {
  // Global / menu
  "app.title": "ユウカ育成 (temp)",
  "menu.start": "はじめる！",
  "menu.options": "オプション",

  // Lobby screen
  "lobby.title": "ユウカ育成 (temp)",
  "lobby.btnStart": "はじめる！",
  "lobby.btnSettings": "オプション",
  "lobby.btnLeaderboard": "ランキング",
  "lobby.leaderboardStub": "ランキングは準備中だよ。",
  "lobby.disclaimer": "このゲームは非公式のファンゲームで、公式とは関係ないよ。",
  "lobby.version": "バージョン {version}",
  "lobby.credits": "制作: {author}",
  "lobby.ip": "原作/IP: {ip}",

  // Settings / options panel
  "options.title": "オプション",
  "options.language.label": "言語",
  "options.language.ko": "한국어",
  "options.language.en": "English",
  "options.language.ja": "日本語",
  "settings.title": "オプション",
  "settings.bgm": "BGM",
  "settings.sfx": "SFX",
  "settings.theme": "テーマ",
  "settings.language": "言語",
  "settings.close": "閉じる",
  "settings.themeDefault": "デフォルト",

  // HUD / resources
  "hud.day": "{day}日目",
  "hud.credits": "クレジット: {credits}",
  "hud.stress": "ストレス {stress}/100",
  "hud.thigh": "太もも周囲 {thigh}cm",
  "hud.thighCm": "太もも周囲 {thigh}cm",
  "hud.stage": "ステージ {stage}",
  "hud.actions": "残り行動 {actions}/3",

  // In-game action buttons (bottom panel)
  "game.action.work": "働く",
  "game.action.eat": "ごはん",
  "game.action.guest": "ゲスト",
  "action.work": "働く",
  "action.eat": "ごはん",
  "action.guest": "ゲスト",

  // Log panel
  "log.title": "記録",
  "log.empty": "まだ記録はないよ。",
  "log.work": "働いたよ: クレジット +{credits} / ストレス +{stress}",
  "log.workNoa": "働いたよ(ノア): クレジット +{credits} / ストレス +{stress} / ノア残り {charges}回",
  "log.eat": "ごはんを食べたよ: クレジット -{credits} / 太もも +{thigh}cm / ストレス -{stress}",
  "log.noMeal": "今日は食事なし: 太もも -5%",
  "log.guest": "ゲストが来たよ: {name} -> {effect}",

  // Guest names/effects
  "guest.teacher.name": "先生(temp)",
  "guest.momoi.name": "モモイ(temp)",
  "guest.aris.name": "アリス(temp)",
  "guest.rio.name": "リオ(temp)",
  "guest.noa.name": "ノア(temp)",
  "guest.maki.name": "マキ(temp)",
  "guest.koyuki.name": "コユキ(temp)",
  "guest.effect.teacher": "太もも +8% / ストレス -15",
  "guest.effect.momoi": "太もも +10% / ストレス +10",
  "guest.effect.aris": "太もも +12% / クレジット +15%",
  "guest.effect.rio": "クレジット +12% / ストレス +12",
  "guest.effect.noa": "クレジット +5% / ストレス -5 / 仕事強化3回",
  "guest.effect.maki.success": "大当たりだよ: 太もも +14% / クレジット +15% / ストレス +10",
  "guest.effect.maki.slip": "予想外だったよ: 太もも -8% / クレジット +10% / ストレス -5",
  "guest.effect.koyuki.jackpot": "ジャックポットだよ: クレジット +80% / ストレス +20",
  "guest.effect.koyuki.loss": "予想外だったよ: クレジット -50% / 太もも +6% / ストレス +20",

  // Endings
  "ending.normal.title": "ノーマルエンド(temp)",
  "ending.bankrupt.title": "破産エンド(temp)",
  "ending.stress.title": "ストレスエンド(temp)",
  "ending.normal.desc": "100日を乗り切ったよ。記録を残した。",
  "ending.bankrupt.desc": "クレジットが尽きたよ。もう一度計画しよう。",
  "ending.stress.desc": "がんばりすぎたよ。休憩しよう。",
  "ending.continue": "続ける",

  // Result screen
  "result.title": "結果",
  "result.ending": "エンディング",
  "result.finalThigh": "最終太もも周囲",
  "result.dayReached": "到達日数",
  "result.finalCredits": "最終クレジット",
  "result.finalStress": "最終ストレス",
  "result.share": "結果をシェア",
  "score.title": "結果",
  "score.ending": "エンディング",
  "score.finalThigh": "最終太もも周囲",
  "score.dayReached": "到達日数",
  "score.finalCredits": "最終クレジット",
  "score.finalStress": "最終ストレス",
  "score.btnRetry": "もう一回",
  "score.btnBack": "ロビーへ",
  "score.btnShare": "結果をシェア",

  // Share page
  "share.title": "シェア結果",
  "share.invalid": "このシェアリンクは無効だよ。",
  "share.playCta": "プレイしてみる？",
  "share.score": "今回の記録",
  "share.btnPlay": "プレイしてみる？",
  "share.cardTitle": "今回の記録",

  // Formatting
  "format.cm": "{value}cm",
  "format.day": "{value}日目",
  "format.credits": "{value}クレジット",

  // Renderer labels / compare names
  "render.labelYuuka": "ユウカ(temp)",
  "render.stage": "ステージ {stage}",
  "render.thigh": "太もも {thigh}cm",

  // Debug / fallback message
  "errors.missingKey": "[[missing:{key}]]",
};

export default ja;
