using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>URP 3D 보드용 스프라이트 렌더러 — 스테이지 재빌드마다 독립 머티리얼.</summary>
    public static class BoardSpriteUtil
    {
        static Shader _shader;

        static Shader ResolveShader()
        {
            if (_shader != null) return _shader;
            _shader = Shader.Find("Sprites/Default")
                ?? Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default")
                ?? Shader.Find("Universal Render Pipeline/Unlit")
                ?? Shader.Find("Unlit/Transparent");
            return _shader;
        }

        public static void ResetShaderCache() => _shader = null;

        public static Material CreateMaterial(Sprite sprite)
        {
            var shader = ResolveShader();
            var mat = new Material(shader);
            if (sprite == null || sprite.texture == null) return mat;

            var tex = sprite.texture;
            var rect = sprite.textureRect;
            if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", tex);
            if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", tex);
            mat.mainTexture = tex;

            var scale = new Vector2(rect.width / tex.width, rect.height / tex.height);
            var offset = new Vector2(rect.x / tex.width, rect.y / tex.height);
            if (mat.HasProperty("_MainTex"))
            {
                mat.SetTextureScale("_MainTex", scale);
                mat.SetTextureOffset("_MainTex", offset);
            }
            if (mat.HasProperty("_BaseMap"))
            {
                mat.SetTextureScale("_BaseMap", scale);
                mat.SetTextureOffset("_BaseMap", offset);
            }

            return mat;
        }

        public static void Apply(SpriteRenderer sr, Sprite sprite, Color? tint = null)
        {
            sr.sprite = sprite;
            sr.sharedMaterial = CreateMaterial(sprite);
            sr.color = tint ?? Color.white;
        }
    }
}
