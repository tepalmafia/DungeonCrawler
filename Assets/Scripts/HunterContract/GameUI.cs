using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

// 모든 UI를 코드로 생성한다 (프리팹/씬 에셋 불필요).
// 패널 5개: 의뢰 게시판 / 준비 / 함정 배치 / 사냥 HUD / 정산.
public class GameUI : MonoBehaviour
{
    GameFlow flow;
    Font font;

    GameObject questPanel, prepPanel, placePanel, huntPanel, resultPanel;

    // 의뢰
    Text questHonorText;

    // 준비
    Text prepTitleText, prepGoldText, prepMsgText;
    readonly List<Text> shopTexts = new List<Text>();
    Text[] gambitCondTexts, gambitActTexts, gambitOnTexts;

    // 함정 배치
    readonly List<Text> placeTrapTexts = new List<Text>();
    Text placeSelText;

    // 사냥
    Text timerText, monsterInfoText, hunterInfoText, huntHintText, logText;
    RectTransform monsterFill, hunterFill;
    const float MonsterBarW = 500f, HunterBarW = 300f;
    Button[] cardButtons;

    // 정산
    Text resultTitle, resultBody;

    public void Init(GameFlow f)
    {
        flow = f;
        font = SpriteFactory.UIFont();
    }

    public void BuildAll()
    {
        BuildCanvas();
        BuildQuestPanel();
        BuildPrepPanel();
        BuildPlacePanel();
        BuildHuntPanel();
        BuildResultPanel();
    }

    public void ShowPhase(GameFlow.Phase p)
    {
        questPanel.SetActive(p == GameFlow.Phase.Quest);
        prepPanel.SetActive(p == GameFlow.Phase.Prep);
        placePanel.SetActive(p == GameFlow.Phase.Place);
        huntPanel.SetActive(p == GameFlow.Phase.Hunt);
        resultPanel.SetActive(p == GameFlow.Phase.Result);

        if (p == GameFlow.Phase.Quest) RefreshQuest();
        if (p == GameFlow.Phase.Prep) RefreshPrep();
        if (p == GameFlow.Phase.Place) RefreshPlace();
        if (p == GameFlow.Phase.Result) ShowResult();
    }

    // ---------- 빌더 ----------

    Transform canvasRoot;

    void BuildCanvas()
    {
        var go = new GameObject("Canvas", typeof(RectTransform));
        go.transform.SetParent(transform, false);
        var canvas = go.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = go.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280f, 720f);
        go.AddComponent<GraphicRaycaster>();
        canvasRoot = go.transform;
    }

    GameObject NewUI(string name, Transform parent)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        return go;
    }

    RectTransform SetRT(GameObject go, Vector2 pos, Vector2 size)
    {
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        return rt;
    }

    GameObject FullPanel(string name, Color bg)
    {
        var go = NewUI(name, canvasRoot);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = rt.offsetMax = Vector2.zero;
        var img = go.AddComponent<Image>();
        img.color = bg;
        return go;
    }

    Text MakeText(Transform parent, string content, int size, Vector2 pos, Vector2 sz,
                  TextAnchor anchor = TextAnchor.MiddleCenter, Color? color = null)
    {
        var go = NewUI("Text", parent);
        SetRT(go, pos, sz);
        var t = go.AddComponent<Text>();
        t.font = font;
        t.fontSize = size;
        t.text = content;
        t.alignment = anchor;
        t.color = color ?? Color.white;
        t.horizontalOverflow = HorizontalWrapMode.Wrap;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        t.raycastTarget = false;
        return t;
    }

    Button MakeButton(Transform parent, string label, Vector2 pos, Vector2 sz,
                      UnityAction onClick, int fontSize = 18,
                      TextAnchor labelAnchor = TextAnchor.MiddleCenter)
    {
        var go = NewUI("Btn_" + label, parent);
        SetRT(go, pos, sz);
        var img = go.AddComponent<Image>();
        img.color = new Color(0.22f, 0.25f, 0.32f);
        var btn = go.AddComponent<Button>();
        btn.targetGraphic = img;
        btn.onClick.AddListener(onClick);
        var t = MakeText(go.transform, label, fontSize, Vector2.zero, new Vector2(sz.x - 16f, sz.y - 6f), labelAnchor);
        t.raycastTarget = false;
        return btn;
    }

    Text ButtonText(Button b)
    {
        return b.GetComponentInChildren<Text>();
    }

    RectTransform MakeBar(Transform parent, Vector2 pos, float width, float height, Color fillColor)
    {
        var bg = NewUI("BarBg", parent);
        SetRT(bg, pos, new Vector2(width, height));
        var bgImg = bg.AddComponent<Image>();
        bgImg.color = new Color(0f, 0f, 0f, 0.6f);
        bgImg.raycastTarget = false;

        var fill = NewUI("Fill", bg.transform);
        var rt = fill.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 0.5f);
        rt.pivot = new Vector2(0f, 0.5f);
        rt.anchoredPosition = new Vector2(2f, 0f);
        rt.sizeDelta = new Vector2(width - 4f, height - 4f);
        var img = fill.AddComponent<Image>();
        img.color = fillColor;
        img.raycastTarget = false;
        return rt;
    }

    void SetBar(RectTransform fill, float pct, float fullWidth)
    {
        fill.sizeDelta = new Vector2(Mathf.Clamp01(pct) * (fullWidth - 4f), fill.sizeDelta.y);
    }

    // ---------- 의뢰 게시판 ----------

    void BuildQuestPanel()
    {
        questPanel = FullPanel("QuestPanel", new Color(0.09f, 0.1f, 0.13f, 1f));
        MakeText(questPanel.transform, "헌터의 의뢰", 40, new Vector2(0, 290), new Vector2(600, 60));
        MakeText(questPanel.transform, "의뢰를 선택하라 — 준비한 만큼만 결과가 나온다", 18,
                 new Vector2(0, 240), new Vector2(700, 30), TextAnchor.MiddleCenter,
                 new Color(0.7f, 0.75f, 0.8f));

        for (int i = 0; i < DB.Quests.Length; i++)
        {
            var def = DB.Quests[i];
            string label = string.Format("{0}   준비 골드 {1}G / 기본 보상 {2}pt\n\n{3}",
                                         def.name, def.prepGold, def.baseReward, def.desc);
            MakeButton(questPanel.transform, label, new Vector2(0, 90 - i * 190), new Vector2(720, 170),
                       () => flow.SelectQuest(def), 16, TextAnchor.MiddleLeft);
        }

        questHonorText = MakeText(questPanel.transform, "", 20, new Vector2(0, -310), new Vector2(500, 36));
    }

    public void RefreshQuest()
    {
        questHonorText.text = "누적 명예: " + RunState.honorTotal + "pt";
    }

    // ---------- 준비 ----------

    void BuildPrepPanel()
    {
        prepPanel = FullPanel("PrepPanel", new Color(0.1f, 0.12f, 0.15f, 1f));
        prepTitleText = MakeText(prepPanel.transform, "준비", 30, new Vector2(-250, 325), new Vector2(600, 44), TextAnchor.MiddleLeft);
        prepGoldText = MakeText(prepPanel.transform, "", 26, new Vector2(430, 325), new Vector2(340, 44), TextAnchor.MiddleRight,
                                new Color(1f, 0.85f, 0.3f));

        // 좌: 상점
        MakeText(prepPanel.transform, "상점 (장비는 이번 판 대여)", 20, new Vector2(-380, 275), new Vector2(430, 32), TextAnchor.MiddleLeft);
        shopTexts.Clear();
        for (int i = 0; i < flow.Shop.Count; i++)
        {
            int idx = i;
            var btn = MakeButton(prepPanel.transform, "", new Vector2(-380, 230 - i * 52), new Vector2(430, 46),
                                 () => flow.Buy(idx), 15, TextAnchor.MiddleLeft);
            shopTexts.Add(ButtonText(btn));
        }
        prepMsgText = MakeText(prepPanel.transform, "", 15, new Vector2(-380, -212), new Vector2(430, 28),
                               TextAnchor.MiddleLeft, new Color(1f, 0.6f, 0.5f));

        // 좌 하단: 몬스터 정보
        MakeText(prepPanel.transform, "의뢰 정보", 18, new Vector2(-380, -248), new Vector2(430, 28), TextAnchor.MiddleLeft);
        var descText = MakeText(prepPanel.transform, "", 14, new Vector2(-380, -305), new Vector2(430, 80),
                                TextAnchor.UpperLeft, new Color(0.75f, 0.8f, 0.85f));
        questDescText = descText;

        // 우: 감빗 규칙표
        MakeText(prepPanel.transform, "감빗 규칙 (위 줄이 우선. 클릭해서 변경)", 20, new Vector2(310, 275), new Vector2(560, 32), TextAnchor.MiddleLeft);
        gambitCondTexts = new Text[3];
        gambitActTexts = new Text[3];
        gambitOnTexts = new Text[3];
        for (int i = 0; i < 3; i++)
        {
            int idx = i;
            float y = 215 - i * 64;
            MakeText(prepPanel.transform, (i + 1).ToString(), 22, new Vector2(60, y), new Vector2(36, 48));
            var condBtn = MakeButton(prepPanel.transform, "", new Vector2(190, y), new Vector2(200, 50),
                                     () => flow.CycleGambitCond(idx), 16);
            gambitCondTexts[i] = ButtonText(condBtn);
            MakeText(prepPanel.transform, "→", 22, new Vector2(305, y), new Vector2(32, 48));
            var actBtn = MakeButton(prepPanel.transform, "", new Vector2(420, y), new Vector2(180, 50),
                                    () => flow.CycleGambitAct(idx), 16);
            gambitActTexts[i] = ButtonText(actBtn);
            var onBtn = MakeButton(prepPanel.transform, "", new Vector2(555, y), new Vector2(70, 50),
                                   () => flow.ToggleGambit(idx), 15);
            gambitOnTexts[i] = ButtonText(onBtn);
        }

        // 우 하단: 긴급 카드 안내
        string cards = "긴급 지시 카드 (사냥 중 각 1회, 미사용 1장당 보상 +10%)\n";
        for (int i = 0; i < DB.CardNames.Length; i++)
            cards += "· " + DB.CardNames[i] + " — " + DB.CardDescs[i] + "\n";
        MakeText(prepPanel.transform, cards, 14, new Vector2(310, -80), new Vector2(560, 130),
                 TextAnchor.UpperLeft, new Color(0.75f, 0.8f, 0.85f));

        MakeButton(prepPanel.transform, "함정 배치로 →", new Vector2(310, -240), new Vector2(320, 62),
                   () => flow.ToPlacement(), 22);
    }

    Text questDescText;

    public void RefreshPrep()
    {
        var run = flow.run;
        prepTitleText.text = "준비 — " + run.quest.name;
        prepGoldText.text = "골드: " + run.gold + "G";
        questDescText.text = run.quest.desc;
        for (int i = 0; i < flow.Shop.Count && i < shopTexts.Count; i++)
        {
            var item = flow.Shop[i];
            shopTexts[i].text = string.Format("{0} ({1}G)   {2}", item.name, item.price, item.status());
        }
        for (int i = 0; i < 3; i++)
        {
            var rule = run.gambits[i];
            gambitCondTexts[i].text = GambitInfo.CondName(rule.cond);
            gambitActTexts[i].text = GambitInfo.ActName(rule.act);
            gambitOnTexts[i].text = rule.enabled ? "ON" : "OFF";
            gambitOnTexts[i].color = rule.enabled ? new Color(0.4f, 1f, 0.5f) : new Color(0.6f, 0.6f, 0.6f);
        }
        prepMsgText.text = flow.prepMessage;
    }

    // ---------- 함정 배치 ----------

    void BuildPlacePanel()
    {
        placePanel = NewUI("PlacePanel", canvasRoot);
        var rt = placePanel.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = rt.offsetMax = Vector2.zero;

        var side = NewUI("Side", placePanel.transform);
        SetRT(side, new Vector2(-490, 0), new Vector2(290, 720));
        var img = side.AddComponent<Image>();
        img.color = new Color(0.08f, 0.09f, 0.12f, 0.92f);

        MakeText(side.transform, "함정 배치", 26, new Vector2(0, 320), new Vector2(260, 40));
        MakeText(side.transform, "함정을 선택하고 맵을 클릭해 설치", 14, new Vector2(0, 282), new Vector2(260, 30),
                 TextAnchor.MiddleCenter, new Color(0.7f, 0.75f, 0.8f));

        placeTrapTexts.Clear();
        TrapType[] types = { TrapType.Snare, TrapType.Shock, TrapType.Spike };
        for (int i = 0; i < types.Length; i++)
        {
            var t = types[i];
            var btn = MakeButton(side.transform, "", new Vector2(0, 220 - i * 70), new Vector2(260, 60),
                                 () => flow.SelectTrap(t), 16);
            placeTrapTexts.Add(ButtonText(btn));
        }

        placeSelText = MakeText(side.transform, "", 17, new Vector2(0, -10), new Vector2(260, 34));

        MakeText(side.transform,
                 "몬스터는 우측에서 배회를 시작한다.\n좌우 끝 초록 지점이 탈출구 —\n도주형은 그 길목도 대비하라.",
                 14, new Vector2(0, -90), new Vector2(260, 110), TextAnchor.UpperLeft,
                 new Color(0.7f, 0.75f, 0.8f));

        MakeButton(side.transform, "← 준비로", new Vector2(0, -210), new Vector2(260, 52),
                   () => flow.BackToPrep(), 18);
        MakeButton(side.transform, "사냥 시작!", new Vector2(0, -290), new Vector2(260, 66),
                   () => flow.StartHunt(), 24);
    }

    public void RefreshPlace()
    {
        var run = flow.run;
        TrapType[] types = { TrapType.Snare, TrapType.Shock, TrapType.Spike };
        for (int i = 0; i < types.Length; i++)
            placeTrapTexts[i].text = DB.TrapName(types[i]) + " — 보유 " + run.trapStock[types[i]];
        placeSelText.text = flow.selectedTrap.HasValue
            ? "선택: " + DB.TrapName(flow.selectedTrap.Value)
            : "함정을 선택하세요";
    }

    // ---------- 사냥 HUD ----------

    void BuildHuntPanel()
    {
        huntPanel = NewUI("HuntPanel", canvasRoot);
        var rt = huntPanel.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = rt.offsetMax = Vector2.zero;

        timerText = MakeText(huntPanel.transform, "3:00", 36, new Vector2(0, 325), new Vector2(220, 50));
        monsterInfoText = MakeText(huntPanel.transform, "", 18, new Vector2(0, 288), new Vector2(600, 30));
        monsterFill = MakeBar(huntPanel.transform, new Vector2(0, 260), MonsterBarW, 18, new Color(0.9f, 0.3f, 0.3f));

        hunterInfoText = MakeText(huntPanel.transform, "", 16, new Vector2(-440, -278), new Vector2(300, 28), TextAnchor.MiddleLeft);
        hunterFill = MakeBar(huntPanel.transform, new Vector2(-440, -302), HunterBarW, 14, new Color(0.3f, 0.6f, 0.95f));

        // 감빗 발동 로그
        var logBg = NewUI("LogBg", huntPanel.transform);
        SetRT(logBg, new Vector2(430, 90), new Vector2(400, 250));
        var logImg = logBg.AddComponent<Image>();
        logImg.color = new Color(0f, 0f, 0f, 0.4f);
        logImg.raycastTarget = false;
        logText = MakeText(logBg.transform, "", 14, Vector2.zero, new Vector2(384, 234), TextAnchor.UpperLeft);

        huntHintText = MakeText(huntPanel.transform, "", 20, new Vector2(0, -255), new Vector2(700, 32),
                                TextAnchor.MiddleCenter, new Color(1f, 0.85f, 0.3f));

        cardButtons = new Button[3];
        for (int i = 0; i < 3; i++)
        {
            int idx = i;
            cardButtons[i] = MakeButton(huntPanel.transform, DB.CardNames[i],
                                        new Vector2((i - 1) * 175, -322), new Vector2(165, 56),
                                        () => flow.hunt.UseCard(idx), 16);
        }
    }

    public void RefreshHunt()
    {
        var hunt = flow.hunt;
        var run = flow.run;
        if (hunt.monster == null || hunt.hunter == null) return;

        timerText.text = hunt.TimerText;
        timerText.color = hunt.remaining < 30f ? new Color(1f, 0.4f, 0.35f) : Color.white;

        var m = hunt.monster;
        monsterInfoText.text = string.Format("{0} — {1}  ({2:0}/{3:0})",
                                             run.quest.name, m.StateLabel, m.unit.hp, m.unit.maxHp);
        SetBar(monsterFill, m.unit.Pct, MonsterBarW);

        var h = hunt.hunter;
        hunterInfoText.text = h.knockedOut
            ? string.Format("헌터 기절! 부활까지 {0:0.0}초", h.KoRemaining)
            : string.Format("헌터 HP {0:0}/{1:0}  (물약 {2})", h.unit.hp, h.unit.maxHp, run.potions);
        SetBar(hunterFill, h.unit.Pct, HunterBarW);

        logText.text = string.Join("\n", hunt.log.ToArray());
        huntHintText.text = hunt.awaitingLureTarget ? "맵을 클릭해 유인 지점을 지정하라!" : "";

        for (int i = 0; i < 3; i++)
            cardButtons[i].interactable = hunt.running && !run.cardUsed[i];
    }

    // ---------- 정산 ----------

    void BuildResultPanel()
    {
        resultPanel = FullPanel("ResultPanel", new Color(0.09f, 0.1f, 0.13f, 0.97f));
        resultTitle = MakeText(resultPanel.transform, "", 36, new Vector2(0, 200), new Vector2(800, 60));
        resultBody = MakeText(resultPanel.transform, "", 20, new Vector2(0, -20), new Vector2(700, 320));
        MakeButton(resultPanel.transform, "다음 의뢰 →", new Vector2(0, -260), new Vector2(320, 64),
                   () => flow.Retry(), 24);
    }

    public void ShowResult()
    {
        var hunt = flow.hunt;
        bool ok = hunt.success == true;
        resultTitle.text = ok ? "사냥 성공!" : "사냥 실패…";
        resultTitle.color = ok ? new Color(0.5f, 1f, 0.6f) : new Color(1f, 0.5f, 0.45f);
        resultBody.text = hunt.resultText;
    }
}
