using UnityEngine;

public class HealthPickup : MonoBehaviour
{
    public int healAmount = 1;

    void OnTriggerEnter2D(Collider2D other)
    {
        Debug.Log("충돌 감지: " + other.gameObject.name);

        if (other.CompareTag("Player"))
        {
            Debug.Log("플레이어와 충돌!");
            Health playerHealth = other.GetComponent<Health>();
            if (playerHealth != null)
            {
                playerHealth.Heal(healAmount);
                Destroy(gameObject);
            }
        }
    }
}