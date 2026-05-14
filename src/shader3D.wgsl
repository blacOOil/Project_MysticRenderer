struct Uniforms {
    mvpMatrix : mat4x4<f32>,
    normalMatrix : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) normal         : vec3<f32>,
    @location(1) worldPos       : vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = uniforms.mvpMatrix * vec4<f32>(in.position, 1.0);
    out.normal   = normalize((uniforms.normalMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.worldPos = in.position;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir  = normalize(vec3<f32>(1.0, 2.0, 3.0));
    let diffuse   = max(dot(in.normal, lightDir), 0.0);
    let ambient   = 0.2;
    let color     = vec3<f32>(1.0, 1.0, 1.0); // model tint
    return vec4<f32>(color * (ambient + diffuse * 0.8), 1.0);
}