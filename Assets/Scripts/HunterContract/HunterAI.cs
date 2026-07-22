using UnityEngine;

// 헌터 자동전투. 감빗 규칙표를 위에서부터 평가해 첫 번째 실행 가능한 줄을 수행한다.
// 아무 줄도 발동하지 않으면 기본 행동(추적 + 평타).
public class HunterAI : MonoBehaviour
{
    public CombatUnit unit;
    public MonsterAI monster;
    public RunState run;
    public HuntManager hunt;

    public bool knockedOut;
    public float focusUntil; // 집중 사격 카드

    const float MoveSpeed = 3.5f;
    const float BasicRange = 1.2f;
    const float StrongRange = 1.4f;

    float koTimer;
    float basicCd;
    float strongCd;
    float potionCd;
    float lureCd;
    float lastBasicLogTime = -99f;

    SpriteRenderer sr;

    public void Init(RunState r, HuntManager m)
    {
        run = r;
        hunt = m;
        unit = GetComponent<CombatUnit>();
        sr = GetComponent<SpriteRenderer>();
    }

    public void TakeHit(float dmg)
    {
        if (knockedOut) return;
        unit.Damage(dmg * run.DamageTakenMult);
        SpriteFactory.Fx(transform.position, new Color(1f, 0.3f, 0.3f));
        if (unit.IsDead)
        {
            knockedOut = true;
            koTimer = 10f;
            hunt.hadKnockout = true;
            sr.color = Color.gray;
            hunt.AddLog("헌터 기절! 10초 후 부활 (타이머는 계속 흐른다)");
            if (monster != null) monster.OnHunterKnockout();
        }
    }

    void Update()
    {
        if (hunt == null || !hunt.running || monster == null) return;
        if (monster.state == MonsterAI.State.Dead || monster.state == MonsterAI.State.Escaped) return;

        float dt = Time.deltaTime;
        if (basicCd > 0f) basicCd -= dt;
        if (strongCd > 0f) strongCd -= dt;
        if (potionCd > 0f) potionCd -= dt;
        if (lureCd > 0f) lureCd -= dt;

        if (knockedOut)
        {
            koTimer -= dt;
            if (koTimer <= 0f)
            {
                knockedOut = false;
                unit.hp = unit.maxHp * 0.5f;
                sr.color = new Color(0.3f, 0.55f, 0.95f);
                hunt.AddLog("헌터가 일어났다! (HP 50%)");
            }
            return;
        }

        // 감빗 평가: 첫 번째 만족 + 실행 가능한 줄
        for (int i = 0; i < run.gambits.Count; i++)
        {
            var rule = run.gambits[i];
            if (!rule.enabled) continue;
            if (!CondTrue(rule.cond)) continue;
            if (!CanRun(rule.act)) continue;
            RunAction(rule.act, i);
            return;
        }
        ChaseAndBasic(-1); // 기본 행동
    }

    public float KoRemaining { get { return knockedOut ? koTimer : 0f; } }

    bool CondTrue(GCond c)
    {
        switch (c)
        {
            case GCond.Always: return true;
            case GCond.MyHpBelow50: return unit.Pct < 0.5f;
            case GCond.MonsterHpBelow50: return monster.unit.Pct < 0.5f;
            default: return monster.IsTrapped;
        }
    }

    bool CanRun(GAct a)
    {
        switch (a)
        {
            case GAct.BasicAttack: return true;
            case GAct.StrongAttack: return strongCd <= 0f;
            case GAct.HealPotion: return potionCd <= 0f && run.potions > 0 && unit.hp < unit.maxHp * 0.95f;
            default: return lureCd <= 0f && run.lures > 0 && hunt.activeLure == null && hunt.HasTrapTarget();
        }
    }

    void RunAction(GAct a, int slot)
    {
        switch (a)
        {
            case GAct.BasicAttack:
                ChaseAndBasic(slot);
                break;

            case GAct.StrongAttack:
                float dist = Vector2.Distance(transform.position, monster.transform.position);
                if (dist > StrongRange)
                {
                    MoveTowards(monster.transform.position);
                }
                else
                {
                    float dmg = 60f * run.DamageMult * (monster.IsTrapped ? 2f : 1f);
                    monster.unit.Damage(dmg);
                    strongCd = 8f;
                    SpriteFactory.Fx(monster.transform.position, new Color(1f, 0.9f, 0.2f), 0.7f);
                    LogRule(slot, string.Format("강공격! ({0:0} 피해)", dmg));
                }
                break;

            case GAct.HealPotion:
                run.potions--;
                unit.Heal(40f);
                potionCd = 5f;
                SpriteFactory.Fx(transform.position, new Color(0.3f, 1f, 0.4f), 0.6f);
                LogRule(slot, "회복 물약 사용 (+40)");
                ChaseAndBasic(-1); // 물약은 즉발 — 이동은 계속
                break;

            case GAct.ThrowLure:
                run.lures--;
                lureCd = 15f;
                Vector2 target = hunt.BestLurePos();
                hunt.activeLure = LurePoint.Spawn(target);
                LogRule(slot, "미끼 투척 (함정 위로)");
                break;
        }
    }

    void ChaseAndBasic(int slot)
    {
        float dist = Vector2.Distance(transform.position, monster.transform.position);
        if (dist > BasicRange)
        {
            MoveTowards(monster.transform.position);
            return;
        }
        if (basicCd <= 0f)
        {
            basicCd = Time.time < focusUntil ? 0.4f : 0.8f;
            float dmg = 20f * run.DamageMult * (monster.IsTrapped ? 2f : 1f);
            monster.unit.Damage(dmg);
            SpriteFactory.Fx(monster.transform.position, Color.white, 0.4f);
            // 평타는 매 타마다 로그가 쏟아지지 않게 2초 간격으로만 기록
            if (slot >= 0 && Time.time - lastBasicLogTime > 2f)
            {
                lastBasicLogTime = Time.time;
                LogRule(slot, "평타 공격 중");
            }
        }
    }

    void LogRule(int slot, string msg)
    {
        if (slot < 0) hunt.AddLog(msg);
        else
        {
            var rule = run.gambits[slot];
            hunt.AddLog(string.Format("[{0}] {1}→{2}: {3}",
                slot + 1, GambitInfo.CondName(rule.cond), GambitInfo.ActName(rule.act), msg));
        }
    }

    void MoveTowards(Vector2 target)
    {
        Vector2 dir = target - (Vector2)transform.position;
        if (dir.sqrMagnitude < 0.0001f) return;
        Vector2 next = (Vector2)transform.position + dir.normalized * MoveSpeed * Time.deltaTime;
        next.x = Mathf.Clamp(next.x, -MonsterAI.ArenaX, MonsterAI.ArenaX);
        next.y = Mathf.Clamp(next.y, -MonsterAI.ArenaY, MonsterAI.ArenaY);
        transform.position = next;
    }
}
