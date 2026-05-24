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
    private colorBuffer:   GPUBuffer;
    private uvBuffer:      GPUBuffer; // 
    private indexBuffer:   GPUBuffer;
    private depthTexture:  GPUTexture;
    private indexCount:    number;
    private indexFormat:   GPUIndexFormat = 'uint32';
    private animFrameId:   number = 0;
    private modelRotation: [number, number, number] = [0, 0, 0];

    private lightBuffer: GPUBuffer; // 
    private lightDir:    [number, number, number] = [1.0, 2.0, 3.0];
    private lightColor:  [number, number, number] = [1.0, 1.0, 1.0];
    private ambient:     number = 0.2;

    //  texture resources
    private gpuTexture:  GPUTexture | null = null;
    private sampler:     GPUSampler;
    private hasTexture:  boolean = false;



    constructor(
        private device:   GPUDevice,
        private canvas:   HTMLCanvasElement,
        private context:  GPUCanvasContext,
        private format:   GPUTextureFormat,
        private camera:   OrbitCamera,
        objData:          ModelData,
    ) {
        this.sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });

        this.indexCount    = objData.indices.length;
        this.indexFormat   = objData.indices instanceof Uint32Array ? 'uint32' : 'uint16';
        this.vertexBuffer  = CreateGPUBuffer(device, objData.vertices);
        this.normalBuffer  = CreateGPUBuffer(device, objData.normals);
        this.colorBuffer   = CreateGPUBuffer(device, this.extractColors(objData));
        this.uvBuffer      = CreateGPUBuffer(device, objData.uvs ?? new Float32Array(objData.vertices.length / 3 * 2));
        this.indexBuffer   = this.createIndexBuffer(objData.indices);
        this.uniformBuffer = this.createUniformBuffer();
        this.pipeline      = this.createPipeline();

        this.lightBuffer   = this.createLightBuffer();
        this.gpuTexture    = this.createDefaultTexture();
        this.bindGroup     = this.createBindGroup();
        this.depthTexture  = this.createDepthTexture();

        this.uploadTexture(objData);
    }

    //  create a 1x1 white fallback texture
    private createDefaultTexture(): GPUTexture {
        const tex = this.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this.device.queue.writeTexture(
            { texture: tex },
            new Uint8Array([255, 255, 255, 255]),
            { bytesPerRow: 4 },
            [1, 1],
        );
        return tex;
    }
    private createLightBuffer(): GPUBuffer {
    return this.device.createBuffer({
        size: 32, // vec3 lightDir (12) + pad (4) + vec3 lightColor (12) + ambient (4)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
    private updateLightBuffer() {
    const data = new Float32Array([
        ...this.lightDir,   this.ambient,   // offset 0  — xyz + ambient packed
        ...this.lightColor, 0.0,            // offset 16 — rgb + padding
    ]);
    this.device.queue.writeBuffer(this.lightBuffer, 0, data);
}
    setLightDirection(x: number, y: number, z: number) {
    this.lightDir = [x, y, z];
}

    setLightColor(r: number, g: number, b: number) {
    this.lightColor = [r, g, b];
}

    setAmbient(value: number) {
    this.ambient = Math.max(0, Math.min(1, value));
}

    //  upload ImageBitmap texture to GPU if present
    private uploadTexture(objData: ModelData) {
        const bitmap = objData.materials?.find(m => m.texture)?.texture;
        if (!bitmap) {
            this.hasTexture = false;
            return;
        }

        if (this.gpuTexture) this.gpuTexture.destroy();

        this.gpuTexture = this.device.createTexture({
            size: [bitmap.width, bitmap.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: this.gpuTexture },
            [bitmap.width, bitmap.height],
        );

        this.hasTexture = true;
        this.bindGroup  = this.createBindGroup(); //  rebuild with new texture
    }

    private extractColors(objData: ModelData): Float32Array {
        if (!objData.materials || objData.materials.length === 0) {
            const count = objData.vertices.length / 3;
            const colors = new Float32Array(count * 3).fill(0.8);
            return colors;
        }
        const colors: number[] = [];
        for (const mat of objData.materials) {
            colors.push(...mat.diffuse);
        }
        return new Float32Array(colors);
    }
    private clearColor = { r: 0.1, g: 0.1, b: 0.15, a: 1.0 };

    setBackgroundColor(r: number, g: number, b: number) {
    this.clearColor = { r, g, b, a: 1.0 };
    }

    private createIndexBuffer(indices: Uint16Array | Uint32Array): GPUBuffer {
        const buffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        if (indices instanceof Uint32Array) {
            new Uint32Array(buffer.getMappedRange()).set(indices);
        } else {
            new Uint16Array(buffer.getMappedRange()).set(indices);
        }
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
                    { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }] },
                    { arrayStride: 8,  attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x2' }] }, // ✅ UV
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
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.sampler },                        // 
                { binding: 2, resource: this.gpuTexture!.createView() },       // 
                { binding: 3, resource: { buffer: this.lightBuffer } },
            ],
        });
    }

    private createDepthTexture(): GPUTexture {
        return this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    setRotation(x: number, y: number, z: number) {
        this.modelRotation = [x, y, z];
    }

    private updateUniforms() {
        const aspect   = this.canvas.width / this.canvas.height;
        const proj     = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);
        const view     = this.camera.getViewMatrix();
        let modelMat   = mat4.create();
        mat4.rotateX(modelMat, modelMat, this.modelRotation[0]);
        mat4.rotateY(modelMat, modelMat, this.modelRotation[1]);
        mat4.rotateZ(modelMat, modelMat, this.modelRotation[2]);

        const mvp       = mat4.mul(mat4.create(), mat4.mul(mat4.create(), proj, view), modelMat);
        const normalMat = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), modelMat)!);

        this.device.queue.writeBuffer(this.uniformBuffer, 0,  new Float32Array(mvp));
        this.device.queue.writeBuffer(this.uniformBuffer, 64, new Float32Array(normalMat));
    }

    private refreshDepthTexture() {
        if (this.depthTexture.width !== this.canvas.width ||
            this.depthTexture.height !== this.canvas.height) {
            this.depthTexture.destroy();
            this.depthTexture = this.createDepthTexture();
        }
    }

    private frame() {
        this.updateUniforms();
        this.updateLightBuffer(); 
        this.refreshDepthTexture();

        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: this.clearColor,
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
        renderPass.setVertexBuffer(2, this.colorBuffer);
        renderPass.setVertexBuffer(3, this.uvBuffer);       // 
        renderPass.setIndexBuffer(this.indexBuffer, this.indexFormat);
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

    loadModel(objData: ModelData) {
        this.vertexBuffer.destroy();
        this.normalBuffer.destroy();
        this.colorBuffer.destroy();
        this.uvBuffer.destroy();
        this.indexBuffer.destroy();

        this.indexCount   = objData.indices.length;
        this.indexFormat  = objData.indices instanceof Uint32Array ? 'uint32' : 'uint16';
        this.vertexBuffer = CreateGPUBuffer(this.device, objData.vertices);
        this.normalBuffer = CreateGPUBuffer(this.device, objData.normals);
        this.colorBuffer  = CreateGPUBuffer(this.device, this.extractColors(objData));
        this.uvBuffer     = CreateGPUBuffer(this.device, objData.uvs ?? new Float32Array(objData.vertices.length / 3 * 2));
        this.indexBuffer  = this.createIndexBuffer(objData.indices);

        this.uploadTexture(objData); //  upload new texture
    }

    destroy() {
        this.stop();
        this.vertexBuffer.destroy();
        this.normalBuffer.destroy();
        this.colorBuffer.destroy();
        this.uvBuffer.destroy();
        this.indexBuffer.destroy();
        this.uniformBuffer.destroy();
        this.lightBuffer.destroy();
        this.depthTexture.destroy();
        this.gpuTexture?.destroy();
    }
}