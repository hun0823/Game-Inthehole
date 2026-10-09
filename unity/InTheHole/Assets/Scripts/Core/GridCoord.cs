using System;

namespace InTheHole.Core
{
    [Serializable]
    public struct GridCoord
    {
        public int Row;
        public int Col;

        public GridCoord(int row, int col)
        {
            Row = row;
            Col = col;
        }

        public override string ToString() => $"({Row},{Col})";
    }
}
