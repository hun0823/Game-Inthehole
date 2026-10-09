using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>카메라 뒤 그라데이션 배경 — 화면 전체 cover.</summary>
    public sealed class SceneBackdrop : MonoBehaviour
    {
        const float PitchDeg = 58f;
        const float HeightFactor = 1.22f;

        public static void Attach(Camera cam)
        {
            if (cam == null) return;
            if (Object.FindFirstObjectByType<SceneBackdrop>() != null) return;

            SpriteCatalog.EnsureReady();
            var sprite = SpriteCatalog.Bg;
            if (sprite == null) return;

            var go = new GameObject("Backdrop");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = -100;
            var shader = Shader.Find("Sprites/Default") ?? Shader.Find("Unlit/Transparent");
            sr.material = new Material(shader);

            var fit = go.AddComponent<SceneBackdrop>();
            fit._cam = cam;
            fit._sr = sr;
            SceneAtmosphere.AttachToCamera(cam);
        }

        Camera _cam;
        SpriteRenderer _sr;

        void LateUpdate()
        {
            if (_cam == null || _sr == null || _sr.sprite == null) return;

            var pos = _cam.transform.position + _cam.transform.forward * (_cam.farClipPlane * 0.45f);
            transform.position = pos;
            transform.rotation = _cam.transform.rotation;

            float vpAspect = BackgroundFit.ViewportAspect(_cam);
            float pitchCover = 1f / Mathf.Cos(PitchDeg * 0.5f * Mathf.Deg2Rad);
            float viewH = _cam.orthographicSize * 2f * HeightFactor * pitchCover;
            float viewW = viewH * vpAspect;
            transform.localScale = BackgroundFit.CoverScale(_sr.sprite, viewW, viewH);
        }
    }
}
