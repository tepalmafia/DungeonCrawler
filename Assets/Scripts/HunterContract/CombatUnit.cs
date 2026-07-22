using UnityEngine;

// 헌터·몬스터 공용 HP 홀더. 기존 Health.cs는 int 기반이라 별도로 둔다.
public class CombatUnit : MonoBehaviour
{
    public float maxHp = 100f;
    public float hp = 100f;
    public System.Action onDamaged;

    public void Init(float max)
    {
        maxHp = max;
        hp = max;
    }

    public bool IsDead { get { return hp <= 0f; } }

    public float Pct { get { return maxHp <= 0f ? 0f : hp / maxHp; } }

    public void Damage(float amount)
    {
        if (IsDead) return;
        hp = Mathf.Max(0f, hp - amount);
        if (onDamaged != null) onDamaged();
    }

    public void Heal(float amount)
    {
        if (IsDead) return;
        hp = Mathf.Min(maxHp, hp + amount);
    }
}
