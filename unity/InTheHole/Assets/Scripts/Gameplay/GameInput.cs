using InTheHole.Core;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace InTheHole.Gameplay
{
    /// <summary>
    /// 키보드 + 마우스/터치 스윕(폰처럼 드래그해서 기울이기).
    /// 화면: 위 스윕/↑ = 공이 화면 위로, 아래 스윕/↓ = 화면 아래로 (row0=위, Z↓).
    /// </summary>
    public sealed class GameInput : MonoBehaviour
    {
        public GameSession session;

        [Header("Swipe")]
        public float minSwipePixels = 50f;

        Vector2? _pointerStart;
        bool _swipeLocked;

        void Update()
        {
            if (session == null) return;

            if (HandleSwipeGesture())
                return;

            if (WasPressedHint())
                session.ToggleHint();
            else if (WasPressedUp()) session.TryTilt(TiltDirection.Down);
            else if (WasPressedDown()) session.TryTilt(TiltDirection.Up);
            else if (WasPressedLeft()) session.TryTilt(TiltDirection.Left);
            else if (WasPressedRight()) session.TryTilt(TiltDirection.Right);
            else if (WasPressedReset()) session.ResetStage();
            else if (WasPressedNext()) session.NextStage();
        }

        bool HandleSwipeGesture()
        {
            if (TryPointerDown(out var downPos))
            {
                if (!UiInputSetup.IsPointerOverUi())
                {
                    _pointerStart = downPos;
                    _swipeLocked = false;
                }
            }

            if (_pointerStart.HasValue && TryPointerUp(out var upPos))
            {
                var delta = upPos - _pointerStart.Value;
                _pointerStart = null;

                if (!_swipeLocked && delta.magnitude >= minSwipePixels)
                {
                    session.TryTilt(ScreenDeltaToTilt(delta));
                    return true;
                }
            }

            if (_pointerStart.HasValue && !_swipeLocked && TryPointerPosition(out var pos))
            {
                var delta = pos - _pointerStart.Value;
                if (delta.magnitude >= minSwipePixels)
                {
                    session.TryTilt(ScreenDeltaToTilt(delta));
                    _swipeLocked = true;
                    return true;
                }
            }

            return false;
        }

        static TiltDirection ScreenDeltaToTilt(Vector2 delta)
        {
            if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y))
                return delta.x > 0f ? TiltDirection.Right : TiltDirection.Left;
            return delta.y > 0f ? TiltDirection.Down : TiltDirection.Up;
        }

        static bool TryPointerDown(out Vector2 pos)
        {
#if ENABLE_INPUT_SYSTEM
            if (Touchscreen.current != null)
            {
                var t = Touchscreen.current.primaryTouch;
                if (t.press.wasPressedThisFrame)
                {
                    pos = t.position.ReadValue();
                    return true;
                }
            }
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
            {
                pos = Mouse.current.position.ReadValue();
                return true;
            }
#else
            if (Input.GetMouseButtonDown(0))
            {
                pos = Input.mousePosition;
                return true;
            }
            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)
            {
                pos = Input.GetTouch(0).position;
                return true;
            }
#endif
            pos = default;
            return false;
        }

        static bool TryPointerUp(out Vector2 pos)
        {
#if ENABLE_INPUT_SYSTEM
            if (Touchscreen.current != null)
            {
                var t = Touchscreen.current.primaryTouch;
                if (t.press.wasReleasedThisFrame)
                {
                    pos = t.position.ReadValue();
                    return true;
                }
            }
            if (Mouse.current != null && Mouse.current.leftButton.wasReleasedThisFrame)
            {
                pos = Mouse.current.position.ReadValue();
                return true;
            }
#else
            if (Input.GetMouseButtonUp(0))
            {
                pos = Input.mousePosition;
                return true;
            }
            if (Input.touchCount > 0)
            {
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                {
                    pos = touch.position;
                    return true;
                }
            }
#endif
            pos = default;
            return false;
        }

        static bool TryPointerPosition(out Vector2 pos)
        {
#if ENABLE_INPUT_SYSTEM
            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.isPressed)
            {
                pos = Touchscreen.current.primaryTouch.position.ReadValue();
                return true;
            }
            if (Mouse.current != null && Mouse.current.leftButton.isPressed)
            {
                pos = Mouse.current.position.ReadValue();
                return true;
            }
#else
            if (Input.GetMouseButton(0))
            {
                pos = Input.mousePosition;
                return true;
            }
            if (Input.touchCount > 0)
            {
                pos = Input.GetTouch(0).position;
                return true;
            }
#endif
            pos = default;
            return false;
        }

        static bool WasPressedUp()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null &&
                   (Keyboard.current.wKey.wasPressedThisFrame || Keyboard.current.upArrowKey.wasPressedThisFrame);
#else
            return Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W);
#endif
        }

        static bool WasPressedDown()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null &&
                   (Keyboard.current.sKey.wasPressedThisFrame || Keyboard.current.downArrowKey.wasPressedThisFrame);
#else
            return Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S);
#endif
        }

        static bool WasPressedLeft()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null &&
                   (Keyboard.current.aKey.wasPressedThisFrame || Keyboard.current.leftArrowKey.wasPressedThisFrame);
#else
            return Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A);
#endif
        }

        static bool WasPressedRight()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null &&
                   (Keyboard.current.dKey.wasPressedThisFrame || Keyboard.current.rightArrowKey.wasPressedThisFrame);
#else
            return Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D);
#endif
        }

        static bool WasPressedHint()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null && Keyboard.current.hKey.wasPressedThisFrame;
#else
            return Input.GetKeyDown(KeyCode.H);
#endif
        }

        static bool WasPressedReset()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null && Keyboard.current.rKey.wasPressedThisFrame;
#else
            return Input.GetKeyDown(KeyCode.R);
#endif
        }

        static bool WasPressedNext()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null && Keyboard.current.nKey.wasPressedThisFrame;
#else
            return Input.GetKeyDown(KeyCode.N);
#endif
        }
    }
}
