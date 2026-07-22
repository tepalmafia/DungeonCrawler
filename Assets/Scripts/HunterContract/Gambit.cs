// 감빗(조건-행동 규칙) 정의. 프로토타입은 기본 조건 4종 + 행동 4종.
// 우선순위: 슬롯 위에서부터 검사, 조건 만족 + 실행 가능한 첫 줄만 실행.

public enum GCond
{
    Always,            // 항상
    MyHpBelow50,       // 내 HP < 50%
    MonsterHpBelow50,  // 몬스터 HP < 50%
    MonsterTrapped     // 몬스터가 함정에 걸림
}

public enum GAct
{
    BasicAttack,   // 평타 지속
    StrongAttack,  // 강공격 (쿨 8초, 함정 걸림 시 2배와 궁합)
    HealPotion,    // 회복 물약 (쿨 5초, 소모품)
    ThrowLure      // 미끼 투척 (쿨 15초, 가장 가까운 함정 위로 던짐)
}

public class GambitRule
{
    public GCond cond;
    public GAct act;
    public bool enabled = true;
}

public static class GambitInfo
{
    public static readonly GCond[] AllConds =
    {
        GCond.Always, GCond.MyHpBelow50, GCond.MonsterHpBelow50, GCond.MonsterTrapped
    };

    public static readonly GAct[] AllActs =
    {
        GAct.BasicAttack, GAct.StrongAttack, GAct.HealPotion, GAct.ThrowLure
    };

    public static string CondName(GCond c)
    {
        switch (c)
        {
            case GCond.Always: return "항상";
            case GCond.MyHpBelow50: return "내 HP<50%";
            case GCond.MonsterHpBelow50: return "몬스터 HP<50%";
            default: return "함정에 걸림";
        }
    }

    public static string ActName(GAct a)
    {
        switch (a)
        {
            case GAct.BasicAttack: return "평타 지속";
            case GAct.StrongAttack: return "강공격";
            case GAct.HealPotion: return "회복 물약";
            default: return "미끼 투척";
        }
    }
}
