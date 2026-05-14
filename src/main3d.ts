import { InitGPU } from './helper';
import { loadOBJ } from './objloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const camera = new OrbitCamera(canvas);

    // load default model
    const firstModel = await loadOBJ('./model.obj');
    const renderer   = new Renderer(device, canvas, context, format, camera, firstModel);
    renderer.start();

    // ---- Drag and drop ----
    const dropZone = document.getElementById('canvas-webgpu') as HTMLCanvasElement;

    // prevent browser from opening the file
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over'); //  visual feedback
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const file = e.dataTransfer?.files[0];
        if (!file) return;

        //  only accept .obj files
        if (!file.name.endsWith('.obj')) {
            alert('Only .obj files are supported.');
            return;
        }

        const text = await file.text();
        const objData = loadOBJ(text);
        renderer.loadModel(objData);
    });
};

main();