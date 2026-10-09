using UnityEngine;

namespace InTheHole.Gameplay
{
    public sealed class SceneAtmosphere : MonoBehaviour
    {
        const int StarCount = 88;

        Transform _root;
        Transform[] _stars;
        float[] _phase;
        Camera _cam;

        public static void AttachToCamera(Camera cam)
        {
            if (cam == null) return;
            if (cam.GetComponentInChildren<SceneAtmosphere>() != null) return;

            var root = new GameObject("Stars").transform;
            root.SetParent(cam.transform, false);
            root.localPosition = new Vector3(0f, 0f, 8f);
            root.gameObject.AddComponent<SceneAtmosphere>().Build(cam, root);
        }

        void Build(Camera cam, Transform parent)
        {
            _cam = cam;
            _root = parent;
            _stars = new Transform[StarCount];
            _phase = new float[StarCount];
            var rng = new System.Random(77);

            for (int i = 0; i < StarCount; i++)
            {
                GameObject go;
                if (SpriteCatalog.EnsureReady() && SpriteCatalog.Star != null)
                {
                    go = new GameObject($"Star_{i}");
                    go.transform.SetParent(_root, false);
                    var sr = go.AddComponent<SpriteRenderer>();
                    sr.sprite = SpriteCatalog.Star;
                    sr.sortingOrder = -40;
                    sr.material = new Material(Shader.Find("Sprites/Default") ?? Shader.Find("Unlit/Transparent"));
                    sr.color = Color.Lerp(VisualPalette.StarTwinkleA, VisualPalette.StarTwinkleB, (float)rng.NextDouble());
                }
                else
                {
                    go = GameObject.CreatePrimitive(PrimitiveType.Quad);
                    go.name = $"Star_{i}";
                    Destroy(go.GetComponent<Collider>());
                    go.transform.SetParent(_root, false);
                    FlatMaterialFactory.Apply(go.GetComponent<Renderer>(), VisualPalette.UiText);
                }

                float aspect = _cam != null ? BackgroundFit.ViewportAspect(_cam) : PortraitLayout.TargetAspect;
                float spreadX = 11f * Mathf.Max(1f, aspect / PortraitLayout.TargetAspect);
                float x = (float)(rng.NextDouble() * 2.0 - 1.0) * spreadX;
                float y = (float)(rng.NextDouble() * 2.0 - 1.0) * 9f;
                go.transform.localPosition = new Vector3(x, y, 0f);
                float s = 0.03f + (float)rng.NextDouble() * 0.06f;
                go.transform.localScale = Vector3.one * s;
                _stars[i] = go.transform;
                _phase[i] = (float)rng.NextDouble() * Mathf.PI * 2f;
            }
        }

        void LateUpdate()
        {
            if (_cam == null || _stars == null) return;
            var forward = _cam.transform.forward;
            for (int i = 0; i < _stars.Length; i++)
            {
                var t = _stars[i];
                if (t == null) continue;
                t.rotation = Quaternion.LookRotation(forward, _cam.transform.up);
                float pulse = 0.6f + 0.4f * Mathf.Sin(Time.time * 2f + _phase[i]);
                float baseS = SpriteCatalog.Ready ? 0.08f : 0.05f;
                t.localScale = Vector3.one * (baseS * pulse);
            }
        }
    }
}
