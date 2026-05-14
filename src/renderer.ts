import { mat4 } from 'gl-matrix';
import { CreateGPUBuffer } from './helper';
import { ModelData } from './objloader';
import { OrbitCamera } from './camera';
import shader from './shader3D.wgsl';

export class Renderer {
    private pipeline:      GPURenderPipeline;
    private bindGroup:     GPUBindGroup;
    private uniformBuffer: GPUBuffer;
    private vertexBuffer:  GPUBuffer;
    private normalBuffer:  GPUBuffer;
    private indexBuffer:   GPUBuffer;
    private depthTexture:  GPUTexture;
    private indexCount:    number;
    private animFrameId:   number = 0;

    constructor(
        private device:   GPUDevice,
        private canvas:   HTMLCanvasElement,
        private context:  GPUCanvasContext,
        private format:   GPUTextureFormat,
        private camera:   OrbitCamera,
        objData:          ModelData,
    ) {
        this.indexCount   = objData.indices.length;
        this.vertexBuffer = CreateGPUBuffer(device, objData.vertices);
        this.normalBuffer = CreateGPUBuffer(device, objData.normals);
        this.indexBuffer  = this.createIndexBuffer(objData.indices);
        this.uniformBuffer = this.createUniformBuffer();
        this.pipeline     = this.createPipeline();
        this.bindGroup    = this.createBindGroup();
        this.depthTexture = this.createDepthTexture();
    }

    private createIndexBuffer(indices: Uint16Array): GPUBuffer {
        const buffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint16Array(buffer.getMappedRange()).set(indices);
        buffer.unmap();
        return buffer;
    }

    private createUniformBuffer(): GPUBuffer {
        return this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    private createPipeline(): GPURenderPipeline {
        const shaderModule = this.device.createShaderModule({ code: shader });
        return this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.format }],
            },
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
        });
    }

    private createBindGroup(): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
    }

    private createDepthTexture(): GPUTexture {
        return this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    private updateUniforms() {
        const aspect   = this.canvas.width / this.canvas.height;
        const proj     = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);
        const view     = this.camera.getViewMatrix();
        const modelMat = mat4.create();
        const mvp      = mat4.mul(mat4.create(), mat4.mul(mat4.create(), proj, view), modelMat);
        const normalMat = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), modelMat)!);

        this.device.queue.writeBuffer(this.uniformBuffer, 0,  new Float32Array(mvp));
        this.device.queue.writeBuffer(this.uniformBuffer, 64, new Float32Array(normalMat));
    }

    private refreshDepthTexture() {
        if (
            this.depthTexture.width  !== this.canvas.width ||
            this.depthTexture.height !== this.canvas.height
        ) {
            this.depthTexture.destroy();
            this.depthTexture = this.createDepthTexture();
        }
    }

    private frame() {
        this.updateUniforms();
        this.refreshDepthTexture();

        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setVertexBuffer(1, this.normalBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
        renderPass.drawIndexed(this.indexCount);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        this.animFrameId = requestAnimationFrame(() => this.frame());
    }

    start() {
        this.animFrameId = requestAnimationFrame(() => this.frame());
    }

    stop() {
        cancelAnimationFrame(this.animFrameId);
    }

    destroy() {
        this.stop();
        this.vertexBuffer.destroy();
        this.normalBuffer.destroy();
        this.indexBuffer.destroy();
        this.uniformBuffer.destroy();
        this.depthTexture.destroy();
    }
    loadModel(objData: ModelData) {
    // destroy old buffers
    this.vertexBuffer.destroy();
    this.normalBuffer.destroy();
    this.indexBuffer.destroy();

    // create new buffers from new model
    this.indexCount   = objData.indices.length;
    this.vertexBuffer = CreateGPUBuffer(this.device, objData.vertices);
    this.normalBuffer = CreateGPUBuffer(this.device, objData.normals);
    this.indexBuffer  = this.createIndexBuffer(objData.indices);
}
}