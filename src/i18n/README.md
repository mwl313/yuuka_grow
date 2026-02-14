# i18n Translation Guide

This project uses key-based localization via `t("key")`.

- Source files:
  - `src/i18n/locales/ko.ts`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/ja.ts`
- Fallback order:
  1. selected language
  2. English (`en`)
  3. `[[missing:key]]` with `console.warn`

## Key Table
| Key | Where used | Notes | ko | en | ja |
|---|---|---|---|---|---|
| `app.title` | Lobby title | Main game title | 유우카 키우기 | Grow Yuuka (temp) | ユウカ育成 (temp) |
| `menu.start` | Lobby start button | Start game CTA | 게임 시작 | Start | はじめる！ |
| `menu.options` | Lobby settings button | Open options modal | 설정 | Options | オプション |
| `options.title` | Settings modal title | Options heading | 설정 | Options | オプション |
| `options.language.label` | Settings modal | Language dropdown label | 언어 | Language | 言語 |
| `options.language.ko` | Language dropdown option | Language option text | 한국어 | 한국어 | 한국어 |
| `options.language.en` | Language dropdown option | Language option text | English | English | English |
| `options.language.ja` | Language dropdown option | Language option text | 日本語 | 日本語 | 日本語 |
| `game.action.work` | Game actions | Work action label | 일하기 | Work | 働く |
| `game.action.eat` | Game actions | Eat action label | 밥먹기 | Eat | ごはん |
| `game.action.guest` | Game actions | Guest action label | 게스트 | Guest | ゲスト |
| `hud.credits` | HUD | Credits resource line | 크레딧: {credits} | Credits: {credits} | クレジット: {credits} |
| `hud.stress` | HUD | Stress resource line | 스트레스 {stress}/100 | Stress {stress}/100 | ストレス {stress}/100 |
| `hud.day` | HUD | Current day line | {day}일차 | Day {day} | {day}日目 |
| `hud.thighCm` | HUD | Thigh display alias key | 허벅지 둘레 {thigh}cm | Thigh Circumference {thigh}cm | 太もも周囲 {thigh}cm |
| `result.title` | Result panel | Result screen title | 결과 | Result | 結果 |
| `result.ending` | Result panel | Ending label | 엔딩 | Ending | エンディング |
| `result.finalCredits` | Result panel | Final credits label | 최종 크레딧 | Final Credits | 最終クレジット |
| `result.finalStress` | Result panel | Final stress label | 최종 스트레스 | Final Stress | 最終ストレス |
| `result.finalThigh` | Result panel | Final thigh label | 최종 허벅지 둘레 | Final Thigh Circumference | 最終太もも周囲 |
| `result.share` | Result panel | Share button text | 결과 공유 | Share Result | 結果をシェア |
| `share.title` | Share page | Share page title | 공유 결과 | Shared Result | シェア結果 |
| `share.playCta` | Share page | Play button text | 플레이해보기 | Play Now | プレイしてみる？ |
| `share.score` | Share page | Share card sub-title | 이번 기록 | Score | 今回の記録 |
| `errors.missingKey` | Debug fallback | Missing-key placeholder format | [[missing:{key}]] | [[missing:{key}]] | [[missing:{key}]] |

## Legacy Compatibility Keys
To keep diffs minimal, existing keys are still present (`lobby.*`, `settings.*`, `score.*`, `share.btnPlay`, `share.cardTitle`, `action.*`, `hud.thigh`, etc.).
These map to the same translated intent and can be migrated gradually.

## Naming Notes
- Proper nouns in `en` and `ja` currently include `(temp)` by request.
- If you finalize naming later, remove `(temp)` from those entries only.
