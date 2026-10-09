using UnityEngine;
using UnityEngine.Rendering;
#if UNITY_RENDER_PIPELINE_UNIVERSAL
using UnityEngine.Rendering.Universal;
#endif

namespace InTheHole.Gameplay
{
    /// <summary>
    /// 빈 씬 Play → 2.5D 플랫 보드 자동 생성.
    /// </summary>
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoSetup()
        {
            CleanupIncompleteRuntime();
            SpriteCatalog.ResetCache();
            SpriteBoardBuilder.ResetStatics();

            var existing = Object.FindFirstObjectByType<GameSession>();
            if (existing != null && IsSessionReady(existing))
            {
                if (!GameVisualMode.MinimalLogicView)
                    SpriteCatalog.EnsureReady();
                return;
            }

            SetupScene();
        }

        static bool IsSessionReady(GameSession session) =>
            session != null
            && session.ball != null
            && session.hud != null
            && session.tableTilt != null
            && session.hintGuide != null
            && session.boardPivot != null;

        static void CleanupIncompleteRuntime()
        {
            var root = GameObject.Find("InTheHole_Root");
            if (root != null)
                Object.DestroyImmediate(root);

            var hud = GameObject.Find("GameHUD");
            if (hud != null)
                Object.DestroyImmediate(hud);
        }

        public static void SetupScene()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.42f, 0.38f, 0.52f);
            RenderSettings.fog = false;

            var cam = Camera.main;
            if (cam == null)
            {
                var camGo = new GameObject("Main Camera");
                cam = camGo.AddComponent<Camera>();
                camGo.tag = "MainCamera";
            }

            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = GameVisualMode.MinimalLogicView
                ? new Color(0.12f, 0.14f, 0.18f)
                : VisualPalette.Bg;
            cam.enabled = true;

#if UNITY_RENDER_PIPELINE_UNIVERSAL
            if (cam.GetComponent<UniversalAdditionalCameraData>() == null)
                cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
#endif

            if (GraphicsSettings.currentRenderPipeline == null)
                Debug.LogWarning("[InTheHole] URP not assigned. Editor will auto-fix via UrpAutoSetup, or use menu Edit > Project Settings > Graphics.");

            foreach (var light in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
            {
                if (light.type == LightType.Directional)
                    light.intensity = 0f;
            }

            var root = new GameObject("InTheHole_Root");
            var pivot = new GameObject("BoardPivot").transform;
            pivot.SetParent(root.transform, false);

            var tableTilt = pivot.gameObject.AddComponent<TableTiltPresenter>();
            var hintGuide = pivot.gameObject.AddComponent<HintGuidePresenter>();
            var glassEffects = pivot.gameObject.AddComponent<GlassWallEffects>();
            var boardGo = new GameObject("Board");
            boardGo.transform.SetParent(pivot, false);
            IBoardBuilder boardBuilder = GameVisualMode.MinimalLogicView
                ? boardGo.AddComponent<MinimalBoardBuilder>()
                : boardGo.AddComponent<SpriteBoardBuilder>();

            var ballGo = new GameObject("Ball");
            ballGo.transform.SetParent(pivot, false);
            var ballPresenter = ballGo.AddComponent<BallPresenter>();

            UiInputSetup.Ensure();

            var session = root.AddComponent<GameSession>();
            session.boardPivot = pivot;
            session.tableTilt = tableTilt;
            session.RegisterBoardBuilder(boardBuilder);
            session.ball = ballPresenter;
            session.hintGuide = hintGuide;
            session.glassEffects = glassEffects;
            session.hud = GameHud.Create();

            var input = root.AddComponent<GameInput>();
            input.session = session;

            if (!GameVisualMode.MinimalLogicView)
            {
                SpriteCatalog.EnsureReady();
                SceneBackdrop.Attach(cam);
            }

            Debug.Log(GameVisualMode.MinimalLogicView
                ? $"[{GameBranding.LogTag}] Logic view — drag/swipe or WASD | R | N"
                : $"[{GameBranding.LogTag}] {GameBranding.DisplayName} — drag/swipe or WASD | R | N");
        }
    }
}
