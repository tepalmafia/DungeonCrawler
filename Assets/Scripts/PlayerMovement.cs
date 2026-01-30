using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerMovement : MonoBehaviour
{
    public float moveSpeed = 5f;
    private Rigidbody2D rb;
    private Vector2 movement;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        movement.x = 0;
        movement.y = 0;

        if (Keyboard.current.aKey.isPressed) movement.x = -1;
        if (Keyboard.current.dKey.isPressed) movement.x = 1;
        if (Keyboard.current.wKey.isPressed) movement.y = 1;
        if (Keyboard.current.sKey.isPressed) movement.y = -1;
    }

    void FixedUpdate()
    {
        rb.MovePosition(rb.position + movement * moveSpeed * Time.fixedDeltaTime);
    }
}