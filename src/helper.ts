export const CheckWebGPU = () => {
    let result = 'Great, your current browser supports WebGPU!';
    if (!navigator.gpu) {
        result = `Your current browser does not support WebGPU! Make sure you are on a system 
                    with WebGPU enabled. Currently, WebGPU is supported in  
                    <a href="https://www.google.com/chrome/canary/">Chrome canary</a>
                    with the flag "enable-unsafe-webgpu" enabled. See the 
                    <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"> 
                    Implementation Status</a> page for more details.`;
    }

    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    if (canvas) {
        const div = document.getElementsByClassName('item2')[0] as HTMLDivElement;

        const resizeCanvas = () => {
            canvas.width  = div.offsetWidth;
            canvas.height = div.offsetHeight;
        };

        resizeCanvas(); //  set immediately
        window.addEventListener('resize', resizeCanvas);
    }
    return result;
};

export const InitGPU = async () => {
    const checkgpu = CheckWebGPU();
    if (checkgpu.includes('Your current browser does not support WebGPU!')) {
        console.log(checkgpu);
        throw('Your current browser does not support WebGPU!');
    }

    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;

    //  null-safe adapter + device acquisition
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    //  replaces deprecated context.getPreferredFormat(adapter)
    const format = navigator.gpu.getPreferredCanvasFormat();

    //  size removed (deprecated), canvas sized via CSS/CheckWebGPU
    context.configure({
        device,
        format,
        alphaMode: 'opaque', //  prevents black compositing
    });

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