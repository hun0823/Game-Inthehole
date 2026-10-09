using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
#endif

namespace InTheHole.Gameplay
{
    /// <summary>코드로 만든 Canvas UI 클릭 — EventSystem + Input System UI 모듈.</summary>
    public static class UiInputSetup
    {
        public static void Ensure()
        {
            var es = Object.FindFirstObjectByType<EventSystem>();
            if (es == null)
            {
                var go = new GameObject("EventSystem");
                es = go.AddComponent<EventSystem>();
            }

#if ENABLE_INPUT_SYSTEM
            if (es.GetComponent<InputSystemUIInputModule>() == null)
            {
                var legacy = es.GetComponent<StandaloneInputModule>();
                if (legacy != null)
                    Object.Destroy(legacy);
                es.gameObject.AddComponent<InputSystemUIInputModule>();
            }
#else
            if (es.GetComponent<StandaloneInputModule>() == null)
                es.gameObject.AddComponent<StandaloneInputModule>();
#endif
        }

        public static bool IsPointerOverUi()
        {
            if (EventSystem.current == null)
                return false;

#if ENABLE_INPUT_SYSTEM
            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.isPressed)
            {
                int id = Touchscreen.current.primaryTouch.touchId.ReadValue();
                return EventSystem.current.IsPointerOverGameObject(id);
            }
#endif
            return EventSystem.current.IsPointerOverGameObject();
        }
    }
}
