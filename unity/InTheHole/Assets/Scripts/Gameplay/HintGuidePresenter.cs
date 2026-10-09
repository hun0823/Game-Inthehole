using System.Collections.Generic;

using InTheHole.Core;

using InTheHole.Data;

using UnityEngine;

using UnityEngine.Rendering;



namespace InTheHole.Gameplay

{

    /// <summary>힌트: 바닥 점선 경로 (보드 피벗 로컬 좌표).</summary>

    public sealed class HintGuidePresenter : MonoBehaviour

    {

        static readonly Color DotColor = new(1f, 0.85f, 0.1f, 1f);

        const float DotSpacing = 0.12f;

        const float DotRadius = 0.09f;

        const float FloorY = 0.22f;

        const int HintRenderQueue = 3500;



        Transform _pathRoot;



        public bool IsVisible => _pathRoot != null;



        public void Show(LevelDefinition level, IReadOnlyList<TiltDirection> solution, Transform boardPivot, GameSimulation simAtShow)

        {

            Clear();

            if (level == null || solution == null || solution.Count == 0 || boardPivot == null)

                return;



            var waypoints = BuildWaypoints(level, solution, simAtShow);

            if (waypoints.Count < 2)

            {

                Debug.LogWarning($"[HintGuide] Path too short ({waypoints.Count} pts) stage={level.Id}");

                return;

            }



            _pathRoot = new GameObject("HintDottedPath").transform;

            _pathRoot.SetParent(boardPivot, false);

            _pathRoot.localPosition = Vector3.zero;

            _pathRoot.localRotation = Quaternion.identity;

            BuildDottedPath(waypoints);

        }



        public void Clear()

        {

            if (_pathRoot != null)

                Destroy(_pathRoot.gameObject);

            _pathRoot = null;

        }



        static List<Vector3> BuildWaypoints(LevelDefinition level, IReadOnlyList<TiltDirection> solution, GameSimulation simAtShow)

        {

            int n = level.Size;

            var points = new List<Vector3>();

            var last = (-1, -1);



            void AddCell(int row, int col)

            {

                if (last == (row, col))

                    return;

                var c = BoardLayout.CellCenter(row, col, n);

                points.Add(new Vector3(c.x, FloorY, c.z));

                last = (row, col);

            }



            var replay = simAtShow != null ? CloneForReplay(simAtShow) : CreateFreshSim(level);

            AddCell(replay.Ball.Row, replay.Ball.Col);



            foreach (var dir in solution)

            {

                var result = replay.SimulateTilt(dir);

                replay.ApplyTiltResult(result);

                if (!result.Moved)

                    continue;

                for (int i = 1; i < result.Path.Count; i++)

                {

                    var cell = result.Path[i];

                    AddCell(cell.Row, cell.Col);

                }

            }



            return points;

        }



        static GameSimulation CreateFreshSim(LevelDefinition level)

        {

            var sim = new GameSimulation();

            sim.LoadFromLevel(level);

            return sim;

        }



        static GameSimulation CloneForReplay(GameSimulation src)

        {

            var copy = new GameSimulation();

            copy.Load(src.HWalls, src.VWalls, src.Ball, src.Hole, src.HGlass, src.VGlass,
                src.HColored, src.VColored, src.Buttons);

            copy.CopyGlassStateFrom(src);

            copy.CopyColoredStateFrom(src);

            copy.ImportStateFrom(src);

            return copy;

        }



        void BuildDottedPath(List<Vector3> waypoints)

        {

            int dashIndex = 0;

            for (int i = 0; i < waypoints.Count - 1; i++)

            {

                var a = waypoints[i];

                var b = waypoints[i + 1];

                float segLen = Vector3.Distance(

                    new Vector3(a.x, 0f, a.z),

                    new Vector3(b.x, 0f, b.z));



                float d = 0f;

                while (d <= segLen + 0.001f)

                {

                    if (dashIndex % 2 == 0)

                    {

                        float t = segLen > 0.001f ? d / segLen : 0f;

                        CreateDot(Vector3.Lerp(a, b, t));

                    }

                    d += DotSpacing;

                    dashIndex++;

                }

            }

        }



        void CreateDot(Vector3 localPos)

        {

            var dot = GameObject.CreatePrimitive(PrimitiveType.Sphere);

            dot.name = "HintDot";

            dot.transform.SetParent(_pathRoot, false);

            dot.transform.localPosition = localPos;

            dot.transform.localScale = Vector3.one * DotRadius * 2f;

            Destroy(dot.GetComponent<Collider>());



            var rend = dot.GetComponent<Renderer>();

            ApplyHintMaterial(rend);

            rend.shadowCastingMode = ShadowCastingMode.Off;

            rend.receiveShadows = false;

        }



        static void ApplyHintMaterial(Renderer renderer)

        {

            var shader = Shader.Find("Unlit/Color")

                ?? Shader.Find("Universal Render Pipeline/Unlit")

                ?? Shader.Find("Sprites/Default");

            var mat = new Material(shader);

            if (mat.HasProperty("_BaseColor"))

                mat.SetColor("_BaseColor", DotColor);

            else if (mat.HasProperty("_Color"))

                mat.SetColor("_Color", DotColor);

            mat.renderQueue = HintRenderQueue;

            renderer.sharedMaterial = mat;

        }



        void OnDestroy() => Clear();

    }

}


