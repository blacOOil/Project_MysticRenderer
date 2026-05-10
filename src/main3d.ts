import { InitGPU, CreateGPUBuffer } from './helper';
import { loadOBJ } from './objloader';
import shader from './shader3D.wgsl';
import { mat4, vec3 } from 'gl-matrix';
import './site.css';
const Render3DModel = async () => {
    const { device, canvas, format, context } = await InitGPU();

    const objData = await loadOBJ('./model.obj');

    // --- Buffers ---
    const vertexBuffer = CreateGPUBuffer(device, objData.vertices);
    const normalBuffer = CreateGPUBuffer(device, objData.normals);

    const indexBuffer = device.createBuffer({
        size: objData.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(objData.indices);
    indexBuffer.unmap();

    // --- Uniform buffer ---
    const uniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // --- Pipeline ---
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({ code: shader }),
            entryPoint: 'vs_main',
            buffers: [
                {
                    arrayStride: 12,
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                },
                {
                    arrayStride: 12,
                    attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({ code: shader }),
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less',
        },
    });

    // --- Bind group ---
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // --- Depth texture ---
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    let rotation = 0;

    const render = () => {
        rotation += 0.00;

        const aspect    = canvas.width / canvas.height;
        const proj      = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);
        const view      = mat4.lookAt(
            mat4.create(),
            vec3.fromValues(0, 1, 3),
            vec3.fromValues(0, 0, 0),
            vec3.fromValues(0, 1, 0),
        );
        const modelMat  = mat4.rotateY(mat4.create(), mat4.create(), rotation);
        const mvp       = mat4.mul(mat4.create(), mat4.mul(mat4.create(), proj, view), modelMat);
        const normalMat = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), modelMat)!);

        device.queue.writeBuffer(uniformBuffer, 0,  new Float32Array(mvp));
        device.queue.writeBuffer(uniformBuffer, 64, new Float32Array(normalMat));

        // --- Recreate depth texture on resize ---
        if (depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
            depthTexture.destroy();
            depthTexture = device.createTexture({
                size: [canvas.width, canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }

        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, normalBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');
        renderPass.drawIndexed(objData.indices.length);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

Render3DModel();