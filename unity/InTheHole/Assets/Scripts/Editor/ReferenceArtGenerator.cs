#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace InTheHole.Editor
{
    /// <summary>
    /// 레퍼런스급 2.5D용 플레이스홀더 스프라이트 생성 → Resources/Art/
    /// </summary>
    public static class ReferenceArtGenerator
    {
        const string OutDir = "Assets/Resources/Art";

        [MenuItem("InTheHole/Generate Reference Art (Sprites)")]
        public static void GenerateAll()
        {
            var wood = $"{OutDir}/wood_a.png";
            if (File.Exists(wood) && new FileInfo(wood).Length > 80_000)
            {
                if (!EditorUtility.DisplayDialog("Generate Reference Art",
                    "커스텀 PNG가 있습니다. 임시 아트로 덮어쓰면 Sync가 다시 필요합니다.\n계속할까요?",
                    "덮어쓰기", "취소"))
                    return;
            }

            Directory.CreateDirectory(OutDir);

            Save("bg_gradient", MakeBgGradient(512, 768));
            Save("wood_a", MakeWood(128, 0));
            Save("wood_b", MakeWood(128, 1));
            Save("frame_mint", MakeFrameMint(128));
            Save("wall_h", MakeCandyWall(256, 96, true));
            Save("wall_v", MakeCandyWall(96, 256, false));
            Save("wall_coral", MakeCandyWall(256, 96, true, "#ff6b6b"));
            Save("wall_blue", MakeCandyWall(256, 96, true, "#5b9dff"));
            Save("wall_purple", MakeCandyWall(256, 96, true, "#b47aff"));
            Save("wall_green", MakeCandyWall(256, 96, true, "#5dd68a"));
            Save("hole_ring", MakeHoleRing(256));
            Save("hole_core", MakeHoleCore(128));
            Save("ball", MakeBall(256));
            Save("ball_shadow", MakeShadow(128));
            Save("star", MakeStar(32));
            Save("ui_panel", MakeUiPanel(64, 64));

            AssetDatabase.Refresh();
            ConfigureImporters();
            Debug.Log($"[InTheHole] Reference art saved to {OutDir}. Play mode will use sprite board.");
        }

        /// <summary>커스텀 PNG 덮어쓰지 않음. 메뉴에서만 수동 실행.</summary>

        static void Save(string name, Texture2D tex)
        {
            var path = $"{OutDir}/{name}.png";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
        }

        public static void ConfigureImportersPublic() => ConfigureImporters();

        static void ConfigureImporters()
        {
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { OutDir }))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var imp = (TextureImporter)AssetImporter.GetAtPath(path);
                imp.textureType = TextureImporterType.Sprite;
                imp.spriteImportMode = SpriteImportMode.Single;
                imp.spritePixelsPerUnit = 100;
                imp.filterMode = FilterMode.Bilinear;
                imp.mipmapEnabled = false;
                imp.alphaIsTransparency = true;
                imp.textureCompression = TextureImporterCompression.Uncompressed;
                imp.SaveAndReimport();
            }
        }

        static Texture2D MakeBgGradient(int w, int h)
        {
            var t = NewTex(w, h);
            var top = Hex("#0c1628");
            var mid = Hex("#142040");
            var bot = Hex("#1a3060");
            for (int y = 0; y < h; y++)
            {
                float v = y / (float)(h - 1);
                var c = Color.Lerp(bot, Color.Lerp(mid, top, v * 1.2f), v);
                for (int x = 0; x < w; x++)
                    t.SetPixel(x, y, c);
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeWood(int size, int seed)
        {
            var t = NewTex(size, size);
            var rng = new System.Random(100 + seed);
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float n = Mathf.PerlinNoise(x * 0.12f + seed, y * 0.08f);
                var c = Color.Lerp(Hex("#8b5e3c"), Hex("#c49262"), n);
                c = Color.Lerp(c, Hex("#6e4a30"), Mathf.PerlinNoise(x * 0.4f, y * 0.05f) * 0.25f);
                t.SetPixel(x, y, c);
            }
            RoundedCorners(t, 10);
            t.Apply();
            return t;
        }

        static Texture2D MakeFrameMint(int size)
        {
            var t = NewTex(size, size);
            FillRounded(t, Hex("#7ee8c8"), Hex("#3db896"), 14);
            t.Apply();
            return t;
        }

        static Texture2D MakeCandyWall(int w, int h, bool horizontal, string hex = "#ff6b6b")
        {
            var t = NewTex(w, h);
            var baseC = Hex(hex);
            var dark = Color.Lerp(baseC, Color.black, 0.28f);
            var hi = Color.Lerp(baseC, Color.white, 0.4f);
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float u = x / (float)(w - 1);
                float v = y / (float)(h - 1);
                float edge = Mathf.Min(Mathf.Min(u, 1f - u) * w * 0.12f, Mathf.Min(v, 1f - v) * h * 0.35f);
                edge = Mathf.Clamp01(edge);
                var c = Color.Lerp(dark, baseC, edge);
                if (v > 0.72f) c = Color.Lerp(c, hi, (v - 0.72f) / 0.28f);
                t.SetPixel(x, y, c);
            }
            RoundedCorners(t, horizontal ? 18 : 14);
            t.Apply();
            return t;
        }

        static Texture2D MakeHoleRing(int size)
        {
            var t = NewTex(size, size);
            float cx = size * 0.5f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(cx, cx)) / cx;
                float a = Mathf.SmoothStep(0.45f, 0.55f, d) * (1f - Mathf.SmoothStep(0.78f, 0.95f, d));
                var c = Color.Lerp(Hex("#18c8e8"), Hex("#9dfff0"), 1f - d);
                t.SetPixel(x, y, new Color(c.r, c.g, c.b, a));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeHoleCore(int size)
        {
            var t = NewTex(size, size);
            float cx = size * 0.5f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(cx, cx)) / cx;
                float a = 1f - Mathf.SmoothStep(0.2f, 1f, d);
                t.SetPixel(x, y, new Color(0f, 0.02f, 0.05f, a));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeBall(int size)
        {
            var t = NewTex(size, size);
            float cx = size * 0.5f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(cx, cx)) / cx;
                if (d > 1f) { t.SetPixel(x, y, Color.clear); continue; }
                var baseC = Color.Lerp(Hex("#9a4e22"), Hex("#e88b4a"), 1f - d);
                float spec = Mathf.Exp(-((x - cx * 1.15f) * (x - cx * 1.15f) + (y - cx * 1.2f) * (y - cx * 1.2f)) / (size * 8f));
                baseC = Color.Lerp(baseC, Hex("#ffe8c8"), spec * 0.85f);
                float rim = Mathf.SmoothStep(0.85f, 1f, d);
                baseC = Color.Lerp(baseC, Hex("#5a3018"), rim * 0.5f);
                t.SetPixel(x, y, new Color(baseC.r, baseC.g, baseC.b, 1f - Mathf.SmoothStep(0.92f, 1f, d)));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeShadow(int size)
        {
            var t = NewTex(size, size / 2);
            float cx = size * 0.5f;
            for (int y = 0; y < t.height; y++)
            for (int x = 0; x < size; x++)
            {
                float dx = (x - cx) / cx;
                float dy = (y - t.height * 0.5f) / (t.height * 0.5f);
                float a = Mathf.Exp(-(dx * dx * 3f + dy * dy * 5f)) * 0.55f;
                t.SetPixel(x, y, new Color(0f, 0f, 0f, a));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeStar(int size)
        {
            var t = NewTex(size, size);
            float cx = size * 0.5f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(cx, cx)) / cx;
                float a = 1f - Mathf.SmoothStep(0.3f, 1f, d);
                t.SetPixel(x, y, new Color(1f, 1f, 1f, a * 0.9f));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeUiPanel(int w, int h)
        {
            var t = NewTex(w, h);
            FillRounded(t, new Color(0.1f, 0.18f, 0.32f, 0.92f), new Color(0.06f, 0.1f, 0.2f, 0.95f), 12);
            t.Apply();
            return t;
        }

        static Texture2D NewTex(int w, int h)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false);
            t.filterMode = FilterMode.Bilinear;
            t.wrapMode = TextureWrapMode.Clamp;
            return t;
        }

        static void FillRounded(Texture2D t, Color inner, Color edge, int radius)
        {
            int w = t.width, h = t.height;
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float dist = EdgeDistance(x, y, w, h, radius);
                var c = Color.Lerp(edge, inner, Mathf.Clamp01(dist * 4f));
                t.SetPixel(x, y, c);
            }
        }

        static void RoundedCorners(Texture2D t, int radius)
        {
            int w = t.width, h = t.height;
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float d = EdgeDistance(x, y, w, h, radius);
                if (d < 0f)
                {
                    var c = t.GetPixel(x, y);
                    c.a *= Mathf.Clamp01(1f + d * 4f);
                    t.SetPixel(x, y, c);
                }
            }
        }

        static float EdgeDistance(int x, int y, int w, int h, int r)
        {
            float dx = Mathf.Min(x, w - 1 - x);
            float dy = Mathf.Min(y, h - 1 - y);
            return Mathf.Min(dx, dy) - r;
        }

        static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }
    }
}
#endif
