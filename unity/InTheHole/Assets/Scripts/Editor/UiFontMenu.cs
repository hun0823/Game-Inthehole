#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace InTheHole.Editor
{
    public static class UiFontMenu
    {
        const string FontAssetPath = "Assets/Resources/Fonts/UiSans.ttf";

        [MenuItem("InTheHole/Show UI Font (UiSans)")]
        public static void ShowUiFont()
        {
            AssetDatabase.Refresh();
            var font = AssetDatabase.LoadAssetAtPath<Font>(FontAssetPath);
            if (font == null)
            {
                var full = Path.GetFullPath(FontAssetPath);
                var exists = File.Exists(full);
                EditorUtility.DisplayDialog("UI Font",
                    exists
                        ? $"파일은 있지만 Unity가 아직 인식하지 못했습니다.\n\nProject 창에서 Assets 우클릭 → Refresh (Ctrl+R)\n\n경로:\n{full}"
                        : $"폰트가 없습니다.\n터미널에서 실행:\npowershell tools/fetch_ui_font.ps1",
                    "OK");
                if (exists)
                    EditorUtility.RevealInFinder(full);
                return;
            }

            Selection.activeObject = font;
            EditorGUIUtility.PingObject(font);
            Debug.Log($"[InTheHole] UI font ready: {FontAssetPath}");
        }
    }
}
#endif
