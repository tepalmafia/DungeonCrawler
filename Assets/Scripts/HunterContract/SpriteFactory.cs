using UnityEngine;

// 런타임에서 스프라이트·폰트·이펙트를 생성하는 유틸리티.
// 아트 에셋 없이 프로토타입을 돌리기 위한 용도.
public static class SpriteFactory
{
    static Sprite circleSprite;
    static Sprite squareSprite;
    static Font uiFont;

    public static Sprite Circle()
    {
        if (circleSprite == null) circleSprite = Make(true);
        return circleSprite;
    }

    public static Sprite Square()
    {
        if (squareSprite == null) squareSprite = Make(false);
        return squareSprite;
    }

    static Sprite Make(bool round)
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        float r = size * 0.5f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                bool inside = true;
                if (round)
                {
                    float dx = x - r + 0.5f;
                    float dy = y - r + 0.5f;
                    inside = dx * dx + dy * dy <= (r - 1f) * (r - 1f);
                }
                tex.SetPixel(x, y, inside ? Color.white : Color.clear);
            }
        }
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 64f);
    }

    // 한글 표시를 위해 OS 폰트를 우선 탐색하고, 없으면 내장 폰트로 폴백.
    public static Font UIFont()
    {
        if (uiFont != null) return uiFont;

        string[] wanted =
        {
            "Malgun Gothic", "맑은 고딕",
            "Apple SD Gothic Neo", "AppleSDGothicNeo-Regular",
            "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", "나눔고딕"
        };
        string[] installed = Font.GetOSInstalledFontNames();
        foreach (string name in wanted)
        {
            foreach (string os in installed)
            {
                if (string.Equals(os, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    uiFont = Font.CreateDynamicFontFromOSFont(os, 16);
                    return uiFont;
                }
            }
        }
        uiFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        return uiFont;
    }

    // 짧게 나타났다 사라지는 타격/효과 플래시.
    public static void Fx(Vector2 pos, Color color, float scale = 0.45f, float life = 0.18f)
    {
        var go = new GameObject("Fx");
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = Vector3.one * scale;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Circle();
        sr.color = color;
        sr.sortingOrder = 8;
        var fade = go.AddComponent<AutoFade>();
        fade.life = life;
    }
}

public class AutoFade : MonoBehaviour
{
    public float life = 0.18f;
    float elapsed;
    SpriteRenderer sr;

    void Awake() { sr = GetComponent<SpriteRenderer>(); }

    void Update()
    {
        elapsed += Time.deltaTime;
        if (sr != null)
        {
            var c = sr.color;
            c.a = Mathf.Lerp(1f, 0f, elapsed / life);
            sr.color = c;
        }
        if (elapsed >= life) Destroy(gameObject);
    }
}
