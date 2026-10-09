using UnityEngine;
using UnityEngine.Rendering;

namespace InTheHole.Gameplay
{
    public enum MaterialStyle
    {
        Matte,
        Ball,
        Hole,
        Rim,
        Glow,
    }

    public static class FlatMaterialFactory
    {
        static Material _softLit;
        static Material _ballLit;
        static Material _holeGlow;
        static Material _flatUnlit;
        static Material _builtinUnlit;

        public static void Apply(Renderer renderer, Color color, MaterialStyle style = MaterialStyle.Matte)
        {
            var mat = new Material(ResolveTemplate(style));
            ApplyColors(mat, color, style);
            renderer.sharedMaterial = mat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            renderer.lightProbeUsage = LightProbeUsage.Off;
            renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
        }

        public static void ApplyFlat(Renderer renderer, Color color) =>
            Apply(renderer, color, MaterialStyle.Matte);

        static bool UrpActive => GraphicsSettings.currentRenderPipeline != null;

        static Material ResolveTemplate(MaterialStyle style)
        {
            if (!UrpActive)
                return EnsureBuiltinUnlit();

            if (style == MaterialStyle.Ball)
            {
                var ball = EnsureBallLit();
                if (ball != null) return ball;
            }

            if (style == MaterialStyle.Glow)
            {
                var glow = EnsureHoleGlow();
                if (glow != null) return glow;
            }

            var soft = EnsureSoftLit();
            return soft != null ? soft : EnsureFlatUnlit();
        }

        static void ApplyColors(Material mat, Color color, MaterialStyle style)
        {
            if (mat.shader.name.Contains("BallLit"))
            {
                mat.SetColor("_Color", color);
                mat.SetColor("_ShadeColor", VisualPalette.BallEdge);
                mat.SetColor("_SpecularColor", VisualPalette.BallShine);
                return;
            }

            if (mat.shader.name.Contains("HoleGlow"))
            {
                mat.SetColor("_Color", color);
                mat.SetColor("_GlowColor", VisualPalette.HoleGlow);
                return;
            }

            Color shade = Color.Lerp(color * 0.55f, Color.black, 0.25f);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);
            if (mat.HasProperty("_ShadeColor"))
            {
                if (style == MaterialStyle.Hole)
                    mat.SetColor("_ShadeColor", VisualPalette.HoleDeep);
                else if (style == MaterialStyle.Rim)
                    mat.SetColor("_ShadeColor", Color.Lerp(color, Color.black, 0.35f));
                else
                    mat.SetColor("_ShadeColor", shade);
            }

            if (mat.HasProperty("_LightBoost"))
                mat.SetFloat("_LightBoost", style == MaterialStyle.Rim ? 0.7f : 0.55f);
            if (mat.HasProperty("_Rim"))
                mat.SetFloat("_Rim", style == MaterialStyle.Rim ? 0.22f : 0.1f);
        }

        static Material EnsureSoftLit()
        {
            if (_softLit != null) return _softLit;
            var shader = Shader.Find("InTheHole/SoftLit");
            if (shader != null && shader.isSupported)
            {
                _softLit = new Material(shader);
                return _softLit;
            }
            return null;
        }

        static Material EnsureBallLit()
        {
            if (_ballLit != null) return _ballLit;
            var shader = Shader.Find("InTheHole/BallLit");
            if (shader != null && shader.isSupported)
            {
                _ballLit = new Material(shader);
                return _ballLit;
            }
            return null;
        }

        static Material EnsureHoleGlow()
        {
            if (_holeGlow != null) return _holeGlow;
            var shader = Shader.Find("InTheHole/HoleGlow");
            if (shader != null && shader.isSupported)
            {
                _holeGlow = new Material(shader);
                return _holeGlow;
            }
            return null;
        }

        static Material EnsureFlatUnlit()
        {
            if (_flatUnlit != null) return _flatUnlit;
            var shader = Shader.Find("InTheHole/FlatUnlit");
            if (shader != null && shader.isSupported)
            {
                _flatUnlit = new Material(shader);
                return _flatUnlit;
            }
            return EnsureBuiltinUnlit();
        }

        static Material EnsureBuiltinUnlit()
        {
            if (_builtinUnlit != null) return _builtinUnlit;
            var shader = Shader.Find("Unlit/Color")
                ?? Shader.Find("Universal Render Pipeline/Unlit")
                ?? Shader.Find("Sprites/Default");
            _builtinUnlit = new Material(shader);
            return _builtinUnlit;
        }
    }
}
