using System.Collections.Generic;
using UnityEngine;

// 사냥 페이즈 진행: 3분 타이머, 승패 판정, 긴급 카드, 보상 정산.
public class HuntManager : MonoBehaviour
{
    public const float TimeLimit = 180f;

    public bool running;
    public float remaining;
    public MonsterAI monster;
    public HunterAI hunter;
    public RunState run;
    public List<Trap> traps = new List<Trap>();
    public Trap lastSpent;          // 함정 재가동 카드 대상
    public LurePoint activeLure;
    public bool hadKnockout;
    public bool awaitingLureTarget; // 긴급 미끼 카드: 클릭 대기 중

    public List<string> log = new List<string>();
    public bool? success;           // null = 진행 중
    public string resultText = "";
    public int earnedPoints;

    public void Begin(RunState r, MonsterAI m, HunterAI h, List<Trap> placed)
    {
        run = r;
        monster = m;
        hunter = h;
        traps = placed;
        remaining = TimeLimit;
        running = true;
        success = null;
        hadKnockout = false;
        awaitingLureTarget = false;
        lastSpent = null;
        log.Clear();
        AddLog("사냥 시작! 제한 시간 3:00");
    }

    void Update()
    {
        if (!running) return;
        remaining -= Time.deltaTime;

        if (monster.state == MonsterAI.State.Dead)
            End(true, "사냥 성공! " + run.quest.name + "을(를) 처치했다.");
        else if (monster.state == MonsterAI.State.Escaped)
            End(false, run.quest.name + "이(가) 탈출구로 도주했다…");
        else if (remaining <= 0f)
        {
            remaining = 0f;
            End(false, "시간 초과 — " + run.quest.name + "이(가) 어둠 속으로 사라졌다…");
        }
    }

    void End(bool ok, string headline)
    {
        running = false;
        success = ok;

        if (ok)
        {
            int baseReward = run.quest.baseReward;
            int timeBonus = Mathf.Min(60, Mathf.FloorToInt(remaining / 10f) * 5);
            int cardCount = 0;
            for (int i = 0; i < run.cardUsed.Length; i++)
                if (!run.cardUsed[i]) cardCount++;
            int cardBonus = cardCount * 10;
            int koBonus = hadKnockout ? 0 : 20;
            int totalPct = 100 + timeBonus + cardBonus + koBonus;
            earnedPoints = Mathf.RoundToInt(baseReward * totalPct / 100f);
            RunState.honorTotal += earnedPoints;

            resultText = headline + "\n\n"
                + "기본 보상: " + baseReward + "pt\n"
                + "남은 시간 보너스: +" + timeBonus + "%\n"
                + "카드 미사용 보너스: +" + cardBonus + "% (" + cardCount + "장)\n"
                + "노 기절 보너스: +" + koBonus + "%\n"
                + "─────────────\n"
                + "획득 명예: " + earnedPoints + "pt (배율 " + totalPct + "%)\n"
                + "누적 명예: " + RunState.honorTotal + "pt";
        }
        else
        {
            earnedPoints = 30; // 위로금 — 메타 성장이 완전히 멈추지 않게
            RunState.honorTotal += earnedPoints;
            resultText = headline + "\n\n"
                + "위로금: " + earnedPoints + "pt\n"
                + "누적 명예: " + RunState.honorTotal + "pt\n\n"
                + "(본편에서는 실패해도 도감 정보가 남아 재도전이 쉬워진다)";
        }
    }

    public void UseCard(int i)
    {
        if (!running || run.cardUsed[i]) return;

        switch (i)
        {
            case 0: // 함정 재가동
                if (lastSpent == null)
                {
                    AddLog("재가동할 함정이 없다 (아직 발동된 함정 없음)");
                    return; // 소모하지 않음
                }
                lastSpent.Rearm();
                run.cardUsed[0] = true;
                AddLog("카드: 함정 재가동! " + DB.TrapName(lastSpent.type) + " 재설치");
                break;

            case 1: // 집중 사격
                hunter.focusUntil = Time.time + 5f;
                run.cardUsed[1] = true;
                AddLog("카드: 집중 사격! 5초간 공격속도 2배");
                break;

            case 2: // 긴급 미끼
                awaitingLureTarget = true;
                run.cardUsed[2] = true;
                AddLog("카드: 긴급 미끼 — 맵을 클릭해 유인 지점을 지정하라");
                break;
        }
    }

    public void SetLureTarget(Vector2 pos)
    {
        awaitingLureTarget = false;
        monster.ForceMoveTo(pos, 4f);
        SpriteFactory.Fx(pos, new Color(0.95f, 0.4f, 0.65f), 0.8f, 0.5f);
        AddLog("긴급 미끼 투척! 몬스터가 유인된다 (4초)");
    }

    public bool HasTrapTarget()
    {
        foreach (var t in traps)
            if (t != null && (t.armed || t.type == TrapType.Spike)) return true;
        return false;
    }

    // 감빗 미끼 투척의 목표: 몬스터에서 가장 가까운 유효 함정 위치
    public Vector2 BestLurePos()
    {
        Vector2 from = monster != null ? (Vector2)monster.transform.position : Vector2.zero;
        Trap best = null;
        float bestDist = float.MaxValue;
        foreach (var t in traps)
        {
            if (t == null || (!t.armed && t.type != TrapType.Spike)) continue;
            float d = Vector2.Distance(from, t.transform.position);
            if (d < bestDist) { bestDist = d; best = t; }
        }
        return best != null ? (Vector2)best.transform.position : from;
    }

    public void AddLog(string msg)
    {
        log.Add(msg);
        if (log.Count > 7) log.RemoveAt(0);
    }

    public string TimerText
    {
        get
        {
            int t = Mathf.CeilToInt(remaining);
            return string.Format("{0}:{1:00}", t / 60, t % 60);
        }
    }
}
