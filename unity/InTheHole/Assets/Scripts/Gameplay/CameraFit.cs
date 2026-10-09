using UnityEngine;

namespace InTheHole.Gameplay
{
    public static class CameraFit
    {
        const float PitchDeg = 58f;
        const float Padding = 0.22f;
        const float MinOrtho = 1.2f;
        const float MaxOrtho = 9f;
        const float CameraDistance = 11f;
        /// <summary>보드를 화면 중앙~하단에 (reference2).</summary>
        const float VerticalBoardBias = 0.32f;

        public static void FitOrthographic(int gridSize, bool topDown = false, bool reserveUiBands = false)
        {
            var cam = Camera.main;
            if (cam == null) return;

            cam.orthographic = true;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 50f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = VisualPalette.Bg;
            cam.enabled = true;
            cam.rect = new Rect(0f, 0f, 1f, 1f);

            if (topDown)
            {
                cam.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
                cam.transform.position = new Vector3(0f, 14f, 0f);
            }
            else
            {
                cam.transform.rotation = Quaternion.Euler(PitchDeg, 0f, 0f);
                cam.transform.position = new Vector3(
                    0f,
                    Mathf.Sin(PitchDeg * Mathf.Deg2Rad) * CameraDistance + VerticalBoardBias,
                    -Mathf.Cos(PitchDeg * Mathf.Deg2Rad) * CameraDistance);
            }

            float half = BoardLayout.ViewHalfExtent(gridSize, BoardVisualConstants.BoardPad);
            var corners = new[]
            {
                new Vector3(-half, 0f, -half),
                new Vector3(half, 0f, -half),
                new Vector3(-half, 0f, half),
                new Vector3(half, 0f, half),
            };

            float maxY = 0f;
            float maxX = 0f;
            foreach (var corner in corners)
            {
                var local = cam.transform.InverseTransformPoint(corner);
                maxY = Mathf.Max(maxY, Mathf.Abs(local.y));
                maxX = Mathf.Max(maxX, Mathf.Abs(local.x));
            }

            float frameAspect = PortraitLayout.TargetAspect;
            float vpAspect = BackgroundFit.ViewportAspect(cam);
            bool portraitPhone = vpAspect < 0.62f;

            float widthFit = maxX / frameAspect + Padding;
            float heightFit = maxY + Padding + CompositionHeadroom(vpAspect, portraitPhone);

            float margin = GridMargin(gridSize, portraitPhone);
            float size = Mathf.Max(widthFit, heightFit) * margin;

            cam.orthographicSize = Mathf.Clamp(size, MinOrtho, MaxOrtho);
        }

        /// <summary>상·하 HUD/버튼 여유 (1080×1920 1x 기준).</summary>
        static float CompositionHeadroom(float vpAspect, bool portraitPhone)
        {
            if (portraitPhone)
                return 0.34f + PortraitLayout.BottomBand * 0.35f;
            float wide = Mathf.Max(0f, vpAspect / PortraitLayout.TargetAspect - 1f);
            return 0.12f + wide * 0.10f;
        }

        static float GridMargin(int gridSize, bool portraitPhone)
        {
            float baseMargin = gridSize switch
            {
                <= 2 => 1.32f,
                <= 3 => 1.26f,
                <= 4 => 1.20f,
                <= 5 => 1.14f,
                <= 6 => 1.10f,
                _ => 1.08f,
            };
            return portraitPhone ? baseMargin : baseMargin * 1.04f;
        }
    }
}
