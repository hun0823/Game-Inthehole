#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;
using InTheHole.Gameplay;

namespace InTheHole.Editor
{
    /// <summary>Resources/Art PNG를 스프라이트로 강제 임포트.</summary>
    public static class ArtImportPipeline
    {
        const string ArtDir = "Assets/Resources/Art";
        const int MinWoodPx = 200;

        public static void EnsureImportedIfNeeded(bool syncDesktopFirst = true)
        {
            if (syncDesktopFirst)
                GameArtAutoSync.TrySyncIfNeeded();

            if (!NeedsImport())
                return;

            ForceImportAll();
        }

        public static void EnsureImported(bool syncDesktopFirst = true)
        {
            if (syncDesktopFirst)
                GameArtAutoSync.TrySyncIfNeeded();
            ForceImportAll();
        }

        static void ForceImportAll()
        {
            if (!Directory.Exists(ArtDir))
                Directory.CreateDirectory(ArtDir);

            foreach (var file in Directory.GetFiles(ArtDir, "*.png"))
            {
                var assetPath = $"{ArtDir}/{Path.GetFileName(file)}";
                AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
            }

            ReferenceArtGenerator.ConfigureImportersPublic();
            AssetDatabase.Refresh();
            SpriteCatalog.ResetCache();
            SpriteBoardBuilder.ResetStatics();
        }

        static bool NeedsImport()
        {
            if (GameArtAutoSync.NeedsSync())
                return true;
            return !Validate(out _);
        }

        public static bool Validate(out string report)
        {
            var lines = new System.Text.StringBuilder();
            bool ok = true;

            foreach (var name in new[] { "ball", "wood_a", "wood_b", "bg_gradient", "hole_ring", "wall_coral" })
            {
                var sp = Resources.Load<Sprite>($"Art/{name}");
                var tex = Resources.Load<Texture2D>($"Art/{name}");
                if (sp != null)
                {
                    var w = sp.texture != null ? sp.texture.width : 0;
                    lines.AppendLine($"OK  Art/{name} (sprite {w}px)");
                    if (name == "wood_a" && w < MinWoodPx)
                    {
                        lines.AppendLine($"    ⚠ wood_a too small ({w}px) — custom art not applied?");
                        ok = false;
                    }
                }
                else if (tex != null)
                    lines.AppendLine($"OK  Art/{name} (texture {tex.width}x{tex.height}, sprite 생성 가능)");
                else
                {
                    lines.AppendLine($"MISSING Art/{name}");
                    ok = false;
                }
            }

            report = lines.ToString();
            return ok;
        }

        [MenuItem("InTheHole/Ensure Game Art Imported")]
        public static void MenuEnsure()
        {
            EnsureImported(syncDesktopFirst: true);
            bool ok = Validate(out var report);
            EditorUtility.DisplayDialog("Game Art",
                ok ? $"임포트 완료.\n\n{report}" : $"일부 누락.\n\n{report}",
                "OK");
            if (!ok)
                Debug.LogWarning($"[ArtImportPipeline]\n{report}");
            else
                Debug.Log($"[ArtImportPipeline]\n{report}");
        }
    }
}
#endif
