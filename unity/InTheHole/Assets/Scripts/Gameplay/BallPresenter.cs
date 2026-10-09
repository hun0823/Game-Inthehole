using System.Collections;
using System.Collections.Generic;
using InTheHole.Core;
using UnityEngine;

namespace InTheHole.Gameplay
{
    public sealed class BallPresenter : MonoBehaviour
    {
        public float stepDuration = 0.085f;
        public AnimationCurve stepEase = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        const int BallSpriteOrder = 30;
        const int BallShadowOrder = 4;
        static readonly Quaternion FloorRot = Quaternion.Euler(90f, 0f, 0f);

        bool _busy;
        bool _spriteMode;
        float _ballY;
        float _ballScale;
        Transform _shadow;
        SpriteRenderer _ballSprite;

        public bool IsBusy => _busy;

        void Awake()
        {
            _ballY = BoardVisualConstants.BallHeight;
            _ballScale = BoardVisualConstants.BallScale;
            BuildVisual();
        }

        void LateUpdate()
        {
            if (!_spriteMode || Camera.main == null) return;
            var cam = Camera.main.transform;
            transform.rotation = Quaternion.LookRotation(cam.forward, cam.up);
        }

        void BuildVisual()
        {
            if (GameVisualMode.MinimalLogicView)
            {
                BuildMinimalSphere();
                return;
            }

            HideMeshBall();
            DestroyChildSprites();

            if (TryBuildSpriteBall())
            {
                EnsureShadow();
                return;
            }

            BuildSphereBall();
            EnsureShadow();
        }

        bool TryBuildSpriteBall()
        {
            if (!SpriteCatalog.EnsureReady() || SpriteCatalog.Ball == null)
                return false;

            var tex = SpriteCatalog.Ball.texture;
            if (tex == null || tex.width < 200)
                return false;

            _spriteMode = true;
            var meshT = transform.Find("BallMesh");
            if (meshT != null)
                meshT.gameObject.SetActive(false);

            var sr = gameObject.GetComponent<SpriteRenderer>();
            if (sr == null)
                sr = gameObject.AddComponent<SpriteRenderer>();

            BoardSpriteUtil.Apply(sr, SpriteCatalog.Ball);
            sr.sortingOrder = BallSpriteOrder;
            _ballSprite = sr;
            ApplyBallDiameterScale();
            return true;
        }

        void BuildSphereBall()
        {
            _spriteMode = false;
            DestroyChildSprites();

            var sr = GetComponent<SpriteRenderer>();
            if (sr != null)
                Destroy(sr);

            var meshRenderer = GetComponent<MeshRenderer>();
            if (meshRenderer != null)
                meshRenderer.enabled = false;

            var meshT = transform.Find("BallMesh");
            if (meshT == null)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                go.name = "BallMesh";
                go.transform.SetParent(transform, false);
                Destroy(go.GetComponent<Collider>());
                meshT = go.transform;
            }

            meshT.gameObject.SetActive(true);
            FlatMaterialFactory.Apply(meshT.GetComponent<Renderer>(), VisualPalette.Ball, MaterialStyle.Ball);
            meshT.localScale = Vector3.one;
            transform.localRotation = Quaternion.identity;
            ApplyBallDiameterScale();
        }

        void HideMeshBall()
        {
            var meshT = transform.Find("BallMesh");
            if (meshT != null)
                meshT.gameObject.SetActive(false);
        }

        void DestroyChildSprites()
        {
            foreach (var r in GetComponentsInChildren<SpriteRenderer>())
            {
                if (r.gameObject != gameObject)
                    Destroy(r.gameObject);
            }
        }

        /// <summary>
        /// 3D 구: 지름 = BallDiameter.
        /// 스프라이트: bounds(PPU 100)를 먼저 BallDiameter에 맞춘 뒤 스케일 (1024px가 화면을 덮지 않도록).
        /// </summary>
        void ApplyBallDiameterScale()
        {
            transform.localScale = Vector3.one * (_spriteMode ? SpriteBallUniformScale() : BoardVisualConstants.BallDiameter);
        }

        float SpriteBallUniformScale()
        {
            var sp = SpriteCatalog.Ball;
            if (sp == null) return BoardVisualConstants.BallDiameter;
            var b = sp.bounds.size;
            return BoardVisualConstants.BallDiameter / Mathf.Max(b.x, b.y, 0.001f);
        }

        void BuildMinimalSphere()
        {
            _ballY = 0.14f;
            _spriteMode = false;
            BuildSphereBall();
        }

        void EnsureShadow()
        {
            if (_shadow != null || transform.parent == null) return;

            if (GameVisualMode.MinimalLogicView)
            {
                _shadow = CreateCylinderShadow(
                    new Vector3(_ballScale * 0.5f, 0.015f, _ballScale * 0.4f),
                    new Color(0f, 0f, 0f, 0.35f),
                    flat: true);
                return;
            }

            if (_spriteMode && SpriteCatalog.BallShadow != null)
            {
                _shadow = CreateSpriteShadow();
                if (_shadow != null) return;
            }

            _shadow = CreateCylinderShadow(
                new Vector3(BoardVisualConstants.BallDiameter * 0.72f, 0.012f, BoardVisualConstants.BallDiameter * 0.52f),
                new Color(0f, 0f, 0f, 0.38f),
                flat: false);
        }

        Transform CreateSpriteShadow()
        {
            var sp = SpriteCatalog.BallShadow;
            if (sp == null) return null;

            var go = new GameObject("BallShadow");
            go.transform.SetParent(transform.parent, false);
            go.transform.localRotation = FloorRot;
            go.transform.localPosition = ShadowLocalPos();
            go.transform.localScale = ShadowScale();

            var sr = go.AddComponent<SpriteRenderer>();
            BoardSpriteUtil.Apply(sr, sp, new Color(1f, 1f, 1f, 0.85f));
            sr.sortingOrder = BallShadowOrder;
            return go.transform;
        }

        Vector3 ShadowLocalPos()
        {
            var p = transform.localPosition;
            return new Vector3(p.x, 0.02f, p.z + 0.05f);
        }

        Vector3 ShadowScale()
        {
            float d = BoardVisualConstants.BallDiameter;
            var b = SpriteCatalog.BallShadow.bounds.size;
            float sx = d * 0.9f / Mathf.Max(b.x, 0.001f);
            float sy = d * 0.55f / Mathf.Max(b.y, 0.001f);
            return new Vector3(sx, sy, 1f);
        }

        Transform CreateCylinderShadow(Vector3 scale, Color color, bool flat)
        {
            var shadow = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shadow.name = "BallShadow";
            shadow.transform.SetParent(transform.parent, false);
            shadow.transform.localRotation = Quaternion.identity;
            shadow.transform.localScale = scale;
            Destroy(shadow.GetComponent<Collider>());
            if (flat)
                FlatMaterialFactory.ApplyFlat(shadow.GetComponent<Renderer>(), color);
            else
                FlatMaterialFactory.Apply(shadow.GetComponent<Renderer>(), color);
            return shadow.transform;
        }

        void SyncShadow()
        {
            EnsureShadow();
            if (_shadow == null) return;

            if (_spriteMode && SpriteCatalog.BallShadow != null)
            {
                _shadow.localPosition = ShadowLocalPos();
                _shadow.localScale = ShadowScale();
                return;
            }

            var p = transform.localPosition;
            _shadow.localPosition = new Vector3(p.x, 0.02f, p.z + 0.05f);
        }

        public void SnapTo(GridCoord coord)
        {
            ResetVisual();
            transform.localPosition = CellToLocal(coord);
            SyncShadow();
        }

        public void ResetVisual()
        {
            _busy = false;
            _ballScale = BoardVisualConstants.BallScale;
            ApplyBallDiameterScale();
            SyncShadow();
        }

        Vector3 CellToLocal(GridCoord coord)
        {
            var p = BoardLayout.CellCenter(coord.Row, coord.Col);
            return new Vector3(p.x, _ballY, p.z);
        }

        static Vector3 LeanOffset(TiltDirection dir)
        {
            const float lean = 0.05f;
            return dir switch
            {
                TiltDirection.Up => new Vector3(0f, 0f, -lean),
                TiltDirection.Down => new Vector3(0f, 0f, lean),
                TiltDirection.Left => new Vector3(-lean, 0f, 0f),
                TiltDirection.Right => new Vector3(lean, 0f, 0f),
                _ => Vector3.zero
            };
        }

        public IEnumerator AnimatePath(IReadOnlyList<GridCoord> path, TiltDirection dir)
        {
            if (path.Count < 2) yield break;

            _busy = true;
            var lean = LeanOffset(dir);

            for (int i = 1; i < path.Count; i++)
            {
                var from = transform.localPosition;
                var target = CellToLocal(path[i]) + lean;

                float t = 0f;
                while (t < 1f)
                {
                    t += Time.deltaTime / stepDuration;
                    transform.localPosition = Vector3.Lerp(from, target, stepEase.Evaluate(Mathf.Clamp01(t)));
                    if (!_spriteMode)
                        transform.Rotate(Vector3.right, 480f * Time.deltaTime, Space.Self);
                    SyncShadow();
                    yield return null;
                }

                transform.localPosition = target;
                SyncShadow();
            }

            transform.localPosition = CellToLocal(path[path.Count - 1]);
            SyncShadow();
            _busy = false;
        }

        public IEnumerator DropIntoHole()
        {
            _busy = true;
            var start = transform.localPosition;
            var end = start + Vector3.down * 0.35f;
            var startScale = transform.localScale;
            float t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime * 5f;
                float e = t * t;
                transform.localPosition = Vector3.Lerp(start, end, e);
                transform.localScale = Vector3.Lerp(startScale, startScale * 0.2f, e);
                if (_shadow != null)
                    _shadow.localScale = Vector3.Lerp(_shadow.localScale, Vector3.zero, e);
                yield return null;
            }
            _busy = false;
        }
    }
}
