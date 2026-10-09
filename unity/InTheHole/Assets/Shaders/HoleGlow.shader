Shader "InTheHole/HoleGlow"
{
    Properties
    {
        _Color ("Color", Color) = (0.2, 0.9, 0.8, 1)
        _GlowColor ("Glow", Color) = (0.6, 1, 0.95, 1)
        _PulseSpeed ("Pulse", Float) = 2.5
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry+10" }
        Pass
        {
            Tags { "LightMode" = "UniversalForward" }
            ZWrite On
            Cull Back
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _Color;
                half4 _GlowColor;
                half _PulseSpeed;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; half3 n : TEXCOORD0; };

            Varyings vert(Attributes input)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.n = TransformObjectToWorldNormal(input.normalOS);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half pulse = 0.65h + 0.35h * sin(_Time.y * _PulseSpeed);
                half rim = pow(saturate(1.0h - abs(i.n.y)), 1.8h);
                half3 col = lerp(_Color.rgb, _GlowColor.rgb, rim * pulse);
                return half4(col * (0.85h + pulse * 0.25h), 1.0h);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
