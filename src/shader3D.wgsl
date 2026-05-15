struct Uniforms {
    mvpMatrix    : mat4x4<f32>,
    normalMatrix : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms  : Uniforms;
@group(0) @binding(1) var          mySampler : sampler;       // 
@group(0) @binding(2) var          myTexture : texture_2d<f32>; // 

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,
    @location(2) color    : vec3<f32>,
    @location(3) uv       : vec2<f32>, // 
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) normal         : vec3<f32>,
    @location(1) worldPos       : vec3<f32>,
    @location(2) color          : vec3<f32>,
    @location(3) uv             : vec2<f32>, // 
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = uniforms.mvpMatrix * vec4<f32>(in.position, 1.0);
    out.normal   = normalize((uniforms.normalMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.worldPos = in.position;
    out.color    = in.color;
    out.uv       = in.uv; // 
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(vec3<f32>(1.0, 2.0, 3.0));
    let viewDir  = normalize(-in.worldPos);
    let halfDir  = normalize(lightDir + viewDir);

    let diffuse  = max(dot(in.normal, lightDir), 0.0);
    let specular = pow(max(dot(in.normal, halfDir), 0.0), 32.0) * 0.3;
    let ambient  = 0.2;

    //  sample texture and multiply with vertex color
    let texColor = textureSample(myTexture, mySampler, in.uv).rgb;
    let baseColor = in.color * texColor;

    let finalColor = baseColor * (ambient + diffuse * 0.8) + vec3<f32>(specular);
    return vec4<f32>(finalColor, 1.0);
}