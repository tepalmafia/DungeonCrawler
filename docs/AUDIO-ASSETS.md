# 음원 넣기 — CC0 샘플

> 대상: `web/3d/audio/`
> 상태: **재생 층은 완성. 음원 파일은 아직 없음.**

---

## 0. 지금 상태

`web/3d/js/core/samples.js` 가 음원을 읽어 재생합니다. **파일이 하나도 없으면
지금까지 쓰던 합성음이 그대로 납니다** — 게임은 똑같이 돌아갑니다.

파일을 넣는 순간 그 소리만 녹음으로 바뀝니다. 코드는 안 고쳐도 됩니다.

### 왜 제가 직접 못 넣었나

이 컨테이너의 네트워크 정책이 음원 사이트를 전부 막습니다. 실측:

| 호스트 | |
|---|---|
| `opengameart.org` · `freesound.org` · `kenney.nl` · `mediafire.com` | **차단** |
| `raw.githubusercontent.com` | 열림 (개별 파일만. 목록 조회 불가) |

GitHub 에 있는 CC0 음원 저장소를 둘 찾았지만 둘 다 못 씁니다 —
`PanderMusubi/sound-effects-library-weapons` 는 **데비안 패키징 껍데기**라
실제 음원이 mediafire 에 있고, `Calinou/kenney-*` 는 **UI 클릭음**이라
타격음으로 쓸 수 없습니다.

---

## 1. 어디서 받나 (전부 CC0)

| 출처 | 무엇 | 링크 |
|---|---|---|
| **Kenney — Impact Sounds** | 타격·충돌 (제일 잘 맞습니다) | <https://kenney.nl/assets/impact-sounds> |
| **Kenney — RPG Audio** | 검·발소리·갑옷 | <https://kenney.nl/assets/rpg-audio> |
| **OpenGameArt — Punches, hits, swords and squishes** | 근접 타격 | <https://opengameart.org/content/punches-hits-swords-and-squishes> |
| **Still North Media — Medieval Weapons Library** | 금속 충돌 (CC0) | <http://www.stillnorthmedia.com/medieval-weapon.html> |
| **Freesound** (CC0 필터) | 필요한 것만 골라서 | <https://freesound.org/search/?f=license:%22Creative+Commons+0%22> |

**★ CC0 인지 파일마다 확인해 주세요.** Freesound 는 같은 검색 결과에도
CC-BY 가 섞입니다. CC-BY 는 출처 표기 의무가 있어 다른 문제가 됩니다.

---

## 2. 어떤 이름으로 넣나

`web/3d/audio/` 에 아래 이름으로 넣습니다. **없는 것은 그냥 안 넣으면 됩니다** —
그 소리만 합성으로 남습니다.

| 파일 | 무슨 소리 | 몇 개 |
|---|---|---|
| `hit-bone-1.ogg` … `-3` | 뼈를 때리는 소리 (해골) | 2~3 |
| `hit-flesh-1.ogg` … `-3` | 살을 때리는 소리 (구울) | 2~3 |
| `hit-stone-1.ogg` … `-2` | 돌을 때리는 소리 (골렘) | 2 |
| `hit-spirit-1.ogg` … `-2` | 실체 없는 것 (망령 궁수) | 2 |
| `hit-crit-1.ogg` … `-2` | 치명타 (없으면 위 파일을 낮게 재생) | 2 |
| `swing-1.ogg` … `-3` | 무기를 휘두르는 바람 소리 | 2~3 |
| `step-1.ogg` … `-4` | 발소리 (기본) | 3~4 |
| `step-stone-1.ogg` … `-2` | 무거운 발소리 (골렘) | 2 |
| `step-water-1.ogg` … `-2` | 젖은 바닥 (침수 회랑) | 2 |

**같은 소리를 여러 개 넣는 것이 중요합니다.** 매번 같은 파일이 나면 뇌가
곧바로 「기계」로 판정합니다 — 합성음에서 주파수를 흔든 것과 같은 이유이고,
녹음은 흔드는 것보다 **원래 서로 다른 것**이라 훨씬 자연스럽습니다.

### 형식

`ogg` 를 권장합니다 (작습니다). `m4a`·`wav` 도 자동으로 찾습니다 —
확장자만 맞으면 되고 코드는 안 고칩니다.

**길이는 0.3초 안쪽**으로 잘라 주세요. 타격음이 길면 다음 타격과 겹칩니다.
평타가 초당 한 대 이상 들어갑니다.

---

## 3. 넣은 뒤 할 일

### 3-1. 음량 맞추기

파일마다 녹음 레벨이 다릅니다. **귀로 맞추면 다음에 또 어긋나므로** 재서 맞춥니다.

```bash
python3 tools/serve.py 8137 &
node tools/audio-audit.js
```

- `dB` 열을 보고 종족 간 편차가 9 dB 를 넘지 않게
- `peak` 이 0.8 을 넘으면 **찢어집니다**
- 보정은 `core/samples.js` 의 `MANIFEST[...].vol` 로

### 3-2. 검사

```bash
./tools/run-verify3d.sh
```

- `audio.samplesOptional` — 파일이 없어도 합성으로 떨어지는가
- `audio.noClip` — 최대 진폭 0.8 미만
- `audio.impactNotTonal` — 주기성 0.35 미만 (**녹음에는 적용 안 합니다** —
  진짜 금속 충돌음은 원래 공진이 있어 주기성이 높게 나옵니다. 이 검사는
  합성음이 「뿅」이 되는 것을 막는 용도입니다)

### 3-3. 출처 기록

`web/3d/audio/CREDITS.md` 에 파일마다 **출처와 라이선스**를 적습니다.
CC0 는 표기 의무가 없지만, **나중에 「이거 어디서 받았지」가 반드시 생깁니다.**
그때 못 찾으면 그 파일은 못 쓰는 파일이 됩니다.

```
hit-bone-1.ogg   Kenney — Impact Sounds (CC0)  https://kenney.nl/assets/impact-sounds
hit-flesh-2.ogg  Freesound #123456 by 아무개 (CC0)  https://freesound.org/s/123456/
```

---

## 4. 왜 합성을 안 지우나

파일이 안 들어온 소리가 남을 수 있고, 무엇보다 **저장소가 지금까지
「외부 에셋 0」으로 굴러왔습니다.** 합성을 지우면 음원 없이는 조용한 게임이
되고, 그건 되돌리기 어려운 결정입니다. 둘을 같이 두면 언제든 되돌릴 수 있습니다.

용량도 이유입니다 — 합성은 0 바이트입니다.
