import { InitGPU, CreateGPUBuffer } from './helper';
import { loadOBJ } from './objloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const objData  = await loadOBJ('./model.obj'); // ✅ keep async/fetch
    const camera   = new OrbitCamera(canvas);
    const renderer = new Renderer(device, canvas, context, format, camera, objData);
    renderer.start();
};

main();