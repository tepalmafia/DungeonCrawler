using System.Collections.Generic;

// 기획서 Docs/GameDesign.md 기준 데이터 정의.
// 프로토타입 범위: 몬스터 1~2번, 함정 3종, 감빗 기본 조건 4종, 긴급 카드 3종.

public enum MonsterId { BoarKing, GaleDeer }

public class MonsterDef
{
    public MonsterId id;
    public string name;
    public float maxHp;
    public int prepGold;      // 이 의뢰의 준비 골드
    public int baseReward;    // 기본 명예 pt
    public float fleeAtSeconds = 99999f; // 도주 시작 경과 시간 (도주형만)
    public float fleeAtHpPct = -1f;      // 도주 시작 HP 비율 (도주형만)
    public string desc;
}

public enum TrapType { Snare, Shock, Spike }

public static class DB
{
    public static readonly MonsterDef Boar = new MonsterDef
    {
        id = MonsterId.BoarKing,
        name = "멧돼지 왕",
        maxHp = 300f,
        prepGold = 800,
        baseReward = 100,
        desc = "튜토리얼. 2초 조준 후 직선 돌진, 돌진 뒤 3초 경직이 딜 타임.\n" +
               "HP 30% 이하에서 격노(조준 1초). 도주하지 않는다.\n" +
               "돌진 경로에 함정을 깔면 쉽게 걸린다."
    };

    public static readonly MonsterDef Deer = new MonsterDef
    {
        id = MonsterId.GaleDeer,
        name = "질풍 사슴",
        maxHp = 250f,
        prepGold = 1000,
        baseReward = 180,
        fleeAtSeconds = 90f,
        fleeAtHpPct = 0.4f,
        desc = "도주형. 헌터보다 빨라 평타가 닿지 않는다 — 함정 없이는 딜 불가.\n" +
               "1:30 경과 또는 HP 40% 이하 시 탈출구로 도주 시도.\n" +
               "미끼로 함정 지대에 유인하고, 속박 덫으로 도주를 저지하라."
    };

    public static readonly MonsterDef[] Quests = { Boar, Deer };

    public static string TrapName(TrapType t)
    {
        switch (t)
        {
            case TrapType.Snare: return "속박 덫";
            case TrapType.Shock: return "전격 트랩";
            default: return "가시 지대";
        }
    }

    public static int TrapPrice(TrapType t)
    {
        switch (t)
        {
            case TrapType.Snare: return 200;
            case TrapType.Shock: return 150;
            default: return 100;
        }
    }

    public static readonly string[] CardNames = { "함정 재가동", "집중 사격", "긴급 미끼" };
    public static readonly string[] CardDescs =
    {
        "가장 최근 발동된 함정 1개를 재설치",
        "5초간 공격속도 2배",
        "맵을 클릭해 몬스터를 그 지점으로 강제 이동 (4초)"
    };
}

// 한 판 동안의 상태. 판이 끝나면 버려진다 (로그라이트 리셋).
public class RunState
{
    public MonsterDef quest;
    public int gold;
    public int weaponLv;   // 0/1/2 → 피해 x1.0 / x1.25 / x1.5
    public int armorLv;    // 0/1   → 받는 피해 x1.0 / x0.8
    public int potions;
    public int lures;
    public Dictionary<TrapType, int> trapStock = new Dictionary<TrapType, int>
    {
        { TrapType.Snare, 0 }, { TrapType.Shock, 0 }, { TrapType.Spike, 0 }
    };
    public List<GambitRule> gambits;
    public bool[] cardUsed = new bool[3];

    // 세션 동안만 누적되는 명예 pt (메타 저장은 프로토타입 범위 밖).
    public static int honorTotal;

    public RunState(MonsterDef q)
    {
        quest = q;
        gold = q.prepGold;
        gambits = new List<GambitRule>
        {
            new GambitRule { cond = GCond.MonsterTrapped, act = GAct.StrongAttack },
            new GambitRule { cond = GCond.MyHpBelow50, act = GAct.HealPotion },
            new GambitRule { cond = GCond.Always, act = GAct.BasicAttack }
        };
    }

    public float DamageMult
    {
        get { return weaponLv == 2 ? 1.5f : weaponLv == 1 ? 1.25f : 1f; }
    }

    public float DamageTakenMult
    {
        get { return armorLv >= 1 ? 0.8f : 1f; }
    }
}
