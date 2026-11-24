// Mặt đồng hồ chân trời nhân tạo: trời xanh / đất nâu, vạch góc ngóc, quay và trượt theo nghiêng/ngóc.
Shader "SaiCanh/Attitude"
{
    Properties
    {
        _Pitch ("Pitch (deg)", Float) = 0
        _Roll ("Roll (rad)", Float) = 0
        _Bright ("Brightness", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"
            float _Pitch, _Roll, _Bright;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert(appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord.xy * 2 - 1; return o; }
            float bar(float y, float w, float yc, float x) { return step(abs(y - yc), 0.008) * step(abs(x), w); }
            fixed4 frag(v2f i) : SV_Target
            {
                float s = sin(_Roll), c = cos(_Roll);
                float2 p = float2(c * i.uv.x - s * i.uv.y, s * i.uv.x + c * i.uv.y);
                float k = 0.022; // đơn vị / độ
                float y = p.y + _Pitch * k;
                float3 sky = lerp(float3(0.18,0.45,0.78), float3(0.05,0.22,0.5), saturate(y));
                float3 gnd = lerp(float3(0.45,0.28,0.13), float3(0.3,0.17,0.07), saturate(-y));
                float3 col = y > 0 ? sky : gnd;
                col = lerp(col, float3(1,1,1), step(abs(y), 0.01));
                float m = 0;
                for (int j = 1; j <= 4; j++)
                {
                    float deg = j * 5.0;
                    float w = (j % 2 == 0) ? 0.2 : 0.1;
                    m += bar(y, w, deg * k, p.x) + bar(y, w, -deg * k, p.x);
                }
                col = lerp(col, float3(1,1,1), saturate(m));
                return fixed4(col * _Bright, 1);
            }
            ENDCG
        }
    }
}
