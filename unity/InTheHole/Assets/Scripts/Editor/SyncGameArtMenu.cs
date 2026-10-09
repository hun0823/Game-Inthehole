#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using InTheHole.Gameplay;

namespace InTheHole.Editor
{
    public static class SyncGameArtMenu
    {
        public const string SourceFolder2 = @"C:\Users\ckdgn\Desktop\Rollin' Board\game_asset2";
        public const string SourceFolder = @"C:\Users\ckdgn\Desktop\Rollin' Board\game_asset\png";

        const string DstDir = "Assets/Resources/Art";
        const long MinCustomBytes = 80_000;

        /// <summary>Unity 파일명 → 바탕화면 후보 파일명 (앞 우선).</summary>
        public static IReadOnlyDictionary<string, string[]> FileMap => Map;

        static readonly Dictionary<string, string[]> Map = new()
        {
            { "wood_a.png", new[] { "wood_a.png", "wood_a-removebg-preview.png" } },
            { "wood_b.png", new[] { "wood_b.png", "wood_b-removebg-preview.png" } },
            { "wall_coral.png", new[] { "wall_coral.png", "wall_coral-removebg-preview.png" } },
            { "wall_blue.png", new[] { "wall_blue.png", "wall_blue-removebg-preview.png" } },
            { "wall_purple.png", new[] { "wall_purple.png", "wall_purple-removebg-preview.png" } },
            { "wall_green.png", new[] { "wall_green.png", "wall_green-removebg-preview.png" } },
            { "star.png", new[] { "star.png", "star-removebg-preview.png" } },
            { "frame_mint.png", new[] { "frame_mint.png" } },
            { "ball.png", new[] { "ball.png" } },
            { "ball_shadow.png", new[] { "ball_shadow.png" } },
            { "hole_ring.png", new[] { "hole_ring.png" } },
            { "hole_core.png", new[] { "hole_core.png" } },
            { "bg_gradient.png", new[] { "bg_gradient.png" } },
            { "wall_h.png", new[] { "wall_h.png" } },
            { "wall_v.png", new[] { "wall_v.png" } },
            { "ui_panel.png", new[] { "ui_panel.png" } },
        };

        static readonly string[] SourceFolders = { SourceFolder2, SourceFolder };

        [MenuItem("InTheHole/Sync Game Art (Desktop PNG)")]
        public static void SyncFromDesktop()
        {
            if (!Directory.Exists(SourceFolder2) && !Directory.Exists(SourceFolder))
            {
                EditorUtility.DisplayDialog("Sync Game Art",
                    $"폴더가 없습니다:\n{SourceFolder2}\n또는\n{SourceFolder}",
                    "OK");
                return;
            }

            int n = CopyAll(silent: false);
            ArtImportPipeline.EnsureImported(syncDesktopFirst: false);
            EditorUtility.DisplayDialog("Sync Game Art",
                $"{n}개 PNG 복사 완료.\n\n소스 우선: game_asset2 → game_asset/png\n⚠ Generate Reference Art 는 덮어씁니다.",
                "OK");
        }

        public static int CopyAll(bool silent)
        {
            Directory.CreateDirectory(DstDir);
            int n = 0;

            foreach (var kv in Map)
            {
                if (!TryResolveSource(kv.Value, out var from))
                {
                    if (!silent)
                        Debug.LogWarning($"[SyncGameArt] Missing {kv.Key}");
                    continue;
                }

                var to = Path.Combine(DstDir, kv.Key);
                File.Copy(from, to, true);
                n++;
            }

            WriteGeneratedBallIfMissing();
            return n;
        }

        public static bool TryResolveSource(string[] candidates, out string path)
        {
            foreach (var folder in SourceFolders)
            {
                if (!Directory.Exists(folder)) continue;
                foreach (var name in candidates)
                {
                    var candidate = Path.Combine(folder, name);
                    if (File.Exists(candidate))
                    {
                        path = candidate;
                        return true;
                    }
                }
            }

            path = null;
            return false;
        }

        static void WriteGeneratedBallIfMissing()
        {
            var to = Path.Combine(DstDir, "ball.png");
            if (File.Exists(to) && new FileInfo(to).Length >= MinCustomBytes)
                return;

            if (TryResolveSource(new[] { "ball.png" }, out _))
                return;

            var projRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
            var script = Path.Combine(projRoot, "tools", "generate_reference_art.py");
            if (!File.Exists(script))
                return;

            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = $"-c \"from pathlib import Path; import importlib.util; " +
                                $"spec=importlib.util.spec_from_file_location('ga', r'{script.Replace("\\", "\\\\")}'); " +
                                $"ga=importlib.util.module_from_spec(spec); spec.loader.exec_module(ga); " +
                                $"w,h,p=ga.make_ball(256); ga.write_png(Path(r'{Path.GetFullPath(to).Replace("\\", "\\\\")}'), w, h, p)\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                System.Diagnostics.Process.Start(psi)?.WaitForExit(5000);
            }
            catch
            {
                // optional
            }
        }
    }
}
#endif
