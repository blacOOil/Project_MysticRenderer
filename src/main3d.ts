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

    const uniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({ code: shader }),
            entryPoint: 'vs_main',
            buffers: [
                { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
            ],
        },
        fragment: {
            module: device.createShaderModule({ code: shader }),
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // ---- Camera state ----
    let yaw      = 0;        // left/right orbit
    let pitch    = 0.3;      // up/down orbit
    let radius   = 3.0;      // zoom distance
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    // Mouse drag — orbit
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        yaw   += dx * 0.005;
        pitch += dy * 0.005;
        // clamp pitch so camera doesn't flip
        pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
    });

    // Scroll — zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        radius += e.deltaY * 0.01;
        radius = Math.max(0.5, Math.min(20.0, radius)); // clamp zoom
    }, { passive: false });

    // Touch support — orbit on mobile
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastPinchDist = 0;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY,
            );
        }
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - lastTouchX;
            const dy = e.touches[0].clientY - lastTouchY;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            yaw   += dx * 0.005;
            pitch += dy * 0.005;
            pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
        }
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY,
            );
            radius -= (dist - lastPinchDist) * 0.01;
            radius = Math.max(0.5, Math.min(20.0, radius));
            lastPinchDist = dist;
        }
    }, { passive: false });

    // ---- Render loop ----
    const render = () => {
        // Convert spherical coords to camera position
        const camX = radius * Math.sin(yaw) * Math.cos(pitch);
        const camY = radius * Math.sin(pitch);
        const camZ = radius * Math.cos(yaw) * Math.cos(pitch);

        const aspect = canvas.width / canvas.height;
        const proj   = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);
        const view   = mat4.lookAt(
            mat4.create(),
            vec3.fromValues(camX, camY, camZ),  // ✅ orbiting camera
            vec3.fromValues(0, 0, 0),
            vec3.fromValues(0, 1, 0),
        );
        const modelMat  = mat4.create(); // no rotation, camera orbits instead
        const mvp       = mat4.mul(mat4.create(), mat4.mul(mat4.create(), proj, view), modelMat);
        const normalMat = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), modelMat)!);

        device.queue.writeBuffer(uniformBuffer, 0,  new Float32Array(mvp));
        device.queue.writeBuffer(uniformBuffer, 64, new Float32Array(normalMat));

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