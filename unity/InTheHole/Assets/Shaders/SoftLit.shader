Shader "InTheHole/SoftLit"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
        _ShadeColor ("Shade", Color) = (0, 0, 0, 1)
        _LightBoost ("Light Boost", Range(0, 1)) = 0.55
        _Rim ("Rim", Range(0, 0.5)) = 0.12
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }
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
                half4 _ShadeColor;
                half _LightBoost;
                half _Rim;
            CBUFFER_END

            static const half3 kLightDir = half3(0.35, 0.92, 0.18);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                half3 normalWS : TEXCOORD0;
                half3 viewDirWS : TEXCOORD1;
            };

            Varyings vert(Attributes input)
            {
                Varyings o;
                float3 posWS = TransformObjectToWorld(input.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(posWS);
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.viewDirWS = normalize(_WorldSpaceCameraPos - posWS);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 n = normalize(i.normalWS);
                half ndl = saturate(dot(n, normalize(kLightDir)));
                half lit = lerp(0.38h, 1.0h, ndl * _LightBoost + (1.0h - _LightBoost) * 0.5h);
                half3 base = lerp(_ShadeColor.rgb, _Color.rgb, lit);
                half rim = pow(1.0h - saturate(dot(n, normalize(i.viewDirWS))), 2.5h) * _Rim;
                return half4(base + rim, 1.0h);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
