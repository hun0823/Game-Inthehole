using UnityEngine;

using UnityEngine.UI;



namespace InTheHole.Gameplay

{

    /// <summary>모바일 세로(9:16) 기준 화면 — 넓은 에디터 뷰에서는 좌우 레터박스.</summary>

    public static class PortraitLayout

    {

        public const float TargetAspect = 9f / 16f;

        /// <summary>HUD 레이아웃 힌트 (카메라 rect에는 사용하지 않음 — 배경 단일화).</summary>
        public const float TopBand = 0.10f;

        /// <summary>하단 조작 버튼 여유.</summary>
        public const float BottomBand = 0.14f;



        public static Rect GetPortraitSafeRect()

        {

            float screenAspect = Screen.height > 0 ? (float)Screen.width / Screen.height : TargetAspect;

            if (screenAspect >= TargetAspect)

            {

                float w = TargetAspect / screenAspect;

                return new Rect((1f - w) * 0.5f, 0f, w, 1f);

            }



            float h = screenAspect / TargetAspect;

            return new Rect(0f, (1f - h) * 0.5f, 1f, h);

        }



        /// <summary>레거시 — 카메라는 전체 SafeRect 사용 (HUD는 투명 오버레이).</summary>
        public static Rect GetGameViewportRect() => GetPortraitSafeRect();

    }



    /// <summary>HUD를 세로 안전 영역에 맞추고 좌우 레터박스를 채움.</summary>

    public sealed class PortraitFrameDriver : MonoBehaviour

    {

        RectTransform _safeRoot;

        RectTransform _leftBar;

        RectTransform _rightBar;

        RectTransform _topBar;

        RectTransform _bottomBar;



        public RectTransform SafeRoot => _safeRoot;



        public static PortraitFrameDriver Attach(Transform canvasRoot)

        {

            var driver = canvasRoot.GetComponent<PortraitFrameDriver>();

            if (driver != null)

                return driver;

            return canvasRoot.gameObject.AddComponent<PortraitFrameDriver>();

        }



        void Awake() => Build();



        void OnRectTransformDimensionsChange() => Apply();



        void Update()

        {

            if (Screen.width != _lastW || Screen.height != _lastH)

                Apply();

        }



        int _lastW;

        int _lastH;



        void Build()

        {

            var canvasRt = transform as RectTransform;

            if (canvasRt == null)

                return;



            _leftBar = CreateBar("LetterboxLeft", canvasRt);

            _rightBar = CreateBar("LetterboxRight", canvasRt);

            _topBar = CreateBar("LetterboxTop", canvasRt);

            _bottomBar = CreateBar("LetterboxBottom", canvasRt);



            var safeGo = new GameObject("PortraitSafe", typeof(RectTransform));

            safeGo.transform.SetParent(canvasRt, false);

            _safeRoot = safeGo.GetComponent<RectTransform>();

            Apply();

        }



        void Apply()

        {

            if (_safeRoot == null)

                return;



            _lastW = Screen.width;

            _lastH = Screen.height;



            var safe = PortraitLayout.GetPortraitSafeRect();

            Stretch(_safeRoot, safe.x, safe.y, safe.x + safe.width, safe.y + safe.height);



            Stretch(_leftBar, 0f, 0f, safe.x, 1f);

            Stretch(_rightBar, safe.x + safe.width, 0f, 1f, 1f);

            Stretch(_topBar, safe.x, safe.y + safe.height, safe.x + safe.width, 1f);

            Stretch(_bottomBar, safe.x, 0f, safe.x + safe.width, safe.y);

        }



        static RectTransform CreateBar(string name, RectTransform parent)

        {

            var go = new GameObject(name, typeof(RectTransform), typeof(Image));

            go.transform.SetParent(parent, false);

            go.transform.SetAsFirstSibling();

            var img = go.GetComponent<Image>();

            img.color = Color.clear;

            img.raycastTarget = false;

            return go.GetComponent<RectTransform>();

        }



        static void Stretch(RectTransform rt, float minX, float minY, float maxX, float maxY)

        {

            rt.anchorMin = new Vector2(minX, minY);

            rt.anchorMax = new Vector2(maxX, maxY);

            rt.offsetMin = Vector2.zero;

            rt.offsetMax = Vector2.zero;

        }

    }

}


