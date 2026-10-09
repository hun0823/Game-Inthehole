using UnityEngine;

namespace InTheHole.Gameplay
{
    /// <summary>버튼 칸 탭 → GameSession.TryPressButtonAt.</summary>
    public sealed class ButtonCell : MonoBehaviour
    {
        public int Row { get; private set; }
        public int Col { get; private set; }

        GameSession _session;

        public void Init(GameSession session, int row, int col)
        {
            _session = session;
            Row = row;
            Col = col;
        }

        void OnMouseDown()
        {
            _session?.TryPressButtonAt(Row, Col);
        }
    }
}
