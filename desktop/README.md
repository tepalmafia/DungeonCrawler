# 데스크톱(스팀) 래퍼

무덤에서 왕좌까지의 Electron 래퍼입니다. 게임 본체(`../web`)는 수정 없이 그대로 로드되며,
`preload.cjs`가 노출하는 `window.desktop` 브리지를 게임의 Store/도전과제/전체화면 코드가 감지해 갈아탑니다.

## 개발 실행
```bash
cd desktop
npm install        # electron (+ 선택: steamworks.js)
npm start
```

## 웹 ↔ 데스크톱 차이
| 기능 | 웹 (GitHub Pages) | 데스크톱 |
|---|---|---|
| 저장 | localStorage | `userData/save.json` (원자적 쓰기) |
| 전체화면 | Fullscreen API | 창 전체화면 (F11 / 설정 패널) |
| 도전과제 | Meta.data.achv 기록 + 배너 | + 스팀워크스 `achievement.activate` |

## 스팀 출시 체크리스트
1. Steamworks 파트너 등록 후 App ID 발급 → `desktop/steam_appid.txt`에 기입 (개발 중 테스트용)
2. 파트너 사이트에 도전과제 8종 등록 — API Name은 `web/js/core/achievements.js`의 id와 동일하게:
   `FIRST_VENGEANCE, GATE_BREAKER, VERDICT_OVERTURNED, FAITH_ASHES, THRONE_FALLS, KINGS_WRATH, WHOLE_TRUTH, FIFTH_HAND`
3. `npm run dist` (electron-builder) → 산출물을 SteamPipe로 업로드
4. 스토어 자산: 캡슐 이미지·스크린샷 5장(거점/전투/보스전/카드/에필로그)·트레일러
5. 게임패드는 게임 내 지원(Gamepad API) — 스팀 입력 설정은 '게임패드 지원' 체크만
