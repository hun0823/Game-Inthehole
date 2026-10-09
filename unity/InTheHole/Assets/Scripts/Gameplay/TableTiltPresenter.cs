using InTheHole.Core;
using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>
    /// 2.5D + 가벼운 3D 기울임 — 공이 굴러가는 방향으로 판이 기울어짐.
    /// 카메라: 위에서 직교 (row0 = 화면 위쪽, Z 감소).
    /// </summary>
    public sealed class TableTiltPresenter : MonoBehaviour
    {
        public float tiltAngle = 28f;
        public float shiftAmount = 0.22f;
        public float smooth = 14f;

        Quaternion _targetRot = Quaternion.identity;
        Vector3 _targetPos = Vector3.zero;

        void Update()
        {
            float t = 1f - Mathf.Exp(-smooth * Time.deltaTime);
            transform.localRotation = Quaternion.Slerp(transform.localRotation, _targetRot, t);
            transform.localPosition = Vector3.Lerp(transform.localPosition, _targetPos, t);
        }

        public void SetTilt(TiltDirection? dir, bool active)
        {
            _targetRot = Quaternion.identity;
            _targetPos = Vector3.zero;

            if (!active || !dir.HasValue) return;

            switch (dir.Value)
            {
                // 화면 위로 굴림 (Z↓) → 위쪽 모서리를 들어 올림
                case TiltDirection.Up:
                    _targetRot = Quaternion.Euler(-tiltAngle, 0f, 0f);
                    _targetPos = new Vector3(0f, 0f, -shiftAmount);
                    break;
                case TiltDirection.Down:
                    _targetRot = Quaternion.Euler(tiltAngle, 0f, 0f);
                    _targetPos = new Vector3(0f, 0f, shiftAmount);
                    break;
                case TiltDirection.Left:
                    _targetRot = Quaternion.Euler(0f, 0f, tiltAngle);
                    _targetPos = new Vector3(-shiftAmount, 0f, 0f);
                    break;
                case TiltDirection.Right:
                    _targetRot = Quaternion.Euler(0f, 0f, -tiltAngle);
                    _targetPos = new Vector3(shiftAmount, 0f, 0f);
                    break;
            }
        }
    }
}
