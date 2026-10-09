namespace InTheHole.Core
{
    public readonly struct ColoredEdge
    {
        public bool IsHorizontal { get; }
        public int Row { get; }
        public int Col { get; }
        public string Color { get; }

        public ColoredEdge(bool isHorizontal, int row, int col, string color)
        {
            IsHorizontal = isHorizontal;
            Row = row;
            Col = col;
            Color = color;
        }
    }
}
