using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

// 이 컴포넌트 하나만 빈 씬의 GameObject에 붙이면 게임 전체가 코드로 구성된다.
// 사용법: 새 씬 → 빈 GameObject 생성 → GameBootstrap 추가 → Play.
public class GameBootstrap : MonoBehaviour
{
    void Start()
    {
        Application.targetFrameRate = 60;
        SetupCamera();
        BuildArena();
        EnsureEventSystem();

        var gameGo = new GameObject("Game");
        var hunt = gameGo.AddComponent<HuntManager>();
        var flow = gameGo.AddComponent<GameFlow>();

        var uiGo = new GameObject("GameUI");
        var ui = uiGo.AddComponent<GameUI>();

        flow.Init(ui, hunt);
        ui.Init(flow);
        ui.BuildAll();
        flow.SetPhase(GameFlow.Phase.Quest);
    }

    void SetupCamera()
    {
        var cam = Camera.main;
        if (cam == null)
        {
            var go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            cam = go.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = 6f;
        cam.transform.position = new Vector3(0f, 0f, -10f);
        cam.backgroundColor = new Color(0.05f, 0.06f, 0.08f);
        cam.clearFlags = CameraClearFlags.SolidColor;
    }

    void BuildArena()
    {
        // 바닥
        MakeQuad("Ground", Vector2.zero, new Vector2(16f, 10f),
                 new Color(0.14f, 0.17f, 0.15f), 0);

        // 벽 테두리
        Color wall = new Color(0.3f, 0.32f, 0.36f);
        MakeQuad("WallTop", new Vector2(0f, 5.1f), new Vector2(16.6f, 0.3f), wall, 3);
        MakeQuad("WallBottom", new Vector2(0f, -5.1f), new Vector2(16.6f, 0.3f), wall, 3);
        MakeQuad("WallLeft", new Vector2(-8.15f, 0f), new Vector2(0.3f, 10.5f), wall, 3);
        MakeQuad("WallRight", new Vector2(8.15f, 0f), new Vector2(0.3f, 10.5f), wall, 3);

        // 탈출구 (도주형 몬스터의 목적지)
        Color gate = new Color(0.25f, 0.75f, 0.4f);
        MakeQuad("GateLeft", MonsterAI.GateL + new Vector2(-0.5f, 0f), new Vector2(0.35f, 1.8f), gate, 4);
        MakeQuad("GateRight", MonsterAI.GateR + new Vector2(0.5f, 0f), new Vector2(0.35f, 1.8f), gate, 4);
    }

    void MakeQuad(string name, Vector2 pos, Vector2 size, Color color, int order)
    {
        var go = new GameObject(name);
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = new Vector3(size.x, size.y, 1f);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Square();
        sr.color = color;
        sr.sortingOrder = order;
    }

    void EnsureEventSystem()
    {
        if (EventSystem.current != null) return;
        var go = new GameObject("EventSystem");
        go.AddComponent<EventSystem>();
        go.AddComponent<InputSystemUIInputModule>();
    }
}
