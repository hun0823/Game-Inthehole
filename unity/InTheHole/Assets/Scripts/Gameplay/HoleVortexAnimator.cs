using UnityEngine;

namespace InTheHole.Gameplay
{
    public sealed class HoleVortexAnimator : MonoBehaviour
    {
        public float spinSpeed = 95f;
        public float pulseSpeed = 2.2f;

        Transform _ringA;
        Transform _ringB;

        public void SetRings(Transform ringA, Transform ringB)
        {
            _ringA = ringA;
            _ringB = ringB;
        }

        void Update()
        {
            transform.Rotate(0f, spinSpeed * Time.deltaTime, 0f, Space.Self);
            if (_ringA != null)
                _ringA.Rotate(0f, -spinSpeed * 0.65f * Time.deltaTime, 0f, Space.Self);
            if (_ringB != null)
                _ringB.Rotate(0f, spinSpeed * 0.45f * Time.deltaTime, 0f, Space.Self);
        }
    }
}
