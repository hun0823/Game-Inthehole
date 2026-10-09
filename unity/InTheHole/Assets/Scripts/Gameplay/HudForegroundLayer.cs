using UnityEngine;



namespace InTheHole.Gameplay

{

    /// <summary>배경 패널 위에 글자·버튼이 항상 그려지도록 전경 Canvas 레이어.</summary>

    public static class HudForegroundLayer

    {

        public static RectTransform Create(Transform parent, int sortingOrder = 100)

        {

            var go = new GameObject("HudForeground", typeof(RectTransform), typeof(Canvas));

            go.transform.SetParent(parent, false);

            go.transform.SetAsLastSibling();



            var canvas = go.GetComponent<Canvas>();

            canvas.overrideSorting = true;

            canvas.sortingOrder = sortingOrder;



            var rt = go.GetComponent<RectTransform>();

            rt.anchorMin = Vector2.zero;

            rt.anchorMax = Vector2.one;

            rt.offsetMin = Vector2.zero;

            rt.offsetMax = Vector2.zero;

            return rt;

        }

    }

}


