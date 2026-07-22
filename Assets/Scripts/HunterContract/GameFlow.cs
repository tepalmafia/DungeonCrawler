using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

// 전체 게임 흐름: 의뢰 → 준비 → 함정 배치 → 사냥 → 정산 → (반복).
public class GameFlow : MonoBehaviour
{
    public enum Phase { Quest, Prep, Place, Hunt, Result }

    public Phase phase = Phase.Quest;
    public RunState run;
    public HuntManager hunt;
    public GameUI ui;

    public TrapType? selectedTrap;
    public string prepMessage = "";

    public class ShopItem
    {
        public string name;
        public int price;
        public System.Func<string> status;
        public System.Func<bool> canBuy;
        public System.Action apply;
    }

    public List<ShopItem> Shop = new List<ShopItem>();

    readonly List<Trap> placedTraps = new List<Trap>();
    GameObject hunterGo, monsterGo;

    public void Init(GameUI gameUi, HuntManager huntManager)
    {
        ui = gameUi;
        hunt = huntManager;
        BuildShop();
    }

    void BuildShop()
    {
        Shop.Add(new ShopItem
        {
            name = "무기 강화 Lv1 (피해 +25%)", price = 200,
            status = () => run.weaponLv >= 1 ? "장착됨" : "",
            canBuy = () => run.weaponLv < 1,
            apply = () => run.weaponLv = 1
        });
        Shop.Add(new ShopItem
        {
            name = "무기 강화 Lv2 (피해 +50%)", price = 400,
            status = () => run.weaponLv >= 2 ? "장착됨" : run.weaponLv < 1 ? "Lv1 필요" : "",
            canBuy = () => run.weaponLv == 1,
            apply = () => run.weaponLv = 2
        });
        Shop.Add(new ShopItem
        {
            name = "방어구 (받는 피해 -20%)", price = 200,
            status = () => run.armorLv >= 1 ? "장착됨" : "",
            canBuy = () => run.armorLv < 1,
            apply = () => run.armorLv = 1
        });
        AddTrapItem(TrapType.Snare, "4초 속박, 도주 저지 가능");
        AddTrapItem(TrapType.Shock, "2초 기절 + 피해 30");
        AddTrapItem(TrapType.Spike, "지속형: 도트 + 이속 -30%");
        Shop.Add(new ShopItem
        {
            name = "회복 물약 x3", price = 120,
            status = () => "보유 " + run.potions,
            canBuy = () => true,
            apply = () => run.potions += 3
        });
        Shop.Add(new ShopItem
        {
            name = "미끼 x2 (경계 상태 유인)", price = 80,
            status = () => "보유 " + run.lures,
            canBuy = () => true,
            apply = () => run.lures += 2
        });
    }

    void AddTrapItem(TrapType t, string desc)
    {
        Shop.Add(new ShopItem
        {
            name = DB.TrapName(t) + " (" + desc + ")",
            price = DB.TrapPrice(t),
            status = () => "보유 " + run.trapStock[t],
            canBuy = () => true,
            apply = () => run.trapStock[t]++
        });
    }

    public void SetPhase(Phase p)
    {
        phase = p;
        ui.ShowPhase(p);
    }

    // ---------- 의뢰 ----------

    public void SelectQuest(MonsterDef def)
    {
        run = new RunState(def);
        prepMessage = "";
        SetPhase(Phase.Prep);
    }

    // ---------- 준비 ----------

    public void Buy(int index)
    {
        var item = Shop[index];
        if (!item.canBuy())
        {
            prepMessage = "구매 불가: " + item.name;
        }
        else if (run.gold < item.price)
        {
            prepMessage = "골드 부족! (" + item.price + "G 필요, 보유 " + run.gold + "G)";
        }
        else
        {
            run.gold -= item.price;
            item.apply();
            prepMessage = "";
        }
        ui.RefreshPrep();
    }

    public void CycleGambitCond(int slot)
    {
        var rule = run.gambits[slot];
        int i = System.Array.IndexOf(GambitInfo.AllConds, rule.cond);
        rule.cond = GambitInfo.AllConds[(i + 1) % GambitInfo.AllConds.Length];
        ui.RefreshPrep();
    }

    public void CycleGambitAct(int slot)
    {
        var rule = run.gambits[slot];
        int i = System.Array.IndexOf(GambitInfo.AllActs, rule.act);
        rule.act = GambitInfo.AllActs[(i + 1) % GambitInfo.AllActs.Length];
        ui.RefreshPrep();
    }

    public void ToggleGambit(int slot)
    {
        run.gambits[slot].enabled = !run.gambits[slot].enabled;
        ui.RefreshPrep();
    }

    public void ToPlacement()
    {
        selectedTrap = null;
        SetPhase(Phase.Place);
    }

    public void BackToPrep()
    {
        SetPhase(Phase.Prep);
    }

    // ---------- 함정 배치 ----------

    public void SelectTrap(TrapType t)
    {
        selectedTrap = t;
        ui.RefreshPlace();
    }

    void TryPlaceTrap(Vector2 pos)
    {
        if (!selectedTrap.HasValue) return;
        TrapType t = selectedTrap.Value;
        if (run.trapStock[t] <= 0)
        {
            selectedTrap = null;
            ui.RefreshPlace();
            return;
        }
        run.trapStock[t]--;
        placedTraps.Add(Trap.Place(t, pos, hunt));
        if (run.trapStock[t] <= 0) selectedTrap = null;
        ui.RefreshPlace();
    }

    // ---------- 사냥 ----------

    public void StartHunt()
    {
        hunterGo = MakeUnit("Hunter", new Color(0.3f, 0.55f, 0.95f), 0.8f, new Vector2(-5f, 0f));
        hunterGo.GetComponent<CombatUnit>().Init(100f);
        var hunter = hunterGo.AddComponent<HunterAI>();
        hunter.Init(run, hunt);

        var def = run.quest;
        monsterGo = MakeUnit("Monster", Color.white,
                             def.id == MonsterId.BoarKing ? 1.4f : 1f, new Vector2(5f, 0f));
        monsterGo.GetComponent<CombatUnit>().Init(def.maxHp);
        var monster = monsterGo.AddComponent<MonsterAI>();
        monster.Init(def, hunter, hunt);
        hunter.monster = monster;

        hunt.Begin(run, monster, hunter, placedTraps);
        SetPhase(Phase.Hunt);
    }

    GameObject MakeUnit(string name, Color color, float scale, Vector2 pos)
    {
        var go = new GameObject(name);
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = Vector3.one * scale;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Circle();
        sr.color = color;
        sr.sortingOrder = 5;
        go.AddComponent<CombatUnit>();
        return go;
    }

    // ---------- 정산/반복 ----------

    public void Retry()
    {
        Cleanup();
        SetPhase(Phase.Quest);
    }

    void Cleanup()
    {
        if (hunterGo != null) Destroy(hunterGo);
        if (monsterGo != null) Destroy(monsterGo);
        foreach (var t in placedTraps)
            if (t != null) Destroy(t.gameObject);
        placedTraps.Clear();
        if (hunt.activeLure != null) Destroy(hunt.activeLure.gameObject);
        hunt.running = false;
        hunt.success = null;
        run = null;
        selectedTrap = null;
    }

    // ---------- 입력 ----------

    void Update()
    {
        if (phase == Phase.Place)
        {
            Vector2? click = ArenaClick();
            if (click.HasValue) TryPlaceTrap(click.Value);
        }
        else if (phase == Phase.Hunt)
        {
            ui.RefreshHunt();

            if (hunt.awaitingLureTarget)
            {
                Vector2? click = ArenaClick();
                if (click.HasValue) hunt.SetLureTarget(click.Value);
            }

            if (hunt.success != null) SetPhase(Phase.Result);
        }
    }

    Vector2? ArenaClick()
    {
        if (Mouse.current == null || !Mouse.current.leftButton.wasPressedThisFrame) return null;
        if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) return null;
        var cam = Camera.main;
        if (cam == null) return null;
        Vector2 screen = Mouse.current.position.ReadValue();
        Vector3 world = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, -cam.transform.position.z));
        if (Mathf.Abs(world.x) > MonsterAI.ArenaX || Mathf.Abs(world.y) > MonsterAI.ArenaY) return null;
        return new Vector2(world.x, world.y);
    }
}
