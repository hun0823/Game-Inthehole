using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>배경 스프라이트를 뷰포트에 맞게 비율 유지(cover) 스케일.</summary>
    public static class BackgroundFit
    {
        public static Vector3 CoverScale(Sprite sprite, float viewWidth, float viewHeight)
        {
            if (sprite == null)
                return Vector3.one;

            var size = sprite.bounds.size;
            if (size.x < 0.001f || size.y < 0.001f)
                return Vector3.one;

            float spriteAspect = size.x / size.y;
            float viewAspect = viewWidth / Mathf.Max(viewHeight, 0.001f);
            float uniform = viewAspect > spriteAspect
                ? viewWidth / size.x
                : viewHeight / size.y;

            return new Vector3(uniform, uniform, 1f);
        }

        public static float ViewportAspect(Camera cam)
        {
            if (cam == null)
                return PortraitLayout.TargetAspect;

            if (cam.pixelWidth > 0 && cam.pixelHeight > 0)
                return cam.pixelWidth / (float)cam.pixelHeight;

            float aspect = cam.aspect > 0.01f ? cam.aspect : PortraitLayout.TargetAspect;
            if (cam.rect.width > 0.01f && cam.rect.height > 0.01f)
                aspect *= cam.rect.width / cam.rect.height;
            return aspect;
        }
    }
}
