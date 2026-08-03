# 여기에 그림을 넣습니다

**파일을 넣고 게임을 새로고침하면 바로 나옵니다.** 다른 건 안 하셔도 됩니다.

```
web/3d/assets/
  fx/       공용 이펙트 4장      dot.png  flame.png  beam.png  ring.png
  tiles/    던전 타일 9장        floor_crypt.png  wall_crypt.png  walltop_crypt.png ...
  icons/    UI 아이콘 58장       sword.png  helm_plate.png  skill_cleave.png ...
  ref/      캐릭터 참고 6장      ← 게임이 안 읽습니다. 제가 보고 3D 를 맞춥니다
```

무엇이 몇 장 필요한지와 규격은 **`docs/ART-REQUEST.md`** 에 있습니다.
파일 이름은 그 문서와 **한 글자도 다르면 안 됩니다** — 다르면 게임이 안 씁니다.

## 넣은 게 적용됐는지 보는 법

브라우저 콘솔(F12)에 부팅할 때 한 줄이 찍힙니다.

```
[에셋] 4 / 71장 적용 · 나머지는 코드 그림
```

이름이 틀렸으면 그 자리에서 알려 줍니다.

```
[에셋] 규격에 없는 이름입니다 — tiles/floor_crypt2.png
[에셋] tiles/wall_crypt — 비율이 다릅니다. 규격 512x870 (0.59), 받은 것 512x512 (1.00). 화면에서 늘어납니다
```

자세히 보려면 콘솔에서 `G3.assets()`.

## 아직 그림이 없는 자리는

**코드가 그린 임시 그림**이 나옵니다. 그림이 들어오면 그 자리만 바뀝니다 —
한 장씩 주셔도 되고, 넣는 즉시 확인됩니다.

## 배포할 때 (제가 합니다)

GitHub Pages 는 폴더를 훑어 줄 사람이 없어서 목록 파일이 필요합니다.

```
node tools/assets.js --write
```

로컬(`python3 tools/serve.py 8137`)에서는 서버가 알아서 훑으므로 안 돌려도 됩니다.
