namespace InTheHole.Core
{
    public readonly struct ButtonDef
    {
        public int Row { get; }
        public int Col { get; }
        public string Color { get; }

        public ButtonDef(int row, int col, string color)
        {
            Row = row;
            Col = col;
            Color = color;
        }
    }
}
