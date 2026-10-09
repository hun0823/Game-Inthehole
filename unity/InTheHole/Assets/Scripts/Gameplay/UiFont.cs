using UnityEngine;



namespace InTheHole.Gameplay

{

    /// <summary>UI 폰트 — Resources/Fonts/UiSans.ttf 우선 (tools/ui_font_guide.md).</summary>

    public static class UiFont

    {

        static Font _cached;



        public static Font Get()

        {

            if (_cached != null)

                return _cached;



            _cached = Resources.Load<Font>("Fonts/UiSans");

            if (_cached == null)

            {

                _cached = Font.CreateDynamicFontFromOSFont(

                    new[] { "Segoe UI Semibold", "Segoe UI", "Malgun Gothic Semibold", "Malgun Gothic", "Noto Sans KR Bold", "Noto Sans KR" },

                    64);

            }



            if (_cached == null)

                _cached = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            if (_cached == null)

                Debug.LogError("[UiFont] No UI font available.");

            return _cached;

        }

    }

}


