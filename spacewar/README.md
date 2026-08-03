# spacewar — 임시 보관함

**이 폴더는 DungeonCrawler 의 것이 아닙니다.** 다음 게임(`spacewar`)의 문서를
저장소가 생길 때까지 잠깐 여기 둔 것입니다.

## 왜 여기 있나

`spacewar` 저장소를 만들려다 GitHub 에서 막혔습니다:

```
POST https://api.github.com/user/repos → 403 Resource not accessible by integration
```

이 세션의 GitHub 토큰은 `tepalmafia/DungeonCrawler` 한 곳으로 접근이 묶여 있어
**새 저장소를 팔 권한이 없습니다.** 작업 환경은 세션이 끝나면 사라지므로
기획안을 어딘가에 커밋해 두지 않으면 없어집니다. 그래서 여기 둡니다.

## 저장소가 생기면

사장님이 https://github.com/new 에서 `spacewar` 를 만드시거나
`gh repo create tepalmafia/spacewar --public --add-readme` 한 줄이면 됩니다.
그다음:

```
node tools/export-starter.js ../spacewar     # 검증된 뼈대를 뽑는다
cp -r spacewar/docs/PLAN.md ../spacewar/docs/  # 기획안을 옮긴다
rm -rf spacewar/                              # 이 폴더는 지운다
```

무엇을 가져가고 무엇을 두고 가는지는 `docs/REUSE.md` 에 줄 단위로 적혀 있습니다.

## 들어 있는 것

| 파일 | 무엇 |
|---|---|
| `docs/PLAN.md` | 기획안 초안 — 목적 · 핵심 루프 · 공간 · 계통 · 손 · 목표 숫자 · 만드는 순서 |
