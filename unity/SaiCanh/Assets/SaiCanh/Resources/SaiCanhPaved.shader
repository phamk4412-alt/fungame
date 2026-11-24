// Mặt nhựa đường / vạch sơn nằm sát mặt đất: shader Standard có dịch độ sâu (Offset) để không nhấp nháy.
Shader "SaiCanh/Paved"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Albedo", 2D) = "white" {}
        _Glossiness ("Smoothness", Range(0,1)) = 0.12
        _Emission ("Emission", Color) = (0,0,0,0)
        _Offset ("Depth Offset", Float) = -1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry+1" }
        Offset [_Offset], [_Offset]
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        sampler2D _MainTex; fixed4 _Color; half _Glossiness; fixed4 _Emission;
        struct Input { float2 uv_MainTex; };
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            fixed4 c = tex2D(_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = c.rgb; o.Smoothness = _Glossiness; o.Metallic = 0; o.Alpha = 1;
            o.Emission = _Emission.rgb;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
