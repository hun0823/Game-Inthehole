using UnityEngine;

using UnityEngine.UI;



namespace InTheHole.Gameplay

{

    public static class HudTextStyle

    {

        public static void Apply(Text t, bool richText = false)

        {

            if (t == null) return;

            t.resizeTextForBestFit = false;



            if (t.GetComponent<Outline>() == null)

            {

                var outline = t.gameObject.AddComponent<Outline>();

                outline.effectColor = new Color(0.02f, 0.05f, 0.14f, richText ? 0.95f : 0.8f);

                outline.effectDistance = new Vector2(2f, -2f);

            }



            if (richText)

                return;



            if (t.GetComponent<Shadow>() == null)

            {

                var shadow = t.gameObject.AddComponent<Shadow>();

                shadow.effectColor = new Color(0f, 0f, 0.05f, 0.45f);

                shadow.effectDistance = new Vector2(1f, -1f);

            }

        }

    }

}


