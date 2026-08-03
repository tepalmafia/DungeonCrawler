# 우주선 내부 — 조사와 설계

`web/space/js/world/kit.js` 와 `ship.js` 가 왜 그렇게 생겼는지의 근거다.
2026-08-03 에 실제 우주선과 영화 미술, 게임 레벨 디자인을 찾아보고 정리했다.

## 0. 왜 조사했나

조종석은 사장님이 참고 사진을 주셔서 다시 지었는데, **통로와 기관실은 여전히
민판**이었다. 참고가 없으니 「뭘 넣어야 하는지」를 몰랐고, 모르는 채로 만들면
`docs/POSTMORTEM.md §1-②` 의 「방향을 안 정하고 정교해지는」 짓을 또 하게 된다.

찾아보니 **세 출처가 같은 곳을 가리켰다.**

## 1. 실제 우주선 (ISS) — 배가 「진짜」로 보이는 문법

| 알아낸 것 | 게임에 어떻게 넣었나 |
|---|---|
| **ISPR — 규격 랙.** 냉장고 크기 캐비닛이 벽을 채운다. 모듈마다 같은 규격이다 | `kit.js rack()` 을 **폭 0.9 · 높이 1.9 · 깊이 0.42 로 고정**했다. 기관실 양 벽을 이걸로 채운다 |
| **네 방향 스탠드오프.** 랙 줄 사이 쐐기 공간에 배선·환기·유체관이 지난다 | `conduit()` — 굵기와 색이 다른 관 넷을 다발로 묶어 천장 모서리를 따라 보낸다 |
| **손잡이가 사방에.** 무중력에서 몸을 끌어당기는 물건 | `handrail()` — 통로와 기관실에 깔았다 |
| 가운데는 **좁은 통로**, 벽은 전부 장비 | 통로 폭 2.2 를 안 넓혔다. 랙은 넓은 기관실에만 |
| deck / overhead / port / starboard 로 방향을 부른다 | 아직 안 썼다. 나중에 표지판에 |

**제일 큰 한 방은 규격 랙이다.** 방에 물건이 몇 개 있느냐가 아니라 **같은
규격이 줄지어 있느냐**가 「배 안」을 만든다. 크기를 제각각으로 하면 반복이
안 읽히고, 반복이 안 읽히면 그냥 잡동사니가 된다.

그리고 **손잡이는 이 게임에 유난히 맞는다.** 손만 나오는 게임이라 나중에
「잡는다」가 그대로 동사가 된다 (`PLAN.md §8`).

## 2. Alien 의 「used future」 — 배가 「살아 있는」 것으로 보이는 문법

*Alien*(1979)이 만든 개념이다. 매끈한 우주선이 아니라 **낡고 기름때 낀
화물선**. 각본가 오배넌이 감독에게 준 지침이 이거였다:

> **「보이고 싶은 것보다 세 배는 더 지저분하게 만들어야 한다.」**

| 알아낸 것 | 게임에 어떻게 넣었나 |
|---|---|
| 벽과 천장에 **조명을 박아 넣는다.** 격자와 실용 기구 | `conduit()` 이 배관 다발에 **띠조명을 같이 매단다** |
| **시각적 잡음** — 회로·계기 뭉치를 벽에 붙인다 | `rack()` 의 `'panel'` — 작은 스위치 14개 + 작은 화면 |
| 배관·밸브·격자·케이블을 **전부 노출**한다. 정리하지 않는다 | 관 굵기와 색을 일부러 섞었다. 고정 밴드도 일정 간격으로 보이게 |
| **지상 산업 시설의 번역** — 발전소·하역장·환기 설비 | 기관실 한가운데 **반응로 드럼**. 환기 격자(`'grill'`), 배관 랙(`'pipes'`) |

**다만 「세 배 더 지저분하게」를 그대로 따르지는 않았다.** 저건 영화 지침이고,
이 게임은 **1인칭으로 뛰어다니며 물건을 찾아야 한다.** 너무 지저분하면
밸브가 어디 있는지 안 보이고, 그러면 §3 이 무너진다. 지금은 **절반쯤**만
따랐다 — 무늬(그림)가 들어오면 그때 더 지저분해져도 된다.

## 3. 게임 레벨 디자인 — 읽히게 만드는 문법

여기가 위 둘과 **충돌하는 지점**이고, 그래서 규칙이 필요하다.

| 알아낸 것 | 게임에 어떻게 넣었나 |
|---|---|
| **구역마다 색을 나눈다.** 파랑 = 조종·기술, 노랑 = 사람 사는 곳, 빨강 = 정비·위험 | `kit.js ZONE` — 조종석 파랑, 통로 중립, 기관실 주황·빨강. **우연히 이미 그렇게 하고 있었다** |
| **문이 안 보이면 길을 잃는다.** 문틀을 발광 재질로 바꾸면 확 나아진다 | `doorFrame()` — 문틀 세로·가로에 그 방 색의 띠를 넣었다 |
| 교차점마다 **고유한 랜드마크** | 기관실의 반응로. 방 한가운데 서 있어서 어디서 봐도 방향을 안다 |
| **표지·번호** | `sign()` — 문 위에 「조종석」·「기관실」 |

**이게 왜 중요한가:** 이 게임의 최대 위험은 왕복 노동이다
(`USER-VIEW.md §3-1`). 추격 중에 **통로 입구를 못 찾으면 그것만으로 죽는다.**
분위기와 가독성이 부딪히면 **가독성이 이긴다.**

## 4. 창밖 — 그림 문제가 아니라 **라이선스 문제였다**

조사하다 제일 쓸모 있는 것이 나왔다. **깊은 우주 사진은 공짜로, 상업적으로
쓸 수 있다.**

| 출처 | 라이선스 | 조건 |
|---|---|---|
| **NASA** | 사실상 공개 도메인 | 출처 표기 요청 · **NASA 로고·휘장은 안 된다** · NASA 가 이 게임을 보증하는 것처럼 보이면 안 된다 |
| **ESO** (남유럽천문대) | **CC BY 4.0** | 크레딧을 **또렷하게 보이게**. 문구를 바꾸지 않고 (예: `ESO/José Francisco`) |
| **ESA/Hubble** | 사용 가능 | 크레딧 필수 · 보증 암시 금지 |

ESO 는 **등장방형(2:1) 파노라마**를 직접 제공한다 — `asset-table.js` 의
`sky/deep` 규격이 정확히 그 형식이다. NASA SVS 에도 Gaia 별 목록으로 만든
별 배경이 있다.

**그래서 창밖은 그림을 기다리지 않아도 된다.** 다만 **제가 마음대로 넣지는
않겠습니다** — 사장님이 정하실 일이고, 넣는 순간 `web/space/assets/CREDITS.md`
에 출처와 크레딧 문구를 같이 적어야 합니다 (`RELEASE.md §4`).

한 가지 주의: 크레딧을 **게임 안 어딘가에 보이게** 둬야 한다. 상점 페이지
구석이 아니라, 제작진 화면 정도에는 있어야 CC BY 를 지킨 것이 된다.

## 5. 지금 안 한 것

- **격자 바닥·금속 무늬** — 그림이라 사장님 몫이다. 지금은 민판이라
  바닥이 제일 허전하다. 무늬 한 장이 들어오면 화면이 크게 바뀐다
- **「세 배 더 지저분하게」의 나머지 절반** — §2 참조
- **랙을 열고 닫는 것** — 지금은 서랍이 그려져 있을 뿐 안 열린다.
  5단계(보급)에서 부품을 꺼내는 동작이 붙을 자리다
- **손잡이를 잡는 것** — 6단계(손)에서
- **충돌** — 걷기는 아직 방 사각형만 본다. 반응로와 랙을 **뚫고 지나간다.**
  2단계에서 추격이 붙기 전에 고쳐야 한다

---

**출처**

- [Design and Assembly of the International Space Station — Defense Media Network](https://www.defensemedianetwork.com/stories/design-and-assembly-of-the-international-space-station/)
- [ISS Workplace Design — Metropolis](https://metropolismag.com/viewpoints/international-space-station-workplace-design/)
- [ISS: Cupola — eoPortal](https://www.eoportal.org/satellite-missions/iss-cupola)
- [Workstation Designs for a Cis-lunar Deep Space Habitat (AIAA)](http://spacearchitect.org/pubs/AIAA-2014-4196.pdf)
- [Ron Cobb — "Alien Nostromo" the story behind the design](http://www.roncobb.net/05-Alien_Nostromo.html)
- [Space Truckin' – the Nostromo — Strange Shapes](https://alienseries.wordpress.com/2012/10/23/space-truckin-the-nostromo/)
- [Spaceships, ruins, and corporate cities: the menacing architecture of Alien — Domus](https://www.domusweb.it/en/news/2025/09/19/alien-design-nostromo.html)
- [Ship Interior Design — Dev Journal](https://spaceshipadventures.com/blog/spaceship-simulation-ship-interior-design--14-12-2025.php)
- [Spaceship Interiors — GameDev.net](https://www.gamedev.net/forums/topic/653920-spaceship-interiors/5135454/)
- [NASA Image Use Policy](https://gpm.nasa.gov/image-use-policy)
- [Copyright Notice — ESO](https://www.eso.org/public/copyright/) · [Licenses — ESO](https://www.eso.org/public/license/2/)
- [Copyright Information — ESA/Hubble](https://esahubble.org/copyright/)
- [The Milky Way panorama — ESO](https://www.eso.org/public/images/eso0932a/) · [ESO 360 파노라마 아카이브](https://www.eso.org/public/images/archive/category/360pano/)
- [An Elsewhere Starfield — NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/4856)

**확인 안 된 것:** ESO·NASA 페이지는 이 환경에서 직접 열리지 않아(403)
검색 결과의 인용문으로 확인했다. **실제로 이미지를 넣기 전에 원문을 한 번
더** 보시는 게 좋다 — 특히 크레딧 문구의 정확한 형식.
