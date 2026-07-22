using UnityEngine;

// 기획서 §4.2 공통 상태머신: 경계 → 교전 → (격노) → 도주, 함정 걸림은 어디서든.
// 격노는 별도 상태 대신 플래그로 구현 (프로토타입 단순화).
public class MonsterAI : MonoBehaviour
{
    public enum State { Wander, Combat, Flee, Trapped, Dead, Escaped }

    public MonsterDef def;
    public CombatUnit unit;
    public HunterAI hunter;
    public HuntManager hunt;
    public State state = State.Wander;
    public bool enraged;

    public const float ArenaX = 7.5f;
    public const float ArenaY = 4.5f;
    public static readonly Vector2 GateL = new Vector2(-7.2f, 0f);
    public static readonly Vector2 GateR = new Vector2(7.2f, 0f);

    static readonly Vector2[] waypoints =
    {
        new Vector2(-5f, 3f), new Vector2(5f, 3f), new Vector2(5f, -3f), new Vector2(-5f, -3f)
    };

    SpriteRenderer sr;
    int wpIndex;
    float elapsed;

    // 함정/디버프
    float trapTimer;
    bool wasFleeing;
    float fleeBlockUntil;
    float slowUntil;

    // 긴급 미끼 카드: 강제 이동
    Vector2 forceTarget;
    float forceUntil;

    // 멧돼지 왕 패턴
    enum BoarPhase { Approach, Aim, Charge, Recover }
    BoarPhase boar = BoarPhase.Approach;
    float phaseTimer;
    Vector2 chargeDir;
    float chargeDist;
    bool chargeHit;

    // 질풍 사슴 패턴
    float sprintTimer = 5f;
    float sprintLeft;
    Vector2 sprintDir;
    float kickCd;

    public bool IsTrapped { get { return state == State.Trapped; } }

    public void Init(MonsterDef d, HunterAI h, HuntManager m)
    {
        def = d;
        hunter = h;
        hunt = m;
        unit = GetComponent<CombatUnit>();
        sr = GetComponent<SpriteRenderer>();
        unit.onDamaged += OnDamaged;
        UpdateColor();
    }

    void OnDamaged()
    {
        if (state == State.Wander) state = State.Combat;
    }

    public void OnHunterKnockout()
    {
        // 기획: 헌터 기절 시 교전을 풀고 경계로 복귀 (다시 유인할 기회)
        if (state == State.Combat)
        {
            state = State.Wander;
            boar = BoarPhase.Approach;
            UpdateColor();
        }
    }

    public void ApplySlow()
    {
        slowUntil = Time.time + 0.3f;
    }

    public void ApplyTrap(float duration, float damage)
    {
        if (state == State.Dead || state == State.Escaped) return;
        if (damage > 0f) unit.Damage(damage);
        if (state == State.Flee) wasFleeing = true;
        state = State.Trapped;
        trapTimer = Mathf.Max(trapTimer, duration);
        boar = BoarPhase.Approach;
        UpdateColor();
    }

    public void ForceMoveTo(Vector2 target, float duration)
    {
        if (state == State.Dead || state == State.Escaped || state == State.Trapped) return;
        forceTarget = target;
        forceUntil = Time.time + duration;
    }

    float SpeedMult { get { return Time.time < slowUntil ? 0.7f : 1f; } }

    void Update()
    {
        if (hunt == null || !hunt.running) return;
        if (state == State.Dead || state == State.Escaped) return;

        if (unit.IsDead)
        {
            state = State.Dead;
            sr.color = new Color(0.2f, 0.2f, 0.2f);
            return;
        }

        float dt = Time.deltaTime;
        elapsed += dt;
        if (kickCd > 0f) kickCd -= dt;

        if (state == State.Trapped)
        {
            trapTimer -= dt;
            if (trapTimer <= 0f)
            {
                state = State.Combat;
                if (wasFleeing)
                {
                    // 도주 저지 성공 → 도주 게이지 리셋 (25초간 재도주 금지)
                    fleeBlockUntil = Time.time + 25f;
                    wasFleeing = false;
                    hunt.AddLog("도주 저지 성공! 몬스터가 교전으로 복귀");
                }
                UpdateColor();
            }
            return;
        }

        // 격노 (멧돼지 왕: HP 30% 이하)
        if (def.id == MonsterId.BoarKing && !enraged && unit.Pct < 0.3f)
        {
            enraged = true;
            hunt.AddLog("멧돼지 왕이 격노했다! (조준 시간 단축)");
            UpdateColor();
        }

        // 도주 조건 (질풍 사슴)
        if (state != State.Flee &&
            (elapsed >= def.fleeAtSeconds || (def.fleeAtHpPct > 0f && unit.Pct < def.fleeAtHpPct)) &&
            Time.time > fleeBlockUntil)
        {
            state = State.Flee;
            hunt.AddLog(def.name + "이(가) 도주를 시작했다!");
            UpdateColor();
        }

        // 긴급 미끼 카드: 상태 무관 강제 이동
        if (Time.time < forceUntil)
        {
            MoveTowards(forceTarget, 4.5f);
            return;
        }

        switch (state)
        {
            case State.Wander: WanderTick(); break;
            case State.Combat:
                if (def.id == MonsterId.BoarKing) BoarTick();
                else DeerTick();
                break;
            case State.Flee: FleeTick(); break;
        }
    }

    void WanderTick()
    {
        // 미끼가 있으면 우선 반응 (경계 상태 전용)
        if (hunt.activeLure != null)
        {
            Vector2 lp = hunt.activeLure.transform.position;
            MoveTowards(lp, 2.5f);
            if (Vector2.Distance(transform.position, lp) < 0.5f)
            {
                Destroy(hunt.activeLure.gameObject);
                hunt.AddLog(def.name + "이(가) 미끼를 먹었다");
            }
            return;
        }

        // 웨이포인트 순찰
        Vector2 wp = waypoints[wpIndex];
        MoveTowards(wp, 1.8f);
        if (Vector2.Distance(transform.position, wp) < 0.4f)
            wpIndex = (wpIndex + 1) % waypoints.Length;

        // 헌터 발견 시 교전
        if (hunter != null && !hunter.knockedOut &&
            Vector2.Distance(transform.position, hunter.transform.position) < 4f)
        {
            state = State.Combat;
            UpdateColor();
        }
    }

    void BoarTick()
    {
        if (hunter == null || hunter.knockedOut) return;
        Vector2 hp = hunter.transform.position;
        float dist = Vector2.Distance(transform.position, hp);
        float dt = Time.deltaTime;

        switch (boar)
        {
            case BoarPhase.Approach:
                MoveTowards(hp, 2.2f);
                if (dist <= 5f)
                {
                    boar = BoarPhase.Aim;
                    phaseTimer = enraged ? 1f : 2f;
                    sr.color = new Color(1f, 0.5f, 0.3f); // 조준 텔레그래프
                }
                break;

            case BoarPhase.Aim:
                phaseTimer -= dt;
                if (phaseTimer <= 0f)
                {
                    chargeDir = ((Vector2)(hp - (Vector2)transform.position)).normalized;
                    boar = BoarPhase.Charge;
                    chargeDist = 0f;
                    chargeHit = false;
                }
                break;

            case BoarPhase.Charge:
                Vector2 before = transform.position;
                MoveRaw(chargeDir, 10f);
                chargeDist += Vector2.Distance(before, transform.position);
                if (!chargeHit && Vector2.Distance(transform.position, hunter.transform.position) < 0.9f)
                {
                    hunter.TakeHit(25f);
                    chargeHit = true;
                }
                bool hitWall = Mathf.Abs(transform.position.x) >= ArenaX - 0.05f ||
                               Mathf.Abs(transform.position.y) >= ArenaY - 0.05f;
                if (chargeDist >= 8f || hitWall)
                {
                    boar = BoarPhase.Recover;
                    phaseTimer = 3f; // 딜 타임
                    UpdateColor();
                }
                break;

            case BoarPhase.Recover:
                phaseTimer -= dt;
                if (phaseTimer <= 0f) boar = BoarPhase.Approach;
                break;
        }
    }

    void DeerTick()
    {
        if (hunter == null || hunter.knockedOut) return;
        Vector2 hp = hunter.transform.position;
        float dist = Vector2.Distance(transform.position, hp);
        float dt = Time.deltaTime;

        // 근접 시 뿔치기 반격
        if (dist < 1f && kickCd <= 0f)
        {
            hunter.TakeHit(10f);
            kickCd = 2f;
            SpriteFactory.Fx(hp, new Color(0.7f, 1f, 0.7f));
        }

        // 질주: 5초마다 1.5초간 이속 3배로 방향 전환 (함정 지대 우회 수단)
        sprintTimer -= dt;
        if (sprintLeft > 0f)
        {
            sprintLeft -= dt;
            MoveWithSlide(sprintDir, 8f);
            return;
        }
        if (sprintTimer <= 0f)
        {
            sprintTimer = 5f;
            sprintLeft = 1.5f;
            Vector2 away = ((Vector2)transform.position - hp).normalized;
            Vector2 tangent = new Vector2(-away.y, away.x) * (Random.value < 0.5f ? 1f : -1f);
            sprintDir = (away + tangent * 0.8f).normalized;
            return;
        }

        // 평상시: 거리 3.5 유지하며 도망 (헌터 3.5 < 사슴 4.5 — 함정 없이는 못 잡음)
        if (dist < 3.5f)
        {
            Vector2 away = ((Vector2)transform.position - hp).normalized;
            MoveWithSlide(away, 4.5f);
        }
    }

    void FleeTick()
    {
        Vector2 gate = Vector2.Distance(transform.position, GateL) <
                       Vector2.Distance(transform.position, GateR) ? GateL : GateR;
        MoveTowards(gate, 5.5f);
        if (Vector2.Distance(transform.position, gate) < 0.4f)
        {
            state = State.Escaped;
            sr.color = new Color(0.4f, 0.4f, 0.4f, 0.4f);
        }
    }

    void MoveTowards(Vector2 target, float speed)
    {
        Vector2 dir = (target - (Vector2)transform.position);
        if (dir.sqrMagnitude < 0.0001f) return;
        MoveRaw(dir.normalized, speed);
    }

    void MoveRaw(Vector2 dir, float speed)
    {
        Vector2 next = (Vector2)transform.position + dir * speed * SpeedMult * Time.deltaTime;
        next.x = Mathf.Clamp(next.x, -ArenaX, ArenaX);
        next.y = Mathf.Clamp(next.y, -ArenaY, ArenaY);
        transform.position = next;
    }

    // 벽에 막히면 접선 방향으로 미끄러지듯 이동 (사슴이 구석에 갇히는 것 완화)
    void MoveWithSlide(Vector2 dir, float speed)
    {
        Vector2 before = transform.position;
        MoveRaw(dir, speed);
        float moved = Vector2.Distance(before, transform.position);
        if (moved < speed * SpeedMult * Time.deltaTime * 0.4f)
        {
            Vector2 tangent = new Vector2(-dir.y, dir.x);
            if (Mathf.Abs((before + tangent).x) > ArenaX || Mathf.Abs((before + tangent).y) > ArenaY)
                tangent = -tangent;
            MoveRaw(tangent, speed);
        }
    }

    void UpdateColor()
    {
        if (sr == null) return;
        Color baseC = def.id == MonsterId.BoarKing
            ? new Color(0.55f, 0.35f, 0.2f)   // 갈색
            : new Color(0.55f, 0.8f, 0.45f);  // 연두
        if (state == State.Trapped) sr.color = Color.gray;
        else if (state == State.Flee) sr.color = new Color(baseC.r, baseC.g, baseC.b, 0.75f);
        else if (enraged) sr.color = new Color(0.9f, 0.25f, 0.2f);
        else sr.color = baseC;
    }

    public string StateLabel
    {
        get
        {
            switch (state)
            {
                case State.Wander: return "경계";
                case State.Combat: return enraged ? "격노" : "교전";
                case State.Flee: return "도주 시도!";
                case State.Trapped: return "함정 걸림";
                case State.Dead: return "처치됨";
                default: return "도주함";
            }
        }
    }
}
