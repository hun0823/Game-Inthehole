using System.Collections;

using System.Collections.Generic;

using InTheHole.Core;

using UnityEngine;

using UnityEngine.Rendering;



namespace InTheHole.Gameplay

{

    /// <summary>유리 균열·파괴 연출 — 보드/피벗 좌표 기준, 스프라이트·3D 공통.</summary>

    public sealed class GlassWallEffects : MonoBehaviour

    {

        static readonly Color ShardColor = new(0.75f, 0.92f, 1f, 0.95f);

        static readonly Color FlashColor = new(1f, 0.95f, 0.7f, 1f);

        static readonly Color CrackColor = new(1f, 0.45f, 0.2f, 1f);

        const int FxRenderQueue = 3600;



        Transform _boardRoot;

        Transform _pivot;

        int _gridSize;

        readonly Dictionary<string, Transform> _glassLookup = new();

        readonly Dictionary<string, GameObject> _crackOverlays = new();



        public void SetBoard(Transform boardRoot, Transform boardPivot, int gridSize)

        {

            _boardRoot = boardRoot;

            _pivot = boardPivot != null ? boardPivot : boardRoot;

            _gridSize = gridSize;

            RebuildGlassLookup();

            ClearAllCrackOverlays();

        }



        void RebuildGlassLookup()

        {

            _glassLookup.Clear();

            if (_boardRoot == null) return;

            foreach (Transform t in _boardRoot.GetComponentsInChildren<Transform>(true))

            {

                if (t == _boardRoot) continue;

                var n = t.name;

                if (n.StartsWith("GH_") || n.StartsWith("GV_"))

                    _glassLookup[n] = t;

            }

        }



        public void PlayStressed(IReadOnlyList<GlassEdge> edges)

        {

            if (edges == null || _pivot == null) return;

            foreach (var e in edges)

                StartCoroutine(StressRoutine(e));

        }



        public void PlayBroken(IReadOnlyList<GlassEdge> edges)

        {

            if (edges == null || _pivot == null) return;

            foreach (var e in edges)

                StartCoroutine(BreakRoutine(e));

        }



        IEnumerator StressRoutine(GlassEdge edge)

        {

            var key = GlassKey(edge);

            var go = GetGlass(key);

            var worldPos = EdgeWorldPosition(edge);



            if (go != null)

            {

                TintGlassCracked(go);

                yield return PulseTransform(go.transform, 1.22f, 0.14f);

            }

            else

                yield return null;



            SpawnStressBurst(worldPos);

            AttachCrackOverlay(key, edge, worldPos);

        }



        IEnumerator BreakRoutine(GlassEdge edge)

        {

            var key = GlassKey(edge);

            var worldPos = EdgeWorldPosition(edge);

            var go = GetGlass(key);



            if (go != null)

                worldPos = go.position;



            RemoveCrackOverlay(key);

            if (go != null)

                go.gameObject.SetActive(false);

            else

                _glassLookup.Remove(key);



            SpawnFlash(worldPos, 0.42f);

            yield return SpawnShards(worldPos, edge.IsHorizontal);

        }



        void TintGlassCracked(Transform glass)

        {

            var sr = glass.GetComponent<SpriteRenderer>();

            if (sr != null)

            {

                sr.color = CrackColor;

                return;

            }



            var rend = glass.GetComponent<Renderer>();

            if (rend != null)

                ApplyFxMaterial(rend, CrackColor);

        }



        void AttachCrackOverlay(string key, GlassEdge edge, Vector3 worldPos)

        {

            RemoveCrackOverlay(key);



            var root = new GameObject($"Crack_{key}");

            root.transform.SetParent(_pivot, true);

            root.transform.position = worldPos + Vector3.up * 0.13f;

            if (edge.IsHorizontal)

                root.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);

            else

                root.transform.localRotation = Quaternion.Euler(90f, 0f, 90f);



            float len = BoardLayout.CellSize * 0.75f;

            for (int i = -1; i <= 1; i++)

            {

                var chip = GameObject.CreatePrimitive(PrimitiveType.Cube);

                chip.transform.SetParent(root.transform, false);

                chip.transform.localPosition = new Vector3(i * 0.14f, 0f, 0f);

                chip.transform.localScale = new Vector3(0.1f, 0.02f, len);

                Destroy(chip.GetComponent<Collider>());

                ApplyFxMaterial(chip.GetComponent<Renderer>(), CrackColor);

            }



            _crackOverlays[key] = root;

        }



        void RemoveCrackOverlay(string key)

        {

            if (_crackOverlays.TryGetValue(key, out var root) && root != null)

                Destroy(root);

            _crackOverlays.Remove(key);

        }



        void ClearAllCrackOverlays()

        {

            foreach (var kv in _crackOverlays)

            {

                if (kv.Value != null)

                    Destroy(kv.Value);

            }

            _crackOverlays.Clear();

        }



        void SpawnStressBurst(Vector3 worldPos)

        {

            SpawnFlash(worldPos, 0.28f);

            for (int i = 0; i < 4; i++)

            {

                var spark = GameObject.CreatePrimitive(PrimitiveType.Cube);

                spark.transform.SetParent(_pivot, true);

                spark.transform.position = worldPos + Vector3.up * 0.12f;

                spark.transform.localScale = new Vector3(0.06f, 0.04f, 0.06f);

                spark.transform.rotation = Random.rotation;

                Destroy(spark.GetComponent<Collider>());

                ApplyFxMaterial(spark.GetComponent<Renderer>(), CrackColor);

                Destroy(spark, 0.25f);

            }

        }



        void SpawnFlash(Vector3 worldPos, float scale)

        {

            var flash = GameObject.CreatePrimitive(PrimitiveType.Sphere);

            flash.name = "GlassFlash";

            flash.transform.SetParent(_pivot, true);

            flash.transform.position = worldPos + Vector3.up * 0.1f;

            flash.transform.localScale = Vector3.one * scale;

            Destroy(flash.GetComponent<Collider>());

            ApplyFxMaterial(flash.GetComponent<Renderer>(), FlashColor);

            Destroy(flash, 0.15f);

        }



        IEnumerator SpawnShards(Vector3 worldPos, bool isHorizontal)

        {

            int count = 9;

            var pieces = new List<Transform>(count);

            for (int i = 0; i < count; i++)

            {

                var shard = GameObject.CreatePrimitive(PrimitiveType.Cube);

                shard.name = "GlassShard";

                shard.transform.SetParent(_pivot, true);

                shard.transform.position = worldPos + Vector3.up * 0.08f;

                float sx = isHorizontal ? Random.Range(0.05f, 0.12f) : Random.Range(0.04f, 0.08f);

                float sz = isHorizontal ? Random.Range(0.04f, 0.08f) : Random.Range(0.05f, 0.12f);

                shard.transform.localScale = new Vector3(sx, 0.025f, sz);

                shard.transform.rotation = Random.rotation;

                Destroy(shard.GetComponent<Collider>());

                ApplyFxMaterial(shard.GetComponent<Renderer>(), ShardColor);

                pieces.Add(shard.transform);

            }



            var velocities = new Vector3[count];

            for (int i = 0; i < count; i++)

            {

                var dir = Random.insideUnitSphere;

                dir.y = Mathf.Abs(dir.y) * 0.5f + 0.5f;

                velocities[i] = dir.normalized * Random.Range(2f, 4f);

            }



            float burst = 0.4f;

            float t = 0f;

            while (t < burst)

            {

                t += Time.deltaTime;

                for (int i = 0; i < count; i++)

                {

                    if (pieces[i] == null) continue;

                    pieces[i].position += velocities[i] * Time.deltaTime;

                    velocities[i] += Physics.gravity * 0.4f * Time.deltaTime;

                }

                yield return null;

            }



            for (int i = 0; i < count; i++)

            {

                if (pieces[i] != null)

                    Destroy(pieces[i].gameObject);

            }

        }



        static IEnumerator PulseTransform(Transform t, float peakScale, float duration)

        {

            var t0 = t.localScale;

            var t1 = t0 * peakScale;

            float half = duration * 0.5f;

            for (float u = 0f; u < half; u += Time.deltaTime)

            {

                t.localScale = Vector3.Lerp(t0, t1, u / half);

                yield return null;

            }

            for (float u = 0f; u < half; u += Time.deltaTime)

            {

                t.localScale = Vector3.Lerp(t1, t0, u / half);

                yield return null;

            }

            t.localScale = t0;

        }



        Transform GetGlass(string key)

        {

            if (_glassLookup.TryGetValue(key, out var t) && t != null)

                return t;

            RebuildGlassLookup();

            _glassLookup.TryGetValue(key, out t);

            return t;

        }



        static string GlassKey(GlassEdge edge) =>

            edge.IsHorizontal ? $"GH_{edge.Row}_{edge.Col}" : $"GV_{edge.Row}_{edge.Col}";



        Vector3 EdgeWorldPosition(GlassEdge edge)

        {

            var local = edge.IsHorizontal

                ? BoardLayout.WallHCenter(edge.Row, edge.Col, _gridSize)

                : BoardLayout.WallVCenter(edge.Row, edge.Col, _gridSize);

            local.y = 0.12f;

            return _pivot.TransformPoint(local);

        }



        static void ApplyFxMaterial(Renderer renderer, Color color)

        {

            var shader = Shader.Find("Unlit/Color")

                ?? Shader.Find("Universal Render Pipeline/Unlit")

                ?? Shader.Find("Sprites/Default");

            var mat = new Material(shader);

            if (mat.HasProperty("_BaseColor"))

                mat.SetColor("_BaseColor", color);

            else if (mat.HasProperty("_Color"))

                mat.SetColor("_Color", color);

            mat.renderQueue = FxRenderQueue;

            renderer.sharedMaterial = mat;

            renderer.shadowCastingMode = ShadowCastingMode.Off;

            renderer.receiveShadows = false;

        }

    }

}


