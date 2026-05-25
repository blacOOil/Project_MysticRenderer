export const CheckWebGPU = () => {
    let result = 'Great, your current browser supports WebGPU!';
    if (!navigator.gpu) {
        result = 'Your current browser does not support WebGPU!';
    }
    return result;
};

export const InitGPUForCanvas = async (canvas: HTMLCanvasElement) => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');

    const device  = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format  = navigator.gpu.getPreferredCanvasFormat();

    
    const container = canvas.parentElement!;
    canvas.width  = container.offsetWidth;
    canvas.height = container.offsetHeight;

    context.configure({ device, format, alphaMode: 'opaque' });
    return { device, canvas, format, context };
};

export const CreateGPUBuffer = (
    device: GPUDevice,
    data: Float32Array,
    usageFlag: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
) => {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: usageFlag,
        mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
};