using UnityEngine;

// 배치형 함정. 속박/전격은 1회용(재가동 카드로 복구 가능), 가시 지대는 지속형.
public class Trap : MonoBehaviour
{
    public TrapType type;
    public bool armed = true;
    public HuntManager hunt;

    SpriteRenderer sr;

    public static Color ColorOf(TrapType t)
    {
        switch (t)
        {
            case TrapType.Snare: return new Color(0.95f, 0.65f, 0.15f); // 주황
            case TrapType.Shock: return new Color(0.3f, 0.85f, 0.95f);  // 하늘
            default: return new Color(0.7f, 0.25f, 0.2f, 0.5f);         // 반투명 적갈
        }
    }

    public static Trap Place(TrapType type, Vector2 pos, HuntManager hunt)
    {
        var go = new GameObject("Trap_" + type);
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = Vector3.one * (type == TrapType.Spike ? 2.2f : 0.9f);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Circle();
        sr.color = ColorOf(type);
        sr.sortingOrder = type == TrapType.Spike ? 1 : 2;
        var trap = go.AddComponent<Trap>();
        trap.type = type;
        trap.hunt = hunt;
        trap.sr = sr;
        return trap;
    }

    void Update()
    {
        if (hunt == null || !hunt.running || hunt.monster == null) return;
        var m = hunt.monster;
        if (m.state == MonsterAI.State.Dead || m.state == MonsterAI.State.Escaped) return;

        float d = Vector2.Distance(transform.position, m.transform.position);

        if (type == TrapType.Spike)
        {
            // 지속형: 범위 안에 있는 동안 도트 피해 + 이속 저하
            if (d < 1.15f)
            {
                m.ApplySlow();
                m.unit.Damage(10f * Time.deltaTime);
            }
            return;
        }

        if (!armed) return;
        if (d < 0.7f) Trigger(m);
    }

    void Trigger(MonsterAI m)
    {
        armed = false;
        var c = ColorOf(type);
        sr.color = new Color(c.r * 0.35f, c.g * 0.35f, c.b * 0.35f, 0.6f);
        hunt.lastSpent = this;
        SpriteFactory.Fx(transform.position, Color.yellow, 0.9f);

        if (type == TrapType.Snare)
        {
            m.ApplyTrap(4f, 0f);
            hunt.AddLog("속박 덫 발동! (4초 속박)");
        }
        else
        {
            m.ApplyTrap(2f, 30f);
            hunt.AddLog("전격 트랩 발동! (2초 기절 + 피해)");
        }
    }

    public void Rearm()
    {
        armed = true;
        sr.color = ColorOf(type);
        SpriteFactory.Fx(transform.position, Color.white, 0.7f);
    }
}

// 던져진 미끼. 경계(Wander) 상태의 몬스터만 반응한다.
public class LurePoint : MonoBehaviour
{
    public float life = 12f;

    public static LurePoint Spawn(Vector2 pos)
    {
        var go = new GameObject("Lure");
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = Vector3.one * 0.4f;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Circle();
        sr.color = new Color(0.95f, 0.4f, 0.65f); // 분홍
        sr.sortingOrder = 2;
        return go.AddComponent<LurePoint>();
    }

    void Update()
    {
        life -= Time.deltaTime;
        if (life <= 0f) Destroy(gameObject);
    }
}
