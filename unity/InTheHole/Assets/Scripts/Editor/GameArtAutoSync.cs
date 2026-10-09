#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;
using InTheHole.Gameplay;

namespace InTheHole.Editor
{
    /// <summary>Play 시작·재시작 시 PNG 동기화 + 필요할 때만 임포트.</summary>
    public static class GameArtAutoSync
    {
        const long MinCustomBytes = 80_000;

        [InitializeOnLoadMethod]
        static void Register()
        {
            EditorApplication.delayCall += OnEditorReady;
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
        }

        [InitializeOnEnterPlayMode]
        static void OnEnterPlayMode()
        {
            SpriteCatalog.ResetCache();
            SpriteBoardBuilder.ResetStatics();
        }

        static void OnEditorReady()
        {
            ArtImportPipeline.EnsureImportedIfNeeded(syncDesktopFirst: true);
        }

        static void OnPlayModeChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.ExitingEditMode)
                ArtImportPipeline.EnsureImportedIfNeeded(syncDesktopFirst: true);
        }

        public static bool TrySyncIfNeeded(bool silent = true)
        {
            if (!NeedsSync())
                return false;

            if (!Directory.Exists(SyncGameArtMenu.SourceFolder2) &&
                !Directory.Exists(SyncGameArtMenu.SourceFolder))
            {
                if (!silent)
                    Debug.LogWarning("[GameArtAutoSync] Desktop art folders missing (game_asset2 / game_asset/png).");
                return false;
            }

            int n = SyncGameArtMenu.CopyAll(silent);
            if (n > 0)
                Debug.Log($"[GameArtAutoSync] Copied {n} PNG(s) from desktop.");
            return n > 0;
        }

        public static bool NeedsSync()
        {
            foreach (var kv in SyncGameArtMenu.FileMap)
            {
                var to = ArtPath(kv.Key);
                if (!File.Exists(to))
                    return true;

                var len = new FileInfo(to).Length;
                if (len < 512)
                    return true;

                if (kv.Key == "wood_a.png" && len < MinCustomBytes)
                    return true;

                if (!SyncGameArtMenu.TryResolveSource(kv.Value, out var from))
                    continue;

                if (File.GetLastWriteTimeUtc(from) > File.GetLastWriteTimeUtc(to))
                    return true;
            }

            return false;
        }

        static string ArtPath(string fileName) =>
            Path.Combine(Application.dataPath, "Resources", "Art", fileName);
    }
}
#endif
